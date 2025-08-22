import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { getGlucoseColor, getGlucoseRanges, toMmol, toMgdl } from '../utils/glucoseUtils';

export const useGlucoseFormatting = () => {
  const { unit, formatGlucose, convertGlucose, getUnitLabel } = useGlucoseUnits();

  // Get color based on glucose value in current units
  const getGlucoseColorForValue = (value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl'): string => {
    return getGlucoseColor(value, fromUnit);
  };

  // Get glucose ranges in current unit
  const getCurrentGlucoseRanges = () => {
    return getGlucoseRanges(unit);
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
