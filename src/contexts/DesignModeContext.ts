import { createContext, useContext } from 'react';

export type DesignMode = 'classic' | 'premium';

export interface DesignModeContextType {
  designMode: DesignMode;
  setDesignMode: (mode: DesignMode) => void;
  isClassic: boolean;
  isPremium: boolean;
}

export const DesignModeContext = createContext<DesignModeContextType | undefined>(undefined);

export const useDesignMode = (): DesignModeContextType => {
  const context = useContext(DesignModeContext);
  if (context === undefined) {
    throw new Error('useDesignMode must be used within a DesignModeProvider');
  }
  return context;
};

export default DesignModeContext;
