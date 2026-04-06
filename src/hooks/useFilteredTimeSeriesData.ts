import { useMemo } from 'react';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface TimeSeriesSpanInfo {
  oldestDate: Date;
  newestDate: Date;
  spanDays: number;
  totalReadings: number;
}

export const useFilteredByTimeRange = <T>(
  items: readonly T[],
  getMs: (item: T) => number,
  selectedRange: TimeRange
): T[] => {
  return useMemo(() => {
    if (!items.length) {
      return [];
    }

    return sliceSortedByTimeRange(items, getMs, selectedRange.startMs, selectedRange.endMs);
  }, [items, getMs, selectedRange.endMs, selectedRange.startMs]);
};

export const useFilteredNightscoutData = (
  entriesSortedAsc: readonly NightscoutEntry[],
  treatmentsSortedAsc: readonly NightscoutTreatment[],
  selectedRange: TimeRange,
  getEntryMs: (entry: NightscoutEntry) => number = (entry) => entry.date,
  getTreatmentMs: (treatment: NightscoutTreatment) => number = (treatment) => treatment.mills
) => {
  const filteredReadings = useFilteredByTimeRange(entriesSortedAsc, getEntryMs, selectedRange);
  const filteredTreatments = useFilteredByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange);

  return {
    filteredReadings,
    filteredTreatments
  };
};

export const useTimeSeriesSpanInfo = <T>(
  sortedItemsAsc: readonly T[],
  getMs: (item: T) => number
): TimeSeriesSpanInfo | null => {
  return useMemo(() => {
    if (!sortedItemsAsc.length) {
      return null;
    }

    const oldestEntry = sortedItemsAsc[0];
    const newestEntry = sortedItemsAsc[sortedItemsAsc.length - 1];
    const oldestMs = getMs(oldestEntry);
    const newestMs = getMs(newestEntry);

    return {
      oldestDate: new Date(oldestMs),
      newestDate: new Date(newestMs),
      spanDays: Math.round((newestMs - oldestMs) / (1000 * 60 * 60 * 24)),
      totalReadings: sortedItemsAsc.length
    };
  }, [getMs, sortedItemsAsc]);
};
