// Advanced AI-Powered OpenAPS SMB Optimizer
// Analyzes BG and treatment data to optimize OpenAPS SMB settings
// Aggressive optimization while maintaining safety to avoid hypo/hyperglycemia

import { subDays } from 'date-fns';
import { roundToDecimal } from '../utils/mathUtils';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { analyzeGlucoseEventInsights } from './glucoseEventInsightsService';

interface OptimizationPeriod {
  days: number;
  label: string;
  dataPoints: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

interface GlucosePattern {
  hourOfDay: number;
  avgGlucose: number;
  variability: number;
  trendDirection: 'rising' | 'falling' | 'stable';
  hypoglycemiaRisk: number;
  hyperglycemiaRisk: number;
}

interface TreatmentEffectiveness {
  insulinSensitivity: number;
  carbRatio: number;
  basalEffectiveness: number;
  smbEffectiveness: number;
  correctionEffectiveness: number;
}

interface AIOpenAPSRecommendations {
  analysisPeriod: OptimizationPeriod;
  currentPerformance: {
    timeInRange: number;
    timeBelow70: number;
    timeAbove180: number;
    avgGlucose: number;
    glucoseVariability: number;
    hypoglycemiaEvents: number;
    hyperglycemiaEvents: number;
  };
  optimizedSettings: {
    maxTempBasal: number;
    maximumIOB: number;
    dynamicISFFactor: number;
    smbMaxMinutes: number;
    smbDeliveryRatio: number;
    enableSMBWithCOB: boolean;
    enableSMBWithTemptarget: boolean;
    enableSMBAlways: boolean;
    carbsReqThreshold: number;
    highTemptargetRaisesSensitivity: boolean;
    lowTemptargetLowersSensitivity: boolean;
  };
  safetyConstraints: {
    maxSafeIOB: number;
    maxSafeTempBasal: number;
    conservativeMode: boolean;
    emergencyThresholds: {
      suspendBelowGlucose: number;
      resumeAboveGlucose: number;
    };
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    hypoglycemiaRisk: number;
    hyperglycemiaRisk: number;
    settingsAggression: 'conservative' | 'moderate' | 'aggressive';
    confidenceScore: number;
  };
  patternAnalysis: {
    dawnPhenomenon: boolean;
    postMealSpikes: boolean;
    nightTimeStability: boolean;
    exerciseImpact: 'low' | 'medium' | 'high';
    stressPatterns: boolean;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    warnings: string[];
  };
  expectedOutcomes: {
    projectedTimeInRange: number;
    projectedTimeBelow70: number;
    projectedTimeAbove180: number;
    expectedImprovementDays: number;
  };
}

class AIOpenAPSOptimizer {
  private calculateOptimizationPeriod(analysisDays: number, dataLength: number): OptimizationPeriod {
    const expectedDataPoints = analysisDays * 288; // 5-minute intervals
    const dataCompleteness = dataLength / expectedDataPoints;
    
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (dataCompleteness > 0.85 && analysisDays >= 14) confidenceLevel = 'high';
    else if (dataCompleteness > 0.70 && analysisDays >= 7) confidenceLevel = 'medium';
    
    return {
      days: analysisDays,
      label: `${analysisDays} days`,
      dataPoints: dataLength,
      confidenceLevel
    };
  }

  private analyzeGlucosePatterns(readings: NightscoutEntry[]): GlucosePattern[] {
    const hourlyPatterns: { [hour: number]: number[] } = {};
    
    // Group readings by hour of day
    readings.forEach((reading: NightscoutEntry) => {
      const hour = new Date(reading.date).getHours();
      if (!hourlyPatterns[hour]) hourlyPatterns[hour] = [];
      hourlyPatterns[hour].push(reading.sgv);
    });
    
    return Object.entries(hourlyPatterns).map(([hour, values]) => {
      const avgGlucose = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avgGlucose, 2), 0) / values.length;
      const variability = Math.sqrt(variance);
      
      // Calculate trend direction
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      let trendDirection: 'rising' | 'falling' | 'stable' = 'stable';
      if (secondAvg - firstAvg > 10) trendDirection = 'rising';
      else if (firstAvg - secondAvg > 10) trendDirection = 'falling';
      
      // Calculate risk scores
      const hypoglycemiaRisk = values.filter(v => v < 70).length / values.length;
      const hyperglycemiaRisk = values.filter(v => v > 180).length / values.length;
      
      return {
        hourOfDay: parseInt(hour),
        avgGlucose,
        variability,
        trendDirection,
        hypoglycemiaRisk,
        hyperglycemiaRisk
      };
    });
  }

  private analyzeTreatmentEffectiveness(readings: NightscoutEntry[], treatments: NightscoutTreatment[]): TreatmentEffectiveness {
    // Analyze insulin sensitivity
    const insulinBoluses = treatments.filter((t: NightscoutTreatment) => t.insulin && t.insulin > 0);
    let insulinSensitivity = 50; // Default ISF
    
    if (insulinBoluses.length > 5) {
      const sensitivities = insulinBoluses.map(bolus => {
        const bolusTime = new Date(bolus.created_at).getTime();
        const postBolus = readings.filter(r => 
          new Date(r.date).getTime() > bolusTime && 
          new Date(r.date).getTime() < bolusTime + (4 * 60 * 60 * 1000) // 4 hours
        );
        
        if (postBolus.length > 0) {
          const glucoseDrop = bolus.glucose - postBolus[postBolus.length - 1].sgv;
          return glucoseDrop / bolus.insulin;
        }
        return 50;
      }).filter(s => s > 0 && s < 200);
      
      if (sensitivities.length > 0) {
        insulinSensitivity = sensitivities.reduce((sum, s) => sum + s, 0) / sensitivities.length;
      }
    }

    // Analyze carb ratio effectiveness
    const carbBoluses = treatments.filter(t => t.carbs && t.carbs > 0 && t.insulin && t.insulin > 0);
    let carbRatio = 15; // Default carb ratio
    
    if (carbBoluses.length > 3) {
      const ratios = carbBoluses.map(meal => meal.carbs / meal.insulin);
      carbRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    }

    return {
      insulinSensitivity: Math.max(20, Math.min(150, insulinSensitivity)),
      carbRatio: Math.max(5, Math.min(30, carbRatio)),
      basalEffectiveness: 0.8, // Placeholder - would need more complex analysis
      smbEffectiveness: 0.7, // Placeholder - would need SMB-specific data
      correctionEffectiveness: 0.85 // Placeholder
    };
  }

  private calculateOptimizedSettings(
    _patterns: GlucosePattern[],
    effectiveness: TreatmentEffectiveness,
    currentPerformance: AIOpenAPSRecommendations['currentPerformance'],
    analysisPeriod: OptimizationPeriod,
    eventBurden: { severeHypo: number; prolongedHypo: number; prolongedHyper: number }
  ): AIOpenAPSRecommendations['optimizedSettings'] {
    // More realistic base settings that match real-world usage
    const baseMaxTempBasal = 4.5; // Increased from 3.0
    const baseMaxIOB = 8.0; // Increased from 4.0
    
    // Adjust based on performance - more aggressive scaling
    let aggressionMultiplier = 1.0;
    if (currentPerformance.timeInRange < 50) aggressionMultiplier = 1.8; // Much more aggressive for poor control
    else if (currentPerformance.timeInRange < 60) aggressionMultiplier = 1.6; // Increased from 1.4
    else if (currentPerformance.timeInRange < 70) aggressionMultiplier = 1.4; // Increased from 1.2
    else if (currentPerformance.timeInRange < 80) aggressionMultiplier = 1.2; // Added tier
    else if (currentPerformance.timeInRange > 85) aggressionMultiplier = 0.95; // Less reduction for good control
    
    // Safety constraints based on hypoglycemia history - less restrictive
    let safetyMultiplier = 1.0;
    if (currentPerformance.timeBelow70 > 8) safetyMultiplier = 0.75; // Only reduce significantly for high hypo rates
    else if (currentPerformance.timeBelow70 > 5) safetyMultiplier = 0.85; // Less reduction
    else if (currentPerformance.timeBelow70 > 2) safetyMultiplier = 0.95; // Minimal reduction

    if (eventBurden.severeHypo > 0) safetyMultiplier *= 0.75;
    else if (eventBurden.prolongedHypo > 1) safetyMultiplier *= 0.85;

    if (eventBurden.prolongedHyper >= 3 && eventBurden.severeHypo === 0) {
      safetyMultiplier *= 1.08;
    }
    
    // Confidence-based adjustments - less conservative
    let confidenceMultiplier = 1.0;
    if (analysisPeriod.confidenceLevel === 'low') confidenceMultiplier = 0.9; // Less reduction
    else if (analysisPeriod.confidenceLevel === 'high') confidenceMultiplier = 1.2; // More boost
    
    const finalMultiplier = aggressionMultiplier * safetyMultiplier * confidenceMultiplier;
    
    // Calculate ISF factor based on effectiveness - more realistic range
    const isfEffectiveness = effectiveness.insulinSensitivity / 50; // Normalized to 50 as baseline
    let dynamicISFFactor = Math.round(100 / isfEffectiveness);
    
    // Adjust DynISF based on time in range for more aggressive optimization
    if (currentPerformance.timeInRange < 60) {
      dynamicISFFactor = Math.min(95, dynamicISFFactor * 0.85); // More aggressive
    } else if (currentPerformance.timeInRange < 70) {
      dynamicISFFactor = Math.min(105, dynamicISFFactor * 0.9);
    }
    
    // Ensure DynISF is in practical range
    dynamicISFFactor = Math.max(60, Math.min(150, dynamicISFFactor));
    
    return {
      maxTempBasal: roundToDecimal(Math.min(8.0, baseMaxTempBasal * finalMultiplier), 2), // Increased max from 6.0
      maximumIOB: roundToDecimal(Math.min(15.0, baseMaxIOB * finalMultiplier), 1), // Increased max from 10.0
      dynamicISFFactor,
      smbMaxMinutes: currentPerformance.timeBelow70 > 5 || eventBurden.severeHypo > 0 ? 30 : 60,
      smbDeliveryRatio: currentPerformance.timeBelow70 > 5 || eventBurden.severeHypo > 0 ? 0.3 : 0.5,
      enableSMBWithCOB: currentPerformance.timeBelow70 < 8 && eventBurden.severeHypo === 0,
      enableSMBWithTemptarget: true,
      enableSMBAlways:
        currentPerformance.timeBelow70 < 5 &&
        currentPerformance.timeInRange > 60 &&
        eventBurden.severeHypo === 0 &&
        eventBurden.prolongedHypo === 0,
      carbsReqThreshold: currentPerformance.timeBelow70 > 5 || eventBurden.prolongedHypo > 0 ? 8 : 4,
      highTemptargetRaisesSensitivity: true,
      lowTemptargetLowersSensitivity: true
    };
  }

  private assessRisk(
    currentPerformance: AIOpenAPSRecommendations['currentPerformance'],
    optimizedSettings: AIOpenAPSRecommendations['optimizedSettings'],
    patterns: GlucosePattern[]
  ): AIOpenAPSRecommendations['riskAssessment'] {
    // Calculate hypoglycemia risk
    const hypoglycemiaRisk = Math.min(100, 
      (currentPerformance.timeBelow70 * 10) + 
      (patterns.reduce((sum, p) => sum + p.hypoglycemiaRisk, 0) / patterns.length * 50)
    );
    
    // Calculate hyperglycemia risk
    const hyperglycemiaRisk = Math.min(100,
      (currentPerformance.timeAbove180 * 5) +
      (patterns.reduce((sum, p) => sum + p.hyperglycemiaRisk, 0) / patterns.length * 30)
    );
    
    // Determine overall risk - adjusted for more realistic thresholds
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (hypoglycemiaRisk > 25 || hyperglycemiaRisk > 70) overallRisk = 'high'; // Raised thresholds
    else if (hypoglycemiaRisk > 12 || hyperglycemiaRisk > 50) overallRisk = 'medium'; // Raised thresholds
    
    // Determine settings aggression - updated for new ranges
    let settingsAggression: 'conservative' | 'moderate' | 'aggressive' = 'moderate';
    if (optimizedSettings.maximumIOB > 10 || optimizedSettings.maxTempBasal > 6) { // Raised thresholds
      settingsAggression = 'aggressive';
    } else if (optimizedSettings.maximumIOB < 5 || optimizedSettings.maxTempBasal < 3.5) { // Raised thresholds
      settingsAggression = 'conservative';
    }
    
    // Calculate confidence score
    const confidenceScore = Math.max(0, Math.min(100,
      100 - (hypoglycemiaRisk * 0.8) - (hyperglycemiaRisk * 0.4) + 
      (currentPerformance.timeInRange * 0.5)
    ));
    
    return {
      overallRisk,
      hypoglycemiaRisk: Math.round(hypoglycemiaRisk),
      hyperglycemiaRisk: Math.round(hyperglycemiaRisk),
      settingsAggression,
      confidenceScore: Math.round(confidenceScore)
    };
  }

  private generateRecommendations(
    currentPerformance: AIOpenAPSRecommendations['currentPerformance'],
    _optimizedSettings: AIOpenAPSRecommendations['optimizedSettings'],
    riskAssessment: AIOpenAPSRecommendations['riskAssessment'],
    patterns: GlucosePattern[],
    eventInsights: ReturnType<typeof analyzeGlucoseEventInsights>
  ): AIOpenAPSRecommendations['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    const warnings: string[] = [];
    
    // Immediate recommendations
    if (riskAssessment.hypoglycemiaRisk > 20) {
      immediate.push("Reduce maximum IOB by 20% to minimize hypoglycemia risk");
      immediate.push("Enable Conservative SMB mode with reduced delivery ratio");
    }
    
    if (currentPerformance.timeInRange < 60) {
      immediate.push("Increase maximum temporary basal rate to improve glucose control");
      immediate.push("Enable SMB with COB for better meal coverage");
    }

    if (eventInsights.eventCounts.severeHypo > 0) {
      immediate.push('Severe low events detected: reduce SMB aggressiveness immediately and re-evaluate after 48-72h');
    }

    if (eventInsights.eventCounts.prolongedHyper >= 2 && eventInsights.eventCounts.severeHypo === 0) {
      immediate.push('Prolonged highs detected: consider a cautious increase in SMB coverage and correction aggressiveness');
    }
    
    if (currentPerformance.timeAbove180 > 25) {
      immediate.push("Implement more aggressive Dynamic ISF factor");
      immediate.push("Reduce carbs required threshold for SMB activation");
    }
    
    // Short-term recommendations
    shortTerm.push("Monitor glucose patterns for 3-5 days after implementing changes");
    shortTerm.push("Adjust basal rates based on overnight stability patterns");
    
    if (patterns.some(p => p.trendDirection === 'rising' && p.hourOfDay >= 4 && p.hourOfDay <= 8)) {
      shortTerm.push("Consider dawn phenomenon treatment with scheduled temp targets");
    }

    const topLowHour = eventInsights.topHypoHours[0];
    if (topLowHour) {
      shortTerm.push(
        `Limit SMB aggressiveness around ${topLowHour.hour.toString().padStart(2, '0')}:00 where low-risk burden is highest`
      );
    }

    const topHighHour = eventInsights.topHyperHours[0];
    if (topHighHour) {
      shortTerm.push(
        `Prioritize correction and basal review around ${topHighHour.hour.toString().padStart(2, '0')}:00 for recurrent highs`
      );
    }
    
    // Long-term recommendations
    longTerm.push("Evaluate carb ratio accuracy through detailed meal logging");
    longTerm.push("Consider insulin sensitivity factor (ISF) optimization based on correction effectiveness");
    
    // Warnings
    if (riskAssessment.overallRisk === 'high') {
      warnings.push("HIGH RISK: Implement changes gradually with close monitoring");
    }
    
    if (riskAssessment.settingsAggression === 'aggressive') {
      warnings.push("Aggressive settings detected - ensure frequent glucose monitoring");
    }
    
    if (currentPerformance.timeBelow70 > 5) {
      warnings.push("HYPOGLYCEMIA RISK: Current settings may be too aggressive");
    }

    if (eventInsights.safetyAlerts.length > 0) {
      warnings.push(...eventInsights.safetyAlerts.slice(0, 2));
    }
    
    return { immediate, shortTerm, longTerm, warnings };
  }

  public async optimizeOpenAPSSettings(
    readings: NightscoutEntry[],
    treatments: NightscoutTreatment[],
    analysisDays: number = 14
  ): Promise<AIOpenAPSRecommendations> {
    
    // Filter data to analysis period
    const cutoffDate = subDays(new Date(), analysisDays);
    const filteredReadings = readings.filter(r => new Date(r.date) >= cutoffDate);
    const filteredTreatments = treatments.filter(t => new Date(t.created_at) >= cutoffDate);

    const startMs = cutoffDate.getTime();
    const endMs = Date.now();
    const eventInsights = analyzeGlucoseEventInsights(filteredReadings, filteredTreatments, { startMs, endMs });
    
    // Calculate analysis period
    const analysisPeriod = this.calculateOptimizationPeriod(analysisDays, filteredReadings.length);
    
    // Calculate current performance
    const totalReadings = Math.max(1, filteredReadings.length);
    const inRange = filteredReadings.filter(r => r.sgv >= 70 && r.sgv <= 180).length;
    const below70 = filteredReadings.filter(r => r.sgv < 70).length;
    const above180 = filteredReadings.filter(r => r.sgv > 180).length;
    const avgGlucose = filteredReadings.reduce((sum, r) => sum + r.sgv, 0) / totalReadings;
    const glucoseValues = filteredReadings.map(r => r.sgv);
    const glucoseVariability = Math.sqrt(
      glucoseValues.reduce((sum, val) => sum + Math.pow(val - avgGlucose, 2), 0) / glucoseValues.length
    );
    
    const currentPerformance = {
      timeInRange: Math.round((inRange / totalReadings) * 100),
      timeBelow70: Math.round((below70 / totalReadings) * 100),
      timeAbove180: Math.round((above180 / totalReadings) * 100),
      avgGlucose: Math.round(avgGlucose),
      glucoseVariability: Math.round(glucoseVariability),
      hypoglycemiaEvents: eventInsights.eventCounts.hypo,
      hyperglycemiaEvents: eventInsights.eventCounts.hyper
    };
    
    // Analyze patterns and effectiveness
    const patterns = this.analyzeGlucosePatterns(filteredReadings);
    const effectiveness = this.analyzeTreatmentEffectiveness(filteredReadings, filteredTreatments);
    
    // Calculate optimized settings
    const optimizedSettings = this.calculateOptimizedSettings(
      patterns,
      effectiveness,
      currentPerformance,
      analysisPeriod,
      {
        severeHypo: eventInsights.eventCounts.severeHypo,
        prolongedHypo: eventInsights.eventCounts.prolongedHypo,
        prolongedHyper: eventInsights.eventCounts.prolongedHyper
      }
    );
    
    // Calculate safety constraints - updated for more aggressive settings
    const safetyConstraints = {
      maxSafeIOB: Math.min(optimizedSettings.maximumIOB, 12.0), // Increased from 8.0
      maxSafeTempBasal: Math.min(optimizedSettings.maxTempBasal, 7.0), // Increased from 5.0
      conservativeMode: currentPerformance.timeBelow70 > 5, // Less restrictive
      emergencyThresholds: {
        suspendBelowGlucose: currentPerformance.timeBelow70 > 8 || eventInsights.eventCounts.severeHypo > 0 ? 75 : 65,
        resumeAboveGlucose: currentPerformance.timeBelow70 > 8 || eventInsights.eventCounts.severeHypo > 0 ? 85 : 80
      }
    };
    
    // Assess risk
    const riskAssessment = this.assessRisk(currentPerformance, optimizedSettings, patterns);
    
    // Analyze specific patterns
    const patternAnalysis = {
      dawnPhenomenon: patterns.some(p => 
        p.hourOfDay >= 4 && p.hourOfDay <= 8 && p.trendDirection === 'rising'
      ),
      postMealSpikes: filteredTreatments.filter(t => t.carbs > 0).length > 0, // Simplified
      nightTimeStability: patterns.filter(p => 
        p.hourOfDay >= 22 || p.hourOfDay <= 6
      ).every(p => p.variability < 30),
      exerciseImpact: 'medium' as 'low' | 'medium' | 'high', // Would need exercise data
      stressPatterns: patterns.some(p => p.variability > 50)
    };
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      currentPerformance,
      optimizedSettings,
      riskAssessment,
      patterns,
      eventInsights
    );
    
    // Calculate expected outcomes
    const expectedOutcomes = {
      projectedTimeInRange: Math.min(85, currentPerformance.timeInRange + 
        (riskAssessment.settingsAggression === 'aggressive' ? 15 : 10)),
      projectedTimeBelow70: Math.max(1, currentPerformance.timeBelow70 - 2),
      projectedTimeAbove180: Math.max(5, currentPerformance.timeAbove180 - 8),
      expectedImprovementDays: riskAssessment.confidenceScore > 70 ? 5 : 10
    };
    
    return {
      analysisPeriod,
      currentPerformance,
      optimizedSettings,
      safetyConstraints,
      riskAssessment,
      patternAnalysis,
      recommendations,
      expectedOutcomes
    };
  }
}

export const aiOpenAPSOptimizer = new AIOpenAPSOptimizer();
