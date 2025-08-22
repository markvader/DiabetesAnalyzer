// Round to a specific number of decimal places
export const roundToDecimal = (num: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

// Format percentage
export const formatPercentage = (value: number): string => {
  // Defensive coding: ensure we have a valid number
  if (typeof value !== 'number' || isNaN(value)) {
    console.error('❌ formatPercentage received non-number value:', value);
    return '0.0%';
  }
  return `${roundToDecimal(value, 1)}%`;
};

// Format time string (HH:MM) from a date object - Legacy function, use TimeFormatContext for new code
export const formatTimeString = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// Format time string in 12-hour format from a date object
export const formatTimeString12 = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Calculate percentage change between two values
export const calculatePercentChange = (oldValue: number, newValue: number): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};