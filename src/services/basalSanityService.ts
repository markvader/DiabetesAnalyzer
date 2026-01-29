import type { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../types/nightscout';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';

export type BasalScheduleEntry = { time: string; value: number };

type ProfileLike = {
  basal?: Array<{ time?: unknown; value?: unknown }>;
};

type ScheduleSegment = {
  time: string;
  startMin: number;
  endMin: number;
  rateUph: number;
};

export type BasalSanityCheck = {
  severity: 'info' | 'warn';
  title: string;
  details: string;
};

export type BasalFastingWindow = {
  label: 'Overnight' | 'Afternoon';
  startHour: number;
  endHour: number;
};

export type BasalFastingDriftSummary = {
  window: BasalFastingWindow;
  qualifyingDays: number;
  totalDaysConsidered: number;
  medianDriftMgdlPerHr?: number;
  medianStartMgdl?: number;
  medianEndMgdl?: number;
  lowEventRate?: number; // fraction of qualifying windows containing any <70
  interpretation: 'insufficient' | 'stable' | 'drifting-up' | 'drifting-down' | 'possible-hypo-risk';
};

export type DriftNightSample = {
  label: string;
  windowStartMs: number;
  windowEndMs: number;
  readings: number;
  startMedianMgdl: number;
  endMedianMgdl: number;
  slopeMgdlPerHr: number;
};

export type DriftPatternSummary = {
  windowLabel: string;
  qualifyingNights: number;
  totalNightsConsidered: number;
  medianSlopeMgdlPerHr?: number;
  consistency?: number; // 0..1 fraction aligned with median sign
  direction: 'insufficient' | 'stable' | 'drifting-up' | 'drifting-down';
  examples: DriftNightSample[];
};

export type DawnPhenomenonSummary = {
  qualifyingDays: number;
  totalDaysConsidered: number;
  medianBaselineSlopeMgdlPerHr?: number;
  medianDawnSlopeMgdlPerHr?: number;
  medianDeltaSlopeMgdlPerHr?: number;
  consistency?: number;
  interpretation: 'insufficient' | 'no-signal' | 'dawn-like-rise';
  examples: Array<{
    label: string;
    baselineStartMs: number;
    dawnStartMs: number;
    baselineSlopeMgdlPerHr: number;
    dawnSlopeMgdlPerHr: number;
    deltaSlopeMgdlPerHr: number;
  }>;
};

export type CorrectionStackingEvent = {
  firstBolusMs: number;
  secondBolusMs: number;
  deltaMin: number;
  firstUnits: number;
  secondUnits: number;
  glucoseBeforeSecondMgdl?: number;
  slopeBeforeSecondMgdlPerHr?: number;
  reason: 'short-interval' | 'falling-or-flat';
};

export type CorrectionStackingSummary = {
  insulinActionHours: number;
  minWaitMin: number;
  correctionBoluses: number;
  stackingEvents: CorrectionStackingEvent[];
};

export type BasalSanityThresholds = {
  quiet?: {
    lookbackHours?: number;
    carbsGte?: number;
    bolusGteU?: number;
    excludeTempBasal?: boolean | 'auto';
    minReadings?: number;
  };
  overnight?: {
    startHour?: number;
    endHour?: number;
  };
  dawn?: {
    baselineStartHour?: number;
    baselineEndHour?: number;
    dawnStartHour?: number;
    dawnEndHour?: number;
    minReadingsPerWindow?: number;
    dawnSlopeThresholdMgdlPerHr?: number;
    deltaSlopeThresholdMgdlPerHr?: number;
    requiredConsistency?: number;
  };
  correctionStacking?: {
    insulinActionHours?: number | 'auto';
    minWaitMin?: number | 'auto';
    trendLookbackMin?: number;
    fallingOrFlatSlopeThresholdMgdlPerHr?: number;
    maxGlucoseMatchDeltaMin?: number;
  };
};

export type BasalSanityResult = {
  schedule: {
    entries: BasalScheduleEntry[];
    segments: ScheduleSegment[];
    totalDailyBasalU?: number;
  };
  tempBasal: {
    count: number;
    perDay?: number;
    medianDurationMin?: number;
  };
  drift: BasalFastingDriftSummary[];
	patterns: {
		overnight: DriftPatternSummary;
		dawn: DawnPhenomenonSummary;
		correctionStacking: CorrectionStackingSummary;
	};
  checks: BasalSanityCheck[];
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

const isTempBasalTreatment = (t: NightscoutTreatment): boolean => {
  const eventType = (t.eventType || '').toLowerCase();
  if (eventType.includes('temp basal')) return true;
  if (typeof t.duration === 'number' && t.duration > 0 && (typeof t.rate === 'number' || typeof t.absolute === 'number')) return true;
  return false;
};

const extractActiveBasalSchedule = (profiles: NightscoutProfile[]): BasalScheduleEntry[] | null => {
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

  const segments = profileData.basal;
  if (!Array.isArray(segments)) return null;

  const converted = segments
    .map((segment) => {
      if (!segment || typeof segment !== 'object') return null;
      const record = segment as Record<string, unknown>;
      const time = typeof record.time === 'string' ? record.time : null;
      const value = Number(record.value);
      if (!time || !Number.isFinite(value)) return null;
      const m = timeToMinutes(time);
      if (m === null) return null;
      return { time: minutesToTime(m), value };
    })
    .filter(Boolean) as BasalScheduleEntry[];

  return converted.length ? converted : null;
};

const getActiveProfileDiaHours = (profiles: NightscoutProfile[]): number | undefined => {
  if (!profiles?.length) return undefined;
  const sortedProfiles = [...profiles].sort((a, b) => {
    const dateA = new Date(a.startDate || 0).getTime();
    const dateB = new Date(b.startDate || 0).getTime();
    return dateB - dateA;
  });
  const active = sortedProfiles[0];
  if (!active) return undefined;
  const dia = active.dia;
  return typeof dia === 'number' && Number.isFinite(dia) && dia > 0 ? dia : undefined;
};

const buildSegments = (schedule: BasalScheduleEntry[]): ScheduleSegment[] => {
  const parsed = schedule
    .map((s) => {
      const startMin = timeToMinutes(s.time);
      if (startMin === null) return null;
      return { time: minutesToTime(startMin), startMin, rateUph: s.value };
    })
    .filter(Boolean) as Array<{ time: string; startMin: number; rateUph: number }>;

  if (!parsed.length) return [];

  parsed.sort((a, b) => a.startMin - b.startMin);

  const segments: ScheduleSegment[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const start = parsed[i];
    const next = parsed[(i + 1) % parsed.length];
    const endMin = i === parsed.length - 1 ? next.startMin + MINUTES_PER_DAY : next.startMin;
    segments.push({
      time: start.time,
      startMin: start.startMin,
      endMin,
      rateUph: start.rateUph
    });
  }

  return segments;
};

const computeTotalDailyBasal = (segments: ScheduleSegment[]): number | undefined => {
  if (!segments.length) return undefined;
  let total = 0;
  for (const seg of segments) {
    const durationMin = seg.endMin - seg.startMin;
    if (durationMin <= 0) continue;
    total += seg.rateUph * (durationMin / 60);
  }
  return total;
};

const hasTreatmentsInWindow = (
  treatmentsSortedAsc: NightscoutTreatment[],
  startMs: number,
  endMs: number,
  predicate: (t: NightscoutTreatment) => boolean
): boolean => {
  const slice = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, startMs, endMs);
  return slice.some(predicate);
};

const startOfLocalDayMs = (tMs: number): number => {
  const d = new Date(tMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const addDaysLocal = (dayStartMs: number, days: number): number => {
  const d = new Date(dayStartMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

const robustSlopeMgdlPerHr = (readingsSortedAsc: NightscoutEntry[], startMs: number, endMs: number): number | undefined => {
  if (readingsSortedAsc.length < 10) return undefined;
  const durationHr = (endMs - startMs) / (60 * 60 * 1000);
  if (!Number.isFinite(durationHr) || durationHr <= 0) return undefined;

  // Downsample to keep pairwise slope calculation reasonable.
  const maxPoints = 40;
  const step = Math.max(1, Math.ceil(readingsSortedAsc.length / maxPoints));
  const pts: Array<{ t: number; y: number }> = [];
  for (let i = 0; i < readingsSortedAsc.length; i += step) {
    const r = readingsSortedAsc[i];
    pts.push({ t: getEntryMs(r), y: r.sgv });
  }
  if (pts.length < 10) return undefined;

  const slopes: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dtHr = (pts[j].t - pts[i].t) / (60 * 60 * 1000);
      if (dtHr <= 0) continue;
      // Avoid tiny dt (noise) and huge dt (overweight endpoints).
      if (dtHr < 0.25 || dtHr > durationHr) continue;
      slopes.push((pts[j].y - pts[i].y) / dtHr);
    }
  }

  return median(slopes);
};

const closestReadingValue = (
  readingsSortedAsc: NightscoutEntry[],
  targetMs: number,
  maxAbsDeltaMs: number
): number | undefined => {
  const window = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, targetMs - maxAbsDeltaMs, targetMs + maxAbsDeltaMs);
  if (!window.length) return undefined;
  let best = window[0];
  let bestAbs = Math.abs(getEntryMs(best) - targetMs);
  for (const r of window) {
    const abs = Math.abs(getEntryMs(r) - targetMs);
    if (abs < bestAbs) {
      best = r;
      bestAbs = abs;
    }
  }
  return bestAbs <= maxAbsDeltaMs ? best.sgv : undefined;
};

const computeSlopeBeforeMs = (readingsSortedAsc: NightscoutEntry[], tMs: number, lookbackMin: number): number | undefined => {
  const start = tMs - lookbackMin * 60 * 1000;
  const slice = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, start, tMs);
  if (slice.length < 6) return undefined;
  const first = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, start, start + 10 * 60 * 1000);
  const last = sliceSortedByTimeRange(readingsSortedAsc, getEntryMs, tMs - 10 * 60 * 1000, tMs);
  if (!first.length || !last.length) return undefined;
  const m1 = median(first.map((r) => r.sgv));
  const m2 = median(last.map((r) => r.sgv));
  if (typeof m1 !== 'number' || typeof m2 !== 'number') return undefined;
  const dtHr = lookbackMin / 60;
  return (m2 - m1) / dtHr;
};

const isNonTempBolus = (t: NightscoutTreatment, minUnits: number): boolean => {
  const units = t.insulin ?? t.units;
  if (typeof units !== 'number' || units < minUnits) return false;
  // ignore temp basal-esque entries
  if (typeof t.duration === 'number' && t.duration > 0) return false;
  if (typeof t.rate === 'number' || typeof t.absolute === 'number') return false;
  return true;
};

const isCorrectionBolus = (t: NightscoutTreatment): number | null => {
  if (!isNonTempBolus(t, 0.2)) return null;
  const carbs = t.carbs;
  if (typeof carbs === 'number' && carbs >= 5) return null;
  const units = t.insulin ?? t.units;
  return typeof units === 'number' ? units : null;
};

const computeOvernightDriftPatterns = (params: {
  entriesSortedAsc: NightscoutEntry[];
  treatmentsSortedAsc: NightscoutTreatment[];
  rangeStartMs: number;
  rangeEndMs: number;
  startHour: number;
  endHour: number;
  label: string;
  thresholds?: BasalSanityThresholds;
  allowTempBasal?: boolean;
}): DriftPatternSummary => {
  const { entriesSortedAsc, treatmentsSortedAsc, rangeStartMs, rangeEndMs, startHour, endHour, label } = params;
  const lookbackHours = params.thresholds?.quiet?.lookbackHours ?? 4;
  const carbsGte = params.thresholds?.quiet?.carbsGte ?? 5;
  const bolusGteU = params.thresholds?.quiet?.bolusGteU ?? 0.2;
  const minReadings = params.thresholds?.quiet?.minReadings ?? 24;
  const excludeTempBasalSetting = params.thresholds?.quiet?.excludeTempBasal ?? 'auto';
  const excludeTempBasal = excludeTempBasalSetting === 'auto' ? !(params.allowTempBasal ?? false) : excludeTempBasalSetting;
  const lookbackMs = lookbackHours * 60 * 60 * 1000;
  const day0 = startOfLocalDayMs(rangeStartMs);
  const dayN = startOfLocalDayMs(rangeEndMs);
  const totalNightsConsidered = Math.max(0, Math.round((dayN - day0) / (24 * 60 * 60 * 1000)) + 1);

  const samples: DriftNightSample[] = [];
  for (let i = 0; i < totalNightsConsidered; i++) {
    const dayStart = addDaysLocal(day0, i);
    const winStart = dayStart + startHour * 60 * 60 * 1000;
    const winEnd = dayStart + endHour * 60 * 60 * 1000;
    if (winEnd <= rangeStartMs || winStart >= rangeEndMs) continue;
    if (winStart < rangeStartMs || winEnd > rangeEndMs) continue;

    const readings = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winStart, winEnd);
    if (readings.length < minReadings) continue;

    // Quiet-window exclusions (strict): avoid meal/correction/temp basal confounding.
    const hasCarbs = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - lookbackMs, winEnd, (t) => {
      const carbs = t.carbs ?? 0;
      return typeof carbs === 'number' && carbs >= carbsGte;
    });
    if (hasCarbs) continue;

    const hasBolus = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - lookbackMs, winEnd, (t) => isNonTempBolus(t, bolusGteU));
    if (hasBolus) continue;

    if (excludeTempBasal) {
      const hasTempBasal = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - lookbackMs, winEnd, isTempBasalTreatment);
      if (hasTempBasal) continue;
    }

    const firstSlice = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winStart, winStart + 30 * 60 * 1000);
    const lastSlice = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winEnd - 30 * 60 * 1000, winEnd);
    if (!firstSlice.length || !lastSlice.length) continue;

    const startMed = median(firstSlice.map((r) => r.sgv));
    const endMed = median(lastSlice.map((r) => r.sgv));
    if (typeof startMed !== 'number' || typeof endMed !== 'number') continue;

    const slope = robustSlopeMgdlPerHr(readings, winStart, winEnd);
    if (typeof slope !== 'number' || !Number.isFinite(slope)) continue;

    samples.push({
      label: new Date(dayStart).toISOString().slice(0, 10),
      windowStartMs: winStart,
      windowEndMs: winEnd,
      readings: readings.length,
      startMedianMgdl: startMed,
      endMedianMgdl: endMed,
      slopeMgdlPerHr: slope
    });
  }

  const slopes = samples.map((s) => s.slopeMgdlPerHr);
  const medSlope = median(slopes);

  let direction: DriftPatternSummary['direction'] = 'insufficient';
  if (samples.length >= 4 && typeof medSlope === 'number') {
    if (Math.abs(medSlope) < 3) direction = 'stable';
    else direction = medSlope > 0 ? 'drifting-up' : 'drifting-down';
  }

  const sign = typeof medSlope === 'number' ? Math.sign(medSlope) : 0;
  const consistency = (() => {
    if (!samples.length || !sign) return undefined;
    const aligned = samples.filter((s) => Math.sign(s.slopeMgdlPerHr) === sign).length;
    return aligned / samples.length;
  })();

  const examples = (() => {
    if (!samples.length || !sign) return samples.slice(0, 3);
    return [...samples]
      .filter((s) => Math.sign(s.slopeMgdlPerHr) === sign)
      .sort((a, b) => Math.abs(b.slopeMgdlPerHr) - Math.abs(a.slopeMgdlPerHr))
      .slice(0, 3);
  })();

  return {
    windowLabel: label,
    qualifyingNights: samples.length,
    totalNightsConsidered,
    medianSlopeMgdlPerHr: medSlope,
    consistency,
    direction,
    examples
  };
};

const computeDawnPhenomenon = (params: {
  entriesSortedAsc: NightscoutEntry[];
  treatmentsSortedAsc: NightscoutTreatment[];
  rangeStartMs: number;
  rangeEndMs: number;
  thresholds?: BasalSanityThresholds;
  allowTempBasal?: boolean;
}): DawnPhenomenonSummary => {
  const { entriesSortedAsc, treatmentsSortedAsc, rangeStartMs, rangeEndMs } = params;
  const lookbackHours = params.thresholds?.quiet?.lookbackHours ?? 4;
  const carbsGte = params.thresholds?.quiet?.carbsGte ?? 5;
  const bolusGteU = params.thresholds?.quiet?.bolusGteU ?? 0.2;
  const minReadingsPerWindow = params.thresholds?.dawn?.minReadingsPerWindow ?? 18;
  const excludeTempBasalSetting = params.thresholds?.quiet?.excludeTempBasal ?? 'auto';
  const excludeTempBasal = excludeTempBasalSetting === 'auto' ? !(params.allowTempBasal ?? false) : excludeTempBasalSetting;

  const baselineStartHour = params.thresholds?.dawn?.baselineStartHour ?? 0;
  const baselineEndHour = params.thresholds?.dawn?.baselineEndHour ?? 4;
  const dawnStartHour = params.thresholds?.dawn?.dawnStartHour ?? 4;
  const dawnEndHour = params.thresholds?.dawn?.dawnEndHour ?? 8;
  const dawnSlopeThreshold = params.thresholds?.dawn?.dawnSlopeThresholdMgdlPerHr ?? 5;
  const deltaSlopeThreshold = params.thresholds?.dawn?.deltaSlopeThresholdMgdlPerHr ?? 5;
  const requiredConsistency = params.thresholds?.dawn?.requiredConsistency ?? 0.5;
  const lookbackMs = lookbackHours * 60 * 60 * 1000;
  const day0 = startOfLocalDayMs(rangeStartMs);
  const dayN = startOfLocalDayMs(rangeEndMs);
  const totalDaysConsidered = Math.max(0, Math.round((dayN - day0) / (24 * 60 * 60 * 1000)) + 1);

  const baselineSlopes: number[] = [];
  const dawnSlopes: number[] = [];
  const deltaSlopes: number[] = [];
  const examples: DawnPhenomenonSummary['examples'] = [];

  for (let i = 0; i < totalDaysConsidered; i++) {
    const dayStart = addDaysLocal(day0, i);
    const baselineStart = dayStart + baselineStartHour * 60 * 60 * 1000;
    const baselineEnd = dayStart + baselineEndHour * 60 * 60 * 1000;
    const dawnStart = dayStart + dawnStartHour * 60 * 60 * 1000;
    const dawnEnd = dayStart + dawnEndHour * 60 * 60 * 1000;
    if (dawnEnd <= rangeStartMs || baselineStart >= rangeEndMs) continue;
    if (baselineStart < rangeStartMs || dawnEnd > rangeEndMs) continue;

    const baselineReadings = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, baselineStart, baselineEnd);
    const dawnReadings = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, dawnStart, dawnEnd);
    if (baselineReadings.length < minReadingsPerWindow || dawnReadings.length < minReadingsPerWindow) continue;

    const quietStart = baselineStart - lookbackMs;
    const quietEnd = dawnEnd;
    const hasCarbs = hasTreatmentsInWindow(treatmentsSortedAsc, quietStart, quietEnd, (t) => {
      const carbs = t.carbs ?? 0;
      return typeof carbs === 'number' && carbs >= carbsGte;
    });
    if (hasCarbs) continue;
    const hasBolus = hasTreatmentsInWindow(treatmentsSortedAsc, quietStart, quietEnd, (t) => isNonTempBolus(t, bolusGteU));
    if (hasBolus) continue;
    if (excludeTempBasal) {
      const hasTempBasal = hasTreatmentsInWindow(treatmentsSortedAsc, quietStart, quietEnd, isTempBasalTreatment);
      if (hasTempBasal) continue;
    }

    const baselineSlope = robustSlopeMgdlPerHr(baselineReadings, baselineStart, baselineEnd);
    const dawnSlope = robustSlopeMgdlPerHr(dawnReadings, dawnStart, dawnEnd);
    if (typeof baselineSlope !== 'number' || typeof dawnSlope !== 'number') continue;

    const delta = dawnSlope - baselineSlope;
    baselineSlopes.push(baselineSlope);
    dawnSlopes.push(dawnSlope);
    deltaSlopes.push(delta);
    examples.push({
      label: new Date(dayStart).toISOString().slice(0, 10),
      baselineStartMs: baselineStart,
      dawnStartMs: dawnStart,
      baselineSlopeMgdlPerHr: baselineSlope,
      dawnSlopeMgdlPerHr: dawnSlope,
      deltaSlopeMgdlPerHr: delta
    });
  }

  const qualifyingDays = deltaSlopes.length;
  const medBaseline = median(baselineSlopes);
  const medDawn = median(dawnSlopes);
  const medDelta = median(deltaSlopes);

  const dawnLikeDays = deltaSlopes.filter((d, idx) => d >= deltaSlopeThreshold && (dawnSlopes[idx] ?? 0) >= dawnSlopeThreshold).length;
  const consistency = qualifyingDays ? dawnLikeDays / qualifyingDays : undefined;

  let interpretation: DawnPhenomenonSummary['interpretation'] = 'insufficient';
  if (qualifyingDays >= 4 && typeof medDelta === 'number') {
    interpretation = consistency && consistency >= requiredConsistency ? 'dawn-like-rise' : 'no-signal';
  }

  const bestExamples = [...examples]
    .sort((a, b) => b.deltaSlopeMgdlPerHr - a.deltaSlopeMgdlPerHr)
    .slice(0, 3);

  return {
    qualifyingDays,
    totalDaysConsidered,
    medianBaselineSlopeMgdlPerHr: medBaseline,
    medianDawnSlopeMgdlPerHr: medDawn,
    medianDeltaSlopeMgdlPerHr: medDelta,
    consistency,
    interpretation,
    examples: bestExamples
  };
};

const computeCorrectionStacking = (params: {
  entriesSortedAsc: NightscoutEntry[];
  treatmentsSortedAsc: NightscoutTreatment[];
  rangeStartMs: number;
  rangeEndMs: number;
  thresholds?: BasalSanityThresholds;
  diaHours?: number;
}): CorrectionStackingSummary => {
  const { entriesSortedAsc, treatmentsSortedAsc, rangeStartMs, rangeEndMs } = params;
  const defaultIat = params.diaHours ?? 4;
  const insulinActionHours = (() => {
    const configured = params.thresholds?.correctionStacking?.insulinActionHours;
    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) return configured;
    if (configured === 'auto') return defaultIat;
    return defaultIat;
  })();
  const insulinActionMin = insulinActionHours * 60;
  const minWaitMin = (() => {
    const configured = params.thresholds?.correctionStacking?.minWaitMin;
    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) return configured;
    if (configured === 'auto') return Math.round(Math.max(60, Math.min(120, insulinActionHours * 30)));
    return Math.round(Math.max(60, Math.min(120, insulinActionHours * 30)));
  })();
  const trendLookbackMin = params.thresholds?.correctionStacking?.trendLookbackMin ?? 30;
  const fallingOrFlatSlopeThreshold = params.thresholds?.correctionStacking?.fallingOrFlatSlopeThresholdMgdlPerHr ?? 5;
  const maxGlucoseMatchDeltaMin = params.thresholds?.correctionStacking?.maxGlucoseMatchDeltaMin ?? 10;

  const corrections = treatmentsSortedAsc
    .filter((t) => {
      const ms = getTreatmentMs(t);
      return ms >= rangeStartMs && ms <= rangeEndMs;
    })
    .map((t) => ({ t, ms: getTreatmentMs(t), units: isCorrectionBolus(t) }))
    .filter((x): x is { t: NightscoutTreatment; ms: number; units: number } => typeof x.units === 'number')
    .sort((a, b) => a.ms - b.ms);

  const events: CorrectionStackingEvent[] = [];
  for (let i = 1; i < corrections.length; i++) {
    const prev = corrections[i - 1];
    const cur = corrections[i];
    const deltaMin = (cur.ms - prev.ms) / (60 * 1000);
    if (!Number.isFinite(deltaMin) || deltaMin <= 0 || deltaMin > insulinActionMin) continue;

    const slopeBefore = computeSlopeBeforeMs(entriesSortedAsc, cur.ms, trendLookbackMin);
    const glucoseBefore = closestReadingValue(entriesSortedAsc, cur.ms, maxGlucoseMatchDeltaMin * 60 * 1000);

    const reason = deltaMin < minWaitMin
      ? 'short-interval'
      : slopeBefore !== undefined && slopeBefore <= fallingOrFlatSlopeThreshold
        ? 'falling-or-flat'
        : null;
    if (!reason) continue;

    events.push({
      firstBolusMs: prev.ms,
      secondBolusMs: cur.ms,
      deltaMin,
      firstUnits: prev.units,
      secondUnits: cur.units,
      glucoseBeforeSecondMgdl: glucoseBefore,
      slopeBeforeSecondMgdlPerHr: slopeBefore,
      reason
    });
  }

  // Keep most recent examples first
  events.sort((a, b) => b.secondBolusMs - a.secondBolusMs);

  return {
    insulinActionHours,
    minWaitMin,
    correctionBoluses: corrections.length,
    stackingEvents: events.slice(0, 12)
  };
};

const computeFastingDrift = (params: {
  entriesSortedAsc: NightscoutEntry[];
  treatmentsSortedAsc: NightscoutTreatment[];
  rangeStartMs: number;
  rangeEndMs: number;
  window: BasalFastingWindow;
}): BasalFastingDriftSummary => {
  const { entriesSortedAsc, treatmentsSortedAsc, rangeStartMs, rangeEndMs, window } = params;

  const day0 = startOfLocalDayMs(rangeStartMs);
  const dayN = startOfLocalDayMs(rangeEndMs);

  const totalDaysConsidered = Math.max(0, Math.round((dayN - day0) / (24 * 60 * 60 * 1000)) + 1);

  const drifts: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let qualifyingDays = 0;
  let windowsWithLow = 0;

  for (let dayIndex = 0; dayIndex < totalDaysConsidered; dayIndex++) {
    const dayStart = addDaysLocal(day0, dayIndex);
    const winStart = dayStart + window.startHour * 60 * 60 * 1000;
    const winEnd = dayStart + window.endHour * 60 * 60 * 1000;

    if (winEnd <= rangeStartMs || winStart >= rangeEndMs) continue;

    // Require window fully inside selected range to avoid partial drift windows
    if (winStart < rangeStartMs || winEnd > rangeEndMs) continue;

    const readings = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winStart, winEnd);
    if (readings.length < 24) continue;

    // Exclusions: avoid confounders
    const hasCarbs = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - 4 * 60 * 60 * 1000, winEnd, (t) => {
      const carbs = t.carbs ?? 0;
      return typeof carbs === 'number' && carbs >= 5;
    });
    if (hasCarbs) continue;

    const hasBolus = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - 4 * 60 * 60 * 1000, winEnd, (t) => {
      const units = t.insulin ?? t.units;
      if (typeof units !== 'number' || units < 0.2) return false;
      // ignore temp basal-esque entries
      if (typeof t.duration === 'number' && t.duration > 0) return false;
      if (typeof t.rate === 'number' || typeof t.absolute === 'number') return false;
      return true;
    });
    if (hasBolus) continue;

    const hasTempBasal = hasTreatmentsInWindow(treatmentsSortedAsc, winStart - 4 * 60 * 60 * 1000, winEnd, isTempBasalTreatment);
    if (hasTempBasal) continue;

    // Robust endpoints: median of first/last 30 minutes
    const firstSlice = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winStart, winStart + 30 * 60 * 1000);
    const lastSlice = sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, winEnd - 30 * 60 * 1000, winEnd);
    if (!firstSlice.length || !lastSlice.length) continue;

    const startMed = median(firstSlice.map((r) => r.sgv));
    const endMed = median(lastSlice.map((r) => r.sgv));
    if (typeof startMed !== 'number' || typeof endMed !== 'number') continue;

    const anyLow = readings.some((r) => r.sgv < 70);
    if (anyLow) windowsWithLow++;

    const hours = (winEnd - winStart) / (60 * 60 * 1000);
    const drift = (endMed - startMed) / hours;

    qualifyingDays++;
    drifts.push(drift);
    starts.push(startMed);
    ends.push(endMed);
  }

  const medianDrift = median(drifts);
  const lowEventRate = qualifyingDays ? windowsWithLow / qualifyingDays : undefined;

  let interpretation: BasalFastingDriftSummary['interpretation'] = 'insufficient';
  if (qualifyingDays >= 5 && typeof medianDrift === 'number') {
    if (typeof lowEventRate === 'number' && lowEventRate >= 0.2) {
      interpretation = 'possible-hypo-risk';
    } else if (medianDrift <= -20) {
      interpretation = 'drifting-down';
    } else if (medianDrift >= 20) {
      interpretation = 'drifting-up';
    } else {
      interpretation = 'stable';
    }
  }

  return {
    window,
    qualifyingDays,
    totalDaysConsidered,
    medianDriftMgdlPerHr: medianDrift,
    medianStartMgdl: median(starts),
    medianEndMgdl: median(ends),
    lowEventRate,
    interpretation
  };
};

export function computeBasalSanity(params: {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  profiles: NightscoutProfile[];
  rangeStartMs: number;
  rangeEndMs: number;
  pump?: { name?: string; maxBasalRate?: number; basalIncrements?: number } | null;
	thresholds?: BasalSanityThresholds;
}): BasalSanityResult {
  const entriesSortedAsc = [...(params.entries || [])].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  const treatmentsSortedAsc = [...(params.treatments || [])].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));

  const scheduleEntries = extractActiveBasalSchedule(params.profiles || []) || [];
  const segments = buildSegments(scheduleEntries);
  const checks: BasalSanityCheck[] = [];

  if (!scheduleEntries.length) {
    checks.push({
      severity: 'warn',
      title: 'No basal schedule found',
      details: 'Nightscout profile store did not include a basal schedule, so schedule checks are unavailable.'
    });
  }

  if (scheduleEntries.some((s) => s.value <= 0)) {
    checks.push({
      severity: 'warn',
      title: 'Non-positive basal rate',
      details: 'At least one basal segment is 0 or negative. This is unusual and may indicate profile import issues.'
    });
  }

  const maxRate = scheduleEntries.reduce((m, s) => Math.max(m, s.value), 0);
  if (maxRate > 8) {
    checks.push({
      severity: 'warn',
      title: 'Very high basal rate detected',
      details: `Max scheduled basal is ${maxRate.toFixed(2)} U/h. Verify this matches your actual pump profile.`
    });
  }

  if (params.pump?.maxBasalRate && maxRate > params.pump.maxBasalRate) {
    checks.push({
      severity: 'warn',
      title: 'Basal exceeds pump limit',
      details: `Max scheduled basal (${maxRate.toFixed(2)} U/h) exceeds ${params.pump.name ?? 'selected pump'} max (${params.pump.maxBasalRate} U/h).`
    });
  }

  if (segments.length >= 2) {
    for (let i = 0; i < segments.length; i++) {
      const a = segments[i];
      const b = segments[(i + 1) % segments.length];
      if (a.rateUph <= 0 || b.rateUph <= 0) continue;
      const ratio = b.rateUph / a.rateUph;
      if (ratio >= 1.5 || ratio <= 1 / 1.5) {
        checks.push({
          severity: 'warn',
          title: 'Large basal step change',
          details: `Basal changes from ${a.rateUph.toFixed(2)} to ${b.rateUph.toFixed(2)} U/h at ${b.time}. Consider whether this jump is intentional.`
        });
        break;
      }
    }
  }

  if (params.pump?.basalIncrements && scheduleEntries.length) {
    const inc = params.pump.basalIncrements;
    const offGrid = scheduleEntries.some((s) => {
      const snapped = Math.round(s.value / inc) * inc;
      return Math.abs(snapped - s.value) > 1e-6;
    });

    if (offGrid) {
      checks.push({
        severity: 'info',
        title: 'Basal not aligned to pump increments',
        details: `Some rates are not multiples of ${inc} U/h for ${params.pump.name ?? 'your pump'}. They may be rounded on-device.`
      });
    }
  }

  const totalDailyBasalU = computeTotalDailyBasal(segments);

	const diaHours = getActiveProfileDiaHours(params.profiles || []);

  const tempBasals = treatmentsSortedAsc.filter(isTempBasalTreatment);
  const tempDurations = tempBasals.map((t) => (typeof t.duration === 'number' ? t.duration : undefined)).filter((d): d is number => typeof d === 'number' && d > 0);

  const daysSpan = Math.max(1, (params.rangeEndMs - params.rangeStartMs) / (24 * 60 * 60 * 1000));
	const tempPerDay = tempBasals.length / daysSpan;
	const allowTempBasalForQuietWindows = tempPerDay >= 2;

  const driftWindows: BasalFastingWindow[] = [
    { label: 'Overnight', startHour: 0, endHour: 6 },
    { label: 'Afternoon', startHour: 13, endHour: 16 }
  ];

  const drift = driftWindows.map((w) =>
    computeFastingDrift({
      entriesSortedAsc,
      treatmentsSortedAsc,
      rangeStartMs: params.rangeStartMs,
      rangeEndMs: params.rangeEndMs,
      window: w
    })
  );

  // Evidence-first pattern detection (nightly) and safety signals
  const overnight = computeOvernightDriftPatterns({
    entriesSortedAsc,
    treatmentsSortedAsc,
    rangeStartMs: params.rangeStartMs,
    rangeEndMs: params.rangeEndMs,
    startHour: params.thresholds?.overnight?.startHour ?? 0,
    endHour: params.thresholds?.overnight?.endHour ?? 6,
    label: '00:00–06:00'
    ,thresholds: params.thresholds
    ,allowTempBasal: allowTempBasalForQuietWindows
  });
  const dawn = computeDawnPhenomenon({
    entriesSortedAsc,
    treatmentsSortedAsc,
    rangeStartMs: params.rangeStartMs,
    rangeEndMs: params.rangeEndMs,
    thresholds: params.thresholds,
    allowTempBasal: allowTempBasalForQuietWindows
  });
  const correctionStacking = computeCorrectionStacking({
    entriesSortedAsc,
    treatmentsSortedAsc,
    rangeStartMs: params.rangeStartMs,
    rangeEndMs: params.rangeEndMs,
    thresholds: params.thresholds,
    diaHours
  });

  // Temp basal sanity note
  if (tempBasals.length >= 10 && tempPerDay >= 2) {
    checks.push({
      severity: 'info',
      title: 'Frequent temp basals',
      details: `Detected about ${tempPerDay.toFixed(1)} temp basals/day in the selected range. Frequent temps can make basal drift analysis harder to interpret.`
    });
  }

  // Drift interpretation into checks
  for (const d of drift) {
    if (d.interpretation === 'possible-hypo-risk') {
      checks.push({
        severity: 'warn',
        title: `${d.window.label} fasting lows detected`,
        details: 'Some qualifying fasting windows include glucose <70 mg/dL. Consider reviewing basal and/or safety settings with your care team.'
      });
    } else if (d.interpretation === 'drifting-down') {
      checks.push({
        severity: 'info',
        title: `${d.window.label} drift downward`,
        details: 'Median fasting drift is downward, which can be consistent with basal being high for that time window (not diagnostic).'
      });
    } else if (d.interpretation === 'drifting-up') {
      checks.push({
        severity: 'info',
        title: `${d.window.label} drift upward`,
        details: 'Median fasting drift is upward, which can be consistent with basal being low for that time window (not diagnostic).'
      });
    }
  }

  if (overnight.direction === 'drifting-up' || overnight.direction === 'drifting-down') {
    checks.push({
      severity: 'info',
      title: 'Overnight drift pattern detected',
      details: `Across qualifying nights (00:00–06:00), median slope is ${Math.round(overnight.medianSlopeMgdlPerHr ?? 0)} mg/dL/hr with ~${Math.round((overnight.consistency ?? 0) * 100)}% sign consistency.`
    });
  }

  if (dawn.interpretation === 'dawn-like-rise') {
    checks.push({
      severity: 'info',
      title: 'Dawn-like rise signal',
      details: 'On multiple qualifying mornings, the 04:00–08:00 slope is higher than the 00:00–04:00 baseline, consistent with a dawn-like rise (informational only).'
    });
  }

  if (correctionStacking.stackingEvents.length >= 3) {
    checks.push({
      severity: 'warn',
      title: 'Possible correction stacking',
      details: `Detected ${correctionStacking.stackingEvents.length} instances of correction boluses within ${correctionStacking.insulinActionHours}h of a prior correction (some while glucose was flat/falling or with short wait). Consider reviewing safety/stacking patterns with your care team.`
    });
  } else if (correctionStacking.stackingEvents.length >= 1) {
    checks.push({
      severity: 'info',
      title: 'Correction stacking signals present',
      details: `Detected ${correctionStacking.stackingEvents.length} instances of corrections close together within ${correctionStacking.insulinActionHours}h. This is a safety signal (not dosing advice).`
    });
  }

  if (!checks.length) {
    checks.push({
      severity: 'info',
      title: 'No obvious schedule red flags',
      details: 'Basic schedule integrity checks did not find obvious issues. Interpretation still depends on context and meal/correction patterns.'
    });
  }

  return {
    schedule: {
      entries: scheduleEntries,
      segments,
      totalDailyBasalU
    },
    tempBasal: {
      count: tempBasals.length,
      perDay: tempPerDay,
      medianDurationMin: median(tempDurations)
    },
    drift,
		patterns: {
			overnight,
			dawn,
			correctionStacking
		},
    checks
  };
}
