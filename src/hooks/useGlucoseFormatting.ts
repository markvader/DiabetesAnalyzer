import { useCallback, useMemo } from 'react';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useTimeInRange } from '../contexts/TimeInRangeContext';
import { getGlucoseColor, getGlucoseRanges, toMmol, toMgdl } from '../utils/glucoseUtils';

export const useGlucoseFormatting = () => {
  const { unit, formatGlucose, convertGlucose, getUnitLabel } = useGlucoseUnits();
  const { settings: timeInRangeSettings } = useTimeInRange();

  // Get color based on glucose value in current units using custom settings
  const getGlucoseColorForValue = useCallback((value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl'): string => {
    return getGlucoseColor(value, fromUnit, {
      lowThreshold: timeInRangeSettings.lowThreshold,
      highThreshold: timeInRangeSettings.highThreshold
    });
  }, [timeInRangeSettings.highThreshold, timeInRangeSettings.lowThreshold]);

  // Get glucose ranges in current unit using custom settings
  const getCurrentGlucoseRanges = useCallback(() => {
    return getGlucoseRanges(unit, timeInRangeSettings);
  }, [unit, timeInRangeSettings]);

  // Convert glucose value to current unit and format it
  const formatGlucoseValue = useCallback((value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl', showUnit: boolean = true): string => {
    return formatGlucose(value, fromUnit, showUnit);
  }, [formatGlucose]);

  // Convert glucose value to current unit
  const convertToCurrentUnit = useCallback((value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl'): number => {
    return convertGlucose(value, fromUnit);
  }, [convertGlucose]);

  // Legacy conversion functions (for backwards compatibility)
  const toMmolValue = useCallback((mgdl: number): number => toMmol(mgdl), []);
  const toMgdlValue = useCallback((mmol: number): number => toMgdl(mmol), []);

  return useMemo(() => ({
    unit,
    getUnitLabel,
    formatGlucoseValue,
    convertToCurrentUnit,
    getGlucoseColorForValue,
    getCurrentGlucoseRanges,
    toMmolValue,
    toMgdlValue
  }), [
    unit,
    getUnitLabel,
    formatGlucoseValue,
    convertToCurrentUnit,
    getGlucoseColorForValue,
    getCurrentGlucoseRanges,
    toMmolValue,
    toMgdlValue
  ]);
};
