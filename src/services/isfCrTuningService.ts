import type { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../types/nightscout';
import { lowerBoundByMs, sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';

export type ScheduleEntry = { time: string; value: number };

type ScheduleSegment = {
  time: string;
  startMin: number;
  endMin: number;
  currentValue: number;
};

type CorrectionSample = {
  tMs: number;
  isfMgdlPerU: number;
  units: number;
  pre: number;
  post: number;
  drop: number;
};

type MealSample = {
  tMs: number;
  carbs: number;
  units: number;
  ratioGPerU: number;
  pre: number;
  post2h: number;
  rise2h: number;
  hadHypo4h: boolean;
};

export type SegmentISFSummary = {
  time: string;
  currentISF?: number;
  n: number;
  medianISF?: number;
  ciLow?: number;
  ciHigh?: number;
  suggestedISF?: number;
  notes: string[];
};

export type SegmentCRSummary = {
  time: string;
  currentCR?: number;
  n: number;
  medianRatioUsed?: number;
  medianRise2h?: number;
  hypoRate?: number;
  suggestedCR?: number;
  notes: string[];
};

export type IsfCrTuningResult = {
  segments: {
    isf: SegmentISFSummary[];
    cr: SegmentCRSummary[];
  };
  totals: {
    correctionCandidates: number;
    cleanCorrections: number;
    mealCandidates: number;
    cleanMeals: number;
  };
  warnings: string[];
};

type ProfileLike = {
  sens?: Array<{ time?: unknown; value?: unknown }>;
  carbratio?: Array<{ time?: unknown; value?: unknown }>;
};

const MINUTES_PER_DAY = 24 * 60;

const timeToMinutes = (time: string): number | null => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const minutesToTime = (min: number): string => {
  const m = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const quantile = (values: number[], q: number): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
};

const bootstrapMedianCI = (values: number[], iterations: number = 250): { low?: number; high?: number } => {
  if (values.length < 2) return { low: undefined, high: undefined };
  const medians: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < values.length; j++) {
      sample.push(values[Math.floor(Math.random() * values.length)]);
    }
    const m = median(sample);
    if (typeof m === 'number') medians.push(m);
  }
  return {
    low: quantile(medians, 0.025),
    high: quantile(medians, 0.975)
  };
};

const clampRelative = (current: number, suggested: number, maxRelativeChange: number): number => {
  const min = current * (1 - maxRelativeChange);
  const max = current * (1 + maxRelativeChange);
  return Math.min(max, Math.max(min, suggested));
};

const buildSegments = (schedule: ScheduleEntry[]): ScheduleSegment[] => {
  const parsed = schedule
    .map((s) => {
      const startMin = timeToMinutes(s.time);
      if (startMin === null) return null;
      return { time: s.time, startMin, currentValue: s.value };
    })
    .filter(Boolean) as Array<{ time: string; startMin: number; currentValue: number }>;

  if (!parsed.length) return [];

  parsed.sort((a, b) => a.startMin - b.startMin);

  const segments: ScheduleSegment[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const start = parsed[i];
    const next = parsed[(i + 1) % parsed.length];
    const endMin = i === parsed.length - 1 ? next.startMin + MINUTES_PER_DAY : next.startMin;
    segments.push({
      time: minutesToTime(start.startMin),
      startMin: start.startMin,
      endMin,
      currentValue: start.currentValue
    });
  }

  return segments;
};

const segmentIndexForMs = (segments: ScheduleSegment[], tMs: number): number => {
  if (!segments.length) return -1;
  const d = new Date(tMs);
  const minuteOfDay = d.getHours() * 60 + d.getMinutes();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const end = seg.endMin > MINUTES_PER_DAY ? seg.endMin - MINUTES_PER_DAY : seg.endMin;

    if (seg.endMin > MINUTES_PER_DAY) {
      // segment wraps midnight
      if (minuteOfDay >= seg.startMin || minuteOfDay < end) return i;
    } else {
      if (minuteOfDay >= seg.startMin && minuteOfDay < seg.endMin) return i;
    }
  }

  return -1;
};

const findClosestEntry = (
  entriesSortedAsc: NightscoutEntry[],
  targetMs: number,
  maxAbsDeltaMs: number
): NightscoutEntry | null => {
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

const hasCarbsInWindow = (
  treatmentsSortedAsc: NightscoutTreatment[],
  startMs: number,
  endMs: number,
  minCarbs: number
): boolean => {
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
    if (typeof units !== 'number') return false;
    if (units < minUnits) return false;

    // ignore temp basal-esque entries
    if (typeof t.duration === 'number' && t.duration > 0) return false;
    if (typeof t.rate === 'number' || typeof t.absolute === 'number') return false;

    return true;
  });
};

const extractActiveProfile = (profiles: NightscoutProfile[]): { sens: ScheduleEntry[]; carbratio: ScheduleEntry[] } | null => {
  if (!profiles?.length) return null;

  const sortedProfiles = [...profiles].sort((a, b) => {
    const dateA = new Date(a.startDate || 0).getTime();
    const dateB = new Date(b.startDate || 0).getTime();
    return dateB - dateA;
  });

  const active = sortedProfiles[0];
  if (!active) return null;

  const defaultProfile = active.defaultProfile || 'Default';
  const profileData = active.store?.[defaultProfile] as ProfileLike | undefined;
  if (!profileData) return null;

  const convert = (segments: unknown): ScheduleEntry[] => {
    if (!Array.isArray(segments)) return [];
    return segments
      .map((segment) => {
        if (!segment || typeof segment !== 'object') return null;
        const record = segment as Record<string, unknown>;
        const time = typeof record.time === 'string' ? record.time : null;
        const value = Number(record.value);
        if (!time || !Number.isFinite(value)) return null;
        const canonical = minutesToTime(timeToMinutes(time) ?? 0);
        return { time: canonical, value };
      })
      .filter(Boolean) as ScheduleEntry[];
  };

  return {
    sens: convert(profileData.sens),
    carbratio: convert(profileData.carbratio)
  };
};

export function computeIsfCrTuning(params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  profiles: NightscoutProfile[];
}): IsfCrTuningResult {
  const warnings: string[] = [];

  const entriesSortedAsc = [...(params.entries || [])].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  const treatmentsSortedAsc = [...(params.treatments || [])].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));

  const profile = extractActiveProfile(params.profiles || []);
  if (!profile) {
    warnings.push('No pump profile schedule found. Showing data-driven estimates only.');
  }

  const isfSegments = buildSegments(profile?.sens ?? []);
  const crSegments = buildSegments(profile?.carbratio ?? []);

  const isfBuckets: CorrectionSample[][] = isfSegments.map(() => []);
  const crBuckets: MealSample[][] = crSegments.map(() => []);

  let correctionCandidates = 0;
  let cleanCorrections = 0;
  let mealCandidates = 0;
  let cleanMeals = 0;

  // --- ISF from clean correction boluses ---
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

    const stacked = hasOtherInsulinBolusInWindow(
      treatmentsSortedAsc,
      tMs + 15 * 60 * 1000,
      tMs + 3 * 60 * 60 * 1000,
      0.2,
      t._id || t.id
    );
    if (stacked) continue;

    const drop = pre.sgv - post.sgv;
    if (drop < 10) continue;

    const isfMgdlPerU = drop / units;
    if (!Number.isFinite(isfMgdlPerU) || isfMgdlPerU < 5 || isfMgdlPerU > 300) continue;

    const segIndex = segmentIndexForMs(isfSegments, tMs);
    if (segIndex < 0) continue;

    cleanCorrections++;
    isfBuckets[segIndex].push({
      tMs,
      isfMgdlPerU,
      units,
      pre: pre.sgv,
      post: post.sgv,
      drop
    });
  }

  // --- CR from meal boluses (very conservative heuristic) ---
  for (const t of treatmentsSortedAsc) {
    const units = t.insulin ?? t.units;
    const carbs = t.carbs ?? 0;

    if (typeof units !== 'number' || units < 0.2) continue;
    if (typeof carbs !== 'number' || carbs < 5) continue;

    // exclude temp basal
    if (typeof t.duration === 'number' && t.duration > 0) continue;
    if (typeof t.rate === 'number' || typeof t.absolute === 'number') continue;

    mealCandidates++;

    const tMs = getTreatmentMs(t);

    const pre = findClosestEntry(entriesSortedAsc, tMs, 15 * 60 * 1000);
    const post2h = findClosestEntry(entriesSortedAsc, tMs + 2 * 60 * 60 * 1000, 35 * 60 * 1000);
    if (!pre || !post2h) continue;

    // isolate: avoid follow-up snacks/corrections
    const snackOrMeal = hasCarbsInWindow(treatmentsSortedAsc, tMs + 15 * 60 * 1000, tMs + 2 * 60 * 60 * 1000, 5);
    if (snackOrMeal) continue;

    const correction = hasOtherInsulinBolusInWindow(
      treatmentsSortedAsc,
      tMs + 30 * 60 * 1000,
      tMs + 2 * 60 * 60 * 1000,
      0.2,
      t._id || t.id
    );
    if (correction) continue;

    const rise2h = post2h.sgv - pre.sgv;
    const ratioGPerU = carbs / units;
    if (!Number.isFinite(ratioGPerU) || ratioGPerU < 1 || ratioGPerU > 80) continue;

    const readings4h = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, tMs, tMs + 4 * 60 * 60 * 1000);
    const hadHypo4h = readings4h.some((r) => r.sgv < 70);

    const segIndex = segmentIndexForMs(crSegments, tMs);
    if (segIndex < 0) continue;

    cleanMeals++;
    crBuckets[segIndex].push({
      tMs,
      carbs,
      units,
      ratioGPerU,
      pre: pre.sgv,
      post2h: post2h.sgv,
      rise2h,
      hadHypo4h
    });
  }

  const isfSummaries: SegmentISFSummary[] = isfSegments.map((seg, idx) => {
    const samples = isfBuckets[idx];
    const values = samples.map((s) => s.isfMgdlPerU);
    const m = median(values);
    const ci = bootstrapMedianCI(values);

    const notes: string[] = [];

    if (samples.length < 5) notes.push('Insufficient clean corrections for a stable estimate.');

    const ciWidth =
      typeof ci.low === 'number' && typeof ci.high === 'number' ? Math.max(0, ci.high - ci.low) : undefined;
    if (typeof ciWidth === 'number' && ciWidth > 50) notes.push('Wide uncertainty (corrections vary a lot).');

    let suggestedISF: number | undefined;
    if (typeof m === 'number') {
      if (samples.length >= 5 && typeof ciWidth === 'number' && ciWidth <= 80) {
        suggestedISF = clampRelative(seg.currentValue, m, 0.1);
        if (Math.abs(suggestedISF - seg.currentValue) < seg.currentValue * 0.01) {
          suggestedISF = undefined;
          notes.push('No meaningful change suggested.');
        }
      } else {
        notes.push('Estimate shown; no change suggested due to low confidence.');
      }
    }

    return {
      time: seg.time,
      currentISF: seg.currentValue,
      n: samples.length,
      medianISF: m,
      ciLow: ci.low,
      ciHigh: ci.high,
      suggestedISF,
      notes
    };
  });

  const crSummaries: SegmentCRSummary[] = crSegments.map((seg, idx) => {
    const samples = crBuckets[idx];
    const ratios = samples.map((s) => s.ratioGPerU);
    const rises = samples.map((s) => s.rise2h);
    const mRatio = median(ratios);
    const mRise = median(rises);
    const hypoRate = samples.length ? samples.filter((s) => s.hadHypo4h).length / samples.length : undefined;

    const notes: string[] = [];
    if (samples.length < 5) notes.push('Insufficient clean meals for a stable estimate.');

    let suggestedCR: number | undefined;
    if (typeof seg.currentValue === 'number') {
      if (samples.length >= 5 && typeof mRise === 'number' && typeof hypoRate === 'number') {
        if (mRise >= 60 && hypoRate <= 0.1) {
          suggestedCR = clampRelative(seg.currentValue, seg.currentValue * 0.95, 0.1);
          notes.push('Post-meal rise suggests slightly more insulin.');
        } else if (mRise <= 20 && hypoRate >= 0.1) {
          suggestedCR = clampRelative(seg.currentValue, seg.currentValue * 1.05, 0.1);
          notes.push('Post-meal lows suggest slightly less insulin.');
        } else {
          notes.push('No consistent meal pattern detected.');
        }
      } else if (typeof mRise === 'number') {
        notes.push('Meal response shown; no change suggested due to low confidence.');
      }
    } else if (typeof mRatio === 'number') {
      notes.push('No current carb ratio schedule found; showing median used.');
    }

    return {
      time: seg.time,
      currentCR: seg.currentValue,
      n: samples.length,
      medianRatioUsed: mRatio,
      medianRise2h: mRise,
      hypoRate,
      suggestedCR,
      notes
    };
  });

  if (!isfSegments.length) warnings.push('No ISF schedule segments found in profile.');
  if (!crSegments.length) warnings.push('No carb ratio schedule segments found in profile.');

  return {
    segments: {
      isf: isfSummaries,
      cr: crSummaries
    },
    totals: {
      correctionCandidates,
      cleanCorrections,
      mealCandidates,
      cleanMeals
    },
    warnings
  };
}
