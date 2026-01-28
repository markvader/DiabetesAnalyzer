// AI-Enhanced Analysis for Basal, ISF, and Carb Ratios
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol, GLUCOSE_RANGES, getGlucoseRanges } from '../utils/glucoseUtils';
import { aiAnalysisService } from './aiAnalysisService';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { getTreatmentMs } from '../utils/nightscoutTime';

// Interface for custom glucose range settings
export interface CustomGlucoseRanges {
  lowThreshold: number;
  highThreshold: number;
  targetMin: number;
  targetMax: number;
}

interface TimeSegment {
  time: string;
  rate: number;
}

type ProfileLike = {
  basal?: TimeSegment[];
  sens?: TimeSegment[];
  carbratio?: TimeSegment[];
};

interface AIEnhancedSuggestions {
  basalSuggestions: TimeSegment[];
  isfSuggestions: TimeSegment[];
  carbRatioSuggestions: TimeSegment[];
  aiInsights: {
    recommendations: string[];
    riskAssessment: string;
    confidence: number;
    safetyWarnings: string[];
  };
  safetyScore: number;
  hypoglycemiaRisk: number;
}

type AIInsightsRisk = { riskAssessment?: string };

export const analyzeWithAI = async (
  readings: NightscoutEntry[],
  treatments: NightscoutTreatment[],
  currentProfile: ProfileLike,
  customGlucoseRanges?: CustomGlucoseRanges
): Promise<AIEnhancedSuggestions> => {
  
  // Get AI analysis
  let aiInsights;
  try {
    aiInsights = await aiAnalysisService.analyzeGlucoseData(readings, treatments, currentProfile);
  } catch (error) {
    console.error('AI analysis failed:', error);
    aiInsights = {
      recommendations: ['AI analysis unavailable - using conservative fallback'],
      riskAssessment: 'high',
      confidence: 30,
      safetyWarnings: ['Unable to perform AI safety analysis']
    };
  }

  // Calculate safety metrics
  const safetyScore = calculateSafetyScore(readings, treatments, customGlucoseRanges);
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  
  // Generate ultra-conservative suggestions
  const basalSuggestions = generateSafeBasalSuggestions(readings, treatments, currentProfile, aiInsights);
  const isfSuggestions = generateSafeISFSuggestions(readings, treatments, currentProfile, aiInsights);
  const carbRatioSuggestions = generateSafeCarbRatioSuggestions(readings, treatments, currentProfile, aiInsights);

  return {
    basalSuggestions,
    isfSuggestions,
    carbRatioSuggestions,
    aiInsights,
    safetyScore,
    hypoglycemiaRisk
  };
};

function calculateSafetyScore(readings: NightscoutEntry[], treatments: NightscoutTreatment[], customRanges?: CustomGlucoseRanges): number {
  const timeInRange = calculateTimeInRange(readings, customRanges);
  const variability = calculateVariability(readings);
  const hypoglycemiaEpisodes = readings.filter(r => toMmol(r.sgv) < 3.9).length;
  
  let score = 100;
  
  // Penalize hypoglycemia heavily
  score -= hypoglycemiaEpisodes * 10;
  score -= timeInRange.low * 5;
  
  // Penalize high variability
  if (variability.cv > 40) score -= 20;
  else if (variability.cv > 30) score -= 10;
  
  // Reward good time in range
  if (timeInRange.inRange > 70) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

function calculateHypoglycemiaRisk(readings: NightscoutEntry[]): number {
  const lowReadings = readings.filter(r => toMmol(r.sgv) < 3.9).length;
  const severelyLowReadings = readings.filter(r => toMmol(r.sgv) < 3.0).length;
  const total = readings.length;
  
  const lowPercentage = (lowReadings / total) * 100;
  const severePercentage = (severelyLowReadings / total) * 100;
  
  return Math.min(100, lowPercentage * 10 + severePercentage * 20);
}

function generateSafeBasalSuggestions(
  readings: NightscoutEntry[], 
  treatments: NightscoutTreatment[], 
  currentProfile: ProfileLike, 
  aiInsights: AIInsightsRisk
): TimeSegment[] {
  if (!currentProfile?.basal?.length) return [];
  
  const timeGroups = groupReadingsByTimeOfDay(readings);
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  
  return currentProfile.basal.map((basal) => {
    const hour = parseInt(basal.time.split(':')[0]);
    const bgValues = timeGroups[`${hour}`];
    
    if (bgValues.length === 0) {
      return { time: basal.time, rate: basal.rate };
    }
    
    const avgBG = bgValues.reduce((sum: number, bg: number) => sum + bg, 0) / bgValues.length;
    const avgBGMmol = toMmol(avgBG);
    
    let adjustmentFactor = 0;
    
    // Ultra-conservative adjustments
    if (hypoglycemiaRisk > 20) {
      // High hypoglycemia risk - only reduce, never increase
      if (avgBGMmol < 4.0) {
        adjustmentFactor = -0.15; // Reduce by 15%
      } else if (avgBGMmol < 5.0) {
        adjustmentFactor = -0.10; // Reduce by 10%
      } else if (avgBGMmol > 12.0) {
        adjustmentFactor = 0.05; // Very small increase only for very high glucose
      }
    } else {
      // Lower risk - still very conservative
      if (avgBGMmol < 4.0) {
        adjustmentFactor = -0.10;
      } else if (avgBGMmol < 5.0) {
        adjustmentFactor = -0.05;
      } else if (avgBGMmol > 12.0) {
        adjustmentFactor = 0.05;
      } else if (avgBGMmol > 10.0) {
        adjustmentFactor = 0.03;
      }
    }
    
    // Apply AI safety constraints
    if (aiInsights.riskAssessment === 'critical' || aiInsights.riskAssessment === 'high') {
      adjustmentFactor = Math.min(adjustmentFactor, 0); // Never increase if high risk
      adjustmentFactor *= 0.5; // Make reductions even smaller
    }
    
    const newRate = Math.max(0.05, basal.rate * (1 + adjustmentFactor));
    return { 
      time: basal.time, 
      rate: roundToDecimal(newRate, 2) 
    };
  });
}

function generateSafeISFSuggestions(
  readings: NightscoutEntry[], 
  treatments: NightscoutTreatment[], 
  currentProfile: ProfileLike, 
  aiInsights: AIInsightsRisk
): TimeSegment[] {
  if (!currentProfile?.sens?.length) return [];
  
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  const corrections = treatments.filter(t => t.insulin && !t.carbs);
  
  return currentProfile.sens.map((sens) => {
    const hour = parseInt(sens.time.split(':')[0]);
    
    // Find corrections in this time period
    const hourCorrections = corrections.filter(c => {
      const correctionHour = new Date(getTreatmentMs(c)).getHours();
      return correctionHour === hour;
    });
    
    let adjustmentFactor = 0;
    
    // Ultra-conservative ISF adjustments
    if (hypoglycemiaRisk > 20) {
      // High risk - make ISF less aggressive (higher values = less insulin per unit)
      adjustmentFactor = 0.15; // Increase ISF by 15% (less aggressive)
    } else if (hourCorrections.length > 2) {
      // Frequent corrections might indicate ISF is too weak
      adjustmentFactor = -0.05; // Small decrease (more aggressive)
    } else if (hourCorrections.length === 0) {
      // No corrections might indicate ISF is too strong
      adjustmentFactor = 0.05; // Small increase (less aggressive)
    }
    
    // Apply AI safety constraints
    if (aiInsights.riskAssessment === 'critical' || aiInsights.riskAssessment === 'high') {
      adjustmentFactor = Math.max(adjustmentFactor, 0); // Never make more aggressive if high risk
    }
    
    const newRate = sens.rate * (1 + adjustmentFactor);
    return { 
      time: sens.time, 
      rate: roundToDecimal(newRate, 1) 
    };
  });
}

function generateSafeCarbRatioSuggestions(
  readings: NightscoutEntry[], 
  treatments: NightscoutTreatment[], 
  currentProfile: ProfileLike, 
  aiInsights: AIInsightsRisk
): TimeSegment[] {
  if (!currentProfile?.carbratio?.length) return [];
  
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  const mealTreatments = treatments.filter(t => t.carbs && t.insulin);
  
  return currentProfile.carbratio.map((ratio) => {
    const hour = parseInt(ratio.time.split(':')[0]);
    
    // Find meals in this time period
    const hourMeals = mealTreatments.filter(m => {
      const mealHour = new Date(getTreatmentMs(m)).getHours();
      return mealHour === hour;
    });
    
    let adjustmentFactor = 0;
    
    if (hourMeals.length > 0) {
      // Analyze post-meal glucose responses
      const responses = hourMeals.map(meal => {
        const mealTime = getTreatmentMs(meal);
        const postMealReadings = readings.filter(r => 
          r.date > mealTime && r.date <= mealTime + 3 * 60 * 60 * 1000
        );
        
        if (postMealReadings.length === 0) return null;
        
        const maxPostMeal = Math.max(...postMealReadings.map(r => r.sgv));
        const preMealReading = readings.find(r => 
          r.date <= mealTime && r.date > mealTime - 30 * 60 * 1000
        );
        
        return preMealReading ? maxPostMeal - preMealReading.sgv : null;
      }).filter(r => r !== null);
      
      if (responses.length > 0) {
        const avgResponse = responses.reduce((a, b) => a + b, 0) / responses.length;
        
        // Ultra-conservative carb ratio adjustments
        if (hypoglycemiaRisk > 20) {
          // High risk - make ratios less aggressive (higher values = less insulin per carb)
          if (avgResponse < 20) {
            adjustmentFactor = 0.10; // Increase ratio (less insulin)
          }
        } else {
          // Lower risk - still conservative
          if (avgResponse > 60) {
            adjustmentFactor = -0.05; // Small decrease (more insulin)
          } else if (avgResponse < 20) {
            adjustmentFactor = 0.05; // Small increase (less insulin)
          }
        }
      }
    }
    
    // Apply AI safety constraints
    if (aiInsights.riskAssessment === 'critical' || aiInsights.riskAssessment === 'high') {
      adjustmentFactor = Math.max(adjustmentFactor, 0); // Never make more aggressive if high risk
    }
    
    const newRate = ratio.rate * (1 + adjustmentFactor);
    return { 
      time: ratio.time, 
      rate: roundToDecimal(newRate, 1) 
    };
  });
}

// Helper functions
function groupReadingsByTimeOfDay(readings: NightscoutEntry[]) {
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

function calculateTimeInRange(readings: NightscoutEntry[], customRanges?: CustomGlucoseRanges) {
  if (!readings.length) return { inRange: 0, high: 0, low: 0 };
  
  // Get glucose thresholds based on custom ranges or defaults
  const thresholds = customRanges 
    ? getGlucoseRanges('mmol', customRanges)
    : GLUCOSE_RANGES;
  
  let inRange = 0, high = 0, low = 0;
  
  readings.forEach(reading => {
    const mmol = toMmol(reading.sgv);
    if (mmol >= thresholds.TARGET_MIN && mmol <= thresholds.TARGET_MAX) {
      inRange++;
    } else if (mmol > thresholds.TARGET_MAX) {
      high++;
    } else {
      low++;
    }
  });
  
  const total = readings.length;
  return {
    inRange: roundToDecimal((inRange / total) * 100, 1),
    high: roundToDecimal((high / total) * 100, 1),
    low: roundToDecimal((low / total) * 100, 1)
  };
}

function calculateVariability(readings: NightscoutEntry[]) {
  if (!readings.length) return { cv: 0, stdDev: 0 };
  
  const values = readings.map(r => r.sgv);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    cv: roundToDecimal((stdDev / mean) * 100, 1),
    stdDev: roundToDecimal(toMmol(stdDev), 1)
  };
}