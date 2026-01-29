import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';

export type MealAbsorptionSample = {
  tMs: number;
  carbs: number;
  insulinU?: number;

  speedClass?: 'fast' | 'medium' | 'slow';
  tauFitMin?: number;

  pre?: number;
  peak?: number;
  deltaPeak?: number;

  timeToPeakMin?: number;
  settleTimeMin?: number;

  aucAbovePreMgdlMin?: number;
  hadHypo6h: boolean;
};

export type MealAbsorptionSummary = {
  n: number;
  medianTimeToPeakMin?: number;
  medianSettleTimeMin?: number;
  medianDeltaPeak?: number;
  medianAucAbovePreMgdlMin?: number;
  hypoRate?: number;
};

export type MealAbsorptionSpeedProfile = {
  n: number;
  medianTauFitMin?: number;
  medianTimeToPeakMin?: number;
  medianSettleTimeMin?: number;
};

export type MealAbsorptionProfile = {
  recommendedTauMin?: number;
  bySpeed: {
    fast: MealAbsorptionSpeedProfile;
    medium: MealAbsorptionSpeedProfile;
    slow: MealAbsorptionSpeedProfile;
  };
};

export type MealAbsorptionResult = {
  totals: {
    mealCandidates: number;
    cleanMeals: number;
  };
  summary: {
    overall: MealAbsorptionSummary;
    bySize: {
      small: MealAbsorptionSummary;
      medium: MealAbsorptionSummary;
      large: MealAbsorptionSummary;
    };
  };
  profile?: MealAbsorptionProfile;
  samples: MealAbsorptionSample[];
  warnings: string[];
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const buildSpeedProfile = (samples: MealAbsorptionSample[]): MealAbsorptionSpeedProfile => {
  const tau = samples.map((s) => s.tauFitMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const ttp = samples.map((s) => s.timeToPeakMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const settle = samples.map((s) => s.settleTimeMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return {
    n: samples.length,
    medianTauFitMin: median(tau),
    medianTimeToPeakMin: median(ttp),
    medianSettleTimeMin: median(settle)
  };
};

const buildSummary = (samples: MealAbsorptionSample[]): MealAbsorptionSummary => {
  const ttp = samples.map((s) => s.timeToPeakMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const settle = samples.map((s) => s.settleTimeMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const dPeak = samples.map((s) => s.deltaPeak).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const auc = samples.map((s) => s.aucAbovePreMgdlMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const hypoRate = samples.length ? samples.filter((s) => s.hadHypo6h).length / samples.length : undefined;

  return {
    n: samples.length,
    medianTimeToPeakMin: median(ttp),
    medianSettleTimeMin: median(settle),
    medianDeltaPeak: median(dPeak),
    medianAucAbovePreMgdlMin: median(auc),
    hypoRate
  };
};

const isTempBasalTreatment = (t: NightscoutTreatment): boolean => {
  const eventType = (t.eventType || '').toLowerCase();
  if (eventType.includes('temp basal')) return true;
  if (typeof t.duration === 'number' && t.duration > 0 && (typeof t.rate === 'number' || typeof t.absolute === 'number')) return true;
  return false;
};

const hasCarbsInWindow = (
  treatmentsSortedAsc: NightscoutTreatment[],
  startMs: number,
  endMs: number,
  minCarbs: number,
  excludeTreatmentId?: string
): boolean => {
  const slice = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, startMs, endMs);
  return slice.some((t) => {
    if (excludeTreatmentId && (t._id === excludeTreatmentId || t.id === excludeTreatmentId)) return false;
    const carbs = t.carbs ?? 0;
    return typeof carbs === 'number' && carbs >= minCarbs;
  });
};

const hasBolusInWindow = (
  treatmentsSortedAsc: NightscoutTreatment[],
  startMs: number,
  endMs: number,
  minUnits: number,
  excludeTreatmentId?: string
): boolean => {
  const slice = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, startMs, endMs);
  return slice.some((t) => {
    if (excludeTreatmentId && (t._id === excludeTreatmentId || t.id === excludeTreatmentId)) return false;

    const units = t.insulin ?? t.units;
    if (typeof units !== 'number' || units < minUnits) return false;

    // ignore temp basal-esque entries
    if (typeof t.duration === 'number' && t.duration > 0) return false;
    if (typeof t.rate === 'number' || typeof t.absolute === 'number') return false;

    return true;
  });
};

const hasTempBasalInWindow = (treatmentsSortedAsc: NightscoutTreatment[], startMs: number, endMs: number): boolean => {
  const slice = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, startMs, endMs);
  return slice.some(isTempBasalTreatment);
};

const medianInWindow = (readingsSortedAsc: NightscoutEntry[], startMs: number, endMs: number): number | undefined => {
  const slice = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, startMs, endMs);
  if (!slice.length) return undefined;
  return median(slice.map((r) => r.sgv));
};

const integrateAucAboveBaseline = (readingsSortedAsc: NightscoutEntry[], startMs: number, endMs: number, baseline: number): number | undefined => {
  const slice = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, startMs, endMs);
  if (slice.length < 2) return undefined;

  let auc = 0;
  for (let i = 1; i < slice.length; i++) {
    const a = slice[i - 1];
    const b = slice[i];
    const dtMin = (getEntryMs(b) - getEntryMs(a)) / (60 * 1000);
    if (!Number.isFinite(dtMin) || dtMin <= 0 || dtMin > 30) continue;

    const ya = Math.max(0, a.sgv - baseline);
    const yb = Math.max(0, b.sgv - baseline);
    auc += ((ya + yb) / 2) * dtMin;
  }

  return auc;
};

const fitTauFromDecay = (params: {
  readingsSortedAsc: NightscoutEntry[];
  baseline: number;
  mealMs: number;
  peakMs: number;
  deltaPeak: number;
}): number | undefined => {
  const { readingsSortedAsc, baseline, mealMs, peakMs, deltaPeak } = params;
  if (!Number.isFinite(deltaPeak) || deltaPeak <= 0) return undefined;

  // Use post-peak points with meaningful signal.
  const decayWindow = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, peakMs, mealMs + 6 * 60 * 60 * 1000);
  const points = decayWindow
    .map((r) => {
      const tMin = (getEntryMs(r) - peakMs) / (60 * 1000);
      const y = r.sgv - baseline;
      return { tMin, y };
    })
    .filter((p) => Number.isFinite(p.tMin) && p.tMin >= 10 && p.tMin <= 240 && Number.isFinite(p.y) && p.y >= 10);

  if (points.length < 6) return undefined;

  // Simple grid search over tau in minutes.
  let bestTau: number | undefined;
  let bestSse = Number.POSITIVE_INFINITY;

  for (let tau = 30; tau <= 180; tau += 5) {
    let sse = 0;
    for (const p of points) {
      const yPred = deltaPeak * Math.exp(-p.tMin / tau);
      const err = p.y - yPred;
      sse += err * err;
    }

    if (sse < bestSse) {
      bestSse = sse;
      bestTau = tau;
    }
  }

  return typeof bestTau === 'number' ? clamp(bestTau, 20, 240) : undefined;
};

const classifySpeed = (params: { timeToPeakMin?: number; settleTimeMin?: number; tauFitMin?: number }): 'fast' | 'medium' | 'slow' | undefined => {
  const { timeToPeakMin, settleTimeMin, tauFitMin } = params;

  if (typeof tauFitMin === 'number' && Number.isFinite(tauFitMin)) {
    if (tauFitMin <= 55) return 'fast';
    if (tauFitMin <= 85) return 'medium';
    return 'slow';
  }

  if (typeof timeToPeakMin !== 'number' || !Number.isFinite(timeToPeakMin)) return undefined;

  // Fallback classification based on observed peak + settling.
  if (timeToPeakMin <= 55 && (typeof settleTimeMin !== 'number' || settleTimeMin <= 180)) return 'fast';
  if (timeToPeakMin <= 85) return 'medium';
  return 'slow';
};

const computeSettleTimeMin = (readingsSortedAsc: NightscoutEntry[], mealMs: number, peakMs: number, baseline: number): number | undefined => {
  const threshold = baseline + 20;
  const afterPeak = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, peakMs, mealMs + 6 * 60 * 60 * 1000);
  if (afterPeak.length < 2) return undefined;

  for (let i = 1; i < afterPeak.length; i++) {
    const prev = afterPeak[i - 1];
    const curr = afterPeak[i];

    // require downward/flat slope and crossing below threshold
    if (curr.sgv <= threshold) {
      const slope = curr.sgv - prev.sgv;
      if (slope <= 0) {
        const tMin = (getEntryMs(curr) - mealMs) / (60 * 1000);
        if (tMin >= 60) return tMin;
      }
    }
  }

  return undefined;
};

const sizeBucket = (carbs: number): 'small' | 'medium' | 'large' => {
  if (carbs < 30) return 'small';
  if (carbs < 60) return 'medium';
  return 'large';
};

export function computeMealAbsorption(params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  rangeStartMs: number;
  rangeEndMs: number;
}): MealAbsorptionResult {
  const warnings: string[] = [];

  const entriesSortedAsc = [...(params.entries || [])].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  const treatmentsSortedAsc = [...(params.treatments || [])].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));

  const mealTreatments = treatmentsSortedAsc.filter((t) => {
    const carbs = t.carbs ?? 0;
    if (typeof carbs !== 'number' || carbs < 10) return false;
    const tMs = getTreatmentMs(t);
    return tMs >= params.rangeStartMs && tMs <= params.rangeEndMs;
  });

  let mealCandidates = 0;
  let cleanMeals = 0;

  const samples: MealAbsorptionSample[] = [];

  for (const meal of mealTreatments) {
    const carbs = meal.carbs ?? 0;
    if (typeof carbs !== 'number' || carbs < 10) continue;

    mealCandidates++;

    const mealMs = getTreatmentMs(meal);
    const mealId = meal._id || meal.id;

    // Clean meal filtering to reduce confounders
    // - No additional carbs soon after
    // - No correction bolus soon after
    // - No temp basal nearby
    const hasSnack = hasCarbsInWindow(treatmentsSortedAsc, mealMs + 15 * 60 * 1000, mealMs + 3 * 60 * 60 * 1000, 10, mealId);
    if (hasSnack) continue;

    const hasCorrectionBolus = hasBolusInWindow(treatmentsSortedAsc, mealMs + 30 * 60 * 1000, mealMs + 3 * 60 * 60 * 1000, 0.2, mealId);
    if (hasCorrectionBolus) continue;

    const hasTemp = hasTempBasalInWindow(treatmentsSortedAsc, mealMs - 30 * 60 * 1000, mealMs + 4 * 60 * 60 * 1000);
    if (hasTemp) continue;

    // Pre baseline as median of last 15 min
    const pre = medianInWindow(entriesSortedAsc, mealMs - 15 * 60 * 1000, mealMs);
    if (typeof pre !== 'number') continue;

    // Window readings
    const window = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, mealMs, mealMs + 6 * 60 * 60 * 1000);
    if (window.length < 12) continue;

    // Peak in first 4 hours
    const peakWindow = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, mealMs, mealMs + 4 * 60 * 60 * 1000);
    if (!peakWindow.length) continue;

    let peak = peakWindow[0];
    for (const r of peakWindow) {
      if (r.sgv > peak.sgv) peak = r;
    }

    const peakMs = getEntryMs(peak);
    const deltaPeak = peak.sgv - pre;
    if (!Number.isFinite(deltaPeak) || deltaPeak < 5) continue;

    const timeToPeakMin = (peakMs - mealMs) / (60 * 1000);
    if (!Number.isFinite(timeToPeakMin) || timeToPeakMin < 0 || timeToPeakMin > 300) continue;

    const settleTimeMin = computeSettleTimeMin(entriesSortedAsc, mealMs, peakMs, pre);
    const aucAbovePre = integrateAucAboveBaseline(entriesSortedAsc, mealMs, mealMs + 6 * 60 * 60 * 1000, pre);

    const tauFitMin = fitTauFromDecay({ readingsSortedAsc: entriesSortedAsc, baseline: pre, mealMs, peakMs, deltaPeak });
    const speedClass = classifySpeed({ timeToPeakMin, settleTimeMin, tauFitMin });

    const anyLow6h = window.some((r) => r.sgv < 70);

    cleanMeals++;

    const insulinU = typeof (meal.insulin ?? meal.units) === 'number' ? (meal.insulin ?? meal.units) : undefined;

    samples.push({
      tMs: mealMs,
      carbs,
      insulinU,
      speedClass,
      tauFitMin,
      pre,
      peak: peak.sgv,
      deltaPeak,
      timeToPeakMin,
      settleTimeMin,
      aucAbovePreMgdlMin: aucAbovePre,
      hadHypo6h: anyLow6h
    });
  }

  if (cleanMeals < 5) {
    warnings.push('Few clean meals qualify with the current filters. Consider widening the date range.');
  }

  const bySize = {
    small: samples.filter((s) => sizeBucket(s.carbs) === 'small'),
    medium: samples.filter((s) => sizeBucket(s.carbs) === 'medium'),
    large: samples.filter((s) => sizeBucket(s.carbs) === 'large')
  };

  const bySpeed = {
    fast: samples.filter((s) => s.speedClass === 'fast'),
    medium: samples.filter((s) => s.speedClass === 'medium'),
    slow: samples.filter((s) => s.speedClass === 'slow')
  };

  const tauAll = samples.map((s) => s.tauFitMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const recommendedTauMin = median(tauAll);

  return {
    totals: {
      mealCandidates,
      cleanMeals
    },
    summary: {
      overall: buildSummary(samples),
      bySize: {
        small: buildSummary(bySize.small),
        medium: buildSummary(bySize.medium),
        large: buildSummary(bySize.large)
      }
    },
    profile: {
      recommendedTauMin,
      bySpeed: {
        fast: buildSpeedProfile(bySpeed.fast),
        medium: buildSpeedProfile(bySpeed.medium),
        slow: buildSpeedProfile(bySpeed.slow)
      }
    },
    samples: samples.sort((a, b) => b.tMs - a.tMs).slice(0, 40),
    warnings
  };
}
