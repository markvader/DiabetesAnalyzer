import { roundToDecimal } from '../utils/mathUtils';
import { toMmol, GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { analyzeWithAI } from './aiEnhancedAnalysisService';
import { InsulinPumpProfile, getPumpById } from '../constants/insulinPumps';

// Define types for analysis
interface BGReading {
  sgv: number;
  date: number;
  dateString: string;
}

interface Treatment {
  insulin?: number;
  carbs?: number;
  eventType: string;
  created_at: string;
}

interface TimeSegment {
  time: string;
  rate: number;
}

interface Profile {
  basal: TimeSegment[];
  carbratio: TimeSegment[];
  sens: TimeSegment[]; // ISF
}

interface AnalysisResults {
  basalSuggestions: TimeSegment[];
  isfSuggestions: TimeSegment[];
  carbRatioSuggestions: TimeSegment[];
  averageBG: number;
  timeInRange: number;
  highPercentage: number;
  lowPercentage: number;
  currentProfile: Profile;
  carbPatterns: {
    timeOfDay: string;
    avgCarbs: number;
    avgGlucoseResponse: number;
    frequency: number;
  }[];
  aiEnhanced?: any;
  safetyWarnings: string[];
  pumpProfile?: InsulinPumpProfile | null;
}

// Constants for analysis - MUCH MORE CONSERVATIVE
const TARGET_BG_MIN = GLUCOSE_RANGES.TARGET_MIN;
const TARGET_BG_MAX = GLUCOSE_RANGES.TARGET_MAX;
const HIGH_BG_THRESHOLD = GLUCOSE_RANGES.HIGH_THRESHOLD;
const LOW_BG_THRESHOLD = GLUCOSE_RANGES.LOW_THRESHOLD;

// ULTRA-CONSERVATIVE adjustment factors (reduced from previous values)
const ADJUSTMENT_FACTOR_BASAL = 0.05; // Reduced from 0.1 to 0.05 (5% max adjustment)
const ADJUSTMENT_FACTOR_ISF = 0.05; // Reduced from 0.15 to 0.05 (5% max adjustment)
const ADJUSTMENT_FACTOR_CARB_RATIO = 0.05; // Reduced from 0.1 to 0.05 (5% max adjustment)

// Pump-aware basal rounding function
function roundBasalRate(rate: number, pump?: InsulinPumpProfile | null): number {
  const increment = pump?.basalIncrements || 0.05; // Default to OmniPod
  return Math.round(rate / increment) * increment;
}

// Group readings by time of day
function groupReadingsByTimeOfDay(readings: BGReading[]) {
  const timeGroups: { [key: string]: number[] } = {};
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  hours.forEach(hour => {
    timeGroups[`${hour}`] = [];
  });
  
  readings.forEach(reading => {
    const date = new Date(reading.date);
    const hour = date.getHours();
    timeGroups[`${hour}`].push(reading.sgv);
  });
  
  return timeGroups;
}

// Calculate time in range percentage
function calculateTimeInRange(readings: BGReading[]) {
  if (!readings.length) return { inRange: 0, high: 0, low: 0 };
  
  const inRange = readings.filter(r => {
    const mmol = toMmol(r.sgv);
    return mmol >= TARGET_BG_MIN && mmol <= TARGET_BG_MAX;
  }).length;
  
  const high = readings.filter(r => toMmol(r.sgv) > TARGET_BG_MAX).length;
  const low = readings.filter(r => toMmol(r.sgv) < TARGET_BG_MIN).length;
  
  return {
    inRange: (inRange / readings.length) * 100,
    high: (high / readings.length) * 100,
    low: (low / readings.length) * 100
  };
}

// Get active profile from Nightscout data
function getActiveProfile(profiles: any[]): Profile | null {
  if (!profiles?.length) return null;

  const sortedProfiles = [...profiles].sort((a, b) => {
    const dateA = new Date(a.startDate || 0).getTime();
    const dateB = new Date(b.startDate || 0).getTime();
    return dateB - dateA;
  });

  const activeProfile = sortedProfiles[0];
  if (!activeProfile) return null;

  const defaultProfile = activeProfile.defaultProfile || 'Default';
  const profileData = activeProfile.store?.[defaultProfile];

  if (!profileData) return null;

  const convertTimeSegments = (segments: any[]): TimeSegment[] => {
    if (!Array.isArray(segments)) return [];
    return segments.map(segment => ({
      time: segment.time,
      rate: Number(segment.value)
    }));
  };

  return {
    basal: convertTimeSegments(profileData.basal || []),
    carbratio: convertTimeSegments(profileData.carbratio || []),
    sens: convertTimeSegments(profileData.sens || [])
  };
}

// ULTRA-CONSERVATIVE basal analysis with safety-first approach
function analyzeBasalRates(readings: BGReading[], currentProfile: Profile, safetyWarnings: string[], pumpProfile?: InsulinPumpProfile | null): TimeSegment[] {
  const timeGroups = groupReadingsByTimeOfDay(readings);
  const adjustedBasals: TimeSegment[] = [];
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  
  currentProfile.basal.forEach(basal => {
    const hour = parseInt(basal.time.split(':')[0]);
    const bgValues = timeGroups[`${hour}`];
    
    if (bgValues.length > 0) {
      const avgBG = bgValues.reduce((sum, bg) => sum + bg, 0) / bgValues.length;
      const avgBGMmol = toMmol(avgBG);
      const lowReadings = bgValues.filter(bg => toMmol(bg) < 3.9).length;
      const lowPercentage = (lowReadings / bgValues.length) * 100;
      
      let adjustmentFactor = 0;
      
      // SAFETY FIRST: If ANY hypoglycemia in this time period, reduce basal
      if (lowPercentage > 0) {
        adjustmentFactor = -ADJUSTMENT_FACTOR_BASAL * 2; // Double reduction for any hypos
        safetyWarnings.push(`Hypoglycemia detected at ${basal.time} - reducing basal rate`);
      } else if (hypoglycemiaRisk > 10) {
        // High overall hypoglycemia risk - be very conservative
        if (avgBGMmol < 6.0) {
          adjustmentFactor = -ADJUSTMENT_FACTOR_BASAL;
        } else if (avgBGMmol > 12.0) {
          adjustmentFactor = ADJUSTMENT_FACTOR_BASAL * 0.5; // Very small increase only
        }
      } else {
        // Lower risk but still conservative
        if (avgBGMmol < 5.0) {
          adjustmentFactor = -ADJUSTMENT_FACTOR_BASAL;
        } else if (avgBGMmol > 12.0) {
          adjustmentFactor = ADJUSTMENT_FACTOR_BASAL;
        } else if (avgBGMmol > 10.0) {
          adjustmentFactor = ADJUSTMENT_FACTOR_BASAL * 0.5;
        }
      }
      
      // Ensure minimum basal rate
      const newRate = Math.max(0.05, roundBasalRate(basal.rate * (1 + adjustmentFactor), pumpProfile));
      adjustedBasals.push({ time: basal.time, rate: newRate });
    } else {
      adjustedBasals.push({ ...basal });
    }
  });
  
  return adjustedBasals;
}

// ULTRA-CONSERVATIVE ISF analysis
function analyzeISF(readings: BGReading[], treatments: Treatment[], currentProfile: Profile, safetyWarnings: string[]): TimeSegment[] {
  const timeGroups = groupReadingsByTimeOfDay(readings);
  const adjustedISF: TimeSegment[] = [];
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);

  currentProfile.sens.forEach(sens => {
    const hour = parseInt(sens.time.split(':')[0]);
    const bgValues = timeGroups[`${hour}`];
    
    if (bgValues.length > 0) {
      const avgBG = bgValues.reduce((sum, bg) => sum + bg, 0) / bgValues.length;
      const avgBGMmol = toMmol(avgBG);
      const lowReadings = bgValues.filter(bg => toMmol(bg) < 3.9).length;
      const lowPercentage = (lowReadings / bgValues.length) * 100;
      
      let adjustmentFactor = 0;
      
      // SAFETY FIRST: If ANY hypoglycemia, make ISF less aggressive (higher value)
      if (lowPercentage > 0) {
        adjustmentFactor = ADJUSTMENT_FACTOR_ISF * 2; // Make ISF much less aggressive
        safetyWarnings.push(`Hypoglycemia detected at ${sens.time} - making ISF less aggressive`);
      } else if (hypoglycemiaRisk > 10) {
        // High overall risk - be conservative
        adjustmentFactor = ADJUSTMENT_FACTOR_ISF; // Less aggressive ISF
      } else {
        // Lower risk but still conservative
        if (avgBGMmol > 12.0) {
          adjustmentFactor = -ADJUSTMENT_FACTOR_ISF * 0.5; // Very small increase in aggressiveness
        } else if (avgBGMmol < 6.0) {
          adjustmentFactor = ADJUSTMENT_FACTOR_ISF; // Less aggressive
        }
      }
      
      const newRate = roundToDecimal(sens.rate * (1 + adjustmentFactor), 1);
      adjustedISF.push({ time: sens.time, rate: newRate });
    } else {
      adjustedISF.push({ ...sens });
    }
  });
  
  return adjustedISF;
}

// Calculate hypoglycemia risk score
function calculateHypoglycemiaRisk(readings: BGReading[]): number {
  const lowReadings = readings.filter(r => toMmol(r.sgv) < 3.9).length;
  const severelyLowReadings = readings.filter(r => toMmol(r.sgv) < 3.0).length;
  const total = readings.length;
  
  const lowPercentage = (lowReadings / total) * 100;
  const severePercentage = (severelyLowReadings / total) * 100;
  
  return lowPercentage + (severePercentage * 2); // Weight severe hypos more heavily
}

// ULTRA-CONSERVATIVE carb ratio analysis
function analyzeCarbAnnouncements(
  readings: BGReading[], 
  treatments: Treatment[], 
  currentProfile: Profile,
  safetyWarnings: string[]
): { carbRatioSuggestions: TimeSegment[]; carbPatterns: any[] } {
  const adjustedCarbRatio: TimeSegment[] = [];
  const carbPatterns: any[] = [];
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  
  // Group carb announcements by hour
  const carbsByHour: { [key: string]: { carbs: number[]; responses: number[]; hypos: number } } = {};
  
  treatments.forEach(treatment => {
    if (treatment.carbs && treatment.carbs > 0) {
      const hour = new Date(treatment.created_at).getHours();
      const response = calculateGlucoseResponse(readings, treatment.created_at);
      const hasPostMealHypo = checkPostMealHypoglycemia(readings, treatment.created_at);
      
      if (!carbsByHour[hour]) {
        carbsByHour[hour] = { carbs: [], responses: [], hypos: 0 };
      }
      
      carbsByHour[hour].carbs.push(treatment.carbs);
      if (response) {
        carbsByHour[hour].responses.push(response);
      }
      if (hasPostMealHypo) {
        carbsByHour[hour].hypos++;
      }
    }
  });
  
  currentProfile.carbratio.forEach(ratio => {
    const hour = parseInt(ratio.time.split(':')[0]);
    const hourData = carbsByHour[hour];
    
    if (hourData && hourData.carbs.length > 0) {
      const avgCarbs = average(hourData.carbs);
      const avgResponse = hourData.responses.length ? average(hourData.responses) : 0;
      const hypoRate = (hourData.hypos / hourData.carbs.length) * 100;
      
      let adjustmentFactor = 0;
      
      // SAFETY FIRST: If ANY post-meal hypoglycemia, make ratio less aggressive
      if (hypoRate > 0) {
        adjustmentFactor = ADJUSTMENT_FACTOR_CARB_RATIO * 2; // Much less aggressive
        safetyWarnings.push(`Post-meal hypoglycemia detected at ${ratio.time} - making carb ratio less aggressive`);
      } else if (hypoglycemiaRisk > 10) {
        // High overall risk - be conservative
        if (avgResponse < 30) {
          adjustmentFactor = ADJUSTMENT_FACTOR_CARB_RATIO; // Less aggressive
        }
      } else {
        // Lower risk but still conservative
        if (avgResponse > 80) {
          adjustmentFactor = -ADJUSTMENT_FACTOR_CARB_RATIO * 0.5; // Very small increase in aggressiveness
        } else if (avgResponse < 30) {
          adjustmentFactor = ADJUSTMENT_FACTOR_CARB_RATIO; // Less aggressive
        }
      }
      
      const newRate = roundToDecimal(ratio.rate * (1 + adjustmentFactor), 1);
      adjustedCarbRatio.push({ time: ratio.time, rate: newRate });
      
      carbPatterns.push({
        timeOfDay: `${hour.toString().padStart(2, '0')}:00`,
        avgCarbs: roundToDecimal(avgCarbs, 1),
        avgGlucoseResponse: roundToDecimal(avgResponse, 1),
        frequency: hourData.carbs.length
      });
    } else {
      adjustedCarbRatio.push({ ...ratio });
    }
  });
  
  return { carbRatioSuggestions: adjustedCarbRatio, carbPatterns };
}

// Check for post-meal hypoglycemia
function checkPostMealHypoglycemia(readings: BGReading[], mealTime: string): boolean {
  const timestamp = new Date(mealTime).getTime();
  const postMealReadings = readings.filter(r =>
    r.date > timestamp &&
    r.date <= timestamp + 4 * 60 * 60 * 1000 // 4 hours post-meal
  );
  
  return postMealReadings.some(r => toMmol(r.sgv) < 3.9);
}

// Calculate glucose response after carb announcement
function calculateGlucoseResponse(readings: BGReading[], announcementTime: string): number {
  const timestamp = new Date(announcementTime).getTime();
  const preReadings = readings.filter(r => 
    r.date >= timestamp - 30 * 60 * 1000 && 
    r.date <= timestamp
  );
  
  const postReadings = readings.filter(r =>
    r.date >= timestamp &&
    r.date <= timestamp + 3 * 60 * 60 * 1000
  );
  
  if (preReadings.length === 0 || postReadings.length === 0) return 0;
  
  const preAvg = average(preReadings.map(r => r.sgv));
  const postMax = Math.max(...postReadings.map(r => r.sgv));
  
  return postMax - preAvg;
}

function average(numbers: number[]): number {
  return numbers.length === 0 ? 0 : numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

// Main analysis function with AI enhancement
export async function analyzeData(data: any, pumpId?: string): Promise<AnalysisResults | null> {
  if (!data || !data.entries || !data.profile || !data.treatments) {
    return null;
  }

  const currentProfile = getActiveProfile(data.profile);
  if (!currentProfile) {
    return null;
  }

  // Get pump profile for pump-aware calculations
  const pumpProfile = pumpId ? getPumpById(pumpId) : null;

  const readings = data.entries as BGReading[];
  const treatments = data.treatments as Treatment[];
  const safetyWarnings: string[] = [];
  
  // Add pump-specific warnings
  if (pumpProfile) {
    if (!pumpProfile.aapsSupported) {
      safetyWarnings.push(`WARNING: ${pumpProfile.name} may require manual configuration in AAPS`);
    }
  }
  
  // Calculate basic stats
  const avgBG = readings.length 
    ? roundToDecimal(readings.reduce((sum, r) => sum + r.sgv, 0) / readings.length, 0)
    : 0;
  
  const timeInRangeStats = calculateTimeInRange(readings);
  
  // Check for critical safety issues
  if (timeInRangeStats.low > 4) {
    safetyWarnings.push('CRITICAL: More than 4% time below range detected. Consider reducing all insulin doses.');
  } else if (timeInRangeStats.low > 2) {
    safetyWarnings.push('WARNING: Elevated hypoglycemia risk detected. Use extreme caution with any changes.');
  }
  
  // Get AI-enhanced analysis
  let aiEnhanced;
  try {
    aiEnhanced = await analyzeWithAI(readings, treatments, currentProfile);
    
    // Use AI suggestions if available and safe
    if (aiEnhanced.hypoglycemiaRisk < 20 && aiEnhanced.safetyScore > 60) {
      return {
        basalSuggestions: aiEnhanced.basalSuggestions,
        isfSuggestions: aiEnhanced.isfSuggestions,
        carbRatioSuggestions: aiEnhanced.carbRatioSuggestions,
        averageBG: avgBG,
        timeInRange: timeInRangeStats.inRange,
        highPercentage: timeInRangeStats.high,
        lowPercentage: timeInRangeStats.low,
        currentProfile,
        carbPatterns: [],
        aiEnhanced,
        safetyWarnings: [...safetyWarnings, ...aiEnhanced.aiInsights.safetyWarnings],
        pumpProfile
      };
    }
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
    safetyWarnings.push('AI analysis unavailable - using ultra-conservative fallback');
  }
  
  // Fallback to ultra-conservative analysis
  const basalSuggestions = analyzeBasalRates(readings, currentProfile, safetyWarnings, pumpProfile);
  const isfSuggestions = analyzeISF(readings, treatments, currentProfile, safetyWarnings);
  const { carbRatioSuggestions, carbPatterns } = analyzeCarbAnnouncements(readings, treatments, currentProfile, safetyWarnings);
  
  return {
    basalSuggestions,
    isfSuggestions,
    carbRatioSuggestions,
    averageBG: avgBG,
    timeInRange: timeInRangeStats.inRange,
    highPercentage: timeInRangeStats.high,
    lowPercentage: timeInRangeStats.low,
    currentProfile,
    carbPatterns,
    aiEnhanced,
    safetyWarnings,
    pumpProfile
  };
}