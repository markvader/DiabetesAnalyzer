import type { NightscoutDeviceStatus, NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../types/nightscout';
import type { PredictionResult } from './advancedPredictionService';
import { advancedPredictionService, type GlucoseReading, type PredictionContext } from './advancedPredictionService';
import { nightscoutTreatmentParser } from './nightscoutTreatmentParser';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { normalCdf } from '../utils/normalDist';

export type HypoRiskForecast = {
  prediction: PredictionResult;
  horizonHours: number;
  intervalMinutes: number;
  inputs: {
    currentBgMgdl: number | null;
    recentSdMgdl: number | null;
    recentCvPct: number | null;
    diaHours: number;
    iobUnits: number | null;
    cobGrams: number | null;
    inputSource: {
      iob: 'deviceStatus' | 'treatments' | 'none';
      cob: 'deviceStatus' | 'treatments' | 'none';
    };
  };
  triggers: {
    elevatedLowProbability: number;
    elevatedSevereLowProbability: number;
  };
  thresholds: {
    low: number;
    severeLow: number;
  };
  probabilitySeries: {
    low: number[];
    severeLow: number[];
  };
  uncertaintySeries: {
    sigmaMgdl: number[];
  };
  summary: {
    maxLow2h: number;
    maxLow6h: number;
    maxSevereLow2h: number;
    maxSevereLow6h: number;
    earliestLowMinute: number | null;
    earliestSevereLowMinute: number | null;
  };
  whyDrivers?: {
    peak: {
      low: { minute: number; probability: number; muMgdl: number; sigmaMgdl: number } | null;
      severeLow: { minute: number; probability: number; muMgdl: number; sigmaMgdl: number } | null;
    };
    top3: {
      low: Array<{ id: string; severity: 'info' | 'moderate' | 'high'; label: string; detail?: string; score: number }>;
      severeLow: Array<{ id: string; severity: 'info' | 'moderate' | 'high'; label: string; detail?: string; score: number }>;
    };
  };
  whyFactors: Array<{
    id: string;
    severity: 'info' | 'moderate' | 'high';
    label: string;
    detail?: string;
  }>;
  // Backwards-compatible, UI-friendly strings.
  explainers: string[];
};

const clamp01 = (p: number) => Math.max(0, Math.min(1, p));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const meanOf = (values: number[]): number | null => {
  if (!values.length) return null;
  const s = values.reduce((a, b) => a + b, 0);
  return s / values.length;
};

const sdOf = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = meanOf(values);
  if (mean === null) return null;
  const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
};

const getRecentTrendMgdlPer5Min = (readings: GlucoseReading[]): number | null => {
  if (readings.length < 6) return null;
  const slice = readings.slice(-6);
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (!first || !last) return null;
  // approximate 5-min step trend across 25 minutes
  const delta = last.sgv - first.sgv;
  return delta / (slice.length - 1);
};

const estimateSigmaFromScenarios = (prediction: PredictionResult, minSigma: number = 10): number[] => {
  const n = prediction.predictions.length;
  const sigma: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hi = prediction.highScenario[i];
    const lo = prediction.lowScenario[i];
    const spread = typeof hi === 'number' && typeof lo === 'number' ? Math.max(0, hi - lo) : 0;
    sigma[i] = Math.max(minSigma, spread / 2);
  }
  return sigma;
};

const getDeviceStatusMs = (ds: NightscoutDeviceStatus): number => {
  if (typeof ds.mills === 'number' && Number.isFinite(ds.mills)) return ds.mills;
  if (typeof ds.date === 'number' && Number.isFinite(ds.date)) return ds.date;
  const parsed = ds.created_at ? Date.parse(ds.created_at) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNumberAtPath = (root: unknown, path: string[]): number | null => {
  let cur: unknown = root;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  if (typeof cur === 'number' && Number.isFinite(cur)) return cur;
  return null;
};

const pickFirstNumber = (...candidates: Array<number | null | undefined>): number | null => {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return null;
};

const extractIobCobFromDeviceStatus = (
  deviceStatus: NightscoutDeviceStatus[] | undefined
): { iob: number | null; cob: number | null } => {
  const arr = Array.isArray(deviceStatus) ? deviceStatus : [];
  if (!arr.length) return { iob: null, cob: null };

  const latest = [...arr].sort((a, b) => getDeviceStatusMs(b) - getDeviceStatusMs(a))[0];
  if (!latest) return { iob: null, cob: null };

  // Common layouts: numbers, nested objects with { iob }, { total }, and cob under openaps.suggested.
  const iob = pickFirstNumber(
    typeof latest.iob === 'number' ? latest.iob : null,
    getNumberAtPath(latest, ['openaps', 'iob', 'iob']),
    getNumberAtPath(latest, ['openaps', 'iob', 'total']),
    getNumberAtPath(latest, ['openaps', 'suggested', 'iob']),
    getNumberAtPath(latest, ['AAPS', 'iob']),
    getNumberAtPath(latest, ['loop', 'iob']),
    getNumberAtPath(latest, ['pump', 'iob'])
  );

  const cob = pickFirstNumber(
    getNumberAtPath(latest, ['openaps', 'suggested', 'cob']),
    getNumberAtPath(latest, ['openaps', 'enacted', 'cob']),
    getNumberAtPath(latest, ['AAPS', 'cob']),
    getNumberAtPath(latest, ['loop', 'cob']),
    getNumberAtPath(latest, ['pump', 'cob']),
    // Some uploaders put cob at top-level (not in our type, but may exist).
    getNumberAtPath(latest as unknown, ['cob'])
  );

  return { iob, cob };
};

const getDiaHoursFromProfile = (profile: NightscoutProfile[] | undefined): number | null => {
  const arr = Array.isArray(profile) ? profile : [];
  for (const p of arr) {
    if (typeof p?.dia === 'number' && Number.isFinite(p.dia) && p.dia > 0.5 && p.dia <= 12) return p.dia;
  }
  return null;
};

const estimateIobCobFromTreatments = (params: {
  treatments: NightscoutTreatment[];
  nowMs: number;
  diaHours: number;
  carbAbsorptionHours: number;
}): { iob: number | null; cob: number | null } => {
  const { treatments, nowMs, diaHours, carbAbsorptionHours } = params;
  const diaMs = Math.max(0.5, diaHours) * 60 * 60 * 1000;
  const carbMs = Math.max(0.5, carbAbsorptionHours) * 60 * 60 * 1000;

  let iob = 0;
  let cob = 0;
  let seenInsulin = false;
  let seenCarbs = false;

  for (const t of treatments) {
    const ms = getTreatmentMs(t);
    if (!Number.isFinite(ms)) continue;
    const dt = nowMs - ms;
    if (dt < 0) continue;

    const insulin = typeof t.insulin === 'number' ? t.insulin : typeof t.units === 'number' ? t.units : null;
    if (typeof insulin === 'number' && Number.isFinite(insulin) && insulin > 0 && dt <= diaMs) {
      const frac = Math.max(0, 1 - dt / diaMs);
      iob += insulin * frac;
      seenInsulin = true;
    }

    const carbs = typeof t.carbs === 'number' ? t.carbs : null;
    if (typeof carbs === 'number' && Number.isFinite(carbs) && carbs > 0 && dt <= carbMs) {
      const frac = Math.max(0, 1 - dt / carbMs);
      cob += carbs * frac;
      seenCarbs = true;
    }
  }

  return {
    iob: seenInsulin ? Math.max(0, iob) : null,
    cob: seenCarbs ? Math.max(0, cob) : null
  };
};

const estimateSigmaSeries = (params: {
  prediction: PredictionResult;
  recentSdMgdl: number | null;
  minSigma: number;
}): number[] => {
  const { prediction, recentSdMgdl, minSigma } = params;
  const sigmaFromScenarios = estimateSigmaFromScenarios(prediction, minSigma);

  // If recent SD is higher than scenario-implied sigma, don't understate risk.
  // Also allow gentle horizon widening even if scenarios are tight (AI outputs can be overconfident).
  const base = typeof recentSdMgdl === 'number' && Number.isFinite(recentSdMgdl) ? recentSdMgdl : null;
  return sigmaFromScenarios.map((s, i) => {
    const horizonFactor = 1 + i * 0.02;
    const alt = base ? base * horizonFactor : 0;
    return Math.max(minSigma, s, alt);
  });
};

const maxOf = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

const indexOfMax = (arr: number[]): number => {
  if (!arr.length) return -1;
  let bestI = 0;
  let best = arr[0] ?? -Infinity;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i] ?? -Infinity;
    if (v > best) {
      best = v;
      bestI = i;
    }
  }
  return bestI;
};

const earliestMinuteAtOrAbove = (probs: number[], threshold: number, intervalMinutes: number): number | null => {
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] >= threshold) return i * intervalMinutes;
  }
  return null;
};

export const computeHypoRiskForecast = async (params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  deviceStatus?: NightscoutDeviceStatus[];
  profile?: NightscoutProfile[];
  thresholds?: { low?: number; severeLow?: number };
  horizonHours?: number;
  intervalMinutes?: number;
}): Promise<HypoRiskForecast | null> => {
  const horizonHours = params.horizonHours ?? 6;
  const intervalMinutes = params.intervalMinutes ?? 5;

  const low = params.thresholds?.low ?? 70;
  const severeLow = params.thresholds?.severeLow ?? 54;

  const entries = params.entries ?? [];
  if (entries.length < 24) return null;

  const readings: GlucoseReading[] = entries
    .map((e) => ({
      sgv: e.sgv,
      date: getEntryMs(e),
      direction: (e as unknown as { direction?: string }).direction,
      trend: (e as unknown as { trend?: number }).trend
    }))
    .filter((r) => Number.isFinite(r.sgv) && Number.isFinite(r.date))
    .sort((a, b) => a.date - b.date);

  if (readings.length < 24) return null;

  const parsed = nightscoutTreatmentParser.parseTreatments(params.treatments ?? [], 12);
  const contextPartial = nightscoutTreatmentParser.generatePredictionContext(parsed);
  const context: PredictionContext = {
    recentMeals: contextPartial.recentMeals ?? [],
    recentInsulin: contextPartial.recentInsulin ?? [],
    recentExercise: contextPartial.recentExercise ?? [],
    timeOfDay: contextPartial.timeOfDay ?? 'morning',
    dayOfWeek: contextPartial.dayOfWeek ?? 'Unknown',
    isWeekend: contextPartial.isWeekend ?? false,
    stressLevel: contextPartial.stressLevel,
    sleepQuality: contextPartial.sleepQuality
  };

  const prediction = await advancedPredictionService.generateDeterministicPredictions(
    readings,
    context,
    horizonHours,
    intervalMinutes
  );

  const currentBgMgdl = readings[readings.length - 1]?.sgv ?? null;
  const recentWindowPoints = Math.min(readings.length, Math.round((3 * 60) / intervalMinutes));
  const recentValues = readings.slice(-recentWindowPoints).map((r) => r.sgv).filter((v) => Number.isFinite(v));
  const recentSdMgdl = sdOf(recentValues);
  const recentMean = meanOf(recentValues);
  const recentCvPct = recentSdMgdl && recentMean ? (recentSdMgdl / recentMean) * 100 : null;

  const diaHours = getDiaHoursFromProfile(params.profile) ?? 4;

  const fromDevice = extractIobCobFromDeviceStatus(params.deviceStatus);
  const nowMs = readings[readings.length - 1]?.date ?? Date.now();
  const fromTreatments = estimateIobCobFromTreatments({
    treatments: params.treatments ?? [],
    nowMs,
    diaHours,
    carbAbsorptionHours: 3
  });

  const iobUnits = fromDevice.iob ?? fromTreatments.iob;
  const cobGrams = fromDevice.cob ?? fromTreatments.cob;
  const inputSource = {
    iob: fromDevice.iob != null ? ('deviceStatus' as const) : fromTreatments.iob != null ? ('treatments' as const) : ('none' as const),
    cob: fromDevice.cob != null ? ('deviceStatus' as const) : fromTreatments.cob != null ? ('treatments' as const) : ('none' as const)
  };

  const sigma = estimateSigmaSeries({ prediction, recentSdMgdl, minSigma: 10 });

  const pLow: number[] = prediction.predictions.map((mu, i) => {
    const s = sigma[i] ?? 10;
    const z = (low - mu) / s;
    return clamp01(normalCdf(z));
  });

  const pSevere: number[] = prediction.predictions.map((mu, i) => {
    const s = sigma[i] ?? 10;
    const z = (severeLow - mu) / s;
    return clamp01(normalCdf(z));
  });

  const peakLowIdx = indexOfMax(pLow);
  const peakSevereIdx = indexOfMax(pSevere);

  const peakLow =
    peakLowIdx >= 0
      ? {
          minute: peakLowIdx * intervalMinutes,
          probability: pLow[peakLowIdx] ?? 0,
          muMgdl: prediction.predictions[peakLowIdx] ?? NaN,
          sigmaMgdl: sigma[peakLowIdx] ?? 10
        }
      : null;

  const peakSevere =
    peakSevereIdx >= 0
      ? {
          minute: peakSevereIdx * intervalMinutes,
          probability: pSevere[peakSevereIdx] ?? 0,
          muMgdl: prediction.predictions[peakSevereIdx] ?? NaN,
          sigmaMgdl: sigma[peakSevereIdx] ?? 10
        }
      : null;

  const points2h = Math.min(pLow.length, Math.round((2 * 60) / intervalMinutes));
  const points6h = Math.min(pLow.length, Math.round((6 * 60) / intervalMinutes));

  const maxLow2h = maxOf(pLow.slice(0, points2h));
  const maxLow6h = maxOf(pLow.slice(0, points6h));
  const maxSevereLow2h = maxOf(pSevere.slice(0, points2h));
  const maxSevereLow6h = maxOf(pSevere.slice(0, points6h));

  // Trigger thresholds for "elevated" risk indicators (UI + summaries).
  const elevatedLowProbability = 0.3;
  const elevatedSevereLowProbability = 0.2;

  const earliestLowMinute = earliestMinuteAtOrAbove(pLow, elevatedLowProbability, intervalMinutes);
  const earliestSevereLowMinute = earliestMinuteAtOrAbove(pSevere, elevatedSevereLowProbability, intervalMinutes);

  const whyFactors: HypoRiskForecast['whyFactors'] = [];

  const trend5 = getRecentTrendMgdlPer5Min(readings);
  if (trend5 !== null && trend5 <= -3) {
    whyFactors.push({
      id: 'trend_fast_falling',
      severity: 'high',
      label: 'Glucose is falling fast',
      detail: `${trend5.toFixed(1)} mg/dL per 5 min (recent)`
    });
  } else if (trend5 !== null && trend5 <= -1.5) {
    whyFactors.push({
      id: 'trend_falling',
      severity: 'moderate',
      label: 'Glucose trend is falling',
      detail: `${trend5.toFixed(1)} mg/dL per 5 min (recent)`
    });
  }

  if (typeof currentBgMgdl === 'number') {
    if (currentBgMgdl <= severeLow + 10) {
      whyFactors.push({
        id: 'current_near_severe',
        severity: 'high',
        label: 'Current glucose is near the severe low threshold',
        detail: `${Math.round(currentBgMgdl)} mg/dL now`
      });
    } else if (currentBgMgdl <= low + 10) {
      whyFactors.push({
        id: 'current_near_low',
        severity: 'moderate',
        label: 'Current glucose is close to the low threshold',
        detail: `${Math.round(currentBgMgdl)} mg/dL now`
      });
    }
  }

  if (recentSdMgdl !== null) {
    if (recentSdMgdl >= 35) {
      whyFactors.push({
        id: 'high_variability',
        severity: 'high',
        label: 'High recent glucose variability',
        detail: `SD ${recentSdMgdl.toFixed(0)} mg/dL (last ~3h)`
      });
    } else if (recentSdMgdl >= 25) {
      whyFactors.push({
        id: 'moderate_variability',
        severity: 'moderate',
        label: 'Elevated recent glucose variability',
        detail: `SD ${recentSdMgdl.toFixed(0)} mg/dL (last ~3h)`
      });
    }
  }

  if (recentCvPct !== null && Number.isFinite(recentCvPct)) {
    if (recentCvPct >= 36) {
      whyFactors.push({
        id: 'high_cv',
        severity: 'moderate',
        label: 'High coefficient of variation (CV)',
        detail: `${recentCvPct.toFixed(0)}% (last ~3h)`
      });
    }
  }

  if (iobUnits !== null) {
    if (iobUnits >= 4) {
      whyFactors.push({
        id: 'high_iob',
        severity: 'high',
        label: 'High insulin-on-board (IOB)',
        detail: `${iobUnits.toFixed(1)}U (${inputSource.iob})`
      });
    } else if (iobUnits >= 2) {
      whyFactors.push({
        id: 'moderate_iob',
        severity: 'moderate',
        label: 'Moderate insulin-on-board (IOB)',
        detail: `${iobUnits.toFixed(1)}U (${inputSource.iob})`
      });
    }
  }

  if (cobGrams !== null) {
    if (cobGrams <= 5) {
      whyFactors.push({
        id: 'low_cob',
        severity: 'moderate',
        label: 'Low carbs-on-board (COB)',
        detail: `${cobGrams.toFixed(0)}g (${inputSource.cob})`
      });
    }
  }

  const minMu = Math.min(...prediction.predictions);
  if (Number.isFinite(minMu) && minMu < low) {
    whyFactors.push({
      id: 'mean_forecast_below_low',
      severity: minMu < severeLow ? 'high' : 'moderate',
      label: 'Mean forecast dips below threshold',
      detail: `min μ ${Math.round(minMu)} mg/dL`
    });
  }

  // Include model-derived risk factors (already explainable)
  for (const f of prediction.riskFactors.slice(0, 8)) {
    whyFactors.push({ id: `model_${f}`, severity: 'info', label: f });
  }

  if (entries.length < 72) {
    whyFactors.push({
      id: 'limited_cgm',
      severity: 'info',
      label: 'Limited recent CGM history reduces forecast confidence'
    });
  }

  const explainers = whyFactors.map((w) => (w.detail ? `${w.label} — ${w.detail}` : w.label));

  const scoreDriversAtPeak = (params2: {
    threshold: number;
    peak: { minute: number; probability: number; muMgdl: number; sigmaMgdl: number } | null;
  }) => {
    const { threshold, peak } = params2;
    if (!peak || !Number.isFinite(peak.muMgdl) || !Number.isFinite(peak.sigmaMgdl) || peak.sigmaMgdl <= 0) return [];

    const mu = peak.muMgdl;
    const s = peak.sigmaMgdl;
    const z = (threshold - mu) / s; // higher = more likely below threshold

    const trendScore = trend5 !== null ? clamp((-trend5 - 0.5) / 3, 0, 1) : 0;
    const proximityScore = clamp((z - 0.5) / 2.5, 0, 1);
    const variabilityScore = recentSdMgdl !== null ? clamp((recentSdMgdl - 15) / 25, 0, 1) : 0;
    const iobScore = iobUnits !== null ? clamp((iobUnits - 0.5) / 4, 0, 1) : 0;
    const cobScore = cobGrams !== null ? clamp((5 - cobGrams) / 5, 0, 1) : 0;
    const meanBelowScore = clamp((threshold - mu) / 25, 0, 1);

    const scored: Array<{ id: string; severity: 'info' | 'moderate' | 'high'; label: string; detail?: string; score: number }> = [];

    if (proximityScore > 0) {
      scored.push({
        id: 'driver_proximity',
        severity: proximityScore > 0.66 ? 'high' : 'moderate',
        label: 'Forecast distribution is close to the low threshold',
        detail: `z=${z.toFixed(2)} (μ ${Math.round(mu)}, σ ${Math.round(s)})`,
        score: 0.40 * proximityScore
      });
    }

    if (trendScore > 0) {
      scored.push({
        id: 'driver_trend',
        severity: trendScore > 0.66 ? 'high' : 'moderate',
        label: 'Falling trend increases risk',
        detail: trend5 !== null ? `${trend5.toFixed(1)} mg/dL per 5 min (recent)` : undefined,
        score: 0.20 * trendScore
      });
    }

    if (variabilityScore > 0) {
      scored.push({
        id: 'driver_variability',
        severity: variabilityScore > 0.66 ? 'high' : 'moderate',
        label: 'Higher recent variability widens uncertainty',
        detail: recentSdMgdl !== null ? `SD ${recentSdMgdl.toFixed(0)} mg/dL (~3h)` : undefined,
        score: 0.15 * variabilityScore
      });
    }

    if (iobScore > 0) {
      scored.push({
        id: 'driver_iob',
        severity: iobScore > 0.66 ? 'high' : 'moderate',
        label: 'Insulin-on-board (IOB) contributes downward pressure',
        detail: iobUnits !== null ? `${iobUnits.toFixed(1)}U (${inputSource.iob})` : undefined,
        score: 0.15 * iobScore
      });
    }

    if (cobScore > 0) {
      scored.push({
        id: 'driver_cob',
        severity: cobScore > 0.66 ? 'moderate' : 'info',
        label: 'Low carbs-on-board (COB) reduces buffering',
        detail: cobGrams !== null ? `${cobGrams.toFixed(0)}g (${inputSource.cob})` : undefined,
        score: 0.05 * cobScore
      });
    }

    if (meanBelowScore > 0) {
      scored.push({
        id: 'driver_mean_below',
        severity: meanBelowScore > 0.66 ? 'high' : 'moderate',
        label: 'Mean forecast is below threshold at peak time',
        detail: `μ ${Math.round(mu)} vs threshold ${Math.round(threshold)}`,
        score: 0.05 * meanBelowScore
      });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  const whyDrivers: HypoRiskForecast['whyDrivers'] = {
    peak: { low: peakLow, severeLow: peakSevere },
    top3: {
      low: scoreDriversAtPeak({ threshold: low, peak: peakLow }),
      severeLow: scoreDriversAtPeak({ threshold: severeLow, peak: peakSevere })
    }
  };

  return {
    prediction,
    horizonHours,
    intervalMinutes,
    inputs: {
      currentBgMgdl,
      recentSdMgdl,
      recentCvPct,
      diaHours,
      iobUnits,
      cobGrams,
      inputSource
    },
    triggers: {
      elevatedLowProbability,
      elevatedSevereLowProbability
    },
    thresholds: { low, severeLow },
    probabilitySeries: { low: pLow, severeLow: pSevere },
    uncertaintySeries: { sigmaMgdl: sigma },
    summary: {
      maxLow2h,
      maxLow6h,
      maxSevereLow2h,
      maxSevereLow6h,
      earliestLowMinute,
      earliestSevereLowMinute
    },
    whyDrivers,
    whyFactors,
    explainers
  };
};
