import { createContext, useContext } from 'react';
import type { NightscoutEntry } from '../types/nightscout';

export interface TensorFlowContextType {
  isReady: boolean;
  isEnabled: boolean;
  isInitializing: boolean;
  error: string | null;
  modelInfo: unknown | null;
  toggleEnabled: (enabled: boolean) => Promise<void>;
  reinitialize: () => Promise<void>;
  getAnalysis: (readings: NightscoutEntry[]) => Promise<unknown>;
}

export const TensorFlowContext = createContext<TensorFlowContextType | undefined>(undefined);

export const useTensorFlow = (): TensorFlowContextType => {
  const context = useContext(TensorFlowContext);
  if (context === undefined) {
    throw new Error('useTensorFlow must be used within a TensorFlowProvider');
  }
  return context;
};

export default TensorFlowContext;
