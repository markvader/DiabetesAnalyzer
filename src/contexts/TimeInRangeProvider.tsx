import React, { useEffect, useState } from 'react';
import { TimeInRangeContext, type TimeInRangeContextType, type TimeInRangeSettings } from './TimeInRangeContext';

const DEFAULT_SETTINGS: TimeInRangeSettings = {
  lowThreshold: 3.9,
  highThreshold: 10.0,
  targetMin: 3.9,
  targetMax: 10.0
};

export const TimeInRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<TimeInRangeSettings>(() => {
    const stored = localStorage.getItem('timeInRangeSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lowThreshold && parsed.highThreshold && parsed.targetMin && parsed.targetMax) {
          return parsed;
        }
      } catch (error) {
        console.error('Error parsing stored time in range settings:', error);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('timeInRangeSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: TimeInRangeSettings) => {
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

  return <TimeInRangeContext.Provider value={value}>{children}</TimeInRangeContext.Provider>;
};
