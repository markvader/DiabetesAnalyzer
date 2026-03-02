import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { getTreatmentMs } from '../utils/nightscoutTime';

export interface GlucoseEvent {
  type: 'hypo' | 'hyper';
  startMs: number;
  endMs: number;
  durationMin: number;
  nadirMgdl: number;
  peakMgdl: number;
  severe: boolean;
  prolonged: boolean;
  relatedToMeal: boolean;
  relatedToCorrection: boolean;
  dominantHour: number;
}

export interface HourlyGlucoseRisk {
  hour: number;
  readings: number;
  lowPct: number;
  highPct: number;
  hypoEvents: number;
  hyperEvents: number;
}

export interface GlucoseEventInsights {
  period: {
    startMs: number;
    endMs: number;
    days: number;
    totalReadings: number;
  };
  metrics: {
    timeInRangePct: number;
    lowPct: number;
    highPct: number;
    veryLowPct: number;
    veryHighPct: number;
    avgGlucoseMgdl: number;
  };
  eventCounts: {
    hypo: number;
    hyper: number;
    severeHypo: number;
    severeHyper: number;
    prolongedHypo: number;
    prolongedHyper: number;
    postMealHypo: number;
    postMealHyper: number;
  };
  events: GlucoseEvent[];
  hourlyRisk: HourlyGlucoseRisk[];
  topHypoHours: HourlyGlucoseRisk[];
  topHyperHours: HourlyGlucoseRisk[];
  safetyAlerts: string[];
  recommendations: {
    smb: string[];
    carbRatio: string[];
    isf: string[];
    basal: string[];
    general: string[];
  };
  aiSummary: {
    confidence: number;
    headline: string;
    riskLevel: 'low' | 'moderate' | 'high';
  };
}

const HYPO_THRESHOLD = 70;
const SEVERE_HYPO_THRESHOLD = 54;
const HYPER_THRESHOLD = 180;
const SEVERE_HYPER_THRESHOLD = 250;
const TARGET_MIN = 70;
const TARGET_MAX = 180;

const MAX_EVENT_GAP_MS = 20 * 60 * 1000;
const PROLONGED_EVENT_MIN = 45;
const MEAL_LINK_WINDOW_MS = 4 * 60 * 60 * 1000;
const CORRECTION_LINK_WINDOW_MS = 3 * 60 * 60 * 1000;

function toSafeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function isMealTreatment(treatment: NightscoutTreatment): boolean {
  return (treatment.carbs ?? 0) > 0;
}

function isCorrectionTreatment(treatment: NightscoutTreatment): boolean {
  const insulin = treatment.insulin ?? treatment.units ?? 0;
  const carbs = treatment.carbs ?? 0;
  return insulin > 0.1 && carbs <= 0;
}

function buildHourlyRisk(readings: NightscoutEntry[], events: GlucoseEvent[]): HourlyGlucoseRisk[] {
  const base = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    readings: 0,
    lowCount: 0,
    highCount: 0,
    hypoEvents: 0,
    hyperEvents: 0
  }));

  for (const reading of readings) {
    const hour = new Date(reading.date).getHours();
    const row = base[hour];
    if (!row) continue;
    const sgv = toSafeNumber(reading.sgv);
    if (sgv === null || sgv <= 0) continue;

    row.readings += 1;
    if (sgv < HYPO_THRESHOLD) row.lowCount += 1;
    if (sgv > HYPER_THRESHOLD) row.highCount += 1;
  }

  for (const event of events) {
    const row = base[event.dominantHour];
    if (!row) continue;
    if (event.type === 'hypo') row.hypoEvents += 1;
    if (event.type === 'hyper') row.hyperEvents += 1;
  }

  return base.map((row) => ({
    hour: row.hour,
    readings: row.readings,
    lowPct: row.readings ? (row.lowCount / row.readings) * 100 : 0,
    highPct: row.readings ? (row.highCount / row.readings) * 100 : 0,
    hypoEvents: row.hypoEvents,
    hyperEvents: row.hyperEvents
  }));
}

function classifyRiskLevel(params: {
  lowPct: number;
  highPct: number;
  severeHypo: number;
  prolongedHyper: number;
  hypoEvents: number;
  hyperEvents: number;
}): 'low' | 'moderate' | 'high' {
  const highRisk =
    params.severeHypo > 0 ||
    params.lowPct >= 4 ||
    params.prolongedHyper >= 3 ||
    params.highPct >= 40;

  if (highRisk) return 'high';

  const moderateRisk =
    params.hypoEvents >= 4 ||
    params.hyperEvents >= 5 ||
    params.lowPct >= 2 ||
    params.highPct >= 30 ||
    params.prolongedHyper >= 1;

  return moderateRisk ? 'moderate' : 'low';
}

export function analyzeGlucoseEventInsights(
  readingsInput: NightscoutEntry[],
  treatmentsInput: NightscoutTreatment[],
  range?: { startMs: number; endMs: number }
): GlucoseEventInsights {
  const readings = [...readingsInput]
    .filter((reading) => Number.isFinite(reading.date) && Number.isFinite(reading.sgv))
    .sort((a, b) => a.date - b.date);

  const treatments = [...treatmentsInput]
    .filter((treatment) => Number.isFinite(getTreatmentMs(treatment)))
    .sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));

  const firstMs = range?.startMs ?? (readings[0]?.date ?? Date.now());
  const lastMs = range?.endMs ?? (readings[readings.length - 1]?.date ?? firstMs);
  const days = Math.max(1, (lastMs - firstMs) / (24 * 60 * 60 * 1000));

  if (!readings.length) {
    return {
      period: { startMs: firstMs, endMs: lastMs, days, totalReadings: 0 },
      metrics: {
        timeInRangePct: 0,
        lowPct: 0,
        highPct: 0,
        veryLowPct: 0,
        veryHighPct: 0,
        avgGlucoseMgdl: 0
      },
      eventCounts: {
        hypo: 0,
        hyper: 0,
        severeHypo: 0,
        severeHyper: 0,
        prolongedHypo: 0,
        prolongedHyper: 0,
        postMealHypo: 0,
        postMealHyper: 0
      },
      events: [],
      hourlyRisk: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        readings: 0,
        lowPct: 0,
        highPct: 0,
        hypoEvents: 0,
        hyperEvents: 0
      })),
      topHypoHours: [],
      topHyperHours: [],
      safetyAlerts: ['No glucose readings found in selected period.'],
      recommendations: {
        smb: ['Collect at least 3 full days of CGM + treatment data before changing SMB settings.'],
        carbRatio: ['Record meal carbs and meal boluses consistently to enable carb-ratio recommendations.'],
        isf: ['Log correction boluses to improve ISF recommendations.'],
        basal: ['Ensure overnight CGM continuity to evaluate basal safety.'],
        general: ['Select a longer period (at least 14 days) for more stable analysis.']
      },
      aiSummary: {
        confidence: 0,
        headline: 'Insufficient data for event-level analysis.',
        riskLevel: 'low'
      }
    };
  }

  const mealTimes = treatments.filter(isMealTreatment).map((t) => getTreatmentMs(t));
  const correctionTimes = treatments.filter(isCorrectionTreatment).map((t) => getTreatmentMs(t));

  const events: GlucoseEvent[] = [];
  let activeType: 'hypo' | 'hyper' | null = null;
  let activeStart = 0;
  let activeEnd = 0;
  let activeNadir = Number.POSITIVE_INFINITY;
  let activePeak = Number.NEGATIVE_INFINITY;
  let previousEventReadingMs = 0;
  let hourHistogram = new Array<number>(24).fill(0);

  const finalizeActiveEvent = () => {
    if (!activeType || activeEnd < activeStart) return;

    const durationMin = Math.max(1, (activeEnd - activeStart) / 60000);
    const severe = activeType === 'hypo' ? activeNadir < SEVERE_HYPO_THRESHOLD : activePeak > SEVERE_HYPER_THRESHOLD;
    const prolonged = durationMin >= PROLONGED_EVENT_MIN;

    const dominantHour = hourHistogram
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)[0]?.hour ?? new Date(activeStart).getHours();

    const relatedToMeal = mealTimes.some((mealTime) => activeStart >= mealTime && activeStart <= mealTime + MEAL_LINK_WINDOW_MS);
    const relatedToCorrection = correctionTimes.some(
      (correctionTime) => activeStart >= correctionTime && activeStart <= correctionTime + CORRECTION_LINK_WINDOW_MS
    );

    events.push({
      type: activeType,
      startMs: activeStart,
      endMs: activeEnd,
      durationMin,
      nadirMgdl: Number.isFinite(activeNadir) ? activeNadir : activeStart,
      peakMgdl: Number.isFinite(activePeak) ? activePeak : activeStart,
      severe,
      prolonged,
      relatedToMeal,
      relatedToCorrection,
      dominantHour
    });

    activeType = null;
    activeStart = 0;
    activeEnd = 0;
    activeNadir = Number.POSITIVE_INFINITY;
    activePeak = Number.NEGATIVE_INFINITY;
    previousEventReadingMs = 0;
    hourHistogram = new Array<number>(24).fill(0);
  };

  for (const reading of readings) {
    const sgv = Number(reading.sgv);
    if (!Number.isFinite(sgv) || sgv <= 0) continue;

    const type: 'hypo' | 'hyper' | null = sgv < HYPO_THRESHOLD ? 'hypo' : sgv > HYPER_THRESHOLD ? 'hyper' : null;

    if (!type) {
      finalizeActiveEvent();
      continue;
    }

    if (!activeType) {
      activeType = type;
      activeStart = reading.date;
      activeEnd = reading.date;
      previousEventReadingMs = reading.date;
      activeNadir = sgv;
      activePeak = sgv;
      hourHistogram[new Date(reading.date).getHours()] += 1;
      continue;
    }

    const gapMs = reading.date - previousEventReadingMs;
    if (activeType !== type || gapMs > MAX_EVENT_GAP_MS) {
      finalizeActiveEvent();
      activeType = type;
      activeStart = reading.date;
      activeEnd = reading.date;
      previousEventReadingMs = reading.date;
      activeNadir = sgv;
      activePeak = sgv;
      hourHistogram[new Date(reading.date).getHours()] += 1;
      continue;
    }

    activeEnd = reading.date;
    previousEventReadingMs = reading.date;
    activeNadir = Math.min(activeNadir, sgv);
    activePeak = Math.max(activePeak, sgv);
    hourHistogram[new Date(reading.date).getHours()] += 1;
  }

  finalizeActiveEvent();

  const values = readings.map((reading) => Number(reading.sgv)).filter((value) => Number.isFinite(value) && value > 0);
  const lowCount = values.filter((value) => value < TARGET_MIN).length;
  const highCount = values.filter((value) => value > TARGET_MAX).length;
  const veryLowCount = values.filter((value) => value < SEVERE_HYPO_THRESHOLD).length;
  const veryHighCount = values.filter((value) => value > SEVERE_HYPER_THRESHOLD).length;
  const inRangeCount = values.filter((value) => value >= TARGET_MIN && value <= TARGET_MAX).length;
  const avgGlucose = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  const hypoEvents = events.filter((event) => event.type === 'hypo');
  const hyperEvents = events.filter((event) => event.type === 'hyper');

  const eventCounts = {
    hypo: hypoEvents.length,
    hyper: hyperEvents.length,
    severeHypo: hypoEvents.filter((event) => event.severe).length,
    severeHyper: hyperEvents.filter((event) => event.severe).length,
    prolongedHypo: hypoEvents.filter((event) => event.prolonged).length,
    prolongedHyper: hyperEvents.filter((event) => event.prolonged).length,
    postMealHypo: hypoEvents.filter((event) => event.relatedToMeal).length,
    postMealHyper: hyperEvents.filter((event) => event.relatedToMeal).length
  };

  const hourlyRisk = buildHourlyRisk(readings, events);

  const topHypoHours = [...hourlyRisk]
    .filter((row) => row.readings >= 6)
    .sort((a, b) => (b.hypoEvents * 2 + b.lowPct) - (a.hypoEvents * 2 + a.lowPct))
    .slice(0, 3);

  const topHyperHours = [...hourlyRisk]
    .filter((row) => row.readings >= 6)
    .sort((a, b) => (b.hyperEvents * 2 + b.highPct) - (a.hyperEvents * 2 + a.highPct))
    .slice(0, 3);

  const safetyAlerts: string[] = [];
  if ((lowCount / values.length) * 100 >= 4 || eventCounts.severeHypo > 0) {
    safetyAlerts.push('High risk: critical hypoglycemia burden detected. Prioritize safety reductions before aggressive changes.');
  } else if ((lowCount / values.length) * 100 >= 2 || eventCounts.hypo >= 4) {
    safetyAlerts.push('Moderate risk: elevated hypoglycemia burden detected. Use conservative insulin adjustments and monitor closely.');
  }

  if ((highCount / values.length) * 100 >= 35 || eventCounts.prolongedHyper >= 3) {
    safetyAlerts.push('Moderate-to-high risk: persistent hyperglycemia burden detected. Consider structured increases in correction and meal coverage.');
  }

  if (eventCounts.postMealHypo >= 2 && eventCounts.postMealHyper >= 2) {
    safetyAlerts.push('High post-meal variability detected (both lows and highs). Focus on meal timing and carb announcement quality.');
  }

  const recommendations = {
    smb: [
      eventCounts.severeHypo > 0
        ? 'Reduce SMB delivery ratio by 10-20% and shorten max SMB minutes until severe lows resolve.'
        : eventCounts.prolongedHyper >= 2 && eventCounts.hypo <= 1
          ? 'Increase SMB coverage gradually (small step-up in SMB ratio or max minutes), then re-check after 3 days.'
          : 'Keep SMB settings stable and verify impact by hour-of-day before changing multiple SMB parameters at once.',
      topHypoHours[0]
        ? `Apply stricter SMB limits during ${topHypoHours[0].hour.toString().padStart(2, '0')}:00-${topHypoHours[0].hour
            .toString()
            .padStart(2, '0')}:59 due to low-event clustering.`
        : 'No dominant low-event SMB hour found; continue standard safety profile.'
    ],
    carbRatio: [
      eventCounts.postMealHypo >= 2
        ? 'Post-meal hypoglycemia is frequent: make carb ratio less aggressive in affected meal windows (+5% to +10%).'
        : eventCounts.postMealHyper >= 3 && eventCounts.postMealHypo === 0
          ? 'Post-meal hyperglycemia dominates without lows: consider a slightly stronger carb ratio (-5% to -10%).'
          : 'Meal outcomes are mixed: prioritize better carb entry timing before changing carb ratios aggressively.',
      'Track 2-4 hour post-meal glucose response per meal type to validate each carb-ratio change.'
    ],
    isf: [
      eventCounts.hypo >= 3
        ? 'Frequent lows suggest ISF may be too aggressive in parts of the day; increase ISF (less aggressive) in low-heavy segments.'
        : eventCounts.prolongedHyper >= 2 && eventCounts.hypo <= 1
          ? 'Prolonged highs with low hypo burden suggest under-correction; reduce ISF slightly (more aggressive) in high-heavy segments.'
          : 'ISF appears broadly balanced; prefer time-segment tuning only where event clusters repeat.',
      `Use correction-only windows and avoid meal/exercise confounders; current data confidence is based on ${Math.round(days)} days.`
    ],
    basal: [
      topHypoHours[0]
        ? `Overnight/segment lows cluster around ${topHypoHours[0].hour.toString().padStart(2, '0')}:00. Consider reducing preceding basal segment by 5%.`
        : 'No strong low-hour cluster found for basal reduction.',
      topHyperHours[0]
        ? `Hyperglycemia clusters around ${topHyperHours[0].hour.toString().padStart(2, '0')}:00. Consider a small basal increase (up to 5%) before that window if lows are controlled.`
        : 'No strong high-hour basal target found.'
    ],
    general: [
      'Apply one parameter change at a time and reassess over 48-72 hours.',
      'Prioritize resolving severe or prolonged hypoglycemia before tightening high-glucose control.',
      'Use selected-period event clusters (not global averages alone) when deciding SMB/CR/ISF/Basal changes.'
    ]
  };

  const confidenceBase = Math.min(100, Math.max(20, (values.length / (days * 288)) * 100));
  const stabilityPenalty = Math.min(30, percentile(values, 90) - percentile(values, 10)) / 4;
  const confidence = Math.max(10, Math.round(confidenceBase - stabilityPenalty));

  const headline =
    eventCounts.severeHypo > 0
      ? 'Safety-first mode: severe low events detected; reduce aggressiveness before optimization.'
      : eventCounts.prolongedHyper >= 3 && eventCounts.hypo <= 1
        ? 'Hyperglycemia-led pattern: controlled step-up in SMB/ISF aggressiveness is likely beneficial.'
        : eventCounts.postMealHypo > 0 && eventCounts.postMealHyper > 0
          ? 'Mixed post-meal excursions: focus on meal-window CR and SMB targeting.'
          : 'Balanced risk profile: optimize by dominant hourly clusters and treatment context.';

  const riskLevel = classifyRiskLevel({
    lowPct: values.length ? (lowCount / values.length) * 100 : 0,
    highPct: values.length ? (highCount / values.length) * 100 : 0,
    severeHypo: eventCounts.severeHypo,
    prolongedHyper: eventCounts.prolongedHyper,
    hypoEvents: eventCounts.hypo,
    hyperEvents: eventCounts.hyper
  });

  return {
    period: {
      startMs: firstMs,
      endMs: lastMs,
      days,
      totalReadings: readings.length
    },
    metrics: {
      timeInRangePct: values.length ? (inRangeCount / values.length) * 100 : 0,
      lowPct: values.length ? (lowCount / values.length) * 100 : 0,
      highPct: values.length ? (highCount / values.length) * 100 : 0,
      veryLowPct: values.length ? (veryLowCount / values.length) * 100 : 0,
      veryHighPct: values.length ? (veryHighCount / values.length) * 100 : 0,
      avgGlucoseMgdl: avgGlucose
    },
    eventCounts,
    events,
    hourlyRisk,
    topHypoHours,
    topHyperHours,
    safetyAlerts,
    recommendations,
    aiSummary: {
      confidence,
      headline,
      riskLevel
    }
  };
}
