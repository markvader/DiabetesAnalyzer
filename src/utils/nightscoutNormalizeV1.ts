import type {
  NightscoutDeviceStatus,
  NightscoutEntry,
  NightscoutTreatment
} from '../types/nightscout';
import {
  parseNightscoutDeviceStatus,
  parseNightscoutEntries,
  parseNightscoutTreatments
} from './nightscoutParse';

type NightscoutV1Normalized = {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  deviceStatus: NightscoutDeviceStatus[];
};

export const normalizeNightscoutV1Data = (raw: {
  entries: unknown;
  treatments: unknown;
  deviceStatus: unknown;
}): NightscoutV1Normalized => {
  return {
    entries: parseNightscoutEntries(raw.entries),
    treatments: parseNightscoutTreatments(raw.treatments),
    deviceStatus: parseNightscoutDeviceStatus(raw.deviceStatus)
  };
};
