import type { NightscoutDeviceStatus, NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../types/nightscout';
import { computeHypoRiskForecast } from './hypoRiskForecastService';

export type CalibrationBinPoint = {
  binStart: number;
  binEnd: number;
  meanPred: number;
  observed: number;
  count: number;
};

export type CalibrationMetrics = {
  samples: number;
  brier: number | null;
  ece: number | null;
  bins: CalibrationBinPoint[];
};

export type HypoRiskCalibrationResult = {
  params: {
    backtestDays: number;
    horizonHours: number;
    strideMinutes: number;
    bins: number;
  };
  low2h: CalibrationMetrics;
  severeLow2h: CalibrationMetrics;
};

type Options = {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  deviceStatus?: NightscoutDeviceStatus[];
  profile?: NightscoutProfile[];
  thresholds: { low: number; severeLow: number };
  backtestDays?: number;
  horizonHours?: number; // calibration horizon (uses max probability within this horizon)
  strideMinutes?: number;
  bins?: number;
  maxSamples?: number;
  onProgress?: (done: number, total: number) => void;
};

const clamp01 = (p: number) => Math.max(0, Math.min(1, p));

const lowerBoundByDate = (arr: Array<{ date: number }>, cutoff: number) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].date < cutoff) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const computeBins = (pairs: Array<{ p: number; y: number }>, bins: number): CalibrationMetrics => {
  const n = pairs.length;
  if (n === 0) {
    return {
      samples: 0,
      brier: null,
      ece: null,
      bins: []
    };
  }

  const count = new Array<number>(bins).fill(0);
  const sumP = new Array<number>(bins).fill(0);
  const sumY = new Array<number>(bins).fill(0);

  let brierSum = 0;

  for (const { p, y } of pairs) {
    const pp = clamp01(p);
    const yy = y ? 1 : 0;
    const idx = Math.min(bins - 1, Math.floor(pp * bins));
    count[idx] += 1;
    sumP[idx] += pp;
    sumY[idx] += yy;
    const diff = pp - yy;
    brierSum += diff * diff;
  }

  const points: CalibrationBinPoint[] = [];
  let eceSum = 0;
  for (let i = 0; i < bins; i++) {
    if (count[i] === 0) {
      points.push({
        binStart: i / bins,
        binEnd: (i + 1) / bins,
        meanPred: (i + 0.5) / bins,
        observed: 0,
        count: 0
      });
      continue;
    }
    const mp = sumP[i] / count[i];
    const obs = sumY[i] / count[i];
    points.push({
      binStart: i / bins,
      binEnd: (i + 1) / bins,
      meanPred: mp,
      observed: obs,
      count: count[i]
    });
    eceSum += (count[i] / n) * Math.abs(mp - obs);
  }

  return {
    samples: n,
    brier: brierSum / n,
    ece: eceSum,
    bins: points
  };
};

const minSgvInWindow = (entriesSortedAsc: NightscoutEntry[], startMs: number, endMs: number): number | null => {
  if (!entriesSortedAsc.length) return null;
  const startIdx = lowerBoundByDate(entriesSortedAsc, startMs);
  if (startIdx >= entriesSortedAsc.length) return null;

  let min = Infinity;
  for (let i = startIdx; i < entriesSortedAsc.length; i++) {
    const e = entriesSortedAsc[i];
    if (e.date > endMs) break;
    const v = e.sgv;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
  }

  return Number.isFinite(min) ? min : null;
};

export async function computeHypoRiskCalibration(opts: Options): Promise<HypoRiskCalibrationResult> {
  const backtestDays = opts.backtestDays ?? 7;
  const horizonHours = opts.horizonHours ?? 2;
  const strideMinutes = opts.strideMinutes ?? 120;
  const bins = opts.bins ?? 10;
  const maxSamples = opts.maxSamples ?? 90;

  const entriesSortedAsc = [...(opts.entries ?? [])]
    .filter((e) => Number.isFinite(e.date) && Number.isFinite(e.sgv))
    .sort((a, b) => a.date - b.date);

  if (entriesSortedAsc.length < 24) {
    return {
      params: { backtestDays, horizonHours, strideMinutes, bins },
      low2h: { samples: 0, brier: null, ece: null, bins: [] },
      severeLow2h: { samples: 0, brier: null, ece: null, bins: [] }
    };
  }

  const endMs = entriesSortedAsc[entriesSortedAsc.length - 1]!.date;
  const startMs = endMs - backtestDays * 24 * 60 * 60 * 1000;
  const horizonMs = horizonHours * 60 * 60 * 1000;
  const strideMs = strideMinutes * 60_000;

  // Choose as-of timestamps by walking entries and taking roughly stride-spaced samples.
  const asOfTimes: number[] = [];
  let lastChosen = -Infinity;
  for (const e of entriesSortedAsc) {
    if (e.date < startMs) continue;
    if (e.date > endMs - horizonMs) break;
    if (e.date - lastChosen < strideMs) continue;
    asOfTimes.push(e.date);
    lastChosen = e.date;
    if (asOfTimes.length >= maxSamples) break;
  }

  const lowPairs: Array<{ p: number; y: number }> = [];
  const severePairs: Array<{ p: number; y: number }> = [];

  for (let i = 0; i < asOfTimes.length; i++) {
    const asOfMs = asOfTimes[i]!;
    opts.onProgress?.(i, asOfTimes.length);

    const forecast = await computeHypoRiskForecast({
      entries: opts.entries,
      treatments: opts.treatments,
      deviceStatus: opts.deviceStatus,
      profile: opts.profile,
      thresholds: opts.thresholds,
      horizonHours,
      intervalMinutes: 5,
      asOfMs
    });

    if (!forecast) continue;

    const lowP = clamp01(forecast.summary.maxLow2h);
    const severeP = clamp01(forecast.summary.maxSevereLow2h);

    const minAhead = minSgvInWindow(entriesSortedAsc, asOfMs, asOfMs + horizonMs);
    if (minAhead === null) continue;

    const lowY = minAhead < opts.thresholds.low ? 1 : 0;
    const severeY = minAhead < opts.thresholds.severeLow ? 1 : 0;

    lowPairs.push({ p: lowP, y: lowY });
    severePairs.push({ p: severeP, y: severeY });
  }

  opts.onProgress?.(asOfTimes.length, asOfTimes.length);

  return {
    params: { backtestDays, horizonHours, strideMinutes, bins },
    low2h: computeBins(lowPairs, bins),
    severeLow2h: computeBins(severePairs, bins)
  };
}
