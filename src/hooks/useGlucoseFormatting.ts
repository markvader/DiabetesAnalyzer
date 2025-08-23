import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useTimeInRange } from '../contexts/TimeInRangeContext';
import { getGlucoseColor, getGlucoseRanges, toMmol, toMgdl } from '../utils/glucoseUtils';

export const useGlucoseFormatting = () => {
  const { unit, formatGlucose, convertGlucose, getUnitLabel } = useGlucoseUnits();
  const { settings: timeInRangeSettings } = useTimeInRange();

  // Get color based on glucose value in current units using custom settings
  const getGlucoseColorForValue = (value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl'): string => {
    return getGlucoseColor(value, fromUnit, {
      lowThreshold: timeInRangeSettings.lowThreshold,
      highThreshold: timeInRangeSettings.highThreshold
    });
  };

  // Get glucose ranges in current unit using custom settings
  const getCurrentGlucoseRanges = () => {
    return getGlucoseRanges(unit, timeInRangeSettings);
  };

  // Convert glucose value to current unit and format it
  const formatGlucoseValue = (value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl', showUnit: boolean = true): string => {
    return formatGlucose(value, fromUnit, showUnit);
  };

  // Convert glucose value to current unit
  const convertToCurrentUnit = (value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl'): number => {
    return convertGlucose(value, fromUnit);
  };

  // Legacy conversion functions (for backwards compatibility)
  const toMmolValue = (mgdl: number): number => toMmol(mgdl);
  const toMgdlValue = (mmol: number): number => toMgdl(mmol);

  return {
    unit,
    getUnitLabel,
    formatGlucoseValue,
    convertToCurrentUnit,
    getGlucoseColorForValue,
    getCurrentGlucoseRanges,
    toMmolValue,
    toMgdlValue
  };
};
