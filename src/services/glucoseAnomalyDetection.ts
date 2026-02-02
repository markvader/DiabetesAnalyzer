import type { NightscoutEntry } from '../types/nightscout';

export type GlucoseAnomalySeverity = 'info' | 'warning' | 'danger';

export type GlucoseAnomalyType =
  | 'DATA_GAP'
  | 'RAPID_JUMP'
  | 'FLATLINE'
  | 'POSSIBLE_COMPRESSION_LOW'
  | 'OUTLIER_VALUE';

export type GlucoseAnomaly = {
  type: GlucoseAnomalyType;
  severity: GlucoseAnomalySeverity;
  startMs: number;
  endMs: number;
  message: string;
  details?: string;

  // Optional structured fields (all mg/dL-based) for unit-aware display.
  gapMinutes?: number;
  durationMinutes?: number;
  valueMgdl?: number;
  deltaMgdl?: number;
  rateMgdlPerMin?: number;
  dropMgdl?: number;
  riseMgdl?: number;
  reboundMgdl?: number;
};

export type GlucoseAnomalyDetectionOptions = {
  maxGapMinutes: number;
  jumpRateMgdlPerMin: number;
  flatlineMinutes: number;
  outlierLowMgdl: number;
  outlierHighMgdl: number;
  compressionLowThresholdMgdl: number;
  compressionWindowMinutes: number;
  compressionMinRateMgdlPerMin: number;
  maxAnomalies: number;
};

const defaultOptions: GlucoseAnomalyDetectionOptions = {
  maxGapMinutes: 15,
  jumpRateMgdlPerMin: 6,
  flatlineMinutes: 30,
  outlierLowMgdl: 40,
  outlierHighMgdl: 400,
  compressionLowThresholdMgdl: 70,
  compressionWindowMinutes: 25,
  compressionMinRateMgdlPerMin: 4,
  maxAnomalies: 100
};

const minutesBetween = (aMs: number, bMs: number) => Math.abs(bMs - aMs) / (1000 * 60);

const sortAscByDate = (entries: NightscoutEntry[]) => {
  if (entries.length <= 1) return entries;
  return [...entries].sort((a, b) => a.date - b.date);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function detectGlucoseAnomalies(
  readings: NightscoutEntry[],
  options?: Partial<GlucoseAnomalyDetectionOptions>
): GlucoseAnomaly[] {
  const opts: GlucoseAnomalyDetectionOptions = { ...defaultOptions, ...(options ?? {}) };
  const sorted = sortAscByDate(readings).filter((r) => Number.isFinite(r.date) && Number.isFinite(r.sgv));
  if (sorted.length < 2) return [];

  const anomalies: GlucoseAnomaly[] = [];
  const maxGapMs = opts.maxGapMinutes * 60_000;

  // 1) Data gaps
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const dt = next.date - prev.date;
    if (dt > maxGapMs) {
      const gapMin = Math.round(dt / 60_000);
      anomalies.push({
        type: 'DATA_GAP',
        severity: gapMin >= 60 ? 'danger' : 'warning',
        startMs: prev.date,
        endMs: next.date,
        message: `Missing CGM data (~${gapMin} min gap)`,
        gapMinutes: gapMin
      });
    }
  }

  // 2) Outlier values
  for (const r of sorted) {
    if (r.sgv <= 0) continue;
    if (r.sgv < opts.outlierLowMgdl) {
      anomalies.push({
        type: 'OUTLIER_VALUE',
        severity: 'danger',
        startMs: r.date,
        endMs: r.date,
        message: `Outlier low value: ${Math.round(r.sgv)} mg/dL`,
        valueMgdl: r.sgv
      });
    } else if (r.sgv > opts.outlierHighMgdl) {
      anomalies.push({
        type: 'OUTLIER_VALUE',
        severity: 'danger',
        startMs: r.date,
        endMs: r.date,
        message: `Outlier high value: ${Math.round(r.sgv)} mg/dL`,
        valueMgdl: r.sgv
      });
    }
  }

  // 3) Rapid jumps / artifacts
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const dtMin = minutesBetween(a.date, b.date);

    // Ignore weird intervals; Nightscout CGM is typically ~5 minutes.
    if (dtMin < 2 || dtMin > 12) continue;

    const delta = b.sgv - a.sgv;
    const rate = Math.abs(delta) / dtMin;

    if (rate >= opts.jumpRateMgdlPerMin) {
      const roundedRate = Math.round(rate * 10) / 10;
      const severity: GlucoseAnomalySeverity = rate >= opts.jumpRateMgdlPerMin * 1.5 ? 'danger' : 'warning';
      anomalies.push({
        type: 'RAPID_JUMP',
        severity,
        startMs: a.date,
        endMs: b.date,
        message: `Rapid change: ${delta > 0 ? '+' : ''}${Math.round(delta)} mg/dL in ${Math.round(dtMin)} min (${roundedRate} mg/dL/min)`,
        durationMinutes: Math.round(dtMin),
        deltaMgdl: delta,
        rateMgdlPerMin: rate
      });
    }
  }

  // 4) Flatlines (unchanged values for a long duration)
  // Tolerate tiny noise by rounding to 1 mg/dL.
  const flatlineThresholdMs = opts.flatlineMinutes * 60_000;
  let runStartIdx = 0;
  let runValue = Math.round(sorted[0].sgv);
  for (let i = 1; i < sorted.length; i++) {
    const v = Math.round(sorted[i].sgv);
    if (v !== runValue) {
      const start = sorted[runStartIdx];
      const end = sorted[i - 1];
      const duration = end.date - start.date;
      if (duration >= flatlineThresholdMs) {
        const durMin = Math.round(duration / 60_000);
        anomalies.push({
          type: 'FLATLINE',
          severity: durMin >= 90 ? 'danger' : 'warning',
          startMs: start.date,
          endMs: end.date,
          message: `Flatline: ~${durMin} min at ${runValue} mg/dL`,
          durationMinutes: durMin,
          valueMgdl: runValue
        });
      }
      runStartIdx = i;
      runValue = v;
    }
  }
  // finalize last run
  {
    const start = sorted[runStartIdx];
    const end = sorted[sorted.length - 1];
    const duration = end.date - start.date;
    if (duration >= flatlineThresholdMs) {
      const durMin = Math.round(duration / 60_000);
      anomalies.push({
        type: 'FLATLINE',
        severity: durMin >= 90 ? 'danger' : 'warning',
        startMs: start.date,
        endMs: end.date,
        message: `Flatline: ~${durMin} min at ${runValue} mg/dL`,
        durationMinutes: durMin,
        valueMgdl: runValue
      });
    }
  }

  // 5) Possible compression lows (rapid drop below threshold then rapid rebound)
  const maxWindowMs = opts.compressionWindowMinutes * 60_000;
  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1];
    const mid = sorted[i];
    const next = sorted[i + 1];

    if (mid.sgv >= opts.compressionLowThresholdMgdl) continue;

    const dtDropMin = minutesBetween(prev.date, mid.date);
    const dtRiseMin = minutesBetween(mid.date, next.date);
    if (dtDropMin < 2 || dtRiseMin < 2 || dtDropMin > 12 || dtRiseMin > 12) continue;

    const windowSpan = next.date - prev.date;
    if (windowSpan > maxWindowMs) continue;

    const dropRate = (prev.sgv - mid.sgv) / dtDropMin;
    const riseRate = (next.sgv - mid.sgv) / dtRiseMin;

    if (dropRate >= opts.compressionMinRateMgdlPerMin && riseRate >= opts.compressionMinRateMgdlPerMin) {
      const low = Math.round(mid.sgv);
      const rebound = Math.round(next.sgv);
      const approxDrop = clamp(Math.round(prev.sgv - mid.sgv), 0, 10_000);
      const approxRise = clamp(Math.round(next.sgv - mid.sgv), 0, 10_000);

      anomalies.push({
        type: 'POSSIBLE_COMPRESSION_LOW',
        severity: 'warning',
        startMs: prev.date,
        endMs: next.date,
        message: `Possible compression low: drop ${approxDrop} → ${low} mg/dL then rebound +${approxRise} (to ~${rebound})`,
        details: 'Heuristic detection based on rapid drop + rebound. Validate against symptoms, calibrations, and context.',
        valueMgdl: low,
        reboundMgdl: rebound,
        dropMgdl: approxDrop,
        riseMgdl: approxRise
      });
    }
  }

  // De-dupe / sort / cap
  const unique = new Map<string, GlucoseAnomaly>();
  for (const a of anomalies) {
    const key = `${a.type}:${a.startMs}:${a.endMs}:${a.message}`;
    if (!unique.has(key)) unique.set(key, a);
  }

  return [...unique.values()]
    .sort((a, b) => b.startMs - a.startMs)
    .slice(0, opts.maxAnomalies);
}
