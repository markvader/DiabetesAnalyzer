export const GLUCOSE_RANGES = {
  LOW_THRESHOLD: 3.9, // 3.9 mmol/L
  HIGH_THRESHOLD: 10.0, // 10.0 mmol/L
  TARGET_MIN: 3.9, // 3.9 mmol/L
  TARGET_MAX: 10.0, // 10.0 mmol/L
  DISPLAY_MIN: 2.0, // 2.0 mmol/L
  DISPLAY_MAX: 22.0, // 22.0 mmol/L
  COLORS: {
    IN_RANGE: 'rgb(53, 162, 235)',
    IN_RANGE_BG: 'rgba(53, 162, 235, 0.1)',
    HIGH: 'rgb(255, 193, 7)',
    HIGH_BG: 'rgba(255, 193, 7, 0.1)',
    LOW: 'rgb(220, 53, 69)',
    LOW_BG: 'rgba(220, 53, 69, 0.1)',
    DARK: {
      IN_RANGE: 'rgb(96, 165, 250)',
      IN_RANGE_BG: 'rgba(96, 165, 250, 0.1)',
      HIGH: 'rgb(251, 191, 36)',
      HIGH_BG: 'rgba(251, 191, 36, 0.1)',
      LOW: 'rgb(239, 68, 68)',
      LOW_BG: 'rgba(239, 68, 68, 0.1)'
    }
  }
};