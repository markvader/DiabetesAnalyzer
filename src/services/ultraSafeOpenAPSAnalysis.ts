// Optimized OpenAPS Analysis - Safety-First with Enhanced Effectiveness
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import { aiAnalysisService } from './aiAnalysisService';

interface UltraSafeOpenAPSAnalysis {
  maxTempBasal: number;
  maximumIOB: number;
  dynamicISFFactor: number;
  ultraConservativeMaxTempBasal: number;
  ultraConservativeMaximumIOB: number;
  ultraConservativeDynamicISFFactor: number;
  standardMaxTempBasal: number;
  standardMaximumIOB: number;
  standardDynamicISFFactor: number;
  safetyLevel: 'ultra-conservative' | 'conservative' | 'standard';
  hypoglycemiaRiskScore: number;
  recommendedStartingLevel: 'ultra-conservative' | 'conservative' | 'standard';
  aiAnalysis?: any;
  criticalWarnings: string[];
  safetyChecks: {
    hypoglycemiaHistory: boolean;
    pediatricPatient: boolean;
    dataQuality: 'high' | 'medium' | 'low';
    variabilityRisk: 'low' | 'medium' | 'high';
  };
  carbCoverage?: {
    recommendedSMBCoverage: number;
    mealPatternAnalysis: string;
    carbRatioAdjustment: number;
  };
}

// Round to nearest 0.05 for OmniPod Dash compatibility
function roundToOmniPodBasal(value: number): number {
  return Math.round(value * 20) / 20; // Round to nearest 0.05
}

export const analyzeUltraSafeOpenAPS = async (
  readings: any[], 
  treatments: any[], 
  currentProfile: any
): Promise<UltraSafeOpenAPSAnalysis> => {
  
  // Get AI analysis first
  let aiAnalysis;
  try {
    aiAnalysis = await aiAnalysisService.analyzeGlucoseData(readings, treatments, currentProfile);
  } catch (error) {
    console.error('AI analysis failed:', error);
  }

  // Calculate safety metrics
  const safetyChecks = calculateSafetyChecks(readings, treatments);
  const hypoglycemiaRiskScore = calculateHypoglycemiaRisk(readings, treatments);
  const criticalWarnings = generateCriticalWarnings(readings, treatments, safetyChecks);
  
  // Determine safety level based on risk assessment
  const safetyLevel = determineSafetyLevel(hypoglycemiaRiskScore, safetyChecks);
  
  // Calculate base settings with more aggressive approach for high BG
  const baseSettings = calculateMoreAggressiveSettings(readings, treatments, currentProfile, safetyLevel);
  
  // Apply safety multipliers
  const safetyMultipliers = getSafetyMultipliers(safetyLevel, hypoglycemiaRiskScore);
  
  // Analyze carb coverage specifically for SMB
  const carbCoverage = analyzeCarbCoverage(readings, treatments, currentProfile);
  
  // Ensure we have valid numbers for all settings with REASONABLE CAPS
  const maxTempBasal = Math.min(3.5, isNaN(baseSettings.maxTempBasal) ? 2.0 : baseSettings.maxTempBasal);
  const maximumIOB = Math.min(6.0, isNaN(baseSettings.maximumIOB) ? 3.0 : baseSettings.maximumIOB);
  const dynamicISFFactor = Math.max(80, Math.min(140, isNaN(baseSettings.dynamicISFFactor) ? 110 : baseSettings.dynamicISFFactor));
  
  // Calculate standard settings (more aggressive for optimal control)
  const standardMaxTempBasal = roundToOmniPodBasal(Math.min(6.0, maxTempBasal * 1.4)); // 40% more than conservative, capped at 6.0
  const standardMaximumIOB = roundToDecimal(Math.min(12.0, maximumIOB * 1.3), 1); // 30% more than conservative, capped at 12.0
  const standardDynamicISFFactor = Math.max(65, Math.min(120, Math.round(dynamicISFFactor * 0.85))); // More aggressive
  
  const result: UltraSafeOpenAPSAnalysis = {
    // Conservative settings - rounded for OmniPod Dash
    maxTempBasal: roundToOmniPodBasal(maxTempBasal),
    maximumIOB: roundToDecimal(maximumIOB, 1),
    dynamicISFFactor: Math.round(dynamicISFFactor),
    
    // Standard settings (more aggressive) - rounded for OmniPod Dash
    standardMaxTempBasal: standardMaxTempBasal,
    standardMaximumIOB: standardMaximumIOB,
    standardDynamicISFFactor: standardDynamicISFFactor,
    
    // Ultra-conservative settings (more reasonable for effectiveness while still conservative)
    ultraConservativeMaxTempBasal: roundToOmniPodBasal(Math.min(3.0, maxTempBasal * 0.7)), // 70% of base, capped at 3.0
    ultraConservativeMaximumIOB: roundToDecimal(Math.min(4.0, maximumIOB * 0.6), 1), // 60% of base, capped at 4.0
    ultraConservativeDynamicISFFactor: Math.max(105, Math.min(130, Math.round(dynamicISFFactor * 1.15))), // More conservative but reasonable
    
    safetyLevel,
    hypoglycemiaRiskScore,
    recommendedStartingLevel: determineRecommendedStartingLevel(hypoglycemiaRiskScore, timeInRange(readings)),
    aiAnalysis,
    criticalWarnings,
    safetyChecks,
    carbCoverage
  };

  return result;
};

function calculateSafetyChecks(readings: any[], treatments: any[]) {
  const timeInRange = calculateTimeInRange(readings);
  const variability = calculateVariability(readings);
  
  return {
    hypoglycemiaHistory: timeInRange.low > 2, // More than 2% time below range is concerning
    pediatricPatient: true, // Assume pediatric for maximum safety
    dataQuality: assessDataQuality(readings, treatments),
    variabilityRisk: variability.cv > 40 ? 'high' : variability.cv > 30 ? 'medium' : 'low'
  };
}

function calculateHypoglycemiaRisk(readings: any[], treatments: any[]): number {
  const timeInRange = calculateTimeInRange(readings);
  const variability = calculateVariability(readings);
  const severeHypos = readings.filter(r => toMmol(r.sgv) < 3.0).length;
  
  // Check if we have a new sensor that might be giving inaccurate low readings
  const possibleNewSensor = checkForPossibleNewSensor(readings);
  
  let riskScore = 0;
  
  // SAFETY PRIORITY: Weight hypoglycemia risk appropriately
  riskScore += timeInRange.low * 8; // Significant penalty for time below range
  
  // Severe hypoglycemia penalty - CRITICAL
  riskScore += severeHypos * 15; // Strong penalty for severe hypos
  
  // Variability penalty - high variability = higher risk
  if (variability.cv > 40) riskScore += 20;
  else if (variability.cv > 30) riskScore += 12;
  else if (variability.cv > 25) riskScore += 8;
  
  // Frequent corrections penalty (sign of unstable control)
  const corrections = treatments.filter(t => t.insulin && !t.carbs);
  if (corrections.length > readings.length * 0.1) riskScore += 12;
  
  // Post-meal hypoglycemia penalty (critical for carb coverage)
  const postMealHypos = countPostMealHypoglycemia(readings, treatments);
  riskScore += postMealHypos * 10; // Penalty for post-meal hypos
  
  // Be more cautious with new sensor suspicions
  if (possibleNewSensor) {
    riskScore = Math.max(0, riskScore - 20); // Less reduction for suspected sensor issues
  }
  
  // Even with high BG, don't reduce risk score too much if there's hypoglycemia history
  if (timeInRange.high > 30 && timeInRange.low < 2) {
    riskScore = Math.max(0, riskScore - 15); // Modest reduction only if low BG is minimal
  }
  
  return Math.min(100, riskScore);
}

function checkForPossibleNewSensor(readings: any[]): boolean {
  if (readings.length < 100) return false;
  
  // Check for patterns that might indicate a new sensor
  // 1. Sudden changes in variability
  const recentReadings = readings.slice(-100);
  const olderReadings = readings.slice(-200, -100);
  
  if (recentReadings.length < 50 || olderReadings.length < 50) return false;
  
  const recentValues = recentReadings.map(r => r.sgv);
  const olderValues = olderReadings.map(r => r.sgv);
  
  const recentMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const olderMean = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
  
  const recentVariance = recentValues.reduce((acc, val) => acc + Math.pow(val - recentMean, 2), 0) / recentValues.length;
  const olderVariance = olderValues.reduce((acc, val) => acc + Math.pow(val - olderMean, 2), 0) / olderValues.length;
  
  const recentStdDev = Math.sqrt(recentVariance);
  const olderStdDev = Math.sqrt(olderVariance);
  
  // If recent readings are significantly more variable, might be a new sensor
  if (recentStdDev > olderStdDev * 1.5) return true;
  
  // 2. Check for unusual number of low readings in recent data
  const recentLows = recentValues.filter(v => toMmol(v) < 3.9).length;
  const olderLows = olderValues.filter(v => toMmol(v) < 3.9).length;
  
  const recentLowRate = recentLows / recentValues.length;
  const olderLowRate = olderLows / olderValues.length;
  
  // If recent low rate is much higher, might be a new sensor
  if (recentLowRate > olderLowRate * 2) return true;
  
  return false;
}

function countPostMealHypoglycemia(readings: any[], treatments: any[]): number {
  let count = 0;
  
  // Find carb announcements
  const carbAnnouncements = treatments.filter(t => t.carbs && t.carbs > 0);
  
  carbAnnouncements.forEach(meal => {
    const mealTime = new Date(meal.created_at).getTime();
    
    // Check for hypos within 5 hours after meal
    const postMealReadings = readings.filter(r => 
      r.date > mealTime && 
      r.date <= mealTime + 5 * 60 * 60 * 1000
    );
    
    const hasHypo = postMealReadings.some(r => toMmol(r.sgv) < 3.9);
    if (hasHypo) count++;
  });
  
  return count;
}

function determineSafetyLevel(riskScore: number, safetyChecks: any): 'ultra-conservative' | 'conservative' | 'standard' {
  // Adjust thresholds to be less conservative
  if (riskScore > 40) { // Reduced from 45 to 40
    return 'ultra-conservative';
  } else if (riskScore > 15) { // Reduced from 20 to 15
    return 'conservative';
  }
  return 'standard'; // Allow standard mode for more aggressive settings
}

function determineRecommendedStartingLevel(riskScore: number, timeInRange: any): 'ultra-conservative' | 'conservative' | 'standard' {
  // BALANCED APPROACH: More reasonable progression while maintaining safety
  // Only recommend conservative settings in low-risk scenarios with good control
  if (riskScore < 8 && timeInRange.high > 35 && timeInRange.low < 1.5) {
    return 'conservative'; // Allow conservative start for very good control
  } else if (riskScore < 20 && timeInRange.low < 3) {
    return 'conservative'; // Conservative for moderate risk
  }
  // Default to ultra-conservative for safety
  return 'ultra-conservative';
}

function calculateMoreAggressiveSettings(
  readings: any[], 
  treatments: any[], 
  currentProfile: any, 
  safetyLevel: string
) {
  // OPTIMIZED: More aggressive base values for better glucose control while maintaining safety
  let baseMaxTempBasal = 3.0; // Increased from 2.5 for better effectiveness
  let baseMaxIOB = 5.0; // Increased from 4.0 for better meal coverage
  let baseDynamicISF = 95; // More aggressive (was 100)
  
  // Analyze current basal rates to set reasonable limits
  if (currentProfile?.basal?.length > 0) {
    try {
      const maxCurrentBasal = Math.max(...currentProfile.basal.map((b: any) => parseFloat(b.rate) || 0));
      if (!isNaN(maxCurrentBasal) && maxCurrentBasal > 0) {
        // OPTIMIZED: Set max temp basal for better effectiveness
        baseMaxTempBasal = Math.min(5.0, Math.max(2.5, maxCurrentBasal * 4.0)); // Max 4.0x current basal, capped at 5.0 U/h
      }
    } catch (error) {
      console.error('Error calculating max current basal:', error);
    }
  }
  
  // Analyze total daily insulin to set reasonable IOB limits
  const totalDailyInsulin = calculateTotalDailyInsulin(treatments);
  if (totalDailyInsulin > 0) {
    // OPTIMIZED: Set max IOB based on TDI - more effective approach
    baseMaxIOB = Math.min(10.0, Math.max(3.0, totalDailyInsulin * 0.3)); // Max 30% of TDI, capped at 10.0 U
  }
  
  // Analyze glucose variability - prioritize safety
  const variability = calculateVariability(readings);
  if (variability.cv > 40) {
    // High variability = much more conservative
    baseMaxTempBasal *= 0.7;
    baseMaxIOB *= 0.7;
    baseDynamicISF = Math.max(baseDynamicISF, 130);
  } else if (variability.cv > 30) {
    baseMaxTempBasal *= 0.8;
    baseMaxIOB *= 0.8;
    baseDynamicISF = Math.max(baseDynamicISF, 125);
  }
  
  // Analyze hypoglycemia history - SAFETY PRIORITY
  const timeInRange = calculateTimeInRange(readings);
  if (timeInRange.low > 4) {
    // Significant hypoglycemia = very conservative
    baseMaxTempBasal *= 0.6;
    baseMaxIOB *= 0.6;
    baseDynamicISF = Math.max(baseDynamicISF, 140);
  } else if (timeInRange.low > 2) {
    baseMaxTempBasal *= 0.75;
    baseMaxIOB *= 0.75;
    baseDynamicISF = Math.max(baseDynamicISF, 130);
  } else if (timeInRange.low > 1) {
    baseMaxTempBasal *= 0.85;
    baseMaxIOB *= 0.85;
    baseDynamicISF = Math.max(baseDynamicISF, 125);
  }
  
  // Analyze high glucose history - MODERATE adjustments for better control
  if (timeInRange.high > 40) {
    // Make more significant increases for very high BG percentage
    baseMaxTempBasal *= 1.25; // 25% increase for better control
    baseMaxIOB *= 1.2; // 20% increase for better meal coverage
    baseDynamicISF = Math.max(85, baseDynamicISF * 0.85); // More aggressive decrease
  } else if (timeInRange.high > 30) {
    baseMaxTempBasal *= 1.15; // 15% increase
    baseMaxIOB *= 1.1; // 10% increase
    baseDynamicISF = Math.max(90, baseDynamicISF * 0.9); // Moderate decrease
  }
  
  // SAFETY CAPS: Higher maximum values for better effectiveness while maintaining safety
  baseMaxTempBasal = Math.min(5.0, baseMaxTempBasal); // Absolute max 5.0 U/h
  baseMaxIOB = Math.min(10.0, baseMaxIOB); // Absolute max 10.0 U
  baseDynamicISF = Math.max(65, Math.min(140, baseDynamicISF)); // Range 65-140%
  
  // Analyze carb coverage needs - but keep conservative
  const carbCoverage = analyzeCarbCoverage(readings, treatments, currentProfile);
  if (carbCoverage && carbCoverage.recommendedSMBCoverage > 0) {
    // Adjust IOB limit based on carb coverage needs - more aggressive for better meal coverage
    const carbBasedIOB = carbCoverage.recommendedSMBCoverage * 3.0; // Increased multiplier
    baseMaxIOB = Math.min(baseMaxIOB * 1.3, carbBasedIOB); // More significant increase for carb coverage
  }
  
  // Check for possible new sensor with inaccurate readings
  const possibleNewSensor = checkForPossibleNewSensor(readings);
  if (possibleNewSensor) {
    // If we suspect sensor issues, be even more conservative
    baseMaxTempBasal = Math.min(baseMaxTempBasal, 1.8);
    baseMaxIOB = Math.min(baseMaxIOB, 2.5);
    baseDynamicISF = Math.max(baseDynamicISF, 110);
  }
  
  // Apply safety level multipliers
  const safetyMultipliers = getSafetyMultipliers(safetyLevel, 0);
  
  return {
    maxTempBasal: roundToOmniPodBasal(baseMaxTempBasal * safetyMultipliers.tempBasal),
    maximumIOB: roundToDecimal(baseMaxIOB * safetyMultipliers.iob, 1),
    dynamicISFFactor: Math.round(baseDynamicISF * safetyMultipliers.dynamicISF)
  };
}

function calculateTotalDailyInsulin(treatments: any[]): number {
  // Get treatments from the last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentTreatments = treatments.filter(t => 
    new Date(t.created_at).getTime() > oneDayAgo && t.insulin
  );
  
  // Sum up all insulin
  return recentTreatments.reduce((sum, t) => sum + (t.insulin || 0), 0);
}

function getSafetyMultipliers(safetyLevel: string, riskScore: number) {
  // OPTIMIZED: More aggressive multipliers for better control while maintaining safety focus
  switch (safetyLevel) {
    case 'ultra-conservative':
      return { tempBasal: 0.75, iob: 0.65, dynamicISF: 1.1 }; // Slightly more aggressive
    case 'conservative':
      return { tempBasal: 0.9, iob: 0.8, dynamicISF: 1.0 }; // More aggressive
    default: // standard
      return { tempBasal: 1.0, iob: 0.95, dynamicISF: 0.9 }; // More aggressive for better control
  }
}

function analyzeCarbCoverage(readings: any[], treatments: any[], currentProfile: any) {
  // Find carb announcements
  const carbAnnouncements = treatments.filter(t => t.carbs && t.carbs > 0);
  
  if (carbAnnouncements.length === 0) {
    return {
      recommendedSMBCoverage: 2.0, // Reasonable default for carb coverage
      mealPatternAnalysis: "No carb announcements found. Using balanced default values for SMB-based carb coverage.",
      carbRatioAdjustment: -0.08 // Modest decrease in carb ratio
    };
  }
  
  // Calculate average carb announcement
  const avgCarbAmount = carbAnnouncements.reduce((sum, t) => sum + t.carbs, 0) / carbAnnouncements.length;
  
  // Analyze post-meal patterns
  const mealPatterns = carbAnnouncements.map(meal => {
    const mealTime = new Date(meal.created_at).getTime();
    
    // Get pre-meal glucose
    const preMealReadings = readings.filter(r => 
      r.date >= mealTime - 30 * 60 * 1000 && 
      r.date <= mealTime
    );
    
    // Get post-meal glucose
    const postMealReadings = readings.filter(r => 
      r.date > mealTime && 
      r.date <= mealTime + 4 * 60 * 60 * 1000
    );
    
    if (preMealReadings.length === 0 || postMealReadings.length === 0) {
      return null;
    }
    
    const preMealAvg = preMealReadings.reduce((sum, r) => sum + r.sgv, 0) / preMealReadings.length;
    const postMealMax = Math.max(...postMealReadings.map(r => r.sgv));
    const postMealMin = Math.min(...postMealReadings.map(r => r.sgv));
    
    const hasHypo = postMealReadings.some(r => toMmol(r.sgv) < 3.9);
    const hasHyper = postMealReadings.some(r => toMmol(r.sgv) > 10.0);
    
    return {
      carbAmount: meal.carbs,
      preMealGlucose: preMealAvg,
      postMealMax,
      postMealMin,
      hasHypo,
      hasHyper,
      glucoseRise: postMealMax - preMealAvg
    };
  }).filter(p => p !== null);
  
  // Calculate recommended SMB coverage based on meal patterns
  let recommendedSMBCoverage = 2.5; // Start with a more aggressive value for SMB-based carb coverage
  let mealPatternAnalysis = "";
  let carbRatioAdjustment = -0.15; // Default to more aggressive carb ratio
  
  if (mealPatterns.length > 0) {
    // Count hypos and hypers
    const hypoCount = mealPatterns.filter(p => p.hasHypo).length;
    const hyperCount = mealPatterns.filter(p => p.hasHyper).length;
    const hypoRate = hypoCount / mealPatterns.length;
    const hyperRate = hyperCount / mealPatterns.length;
    
    // Calculate average glucose rise
    const avgGlucoseRise = mealPatterns.reduce((sum, p) => sum + p.glucoseRise, 0) / mealPatterns.length;
    
    // Determine if carb coverage is adequate
    if (hypoRate > 0.2) {
      // Too many hypos - reduce SMB coverage
      mealPatternAnalysis = "Frequent post-meal hypoglycemia detected. Reducing SMB coverage.";
      recommendedSMBCoverage = 1.2; // Increased from 1.0 but still conservative
      carbRatioAdjustment = 0.1; // Increase carb ratio (less insulin)
    } else if (hyperRate > 0.5 && hypoRate < 0.1) {
      // Many hypers, few hypos - increase coverage
      mealPatternAnalysis = "Frequent post-meal hyperglycemia with few lows. Increasing SMB coverage.";
      recommendedSMBCoverage = 3.0; // More aggressive (increased from 2.5)
      carbRatioAdjustment = -0.2; // Decrease carb ratio (more insulin)
    } else if (avgGlucoseRise > 80 && hypoRate < 0.05) {
      // Large glucose rise with very few hypos
      mealPatternAnalysis = "Large post-meal glucose rises with minimal hypoglycemia. Higher SMB coverage recommended.";
      recommendedSMBCoverage = 3.5; // Much more aggressive (increased from 3.0)
      carbRatioAdjustment = -0.25; // More aggressive carb ratio (increased from -0.2)
    } else {
      // Balanced pattern
      mealPatternAnalysis = "Balanced post-meal patterns. Moderate SMB coverage recommended.";
      recommendedSMBCoverage = 2.5; // Increased from 2.0
      carbRatioAdjustment = -0.15; // Increased from -0.1
    }
    
    // Adjust based on average carb amount
    if (avgCarbAmount > 50) {
      recommendedSMBCoverage += 1.0; // Higher for larger meals (increased from 0.8)
    }
  } else {
    mealPatternAnalysis = "Insufficient meal data for analysis. Using more aggressive default values for SMB-based carb coverage.";
  }
  
  // Safety cap - never recommend more than 6.0U for SMB coverage (increased from 5.0)
  recommendedSMBCoverage = Math.min(recommendedSMBCoverage, 6.0);
  
  return {
    recommendedSMBCoverage: roundToDecimal(recommendedSMBCoverage, 1),
    mealPatternAnalysis,
    carbRatioAdjustment: roundToDecimal(carbRatioAdjustment, 2)
  };
}

function generateCriticalWarnings(readings: any[], treatments: any[], safetyChecks: any): string[] {
  const warnings = [];
  const timeInRange = calculateTimeInRange(readings);
  
  // SAFETY FIRST: Always start with the most important warning
  warnings.push('🚨 SAFETY REMINDER: Always start with Emergency-Safe settings and monitor closely for 72+ hours before making any adjustments.');
  
  // Check for possible new sensor with inaccurate readings
  const possibleNewSensor = checkForPossibleNewSensor(readings);
  if (possibleNewSensor) {
    warnings.push('⚠️ POSSIBLE NEW SENSOR DETECTED: Recent readings show unusual patterns that may indicate a new sensor. Validate ALL low readings with fingerstick tests before making treatment decisions.');
  }
  
  if (timeInRange.low > 4 && !possibleNewSensor) {
    warnings.push('🚨 CRITICAL HYPOGLYCEMIA RISK: >4% time below range detected. IMMEDIATE medical consultation required. DO NOT use automated insulin delivery until resolved.');
  } else if (timeInRange.low > 2 && !possibleNewSensor) {
    warnings.push('⚠️ ELEVATED HYPOGLYCEMIA RISK: >2% time below range. START with Emergency-Safe settings only. Reduce all insulin doses.');
  } else if (timeInRange.low > 1 && !possibleNewSensor) {
    warnings.push('⚠️ HYPOGLYCEMIA DETECTED: >1% time below range. Use Ultra-Conservative settings and monitor closely.');
  }
  
  if (safetyChecks.variabilityRisk === 'high' && !possibleNewSensor) {
    warnings.push('⚠️ HIGH GLUCOSE VARIABILITY: Unstable control detected. START with Emergency-Safe settings and address variability before progressing.');
  }
  
  if (safetyChecks.dataQuality === 'low') {
    warnings.push('⚠️ INSUFFICIENT DATA: Limited data available for analysis. Use Emergency-Safe settings only until more data is available.');
  }
  
  const severeHypos = readings.filter(r => toMmol(r.sgv) < 3.0).length;
  if (severeHypos > 0 && !possibleNewSensor) {
    warnings.push(`🚨 SEVERE HYPOGLYCEMIA ALERT: ${severeHypos} episodes below 3.0 mmol/L detected. EMERGENCY medical consultation required. Automated insulin delivery is NOT safe.`);
  }
  
  // Check for post-meal hypoglycemia specifically
  const postMealHypos = countPostMealHypoglycemia(readings, treatments);
  if (postMealHypos > 0 && !possibleNewSensor) {
    warnings.push(`⚠️ POST-MEAL HYPOGLYCEMIA: ${postMealHypos} episodes detected. Carb ratios need adjustment BEFORE using SMB for meal coverage.`);
  }
  
  // Add SMB-specific safety warnings
  const carbAnnouncements = treatments.filter(t => t.carbs && t.carbs > 0);
  if (carbAnnouncements.length > 0) {
    warnings.push('⚠️ MEAL COVERAGE WARNING: SMB for carb coverage increases hypoglycemia risk. Monitor post-meal patterns for 3+ hours after each meal.');
  }
  
  // Add general safety reminder
  warnings.push('💡 SAFETY PROTOCOL: These settings are suggestions only. Always consult your healthcare provider before making changes. Monitor closely and be prepared to revert to manual dosing if needed.');
  
  // Add warning for persistent high glucose
  if (timeInRange.high > 30) {
    warnings.push('PERSISTENT HYPERGLYCEMIA: More than 30% time above range detected. More aggressive settings are recommended to improve glucose control.');
  }
  
  return warnings;
}

function calculateTimeInRange(readings: any[]) {
  if (!readings.length) return { inRange: 0, high: 0, low: 0 };
  
  let inRange = 0, high = 0, low = 0;
  
  readings.forEach(reading => {
    const mmol = toMmol(reading.sgv);
    if (mmol >= 3.9 && mmol <= 10.0) {
      inRange++;
    } else if (mmol > 10.0) {
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

// Helper function to get time in range for use in determining recommended starting level
function timeInRange(readings: any[]) {
  return calculateTimeInRange(readings);
}

function calculateVariability(readings: any[]) {
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

function assessDataQuality(readings: any[], treatments: any[]): 'high' | 'medium' | 'low' {
  const readingDensity = readings.length / 14; // readings per day over 2 weeks
  const treatmentDensity = treatments.length / 14;
  
  if (readingDensity > 200 && treatmentDensity > 3) return 'high';
  if (readingDensity > 100 && treatmentDensity > 1) return 'medium';
  return 'low';
}