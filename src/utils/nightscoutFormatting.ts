// Utility functions for CAGE/SAGE formatting to match Nightscout display
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
export function isTemporaryBasal(deviceStatus: any): boolean {
  // Check various indicators that suggest a temporary basal is running
  const tempBasalIndicators = [
    deviceStatus.openaps?.enacted?.rate !== undefined && deviceStatus.openaps?.enacted?.duration > 0,
    deviceStatus.loop?.enacted?.rate !== undefined && deviceStatus.loop?.enacted?.duration > 0,
    deviceStatus.pump?.temp?.rate !== undefined && deviceStatus.pump?.temp?.duration > 0,
    // Check if current basal differs from base basal (if available)
    deviceStatus.basal !== deviceStatus.pump?.basebasal && deviceStatus.pump?.basebasal !== undefined,
  ];
  
  return tempBasalIndicators.some(indicator => indicator === true);
}

export const formatBasalRate = (deviceStatus: any, pump: any): string => {
  if (!deviceStatus) return 'No Data';
  
  console.log('🎯 Analyzing basal rate from device status:', {
    pumpExtended: deviceStatus.pump?.extended,
    tempBasalRemaining: deviceStatus.pump?.extended?.TempBasalRemaining,
    tempBasalAbsoluteRate: deviceStatus.pump?.extended?.TempBasalAbsoluteRate,
    baseBasalRate: deviceStatus.pump?.extended?.BaseBasalRate
  });
  
  // Check for temporary basal rate first - TempBasalRemaining > 0 means temp basal is active
  if (deviceStatus.pump?.extended?.TempBasalRemaining !== undefined && 
      deviceStatus.pump?.extended?.TempBasalRemaining > 0 &&
      deviceStatus.pump?.extended?.TempBasalAbsoluteRate !== undefined) {
    const tempRate = deviceStatus.pump.extended.TempBasalAbsoluteRate;
    console.log('✅ Found active temp basal:', tempRate);
    return `T: ${tempRate.toFixed(3)}U`;
  }
  
  // Check BaseBasalRate (default pump basal rate)
  if (deviceStatus.pump?.extended?.BaseBasalRate !== undefined) {
    const baseRate = deviceStatus.pump.extended.BaseBasalRate;
    console.log('✅ Found base basal rate:', baseRate);
    return `${baseRate.toFixed(3)}U`;
  }
  
  // Check other possible locations
  if (deviceStatus.pump?.basal !== undefined) {
    return `${deviceStatus.pump.basal.toFixed(3)}U`;
  }
  
  if (deviceStatus.basal !== undefined) {
    return `${deviceStatus.basal.toFixed(3)}U`;
  }
  
  if (deviceStatus.openaps?.enacted?.rate !== undefined) {
    const duration = deviceStatus.openaps?.enacted?.duration || 0;
    const prefix = duration > 0 ? 'T: ' : '';
    return `${prefix}${deviceStatus.openaps.enacted.rate.toFixed(3)}U`;
  }
  
  console.log('❌ No basal rate found');
  return 'No Data';
};
