import type { TherapyAlgorithm } from '../constants/insulinPumps';
import type { NightscoutTreatment, NightscoutDeviceStatus } from '../types/nightscout';

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

const getNumberAtPath = (source: unknown, path: string[]): number | null => {
  let cursor: unknown = source;
  for (const segment of path) {
    const record = getRecord(cursor);
    if (!record) {
      return null;
    }
    cursor = record[segment];
  }
  return toFiniteNumber(cursor);
};

const parseNumberFromNotes = (notes: unknown, key: 'iob' | 'cob'): number | null => {
  if (typeof notes !== 'string') {
    return null;
  }

  const match = notes.match(new RegExp(`${key}[:\\s]*([0-9.-]+)`, 'i'));
  if (!match?.[1]) {
    return null;
  }

  return toFiniteNumber(match[1]);
};

const preferredFieldOrder = (algorithm: TherapyAlgorithm): Array<'AAPS' | 'loop' | 'openaps'> => {
  if (algorithm === 'loop') {
    return ['loop', 'openaps', 'AAPS'];
  }
  return ['AAPS', 'openaps', 'loop'];
};

export const getTherapyPlatformLabel = (algorithm: TherapyAlgorithm): string => {
  return algorithm === 'loop' ? 'Loop' : 'AAPS';
};

export const getTherapyFeaturesLabel = (algorithm: TherapyAlgorithm): string => {
  return algorithm === 'loop' ? 'Automated Dosing' : 'OpenAPS SMB';
};

export const getPredictionToleranceMgdl = (algorithm: TherapyAlgorithm): number => {
  return algorithm === 'loop' ? 25 : 30;
};

export const extractTreatmentMetric = (
  treatment: NightscoutTreatment,
  key: 'iob' | 'cob',
  algorithm: TherapyAlgorithm
): number | null => {
  const direct = toFiniteNumber(key === 'iob' ? treatment.iob : treatment.cob);
  if (direct !== null) {
    return direct;
  }

  for (const container of preferredFieldOrder(algorithm)) {
    const nested = getNumberAtPath(treatment, [container, key]);
    if (nested !== null) {
      return nested;
    }

    const nestedFromSuggested = getNumberAtPath(treatment, [container, 'suggested', key]);
    if (nestedFromSuggested !== null) {
      return nestedFromSuggested;
    }
  }

  return parseNumberFromNotes(treatment.notes, key);
};

export const extractDeviceStatusMetric = (
  status: NightscoutDeviceStatus,
  key: 'iob' | 'cob',
  algorithm: TherapyAlgorithm
): number | null => {
  const direct = toFiniteNumber(status[key]);
  if (direct !== null) {
    return direct;
  }

  for (const container of preferredFieldOrder(algorithm)) {
    const directNested = getNumberAtPath(status, [container, key]);
    if (directNested !== null) {
      return directNested;
    }

    const suggestedNested = getNumberAtPath(status, [container, 'suggested', key]);
    if (suggestedNested !== null) {
      return suggestedNested;
    }

    const iobContainer = key === 'iob' ? getNumberAtPath(status, [container, 'iob', 'iob']) : null;
    if (iobContainer !== null) {
      return iobContainer;
    }
  }

  return null;
};

export const isAutomatedDosingTreatment = (
  treatment: NightscoutTreatment,
  algorithm: TherapyAlgorithm
): boolean => {
  const eventType = (treatment.eventType || '').toLowerCase();
  const notes = (treatment.notes || '').toLowerCase();

  const baseSignals =
    eventType.includes('temp basal') ||
    eventType.includes('temporary basal') ||
    eventType.includes('openaps enacted') ||
    eventType === 'smb' ||
    eventType.includes('autobolus') ||
    typeof treatment.rate === 'number' ||
    typeof treatment.absolute === 'number';

  if (baseSignals) {
    return true;
  }

  const algorithmSignals =
    algorithm === 'loop'
      ? notes.includes('loop') || notes.includes('autobolus') || notes.includes('automatic')
      : notes.includes('aaps') || notes.includes('openaps') || notes.includes('smb') || notes.includes('androidaps');

  if (algorithmSignals) {
    return true;
  }

  return extractTreatmentMetric(treatment, 'iob', algorithm) !== null || extractTreatmentMetric(treatment, 'cob', algorithm) !== null;
};
