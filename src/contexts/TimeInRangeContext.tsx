import React, { createContext, useContext, useState, useEffect } from 'react';

interface TimeInRangeSettings {
  lowThreshold: number;    // mmol/L
  highThreshold: number;   // mmol/L
  targetMin: number;       // mmol/L
  targetMax: number;       // mmol/L
}

interface TimeInRangeContextType {
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

const TimeInRangeContext = createContext<TimeInRangeContextType | undefined>(undefined);

// Default values (in mmol/L as per current constants)
const DEFAULT_SETTINGS: TimeInRangeSettings = {
  lowThreshold: 3.9,
  highThreshold: 10.0,
  targetMin: 3.9,
  targetMax: 10.0
};

export const TimeInRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<TimeInRangeSettings>(() => {
    // Load from localStorage or use defaults
    const stored = localStorage.getItem('timeInRangeSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate the stored settings
        if (parsed.lowThreshold && parsed.highThreshold && parsed.targetMin && parsed.targetMax) {
          return parsed;
        }
      } catch (error) {
        console.error('Error parsing stored time in range settings:', error);
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('timeInRangeSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: TimeInRangeSettings) => {
    // Validate settings
    if (newSettings.lowThreshold >= newSettings.targetMin) {
      console.error('Low threshold must be less than target minimum');
      return;
    }
    if (newSettings.targetMin >= newSettings.targetMax) {
      console.error('Target minimum must be less than target maximum');
      return;
    }
    if (newSettings.targetMax >= newSettings.highThreshold) {
      console.error('Target maximum must be less than high threshold');
      return;
    }
    
    setSettings(newSettings);
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  // Unit conversion helpers
  const convertToMgDl = (mmolValue: number): number => {
    return mmolValue * 18.018;
  };

  const convertToMmol = (mgDlValue: number): number => {
    return mgDlValue / 18.018;
  };

  const getSettingsInUnit = (unit: 'mmol' | 'mgdl'): TimeInRangeSettings => {
    if (unit === 'mgdl') {
      return {
        lowThreshold: convertToMgDl(settings.lowThreshold),
        highThreshold: convertToMgDl(settings.highThreshold),
        targetMin: convertToMgDl(settings.targetMin),
        targetMax: convertToMgDl(settings.targetMax)
      };
    }
    return settings;
  };

  const setSettingsFromUnit = (newSettings: TimeInRangeSettings, unit: 'mmol' | 'mgdl') => {
    if (unit === 'mgdl') {
      // Convert from mg/dL to mmol/L before storing
      const convertedSettings = {
        lowThreshold: convertToMmol(newSettings.lowThreshold),
        highThreshold: convertToMmol(newSettings.highThreshold),
        targetMin: convertToMmol(newSettings.targetMin),
        targetMax: convertToMmol(newSettings.targetMax)
      };
      updateSettings(convertedSettings);
    } else {
      updateSettings(newSettings);
    }
  };

  const value: TimeInRangeContextType = {
    settings,
    updateSettings,
    resetToDefaults,
    convertToMgDl,
    convertToMmol,
    getSettingsInUnit,
    setSettingsFromUnit
  };

  return (
    <TimeInRangeContext.Provider value={value}>
      {children}
    </TimeInRangeContext.Provider>
  );
};

export const useTimeInRange = (): TimeInRangeContextType => {
  const context = useContext(TimeInRangeContext);
  if (context === undefined) {
    throw new Error('useTimeInRange must be used within a TimeInRangeProvider');
  }
  return context;
};
