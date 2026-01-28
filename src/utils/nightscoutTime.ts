import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';

export const getEntryMs = (entry: Pick<NightscoutEntry, 'mills'>): number => entry.mills;

export const getTreatmentMs = (treatment: Pick<NightscoutTreatment, 'mills'>): number => treatment.mills;
