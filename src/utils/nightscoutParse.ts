import { toEpochMs } from './time';
import type {
  NightscoutDeviceStatus,
  NightscoutEntry,
  NightscoutProfile,
  NightscoutTreatment
} from '../types/nightscout';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return isRecord(value) ? value : undefined;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const coerceArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  return [raw];
};

const getEntryTimeMs = (record: Record<string, unknown>): number | null => {
  const candidate =
    record.date ??
    record.mills ??
    record.srvCreated ??
    record.dateString ??
    record.created_at;

  return toEpochMs(candidate);
};

const getTreatmentTimeMs = (record: Record<string, unknown>): number | null => {
  const candidate =
    record.mills ??
    record.date ??
    record.created_at ??
    record.srvCreated ??
    record.timestamp;

  return toEpochMs(candidate);
};

const getDeviceStatusTimeMs = (record: Record<string, unknown>): number | null => {
  const candidate =
    record.mills ??
    record.date ??
    record.created_at ??
    record.srvCreated;

  return toEpochMs(candidate);
};

export const parseNightscoutEntries = (raw: unknown): NightscoutEntry[] => {
  const items = coerceArray(raw);
  const parsed: NightscoutEntry[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const ms = getEntryTimeMs(item);
    if (!ms) continue;

    const sgv = asNumber(item.sgv);
    if (typeof sgv !== 'number') continue;

    parsed.push({
      _id: asString(item._id),
      id: asString(item.id),
      date: ms,
      mills: ms,
      sgv: Math.trunc(sgv),
      direction: asString(item.direction),
      type: asString(item.type),
      device: asString(item.device),
      dateString: asString(item.dateString) ?? asString(item.created_at)
    });
  }

  return parsed;
};

export const parseNightscoutTreatments = (raw: unknown): NightscoutTreatment[] => {
  const items = coerceArray(raw);
  const parsed: NightscoutTreatment[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const ms = getTreatmentTimeMs(item);
    if (!ms) continue;

    const createdAt = asString(item.created_at) ?? new Date(ms).toISOString();

    parsed.push({
      _id: asString(item._id),
      id: asString(item.id),
      eventType: asString(item.eventType),
      enteredBy: asString(item.enteredBy),
      created_at: createdAt,
      timestamp: asString(item.timestamp),
      date: asNumber(item.date),
      mills: ms,
      insulin: asNumber(item.insulin),
      units: asNumber(item.units),
      carbs: asNumber(item.carbs),
      duration: asNumber(item.duration),
      notes: asString(item.notes),
      reason: asString(item.reason),
      absolute: asNumber(item.absolute),
      rate: asNumber(item.rate),
      temp: asString(item.temp),
      protein: asNumber(item.protein),
      fat: asNumber(item.fat),
      glucose: asNumber(item.glucose),
      glucoseType: asString(item.glucoseType),
      bg: asNumber(item.bg),
      iob: item.iob,
      cob: item.cob,
      eventualBG: item.eventualBG,
      battery: item.battery,
      reservoir: item.reservoir,
      suspended: item.suspended,
      bolusing: item.bolusing,
      tempBasal: item.tempBasal
    });
  }

  return parsed;
};

export const parseNightscoutProfiles = (raw: unknown): NightscoutProfile[] => {
  const items = coerceArray(raw);
  const parsed: NightscoutProfile[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    parsed.push({
      _id: asString(item._id),
      id: asString(item.id),
      startDate: asString(item.startDate),
      defaultProfile: asString(item.defaultProfile),
      store: asRecord(item.store),
      units: asString(item.units),
      dia: asNumber(item.dia)
    });
  }

  return parsed;
};

export const parseNightscoutDeviceStatus = (raw: unknown): NightscoutDeviceStatus[] => {
  const items = coerceArray(raw);
  const parsed: NightscoutDeviceStatus[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const ms = getDeviceStatusTimeMs(item);

    parsed.push({
      _id: asString(item._id),
      id: asString(item.id),
      created_at: asString(item.created_at) ?? (ms ? new Date(ms).toISOString() : undefined),
      date: ms ?? asNumber(item.date),
      mills: ms ?? asNumber(item.mills),
      pump: asRecord(item.pump),
      openaps: asRecord(item.openaps),
      loop: asRecord(item.loop),
      AAPS: asRecord(item.AAPS),
      uploader: asRecord(item.uploader),
      iob: item.iob,
      cage: item.cage,
      sage: item.sage,
      basal: item.basal
    });
  }

  return parsed;
};
