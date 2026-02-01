import React, { useState, type ReactNode } from 'react';
import { InsulinPumpProfile, INSULIN_PUMPS, DEFAULT_PUMP_ID, getPumpById } from '../constants/insulinPumps';
import { InsulinPumpContext, type InsulinPumpContextType } from './InsulinPumpContext';

interface InsulinPumpProviderProps {
  children: ReactNode;
}

export const InsulinPumpProvider: React.FC<InsulinPumpProviderProps> = ({ children }) => {
  const [selectedPumpId, setSelectedPumpIdState] = useState<string>(() => {
    const saved = localStorage.getItem('selected_insulin_pump');
    return saved && INSULIN_PUMPS[saved] ? saved : DEFAULT_PUMP_ID;
  });

  const selectedPump: InsulinPumpProfile | null = getPumpById(selectedPumpId);

  const setSelectedPumpId = (pumpId: string) => {
    if (INSULIN_PUMPS[pumpId]) {
      setSelectedPumpIdState(pumpId);
      localStorage.setItem('selected_insulin_pump', pumpId);
      console.log(`🏥 Insulin pump changed to: ${INSULIN_PUMPS[pumpId].name}`);
    }
  };

  const roundBasalRate = (rate: number): number => {
    if (!selectedPump) return Math.round(rate * 20) / 20;

    const increment = selectedPump.basalIncrements;
    return Math.round(rate / increment) * increment;
  };

  const roundBolusAmount = (bolus: number): number => {
    if (!selectedPump) return Math.round(bolus * 20) / 20;

    const increment = selectedPump.bolusIncrements;
    return Math.round(bolus / increment) * increment;
  };

  const validateBasalRate = (rate: number): { valid: boolean; maxRate: number } => {
    if (!selectedPump) return { valid: rate <= 30, maxRate: 30 };

    return {
      valid: rate <= selectedPump.maxBasalRate,
      maxRate: selectedPump.maxBasalRate
    };
  };

  const validateBolus = (bolus: number): { valid: boolean; maxBolus: number } => {
    if (!selectedPump) return { valid: bolus <= 25, maxBolus: 25 };

    return {
      valid: bolus <= selectedPump.maxBolus,
      maxBolus: selectedPump.maxBolus
    };
  };

  const getRecommendedMaxIOB = (): number => {
    return selectedPump?.recommendedMaxIOB || 5.0;
  };

  const getRecommendedMaxTempBasal = (): number => {
    return selectedPump?.recommendedMaxTempBasal || 6.0;
  };

  const getRecommendedDynamicISF = (): number => {
    return selectedPump?.recommendedDynamicISF || 100;
  };

  const getSafetyMultiplier = (): number => {
    return selectedPump?.safetyMultiplier || 1.0;
  };

  const contextValue: InsulinPumpContextType = {
    selectedPumpId,
    selectedPump,
    setSelectedPumpId,
    roundBasalRate,
    roundBolusAmount,
    validateBasalRate,
    validateBolus,
    getRecommendedMaxIOB,
    getRecommendedMaxTempBasal,
    getRecommendedDynamicISF,
    getSafetyMultiplier
  };

  return <InsulinPumpContext.Provider value={contextValue}>{children}</InsulinPumpContext.Provider>;
};
