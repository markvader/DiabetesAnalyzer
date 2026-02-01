import { createContext, useContext } from 'react';
import type { InsulinPumpProfile } from '../constants/insulinPumps';

export interface InsulinPumpContextType {
  selectedPumpId: string;
  selectedPump: InsulinPumpProfile | null;
  setSelectedPumpId: (pumpId: string) => void;

  roundBasalRate: (rate: number) => number;
  roundBolusAmount: (bolus: number) => number;
  validateBasalRate: (rate: number) => { valid: boolean; maxRate: number };
  validateBolus: (bolus: number) => { valid: boolean; maxBolus: number };

  getRecommendedMaxIOB: () => number;
  getRecommendedMaxTempBasal: () => number;
  getRecommendedDynamicISF: () => number;
  getSafetyMultiplier: () => number;
}

export const InsulinPumpContext = createContext<InsulinPumpContextType | undefined>(undefined);

export const useInsulinPump = (): InsulinPumpContextType => {
  const context = useContext(InsulinPumpContext);
  if (!context) {
    throw new Error('useInsulinPump must be used within an InsulinPumpProvider');
  }
  return context;
};

export default InsulinPumpContext;
