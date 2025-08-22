import React, { createContext, useContext, useState, ReactNode } from 'react';

export type GlucoseUnit = 'mmol' | 'mgdl';

interface GlucoseUnitsContextType {
  unit: GlucoseUnit;
  setUnit: (unit: GlucoseUnit) => void;
  convertGlucose: (value: number, fromUnit?: GlucoseUnit) => number;
  formatGlucose: (value: number, fromUnit?: GlucoseUnit, showUnit?: boolean) => string;
  getUnitLabel: () => string;
}

const GlucoseUnitsContext = createContext<GlucoseUnitsContextType | undefined>(undefined);

interface GlucoseUnitsProviderProps {
  children: ReactNode;
}

export const GlucoseUnitsProvider: React.FC<GlucoseUnitsProviderProps> = ({ children }) => {
  const [unit, setUnitState] = useState<GlucoseUnit>(() => {
    const saved = localStorage.getItem('glucose_unit');
    return (saved as GlucoseUnit) || 'mmol';
  });

  const setUnit = (newUnit: GlucoseUnit) => {
    setUnitState(newUnit);
    localStorage.setItem('glucose_unit', newUnit);
  };

  // Convert glucose values between units
  const convertGlucose = (value: number, fromUnit: GlucoseUnit = 'mgdl'): number => {
    if (fromUnit === unit) {
      return value;
    }
    
    if (fromUnit === 'mgdl' && unit === 'mmol') {
      // Convert mg/dL to mmol/L
      return value / 18.0182;
    } else if (fromUnit === 'mmol' && unit === 'mgdl') {
      // Convert mmol/L to mg/dL
      return value * 18.0182;
    }
    
    return value;
  };

  // Format glucose values with proper unit conversion and display
  const formatGlucose = (value: number, fromUnit: GlucoseUnit = 'mgdl', showUnit: boolean = false): string => {
    const converted = convertGlucose(value, fromUnit);
    const formatted = unit === 'mmol' ? converted.toFixed(1) : Math.round(converted).toString();
    return showUnit ? `${formatted} ${getUnitLabel()}` : formatted;
  };

  // Get unit label for display
  const getUnitLabel = (): string => {
    return unit === 'mmol' ? 'mmol/L' : 'mg/dL';
  };

  const value: GlucoseUnitsContextType = {
    unit,
    setUnit,
    convertGlucose,
    formatGlucose,
    getUnitLabel
  };

  return (
    <GlucoseUnitsContext.Provider value={value}>
      {children}
    </GlucoseUnitsContext.Provider>
  );
};

export const useGlucoseUnits = (): GlucoseUnitsContextType => {
  const context = useContext(GlucoseUnitsContext);
  if (!context) {
    throw new Error('useGlucoseUnits must be used within a GlucoseUnitsProvider');
  }
  return context;
};
