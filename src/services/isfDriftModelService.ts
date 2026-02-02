import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { lowerBoundByMs, sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';

export type DriftConfidence = 'high' | 'medium' | 'low';

export type IsfDriftTimeBin = {
  startMin: number;
  endMin: number;
  label: string;
  n: number;
  medianIsfMgdlPerU: number | null;
  iqrIsfMgdlPerU: number | null;
  multiplier: number | null;
  confidence: DriftConfidence;
};

export type IsfDriftDayOfWeek = {
  dow: number; // 0=Sun .. 6=Sat
  label: string;
  n: number;
  medianIsfMgdlPerU: number | null;
  iqrIsfMgdlPerU: number | null;
  multiplier: number | null;
  confidence: DriftConfidence;
};

export type IsfDriftModelResult = {
  totals: {
    correctionCandidates: number;
    cleanCorrections: number;
  };
  globalMedianIsfMgdlPerU: number | null;
  timeOfDay: IsfDriftTimeBin[];
  dayOfWeek: IsfDriftDayOfWeek[];
  warnings: string[];
};

type CorrectionSample = {
  tMs: number;
  units: number;
  isfMgdlPerU: number;
};

const MINUTES_PER_DAY = 24 * 60;

const minutesToTime = (min: number): string => {
  const m = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
};

const quantile = (values: number[], q: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base] ?? null;
  return (sorted[base] ?? 0) + rest * (next - (sorted[base] ?? 0));
};

const median = (values: number[]): number | null => {
  return quantile(values, 0.5);
};

const iqr = (values: number[]): number | null => {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  if (q1 === null || q3 === null) return null;
  return Math.max(0, q3 - q1);
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const confidenceFrom = (n: number, med: number | null, iqrVal: number | null): DriftConfidence => {
  if (n < 4 || med === null || iqrVal === null || med <= 0) return 'low';
  const rel = iqrVal / med;
  if (n >= 10 && rel <= 0.35) return 'high';
  if (n >= 6 && rel <= 0.55) return 'medium';
  return 'low';
};

const findClosestEntry = (entriesSortedAsc: NightscoutEntry[], targetMs: number, maxAbsDeltaMs: number): NightscoutEntry | null => {
  if (!entriesSortedAsc.length) return null;
  const idx = lowerBoundByMs(entriesSortedAsc, getEntryMs, targetMs);

  let best: NightscoutEntry | null = null;
  let bestAbs = Number.POSITIVE_INFINITY;

  for (const j of [idx - 1, idx, idx + 1]) {
    const item = entriesSortedAsc[j];
    if (!item) continue;
    const abs = Math.abs(getEntryMs(item) - targetMs);
    if (abs <= maxAbsDeltaMs && abs < bestAbs) {
      best = item;
      bestAbs = abs;
    }
  }

  return best;
};

const hasCarbsInWindow = (treatmentsSortedAsc: NightscoutTreatment[], startMs: number, endMs: number, minCarbs: number): boolean => {
  if (!treatmentsSortedAsc.length) return false;
  const slice = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, startMs, endMs);
  return slice.some((t) => (t.carbs ?? 0) >= minCarbs);
};

const hasOtherInsulinBolusInWindow = (
  treatmentsSortedAsc: NightscoutTreatment[],
  startMs: number,
  endMs: number,
  minUnits: number,
  excludeTreatmentId?: string
): boolean => {
  if (!treatmentsSortedAsc.length) return false;
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

const extractCleanCorrections = (entries: NightscoutEntry[], treatments: NightscoutTreatment[]) => {
  const warnings: string[] = [];

  const entriesSortedAsc = [...(entries ?? [])]
    .filter((e) => Number.isFinite(e.sgv) && Number.isFinite(e.date))
    .sort((a, b) => getEntryMs(a) - getEntryMs(b));

  const treatmentsSortedAsc = [...(treatments ?? [])].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));

  let correctionCandidates = 0;
  const samples: CorrectionSample[] = [];

  for (const t of treatmentsSortedAsc) {
    const units = t.insulin ?? t.units;
    const carbs = t.carbs ?? 0;

    if (typeof units !== 'number' || units < 0.2) continue;

    // exclude temp basal / rate changes
    if (typeof t.duration === 'number' && t.duration > 0) continue;
    if (typeof t.rate === 'number' || typeof t.absolute === 'number') continue;

    // keep insulin-only events
    if (carbs > 0) continue;

    correctionCandidates++;

    const tMs = getTreatmentMs(t);

    const pre = findClosestEntry(entriesSortedAsc, tMs, 10 * 60 * 1000);
    const post = findClosestEntry(entriesSortedAsc, tMs + 3 * 60 * 60 * 1000, 35 * 60 * 1000);
    if (!pre || !post) continue;

    // isolate: avoid meals + avoid stacking boluses
    const mealNearby = hasCarbsInWindow(treatmentsSortedAsc, tMs - 30 * 60 * 1000, tMs + 3 * 60 * 60 * 1000, 5);
    if (mealNearby) continue;

    const stacked = hasOtherInsulinBolusInWindow(treatmentsSortedAsc, tMs + 15 * 60 * 1000, tMs + 3 * 60 * 60 * 1000, 0.2, t._id || t.id);
    if (stacked) continue;

    const drop = pre.sgv - post.sgv;
    if (drop < 10) continue;

    const isfMgdlPerU = drop / units;
    if (!Number.isFinite(isfMgdlPerU) || isfMgdlPerU < 5 || isfMgdlPerU > 300) continue;

    samples.push({ tMs, units, isfMgdlPerU });
  }

  if (entriesSortedAsc.length < 24) warnings.push('Not enough CGM points for stable ISF drift modeling.');
  if (samples.length < 6) warnings.push('Not enough clean corrections to learn a reliable pattern.');

  return { warnings, correctionCandidates, samples };
};

export function computeIsfDriftModel(params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  timeBinMinutes?: number; // default 120
}): IsfDriftModelResult {
  const timeBinMinutes = params.timeBinMinutes ?? 120;
  const warnings: string[] = [];

  const { warnings: sampleWarnings, correctionCandidates, samples } = extractCleanCorrections(params.entries, params.treatments);
  warnings.push(...sampleWarnings);

  const globalMedian = median(samples.map((s) => s.isfMgdlPerU));

  const timeBinsCount = Math.max(1, Math.floor(MINUTES_PER_DAY / timeBinMinutes));
  const timeBuckets: number[][] = new Array(timeBinsCount).fill(null).map(() => []);
  for (const s of samples) {
    const d = new Date(s.tMs);
    const m = d.getHours() * 60 + d.getMinutes();
    const idx = clamp(Math.floor(m / timeBinMinutes), 0, timeBinsCount - 1);
    timeBuckets[idx]!.push(s.isfMgdlPerU);
  }

  const timeOfDay: IsfDriftTimeBin[] = timeBuckets.map((values, idx) => {
    const startMin = idx * timeBinMinutes;
    const endMin = startMin + timeBinMinutes;
    const med = median(values);
    const i = iqr(values);
    const conf = confidenceFrom(values.length, med, i);
    const mult = med !== null && globalMedian !== null && globalMedian > 0 ? clamp(med / globalMedian, 0.6, 1.6) : null;
    return {
      startMin,
      endMin,
      label: `${minutesToTime(startMin)}–${minutesToTime(endMin)}`,
      n: values.length,
      medianIsfMgdlPerU: med,
      iqrIsfMgdlPerU: i,
      multiplier: mult,
      confidence: conf
    };
  });

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowBuckets: number[][] = new Array(7).fill(null).map(() => []);
  for (const s of samples) {
    const dow = new Date(s.tMs).getDay();
    dowBuckets[dow]!.push(s.isfMgdlPerU);
  }

  const dayOfWeek: IsfDriftDayOfWeek[] = dowBuckets.map((values, dow) => {
    const med = median(values);
    const i = iqr(values);
    const conf = confidenceFrom(values.length, med, i);
    const mult = med !== null && globalMedian !== null && globalMedian > 0 ? clamp(med / globalMedian, 0.6, 1.6) : null;
    return {
      dow,
      label: dowLabels[dow] ?? String(dow),
      n: values.length,
      medianIsfMgdlPerU: med,
      iqrIsfMgdlPerU: i,
      multiplier: mult,
      confidence: conf
    };
  });

  return {
    totals: {
      correctionCandidates,
      cleanCorrections: samples.length
    },
    globalMedianIsfMgdlPerU: globalMedian,
    timeOfDay,
    dayOfWeek,
    warnings
  };
}
