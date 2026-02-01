import { createContext, useContext } from 'react';

export interface DashboardDisplaySettings {
  showDeviceStatus: boolean;
}

export interface DashboardDisplayContextType extends DashboardDisplaySettings {
  setShowDeviceStatus: (show: boolean) => void;
  resetToDefaults: () => void;
}

export const DashboardDisplayContext = createContext<DashboardDisplayContextType | undefined>(undefined);

export const useDashboardDisplay = (): DashboardDisplayContextType => {
  const context = useContext(DashboardDisplayContext);
  if (context === undefined) {
    throw new Error('useDashboardDisplay must be used within a DashboardDisplayProvider');
  }
  return context;
};

export default DashboardDisplayContext;
