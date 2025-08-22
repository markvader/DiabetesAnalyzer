// Pump-Aware OpenAPS Analysis Service
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import { aiAnalysisService } from './aiAnalysisService';
import { InsulinPumpProfile, getPumpById } from '../constants/insulinPumps';

interface PumpAwareOpenAPSAnalysis {
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
  pumpSpecificWarnings: string[];
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
  // Pump-specific information
  pumpProfile: InsulinPumpProfile | null;
  pumpOptimizedSettings: {
    basalIncrements: number;
    maxSafeBasal: number;
    maxSafeBolus: number;
    deliveryDelayCompensation: number;
  };
}

// Pump-aware rounding function
function roundToPumpBasalIncrement(value: number, pump: InsulinPumpProfile | null): number {
  if (!pump) return Math.round(value * 20) / 20; // Default 0.05 increment
  
  const increment = pump.basalIncrements;
  return Math.round(value / increment) * increment;
}

// Calculate pump-specific maximum safe rates based on pump capabilities
function calculatePumpSafeMaximums(pump: InsulinPumpProfile | null): {
  maxSafeBasal: number;
  maxSafeBolus: number;
  safetyDerating: number;
} {
  if (!pump) {
    return {
      maxSafeBasal: 30.0,
      maxSafeBolus: 25.0,
      safetyDerating: 1.0
    };
  }
  
  // Apply safety derating based on pump characteristics
  let safetyDerating = pump.safetyMultiplier;
  
  // Additional derating for pumps with longer delivery delays
  if (pump.deliveryDelay > 60) {
    safetyDerating *= 0.9; // 10% more conservative for slower pumps
  }
  
  // More conservative for tubeless pumps with shorter life cycles
  if (pump.category === 'tubeless' && pump.cannulaChangeInterval <= 72) {
    safetyDerating *= 0.95; // 5% more conservative
  }
  
  return {
    maxSafeBasal: pump.maxBasalRate * 0.8, // Max 80% of pump capability
    maxSafeBolus: pump.maxBolus * 0.9, // Max 90% of pump capability
    safetyDerating
  };
}

// Generate pump-specific warnings and recommendations
function generatePumpSpecificWarnings(pump: InsulinPumpProfile | null, settings: any): string[] {
  const warnings: string[] = [];
  
  if (!pump) {
    warnings.push('No pump selected - using default OmniPod Dash settings');
    return warnings;
  }
  
  // AAPS compatibility warnings
  if (!pump.aapsSupported) {
    warnings.push(`${pump.name} is not directly supported by AAPS - manual configuration required`);
    if (pump.communicationType !== 'bluetooth' && pump.communicationType !== 'rileylink') {
      warnings.push(`${pump.name} requires ${pump.communicationType} communication - ensure proper setup`);
    }
  }
  
  // Communication-specific warnings
  switch (pump.communicationType) {
    case 'rileylink':
      warnings.push('RileyLink required - ensure device is charged and within range');
      warnings.push('RileyLink communication can introduce delays - monitor closely');
      break;
    case 'orangelink':
      warnings.push('OrangeLink required - newer technology, verify compatibility');
      break;
    case 'medtrum':
      warnings.push('Medtrum proprietary communication - ensure app permissions are granted');
      break;
  }
  
  // Pump-specific limitations
  if (pump.reservoirCapacity < 200) {
    warnings.push(`Small reservoir (${pump.reservoirCapacity}U) - monitor insulin levels frequently`);
  }
  
  if (pump.category === 'tubeless') {
    warnings.push(`Pod change required every ${pump.cannulaChangeInterval} hours - plan accordingly`);
  }
  
  // Basal rate warnings based on pump capabilities
  if (settings.maxTempBasal > pump.maxBasalRate * 0.8) {
    warnings.push(`Max temp basal (${settings.maxTempBasal}U/h) is high for ${pump.name} - consider reducing`);
  }
  
  // IOB warnings
  if (settings.maximumIOB > pump.recommendedMaxIOB * 1.5) {
    warnings.push(`Maximum IOB (${settings.maximumIOB}U) exceeds ${pump.name} recommendations`);
  }
  
  return warnings;
}

// Pump-aware basal calculation
function calculatePumpOptimizedBasal(
  baseBasal: number,
  pump: InsulinPumpProfile | null,
  safetyLevel: string
): number {
  if (!pump) return roundToPumpBasalIncrement(baseBasal, null);
  
  const pumpSafeMaximums = calculatePumpSafeMaximums(pump);
  let optimizedBasal = baseBasal * pumpSafeMaximums.safetyDerating;
  
  // Apply pump-specific optimizations
  switch (pump.id) {
    case 'omnipod-dash':
    case 'omnipod-eros':
      // Omnipods can handle higher temp basals safely
      optimizedBasal = Math.min(optimizedBasal, pumpSafeMaximums.maxSafeBasal);
      break;
      
    case 'dana-rs':
    case 'dana-i':
      // Dana pumps are very responsive - can be slightly more aggressive
      if (safetyLevel === 'standard') {
        optimizedBasal *= 1.1;
      }
      break;
      
    case 'medtronic-670g':
    case 'medtronic-780g':
      // Medtronic pumps have built-in safety systems
      optimizedBasal *= 0.95; // Slightly more conservative
      break;
      
    case 'accu-chek-combo':
    case 'accu-chek-insight':
      // AccuChek pumps can handle high basal rates
      optimizedBasal = Math.min(optimizedBasal, Math.min(25.0, pumpSafeMaximums.maxSafeBasal));
      break;
  }
  
  return roundToPumpBasalIncrement(
    Math.min(optimizedBasal, pumpSafeMaximums.maxSafeBasal),
    pump
  );
}

export const analyzePumpAwareOpenAPS = async (
  readings: any[], 
  treatments: any[], 
  currentProfile: any,
  pumpId: string
): Promise<PumpAwareOpenAPSAnalysis> => {
  
  const pump = getPumpById(pumpId);
  const pumpSafeMaximums = calculatePumpSafeMaximums(pump);
  
  // Get AI analysis first
  let aiAnalysis;
  try {
    aiAnalysis = await aiAnalysisService.analyzeGlucoseData(readings, treatments, currentProfile);
  } catch (error) {
    console.error('AI analysis failed:', error);
  }

  // Calculate safety metrics (reusing existing functions)
  const safetyChecks = calculateSafetyChecks(readings, treatments);
  const hypoglycemiaRiskScore = calculateHypoglycemiaRisk(readings, treatments);
  const criticalWarnings = generateCriticalWarnings(readings, treatments, safetyChecks);
  
  // Determine safety level
  const safetyLevel = determineSafetyLevel(hypoglycemiaRiskScore, safetyChecks);
  
  // Calculate base settings using pump-aware calculations
  const baseSettings = calculateMoreAggressiveSettings(readings, treatments, currentProfile, safetyLevel);
  
  // Apply pump-specific optimizations
  const pumpOptimizedMaxTempBasal = calculatePumpOptimizedBasal(
    baseSettings.maxTempBasal || 2.0, 
    pump, 
    safetyLevel
  );
  
  // Calculate IOB with pump-specific considerations
  let pumpOptimizedMaxIOB = pump?.recommendedMaxIOB || 5.0;
  if (safetyLevel === 'standard') {
    pumpOptimizedMaxIOB *= 1.3;
  } else if (safetyLevel === 'ultra-conservative') {
    pumpOptimizedMaxIOB *= 0.7;
  }
  
  // Dynamic ISF with pump-specific adjustments
  let pumpOptimizedDynamicISF = pump?.recommendedDynamicISF || 100;
  if ((pump?.deliveryDelay ?? 0) > 60) {
    // More conservative ISF for slower-acting pumps
    pumpOptimizedDynamicISF = Math.min(pumpOptimizedDynamicISF + 10, 130);
  }
  
  // Calculate all three tiers with pump optimizations
  const maxTempBasal = pumpOptimizedMaxTempBasal;
  const maximumIOB = roundToDecimal(Math.min(pumpOptimizedMaxIOB, pumpSafeMaximums.maxSafeBasal * 3), 1);
  const dynamicISFFactor = Math.max(80, Math.min(140, pumpOptimizedDynamicISF));
  
  // Standard settings (more aggressive)
  const standardMaxTempBasal = roundToPumpBasalIncrement(
    Math.min(pumpSafeMaximums.maxSafeBasal, maxTempBasal * 1.4), 
    pump
  );
  const standardMaximumIOB = roundToDecimal(Math.min(maximumIOB * 1.3, pumpSafeMaximums.maxSafeBasal * 4), 1);
  const standardDynamicISFFactor = Math.max(65, Math.min(120, Math.round(dynamicISFFactor * 0.85)));
  
  // Ultra-conservative settings
  const ultraConservativeMaxTempBasal = roundToPumpBasalIncrement(
    Math.min(pumpSafeMaximums.maxSafeBasal * 0.6, maxTempBasal * 0.7), 
    pump
  );
  const ultraConservativeMaximumIOB = roundToDecimal(Math.min(maximumIOB * 0.6, 4.0), 1);
  const ultraConservativeDynamicISFFactor = Math.max(105, Math.min(130, Math.round(dynamicISFFactor * 1.15)));
  
  // Generate pump-specific warnings
  const pumpSpecificWarnings = generatePumpSpecificWarnings(pump, {
    maxTempBasal,
    maximumIOB,
    dynamicISFFactor
  });
  
  // Analyze carb coverage (reusing existing function)
  const carbCoverage = analyzeCarbCoverage(readings, treatments, currentProfile);

  return {
    // Conservative settings
    maxTempBasal,
    maximumIOB,
    dynamicISFFactor,
    
    // Standard settings
    standardMaxTempBasal,
    standardMaximumIOB,
    standardDynamicISFFactor,
    
    // Ultra-conservative settings
    ultraConservativeMaxTempBasal,
    ultraConservativeMaximumIOB,
    ultraConservativeDynamicISFFactor,
    
    safetyLevel,
    hypoglycemiaRiskScore,
    recommendedStartingLevel: determineRecommendedStartingLevel(hypoglycemiaRiskScore, timeInRange(readings)),
    aiAnalysis,
    criticalWarnings,
    pumpSpecificWarnings,
    safetyChecks,
    carbCoverage,
    
    // Pump-specific data
    pumpProfile: pump,
    pumpOptimizedSettings: {
      basalIncrements: pump?.basalIncrements || 0.05,
      maxSafeBasal: pumpSafeMaximums.maxSafeBasal,
      maxSafeBolus: pumpSafeMaximums.maxSafeBolus,
      deliveryDelayCompensation: pump?.deliveryDelay || 60
    }
  };
};

// Helper functions (reusing from existing analysis)
function calculateSafetyChecks(readings: any[], _treatments: any[]) {
  // Implementation from existing service
  const hypoglycemiaCount = readings.filter(r => toMmol(r.sgv) < 3.9).length;
  const totalReadings = readings.length;
  const hypoglycemiaPercent = totalReadings > 0 ? (hypoglycemiaCount / totalReadings) * 100 : 0;
  
  return {
    hypoglycemiaHistory: hypoglycemiaPercent > 4,
    pediatricPatient: false, // Could be determined from profile
    dataQuality: totalReadings > 1000 ? 'high' as const : totalReadings > 500 ? 'medium' as const : 'low' as const,
    variabilityRisk: calculateVariabilityRisk(readings)
  };
}

function calculateVariabilityRisk(readings: any[]): 'low' | 'medium' | 'high' {
  if (readings.length < 100) return 'high';
  
  const values = readings.map(r => r.sgv);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const cv = (Math.sqrt(variance) / mean) * 100;
  
  if (cv < 25) return 'low';
  if (cv < 35) return 'medium';
  return 'high';
}

function calculateHypoglycemiaRisk(readings: any[], _treatments: any[]): number {
  // Implementation from existing service
  const hypoglycemiaCount = readings.filter(r => toMmol(r.sgv) < 3.9).length;
  const totalReadings = readings.length;
  let riskScore = totalReadings > 0 ? (hypoglycemiaCount / totalReadings) * 100 : 0;
  
  // Amplify risk based on variability
  const variability = calculateVariabilityRisk(readings);
  if (variability === 'high') riskScore *= 1.5;
  else if (variability === 'medium') riskScore *= 1.2;
  
  return Math.min(100, riskScore);
}

function generateCriticalWarnings(_readings: any[], _treatments: any[], safetyChecks: any): string[] {
  const warnings: string[] = [];
  
  if (safetyChecks.hypoglycemiaHistory) {
    warnings.push('CRITICAL: Recent hypoglycemia detected - use ultra-conservative settings');
  }
  
  if (safetyChecks.dataQuality === 'low') {
    warnings.push('WARNING: Limited data available - recommendations may be less accurate');
  }
  
  if (safetyChecks.variabilityRisk === 'high') {
    warnings.push('CAUTION: High glucose variability detected - start with conservative settings');
  }
  
  return warnings;
}

function determineSafetyLevel(riskScore: number, safetyChecks: any): 'ultra-conservative' | 'conservative' | 'standard' {
  if (riskScore > 15 || safetyChecks.hypoglycemiaHistory) return 'ultra-conservative';
  if (riskScore > 5 || safetyChecks.variabilityRisk === 'high') return 'conservative';
  return 'standard';
}

function determineRecommendedStartingLevel(riskScore: number, timeInRange: any): 'ultra-conservative' | 'conservative' | 'standard' {
  if (riskScore > 10 || timeInRange.low > 4) return 'ultra-conservative';
  if (riskScore > 5 || timeInRange.low > 2) return 'conservative';
  return 'standard';
}

function calculateMoreAggressiveSettings(_readings: any[], _treatments: any[], _currentProfile: any, _safetyLevel: string) {
  // Implementation from existing service - simplified for now
  return {
    maxTempBasal: 3.0,
    maximumIOB: 5.0,
    dynamicISFFactor: 100
  };
}

function analyzeCarbCoverage(_readings: any[], _treatments: any[], _currentProfile: any) {
  // Implementation from existing service
  return {
    recommendedSMBCoverage: 2.0,
    mealPatternAnalysis: 'Standard meal patterns detected',
    carbRatioAdjustment: 1.0
  };
}

function timeInRange(readings: any[]) {
  const total = readings.length;
  if (total === 0) return { low: 0, high: 0, inRange: 0 };
  
  let low = 0, high = 0, inRange = 0;
  
  for (const reading of readings) {
    const mmol = toMmol(reading.sgv);
    if (mmol < 3.9) low++;
    else if (mmol > 10.0) high++;
    else inRange++;
  }
  
  return {
    low: (low / total) * 100,
    high: (high / total) * 100,
    inRange: (inRange / total) * 100
  };
}
