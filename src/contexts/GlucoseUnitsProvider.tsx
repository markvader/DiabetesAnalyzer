import React, { useState, type ReactNode } from 'react';
import { GlucoseUnitsContext, type GlucoseUnit, type GlucoseUnitsContextType } from './GlucoseUnitsContext';

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

  const convertGlucose = (value: number, fromUnit: GlucoseUnit = 'mgdl'): number => {
    if (fromUnit === unit) {
      return value;
    }

    if (fromUnit === 'mgdl' && unit === 'mmol') {
      return value / 18.0182;
    } else if (fromUnit === 'mmol' && unit === 'mgdl') {
      return value * 18.0182;
    }

    return value;
  };

  const getUnitLabel = (): string => {
    return unit === 'mmol' ? 'mmol/L' : 'mg/dL';
  };

  const formatGlucose = (value: number, fromUnit: GlucoseUnit = 'mgdl', showUnit: boolean = false): string => {
    const converted = convertGlucose(value, fromUnit);
    const formatted = unit === 'mmol' ? converted.toFixed(1) : Math.round(converted).toString();
    return showUnit ? `${formatted} ${getUnitLabel()}` : formatted;
  };

  const value: GlucoseUnitsContextType = {
    unit,
    setUnit,
    convertGlucose,
    formatGlucose,
    getUnitLabel
  };

  return <GlucoseUnitsContext.Provider value={value}>{children}</GlucoseUnitsContext.Provider>;
};
