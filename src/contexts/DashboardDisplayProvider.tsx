import React, { useEffect, useState, type ReactNode } from 'react';
import {
  DashboardDisplayContext,
  type DashboardDisplayContextType,
  type DashboardDisplaySettings
} from './DashboardDisplayContext';

const defaultSettings: DashboardDisplaySettings = {
  showDeviceStatus: true
};

export const DashboardDisplayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showDeviceStatus, setShowDeviceStatus] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dashboardDisplaySettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.showDeviceStatus ?? defaultSettings.showDeviceStatus;
      }
    } catch (error) {
      console.warn('Failed to parse dashboard display settings from localStorage:', error);
    }
    return defaultSettings.showDeviceStatus;
  });

  useEffect(() => {
    const settings: DashboardDisplaySettings = {
      showDeviceStatus
    };

    try {
      localStorage.setItem('dashboardDisplaySettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save dashboard display settings to localStorage:', error);
    }
  }, [showDeviceStatus]);

  const resetToDefaults = () => {
    setShowDeviceStatus(defaultSettings.showDeviceStatus);
  };

  const value: DashboardDisplayContextType = {
    showDeviceStatus,
    setShowDeviceStatus,
    resetToDefaults
  };

  return <DashboardDisplayContext.Provider value={value}>{children}</DashboardDisplayContext.Provider>;
};
