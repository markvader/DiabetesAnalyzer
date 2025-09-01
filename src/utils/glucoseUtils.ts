import { GLUCOSE_RANGES } from '../constants/glucoseRanges';

// Conversion factor from mg/dL to mmol/L
const MGDL_TO_MMOL = 0.0555;

// Convert mg/dL to mmol/L
export const toMmol = (mgdl: number): number => {
  return Number((mgdl * MGDL_TO_MMOL).toFixed(1));
};

// Convert mmol/L to mg/dL
export const toMgdl = (mmol: number): number => {
  return Math.round(mmol / MGDL_TO_MMOL);
};

// Get glucose ranges in the specified unit with optional custom settings
export const getGlucoseRanges = (unit: 'mmol' | 'mgdl', customSettings?: {
  lowThreshold: number;
  highThreshold: number;
  targetMin: number;
  targetMax: number;
}) => {
  // Use custom settings if provided, otherwise use defaults
  const baseRanges = customSettings ? {
    LOW_THRESHOLD: customSettings.lowThreshold,
    HIGH_THRESHOLD: customSettings.highThreshold,
    TARGET_MIN: customSettings.targetMin,
    TARGET_MAX: customSettings.targetMax,
    DISPLAY_MIN: GLUCOSE_RANGES.DISPLAY_MIN,
    DISPLAY_MAX: GLUCOSE_RANGES.DISPLAY_MAX,
    COLORS: GLUCOSE_RANGES.COLORS
  } : GLUCOSE_RANGES;

  if (unit === 'mgdl') {
    return {
      LOW_THRESHOLD: toMgdl(baseRanges.LOW_THRESHOLD),
      HIGH_THRESHOLD: toMgdl(baseRanges.HIGH_THRESHOLD),
      TARGET_MIN: toMgdl(baseRanges.TARGET_MIN),
      TARGET_MAX: toMgdl(baseRanges.TARGET_MAX),
      DISPLAY_MIN: toMgdl(baseRanges.DISPLAY_MIN),
      DISPLAY_MAX: toMgdl(baseRanges.DISPLAY_MAX),
      COLORS: baseRanges.COLORS
    };
  }
  return baseRanges;
};

// Get color based on glucose value with optional custom thresholds
export const getGlucoseColor = (value: number, unit: 'mmol' | 'mgdl' = 'mmol', customSettings?: {
  lowThreshold: number;
  highThreshold: number;
}): string => {
  const valueInMmol = unit === 'mgdl' ? toMmol(value) : value;
  
  const lowThreshold = customSettings?.lowThreshold ?? GLUCOSE_RANGES.LOW_THRESHOLD;
  const highThreshold = customSettings?.highThreshold ?? GLUCOSE_RANGES.HIGH_THRESHOLD;
  
  if (valueInMmol > highThreshold) {
    return 'text-orange-600 dark:text-orange-400';
  }
  if (valueInMmol < lowThreshold) {
    return 'text-red-600 dark:text-red-400';
  }
  return 'text-green-600 dark:text-green-400';
};

// Format glucose value with units (legacy - use context formatGlucose instead)
export const formatGlucose = (value: number): string => {
  return `${toMmol(value)} mmol/L`;
};

// Format glucose value with proper units based on user preference (for services)
export const formatGlucoseWithUnit = (value: number, fromUnit: 'mmol' | 'mgdl' = 'mgdl', showUnit: boolean = true): string => {
  // Get user's preferred unit from localStorage
  const savedUnit = localStorage.getItem('glucose_unit') as 'mmol' | 'mgdl' || 'mmol';
  
  let convertedValue: number;
  let unitLabel: string;
  
  if (fromUnit === savedUnit) {
    convertedValue = value;
  } else if (fromUnit === 'mgdl' && savedUnit === 'mmol') {
    convertedValue = toMmol(value);
  } else if (fromUnit === 'mmol' && savedUnit === 'mgdl') {
    convertedValue = toMgdl(value);
  } else {
    convertedValue = value;
  }
  
  if (savedUnit === 'mmol') {
    unitLabel = 'mmol/L';
    convertedValue = Math.round(convertedValue * 10) / 10; // Round to 1 decimal place
  } else {
    unitLabel = 'mg/dL';
    convertedValue = Math.round(convertedValue); // Round to nearest integer
  }
  
  return showUnit ? `${convertedValue}${unitLabel}` : convertedValue.toString();
};

// Export glucose ranges
export { GLUCOSE_RANGES };