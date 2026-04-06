import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';

const normalizeNumber = (value: unknown, precision = 1): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }

  return value.toFixed(precision);
};

const summarizeReadings = (readings: readonly NightscoutEntry[]) => {
  if (!readings.length) {
    return {
      count: 0,
      firstMs: 0,
      lastMs: 0,
      sumSgv: 0,
      avgSgv: 0
    };
  }

  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = Number.NEGATIVE_INFINITY;
  let sumSgv = 0;
  let validCount = 0;

  for (const reading of readings) {
    const ms = Number(reading.date);
    if (Number.isFinite(ms)) {
      if (ms < firstMs) firstMs = ms;
      if (ms > lastMs) lastMs = ms;
    }

    const sgv = Number(reading.sgv);
    if (Number.isFinite(sgv) && sgv > 0) {
      sumSgv += sgv;
      validCount += 1;
    }
  }

  return {
    count: readings.length,
    firstMs: Number.isFinite(firstMs) ? firstMs : 0,
    lastMs: Number.isFinite(lastMs) ? lastMs : 0,
    sumSgv,
    avgSgv: validCount > 0 ? sumSgv / validCount : 0
  };
};

const summarizeTreatments = (treatments: readonly NightscoutTreatment[]) => {
  if (!treatments.length) {
    return {
      count: 0,
      firstMs: 0,
      lastMs: 0,
      insulinSum: 0,
      carbsSum: 0
    };
  }

  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = Number.NEGATIVE_INFINITY;
  let insulinSum = 0;
  let carbsSum = 0;

  for (const treatment of treatments) {
    const ms = Number(treatment.mills ?? treatment.date ?? 0);
    if (Number.isFinite(ms)) {
      if (ms < firstMs) firstMs = ms;
      if (ms > lastMs) lastMs = ms;
    }

    const insulin = Number(treatment.insulin ?? treatment.units ?? 0);
    if (Number.isFinite(insulin) && insulin > 0) {
      insulinSum += insulin;
    }

    const carbs = Number(treatment.carbs ?? 0);
    if (Number.isFinite(carbs) && carbs > 0) {
      carbsSum += carbs;
    }
  }

  return {
    count: treatments.length,
    firstMs: Number.isFinite(firstMs) ? firstMs : 0,
    lastMs: Number.isFinite(lastMs) ? lastMs : 0,
    insulinSum,
    carbsSum
  };
};

export const buildInsightsFingerprint = (
  readings: readonly NightscoutEntry[],
  timeInRange?: {
    timeInRange: number;
    highPercentage: number;
    lowPercentage: number;
  }
): string => {
  const readingSummary = summarizeReadings(readings);

  return [
    'insights',
    readingSummary.count,
    readingSummary.firstMs,
    readingSummary.lastMs,
    normalizeNumber(readingSummary.avgSgv, 2),
    normalizeNumber(timeInRange?.timeInRange, 1),
    normalizeNumber(timeInRange?.highPercentage, 1),
    normalizeNumber(timeInRange?.lowPercentage, 1)
  ].join('|');
};

export const buildMealAnalysisFingerprint = (
  readings: readonly NightscoutEntry[],
  treatments: readonly NightscoutTreatment[]
): string => {
  const readingSummary = summarizeReadings(readings);
  const treatmentSummary = summarizeTreatments(treatments);

  return [
    'meal-analysis',
    readingSummary.count,
    readingSummary.firstMs,
    readingSummary.lastMs,
    normalizeNumber(readingSummary.avgSgv, 2),
    treatmentSummary.count,
    treatmentSummary.firstMs,
    treatmentSummary.lastMs,
    normalizeNumber(treatmentSummary.carbsSum, 1),
    normalizeNumber(treatmentSummary.insulinSum, 2)
  ].join('|');
};

export const buildManagementPlanFingerprint = (
  readings: readonly NightscoutEntry[],
  treatments: readonly NightscoutTreatment[],
  unit: string
): string => {
  const readingSummary = summarizeReadings(readings);
  const treatmentSummary = summarizeTreatments(treatments);

  return [
    'management-plan',
    unit,
    readingSummary.count,
    readingSummary.firstMs,
    readingSummary.lastMs,
    normalizeNumber(readingSummary.avgSgv, 2),
    treatmentSummary.count,
    treatmentSummary.firstMs,
    treatmentSummary.lastMs,
    normalizeNumber(treatmentSummary.carbsSum, 1),
    normalizeNumber(treatmentSummary.insulinSum, 2)
  ].join('|');
};
