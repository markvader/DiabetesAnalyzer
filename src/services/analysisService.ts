import { roundToDecimal } from '../utils/mathUtils';
import { toMmol, GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { analyzeWithAI } from './aiEnhancedAnalysisService';
import { InsulinPumpProfile, getPumpById, getPumpPlatformCompatibility, type TherapyAlgorithm } from '../constants/insulinPumps';
import type { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../types/nightscout';
import { getTreatmentMs } from '../utils/nightscoutTime';
import { computeIsfCrTuning } from './isfCrTuningService';
import { computeIsfDriftModel } from './isfDriftModelService';
import { analyzeGlucoseEventInsights, type GlucoseEventInsights } from './glucoseEventInsightsService';

// Define types for analysis
type BGReading = Pick<NightscoutEntry, 'sgv' | 'date' | 'dateString'>;
type Treatment = NightscoutTreatment;

interface TimeSegment {
  time: string;
  rate: number;
}

interface Profile {
  basal: TimeSegment[];
  carbratio: TimeSegment[];
  sens: TimeSegment[]; // ISF
}

interface CustomGlucoseRanges {
  lowThreshold: number;
  highThreshold: number;
  targetMin: number;
  targetMax: number;
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
  aiEnhanced?: unknown;
  safetyWarnings: string[];
  pumpProfile?: InsulinPumpProfile | null;
  eventInsights?: GlucoseEventInsights;
}

type CarbPattern = {
  timeOfDay: string;
  avgCarbs: number;
  avgGlucoseResponse: number;
  frequency: number;
};

// Constants for analysis - MUCH MORE CONSERVATIVE
// Default to GLUCOSE_RANGES but allow custom settings to override
function getGlucoseThresholds(customRanges?: CustomGlucoseRanges) {
  return {
    TARGET_BG_MIN: customRanges?.targetMin ?? GLUCOSE_RANGES.TARGET_MIN,
    TARGET_BG_MAX: customRanges?.targetMax ?? GLUCOSE_RANGES.TARGET_MAX,
    HIGH_BG_THRESHOLD: customRanges?.highThreshold ?? GLUCOSE_RANGES.HIGH_THRESHOLD,
    LOW_BG_THRESHOLD: customRanges?.lowThreshold ?? GLUCOSE_RANGES.LOW_THRESHOLD
  };
}

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

// Calculate time in range percentage with custom glucose ranges
function calculateTimeInRange(readings: BGReading[], customRanges?: CustomGlucoseRanges) {
  if (!readings.length) return { inRange: 0, high: 0, low: 0 };
  
  const thresholds = getGlucoseThresholds(customRanges);
  
  const inRange = readings.filter(r => {
    const mmol = toMmol(r.sgv);
    return mmol >= thresholds.TARGET_BG_MIN && mmol <= thresholds.TARGET_BG_MAX;
  }).length;
  
  const high = readings.filter(r => toMmol(r.sgv) > thresholds.TARGET_BG_MAX).length;
  const low = readings.filter(r => toMmol(r.sgv) < thresholds.TARGET_BG_MIN).length;
  
  return {
    inRange: (inRange / readings.length) * 100,
    high: (high / readings.length) * 100,
    low: (low / readings.length) * 100
  };
}

// Get active profile from Nightscout data
function getActiveProfile(profiles: NightscoutProfile[]): Profile | null {
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

  const convertTimeSegments = (segments: unknown): TimeSegment[] => {
    if (!Array.isArray(segments)) return [];
    return segments
      .map((segment) => {
        if (!segment || typeof segment !== 'object') return null;
        const record = segment as Record<string, unknown>;
        const time = typeof record.time === 'string' ? record.time : null;
        const rate = Number(record.value);
        if (!time || !Number.isFinite(rate)) return null;
        return { time, rate };
      })
      .filter(Boolean) as TimeSegment[];
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
function analyzeISF(params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  profiles: NightscoutProfile[];
  currentProfile: Profile;
  safetyWarnings: string[];
}): TimeSegment[] {
  const readings = params.entries as BGReading[];
  const timeGroups = groupReadingsByTimeOfDay(readings);
  const adjustedISF: TimeSegment[] = [];

  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  const forbidMoreAggressive = hypoglycemiaRisk > 10;

  // Use newer, data-driven signal first (clean correction boluses) and fall back to drift bins.
  let tuning: ReturnType<typeof computeIsfCrTuning> | null = null;
  try {
    tuning = computeIsfCrTuning({ entries: params.entries, treatments: params.treatments, profiles: params.profiles });
  } catch {
    tuning = null;
  }

  const timeToMinutes = (time: string): number | null => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const tuningByStartMin = new Map<number, { suggested?: number; median?: number; ciWidth?: number; n: number }>();
  if (tuning?.segments?.isf?.length) {
    for (const seg of tuning.segments.isf) {
      const startMin = timeToMinutes(seg.time);
      if (startMin === null) continue;
      const ciWidth =
        typeof seg.ciLow === 'number' && typeof seg.ciHigh === 'number' ? Math.max(0, seg.ciHigh - seg.ciLow) : undefined;
      tuningByStartMin.set(startMin, {
        suggested: seg.suggestedISF,
        median: seg.medianISF,
        ciWidth,
        n: seg.n
      });
    }
  }

  let drift: ReturnType<typeof computeIsfDriftModel> | null = null;
  try {
    drift = computeIsfDriftModel({ entries: params.entries, treatments: params.treatments, timeBinMinutes: 120 });
  } catch {
    drift = null;
  }

  const driftMultiplierForTime = (time: string): number | null => {
    if (!drift?.timeOfDay?.length) return null;
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const minuteOfDay = h * 60 + m;
    const bin = drift.timeOfDay.find((b) => minuteOfDay >= b.startMin && minuteOfDay < b.endMin);
    if (!bin) return null;
    return typeof bin.multiplier === 'number' && Number.isFinite(bin.multiplier) ? bin.multiplier : null;
  };

  const driftAlpha = (conf: 'high' | 'medium' | 'low'): number => {
    // Shrink low-confidence drift toward 1.0 so we still get gentle suggestions.
    if (conf === 'high') return 1.0;
    if (conf === 'medium') return 0.6;
    return 0.3;
  };

  const clampRelative = (current: number, suggested: number, maxRelativeChange: number): number => {
    const min = current * (1 - maxRelativeChange);
    const max = current * (1 + maxRelativeChange);
    return Math.min(max, Math.max(min, suggested));
  };

  // Adaptive rounding:
  // - mmol/L/U schedules are typically < 20 and should keep 0.1 precision.
  // - mg/dL/U schedules are typically >= 20 and can be integer.
  const roundIsf = (value: number, reference: number): number => {
    const decimals = reference < 20 ? 1 : 0;
    return roundToDecimal(value, decimals);
  };

  const visibleStep = (reference: number): number => (reference < 20 ? 0.1 : 1);

  const hadAnyLowInHour = (hour: number): boolean => {
    const bgValues = timeGroups[`${hour}`] ?? [];
    return bgValues.some((bg) => toMmol(bg) < 3.9);
  };

  params.currentProfile.sens.forEach((sens) => {
    const hour = parseInt(sens.time.split(':')[0]);
    const bgValues = timeGroups[`${hour}`] ?? [];
    const lowInThisHour = Number.isFinite(hour) ? hadAnyLowInHour(hour) : false;

    // Start from current schedule.
    const current = sens.rate;
    let target = current;

    // Safety/need signals from CGM + treatment patterns (works even when clean corrections are scarce).
    // These are small “nudges” that can trigger a safe suggestion when needed.
    const nBg = bgValues.length;
    const lowCount = bgValues.filter((bg) => toMmol(bg) < 3.9).length;
    const lowPct = nBg ? (lowCount / nBg) * 100 : 0;
    const avgBg = nBg ? bgValues.reduce((sum, bg) => sum + bg, 0) / nBg : null;
    const avgBGMmol = avgBg !== null ? toMmol(avgBg) : null;

    const hourCorrections = params.treatments.filter((t) => {
      const units = t.insulin ?? t.units;
      const carbs = t.carbs ?? 0;
      if (typeof units !== 'number' || units < 0.2) return false;
      if (carbs > 0) return false;
      const h = new Date(getTreatmentMs(t)).getHours();
      return h === hour;
    });

    // Positive means less aggressive (increase ISF); negative means more aggressive (decrease ISF)
    let nudge = 0;
    if (lowPct > 0) {
      // Any lows in that window → prefer less aggressive for that segment.
      nudge = Math.max(nudge, 0.03);
    } else if (hypoglycemiaRisk > 10) {
      // Elevated overall risk → slight global safety bias.
      nudge = Math.max(nudge, 0.02);
    }

    if (!forbidMoreAggressive && avgBGMmol !== null) {
      // If consistently high and there are frequent corrections, allow tiny increase in aggressiveness.
      if (avgBGMmol > 10 && hourCorrections.length >= 3) nudge = Math.min(nudge, -0.02);
    }

    const startMin = timeToMinutes(sens.time);
    const t = startMin === null ? undefined : tuningByStartMin.get(startMin);
    if (t?.suggested !== undefined && typeof t.suggested === 'number' && Number.isFinite(t.suggested)) {
      // Prefer explicit suggestion from clean-corrections tuning.
      target = t.suggested;
    } else if (t?.median !== undefined && typeof t.median === 'number' && Number.isFinite(t.median) && t.n >= 3) {
      // New behavior: if we have a stable-ish median but the tuner declined to suggest,
      // still allow a tiny, ultra-safe adjustment toward the data.
      target = t.median;

      // If CI is very wide, dampen toward current.
      if (typeof t.ciWidth === 'number' && Number.isFinite(t.ciWidth) && t.ciWidth > 140) {
        target = current + 0.5 * (target - current);
      }
    } else {
      // Fall back to drift multiplier with confidence-weighted blending.
      const mult = driftMultiplierForTime(sens.time);
      if (mult !== null && Number.isFinite(mult) && mult > 0 && drift?.timeOfDay?.length) {
        const minuteOfDay = startMin ?? null;
        const bin = minuteOfDay === null ? null : drift.timeOfDay.find((b) => minuteOfDay >= b.startMin && minuteOfDay < b.endMin);
        const alpha = bin ? driftAlpha(bin.confidence) : 0.3;
        const eff = 1 + alpha * (mult - 1);
        target = current * eff;
      }
    }

    // Apply the nudge on top of the data-driven target.
    // For positive nudges (less aggressive), take the max; for negative (more aggressive), take the min.
    if (nudge > 0) {
      target = Math.max(target, current * (1 + nudge));
    } else if (nudge < 0 && !forbidMoreAggressive) {
      target = Math.min(target, current * (1 + nudge));
    }

    // Safety gating:
    // - If there are any lows in this hour (or overall hypo risk is elevated), never make ISF more aggressive.
    if ((lowInThisHour || forbidMoreAggressive) && target < current) {
      target = current;
      if (lowInThisHour) params.safetyWarnings.push(`Hypoglycemia detected near ${sens.time} - preventing more aggressive ISF`);
    }

    // Ultra-safe cap: always limit changes to ±5%.
    const capped = clampRelative(current, target, ADJUSTMENT_FACTOR_ISF);

    // Round in a unit-aware way and ensure that meaningful changes remain visible after rounding.
    const currentRounded = roundIsf(current, current);
    let rounded = roundIsf(capped, current);

    const relativeMove = current > 0 ? Math.abs(capped - current) / current : 0;
    const minVisibleRelative = 0.015; // ~1.5%
    if (rounded === currentRounded && relativeMove >= minVisibleRelative) {
      const step = visibleStep(current);
      const sign = capped > current ? 1 : capped < current ? -1 : 0;
      if (sign !== 0) {
        const candidate = currentRounded + sign * step;
        const withinCap = candidate >= current * (1 - ADJUSTMENT_FACTOR_ISF) && candidate <= current * (1 + ADJUSTMENT_FACTOR_ISF);
        const violatesSafety = (lowInThisHour || forbidMoreAggressive) && candidate < currentRounded;
        if (withinCap && !violatesSafety) rounded = candidate;
      }
    }

    adjustedISF.push({ time: sens.time, rate: rounded });

    // If we have very sparse data for this segment, nudge user via warning (no UI change).
    if (bgValues.length < 6) {
      // Do not spam: only warn once.
      if (!params.safetyWarnings.some((w) => w.includes('Sparse CGM data'))) {
        params.safetyWarnings.push('Sparse CGM data in some periods; ISF suggestions may be less reliable.');
      }
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
): { carbRatioSuggestions: TimeSegment[]; carbPatterns: CarbPattern[] } {
  const adjustedCarbRatio: TimeSegment[] = [];
  const carbPatterns: CarbPattern[] = [];
  const hypoglycemiaRisk = calculateHypoglycemiaRisk(readings);
  
  // Group carb announcements by hour
  const carbsByHour: { [key: string]: { carbs: number[]; responses: number[]; hypos: number } } = {};
  
  treatments.forEach(treatment => {
    if (treatment.carbs && treatment.carbs > 0) {
      const hour = new Date(getTreatmentMs(treatment)).getHours();
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
export async function analyzeData(
  data: { entries: NightscoutEntry[]; treatments: NightscoutTreatment[]; profile: NightscoutProfile[] }, 
  pumpId?: string, 
  customGlucoseRanges?: CustomGlucoseRanges,
  therapyAlgorithm: TherapyAlgorithm = 'aaps'
): Promise<AnalysisResults | null> {
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
  const eventInsights = analyzeGlucoseEventInsights(data.entries, data.treatments);
  
  // Add pump-specific warnings
  if (pumpProfile) {
    const compatibility = getPumpPlatformCompatibility(pumpProfile.id);
    const compatibilityLevel = compatibility[therapyAlgorithm];

    if (compatibilityLevel === 'not-supported') {
      const platformLabel = therapyAlgorithm === 'loop' ? 'Loop' : 'AAPS';
      safetyWarnings.push(`WARNING: ${pumpProfile.name} is not officially supported by ${platformLabel}.`);
    } else if (compatibilityLevel === 'experimental') {
      const platformLabel = therapyAlgorithm === 'loop' ? 'Loop (experimental branch)' : 'AAPS (experimental)';
      safetyWarnings.push(`WARNING: ${pumpProfile.name} uses ${platformLabel} support. Verify settings conservatively.`);
    }
  }
  
  // Calculate basic stats
  const avgBG = readings.length 
    ? roundToDecimal(readings.reduce((sum, r) => sum + r.sgv, 0) / readings.length, 0)
    : 0;
  
  const timeInRangeStats = calculateTimeInRange(readings, customGlucoseRanges);
  
  // Check for critical safety issues
  if (timeInRangeStats.low > 4) {
    safetyWarnings.push('CRITICAL: More than 4% time below range detected. Consider reducing all insulin doses.');
  } else if (timeInRangeStats.low > 2) {
    safetyWarnings.push('WARNING: Elevated hypoglycemia risk detected. Use extreme caution with any changes.');
  }

  if (eventInsights.safetyAlerts.length > 0) {
    safetyWarnings.push(...eventInsights.safetyAlerts);
  }
  
  // Get AI-enhanced analysis
  let aiEnhanced;
  try {
    aiEnhanced = await analyzeWithAI(readings, treatments, currentProfile);

    const hasMeaningfulIsfDelta = (() => {
      try {
        const currentByMin = new Map<number, number>();
        for (const s of currentProfile.sens) {
          const m = timeToMinutes(s.time);
          if (m !== null) currentByMin.set(m, s.rate);
        }

        const suggestedByMin = new Map<number, number>();
        for (const s of aiEnhanced?.isfSuggestions ?? []) {
          const m = timeToMinutes(s.time);
          if (m !== null) suggestedByMin.set(m, s.rate);
        }

        for (const [m, current] of currentByMin.entries()) {
          const suggested = suggestedByMin.get(m);
          if (typeof suggested !== 'number' || !Number.isFinite(suggested) || !Number.isFinite(current) || current <= 0) continue;
          const rel = Math.abs(suggested - current) / current;
          // Require a small but non-trivial difference; avoids early-returning when AI mirrors current.
          if (rel >= 0.01) return true;
        }
        return false;
      } catch {
        return true;
      }
    })();
    
    // Use AI suggestions if available and safe
    if (aiEnhanced.hypoglycemiaRisk < 20 && aiEnhanced.safetyScore > 60 && hasMeaningfulIsfDelta) {
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
        pumpProfile,
        eventInsights
      };
    }
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
    safetyWarnings.push('AI analysis unavailable - using ultra-conservative fallback');
  }
  
  // Fallback to ultra-conservative analysis
  const basalSuggestions = analyzeBasalRates(readings, currentProfile, safetyWarnings, pumpProfile);
  const isfSuggestions = analyzeISF({
    entries: data.entries,
    treatments: data.treatments,
    profiles: data.profile,
    currentProfile,
    safetyWarnings
  });
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
    pumpProfile,
    eventInsights
  };
}