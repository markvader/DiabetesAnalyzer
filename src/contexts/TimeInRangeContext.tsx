import { createContext, useContext } from 'react';

export interface TimeInRangeSettings {
  lowThreshold: number;    // mmol/L
  highThreshold: number;   // mmol/L
  targetMin: number;       // mmol/L
  targetMax: number;       // mmol/L
}

export interface TimeInRangeContextType {
  settings: TimeInRangeSettings;
  updateSettings: (newSettings: TimeInRangeSettings) => void;
  resetToDefaults: () => void;
  // Helper functions to convert between units
  convertToMgDl: (mmolValue: number) => number;
  convertToMmol: (mgDlValue: number) => number;
  // Get settings in current unit (for display)
  getSettingsInUnit: (unit: 'mmol' | 'mgdl') => TimeInRangeSettings;
  setSettingsFromUnit: (newSettings: TimeInRangeSettings, unit: 'mmol' | 'mgdl') => void;
}

export const TimeInRangeContext = createContext<TimeInRangeContextType | undefined>(undefined);

export const useTimeInRange = (): TimeInRangeContextType => {
  const context = useContext(TimeInRangeContext);
  if (context === undefined) {
    throw new Error('useTimeInRange must be used within a TimeInRangeProvider');
  }
  return context;
};

export default TimeInRangeContext;
