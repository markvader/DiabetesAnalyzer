// Utility functions for CAGE/SAGE formatting to match Nightscout display
import type { NightscoutDeviceStatus } from '../types/nightscout';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getProp(obj: unknown, key: string): unknown {
  const record = asRecord(obj);
  return record ? record[key] : undefined;
}

function getNumberProp(obj: unknown, key: string): number | undefined {
  const value = getProp(obj, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function formatCageValue(hours: number | null): string {
  if (hours === undefined || hours === null || isNaN(hours)) {
    return 'No Data';
  }
  
  if (hours < 24) {
    return `${Math.floor(hours)}h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    if (remainingHours === 0) {
      return `${days}d`;
    } else {
      return `${days}d${remainingHours}h`;
    }
  }
}

export function formatSageValue(hours: number | null): string {
  if (hours === undefined || hours === null || isNaN(hours)) {
    return 'No Data';
  }
  
  if (hours < 24) {
    return `${Math.floor(hours)}h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    if (remainingHours === 0) {
      return `${days}d`;
    } else {
      return `${days}d${remainingHours}h`;
    }
  }
}

// Get color class for CAGE (Cannula Age) based on time
export function getCageColorClass(hours: number | null): { bg: string; text: string; textSecondary: string } {
  if (hours === undefined || hours === null || isNaN(hours)) {
    return {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-300',
      textSecondary: 'text-gray-600 dark:text-gray-400'
    };
  }
  
  // CAGE warnings: >72h is getting critical for most infusion sets
  if (hours > 72) {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      textSecondary: 'text-red-600 dark:text-red-400'
    };
  } else if (hours > 48) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      textSecondary: 'text-orange-600 dark:text-orange-400'
    };
  } else {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      textSecondary: 'text-yellow-600 dark:text-yellow-400'
    };
  }
}

// Get color class for SAGE (Sensor Age) based on time
export function getSageColorClass(hours: number | null): { bg: string; text: string; textSecondary: string } {
  if (hours === undefined || hours === null || isNaN(hours)) {
    return {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-300',
      textSecondary: 'text-gray-600 dark:text-gray-400'
    };
  }
  
  // SAGE warnings: >10 days (240h) is getting very old for most sensors
  if (hours > 240) { // >10 days
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      textSecondary: 'text-red-600 dark:text-red-400'
    };
  } else if (hours > 168) { // >7 days
    return {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      textSecondary: 'text-orange-600 dark:text-orange-400'
    };
  } else {
    return {
      bg: 'bg-cyan-50 dark:bg-cyan-900/20',
      text: 'text-cyan-700 dark:text-cyan-300',
      textSecondary: 'text-cyan-600 dark:text-cyan-400'
    };
  }
}

// Check if current basal is a temporary basal rate
export function isTemporaryBasal(deviceStatus: NightscoutDeviceStatus | null | undefined): boolean {
  if (!deviceStatus) return false;

  // Check various indicators that suggest a temporary basal is running
  const openaps = getProp(deviceStatus, 'openaps');
  const openapsEnacted = getProp(openaps, 'enacted');
  const openapsRate = getNumberProp(openapsEnacted, 'rate');
  const openapsDuration = getNumberProp(openapsEnacted, 'duration') ?? 0;

  const loop = getProp(deviceStatus, 'loop');
  const loopEnacted = getProp(loop, 'enacted');
  const loopRate = getNumberProp(loopEnacted, 'rate');
  const loopDuration = getNumberProp(loopEnacted, 'duration') ?? 0;

  const pump = getProp(deviceStatus, 'pump');
  const pumpTemp = getProp(pump, 'temp');
  const pumpTempRate = getNumberProp(pumpTemp, 'rate');
  const pumpTempDuration = getNumberProp(pumpTemp, 'duration') ?? 0;

  const pumpBaseBasal = getNumberProp(pump, 'basebasal');
  const basal = getNumberProp(deviceStatus, 'basal');

  const tempBasalIndicators = [
    openapsRate !== undefined && openapsDuration > 0,
    loopRate !== undefined && loopDuration > 0,
    pumpTempRate !== undefined && pumpTempDuration > 0,
    // Check if current basal differs from base basal (if available)
    basal !== undefined && pumpBaseBasal !== undefined && basal !== pumpBaseBasal,
  ];
  
  return tempBasalIndicators.some(indicator => indicator === true);
}

export const formatBasalRate = (
  deviceStatus: NightscoutDeviceStatus | null | undefined,
  _pump?: unknown
): string => {
  if (!deviceStatus) return 'No Data';

  const pump = getProp(deviceStatus, 'pump');
  const extended = getProp(pump, 'extended');
  const tempBasalRemaining = getNumberProp(extended, 'TempBasalRemaining');
  const tempBasalAbsoluteRate = getNumberProp(extended, 'TempBasalAbsoluteRate');
  const baseBasalRate = getNumberProp(extended, 'BaseBasalRate');
  const pumpBasal = getNumberProp(pump, 'basal');
  const basal = getNumberProp(deviceStatus, 'basal');

  const openaps = getProp(deviceStatus, 'openaps');
  const openapsEnacted = getProp(openaps, 'enacted');
  const openapsRate = getNumberProp(openapsEnacted, 'rate');
  const openapsDuration = getNumberProp(openapsEnacted, 'duration') ?? 0;
  
  console.log('🎯 Analyzing basal rate from device status:', {
    pumpExtended: extended,
    tempBasalRemaining,
    tempBasalAbsoluteRate,
    baseBasalRate
  });
  
  // Check for temporary basal rate first - TempBasalRemaining > 0 means temp basal is active
  if (tempBasalRemaining !== undefined && tempBasalRemaining > 0 && tempBasalAbsoluteRate !== undefined) {
    const tempRate = tempBasalAbsoluteRate;
    console.log('✅ Found active temp basal:', tempRate);
    return `T: ${tempRate.toFixed(3)}U`;
  }
  
  // Check BaseBasalRate (default pump basal rate)
  if (baseBasalRate !== undefined) {
    const baseRate = baseBasalRate;
    console.log('✅ Found base basal rate:', baseRate);
    return `${baseRate.toFixed(3)}U`;
  }
  
  // Check other possible locations
  if (pumpBasal !== undefined) {
    return `${pumpBasal.toFixed(3)}U`;
  }
  
  if (basal !== undefined) {
    return `${basal.toFixed(3)}U`;
  }
  
  if (openapsRate !== undefined) {
    const prefix = openapsDuration > 0 ? 'T: ' : '';
    return `${prefix}${openapsRate.toFixed(3)}U`;
  }
  
  console.log('❌ No basal rate found');
  return 'No Data';
};
