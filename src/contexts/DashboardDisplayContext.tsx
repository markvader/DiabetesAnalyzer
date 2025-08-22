import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DashboardDisplaySettings {
  showDeviceStatus: boolean;
}

interface DashboardDisplayContextType extends DashboardDisplaySettings {
  setShowDeviceStatus: (show: boolean) => void;
  resetToDefaults: () => void;
}

const defaultSettings: DashboardDisplaySettings = {
  showDeviceStatus: true,
};

const DashboardDisplayContext = createContext<DashboardDisplayContextType | undefined>(undefined);

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

  // Save to localStorage whenever settings change
  useEffect(() => {
    const settings: DashboardDisplaySettings = {
      showDeviceStatus,
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
    resetToDefaults,
  };

  return (
    <DashboardDisplayContext.Provider value={value}>
      {children}
    </DashboardDisplayContext.Provider>
  );
};

export const useDashboardDisplay = (): DashboardDisplayContextType => {
  const context = useContext(DashboardDisplayContext);
  if (context === undefined) {
    throw new Error('useDashboardDisplay must be used within a DashboardDisplayProvider');
  }
  return context;
};

export default DashboardDisplayContext;
