import { createContext, useContext } from 'react';

export interface TimeInRangeSettings {
  lowThreshold: number;
  highThreshold: number;
  targetMin: number;
  targetMax: number;
}

export interface TimeInRangeContextType {
  settings: TimeInRangeSettings;
  updateSettings: (newSettings: TimeInRangeSettings) => void;
  resetToDefaults: () => void;
  convertToMgDl: (mmolValue: number) => number;
  convertToMmol: (mgDlValue: number) => number;
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
