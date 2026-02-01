import { createContext, useContext } from 'react';

export type GlucoseUnit = 'mmol' | 'mgdl';

export interface GlucoseUnitsContextType {
  unit: GlucoseUnit;
  setUnit: (unit: GlucoseUnit) => void;
  convertGlucose: (value: number, fromUnit?: GlucoseUnit) => number;
  formatGlucose: (value: number, fromUnit?: GlucoseUnit, showUnit?: boolean) => string;
  getUnitLabel: () => string;
}

export const GlucoseUnitsContext = createContext<GlucoseUnitsContextType | undefined>(undefined);

export const useGlucoseUnits = (): GlucoseUnitsContextType => {
  const context = useContext(GlucoseUnitsContext);
  if (!context) {
    throw new Error('useGlucoseUnits must be used within a GlucoseUnitsProvider');
  }
  return context;
};

export default GlucoseUnitsContext;
