import React, { createContext, useContext, useState, useEffect } from 'react';

export type DesignMode = 'classic' | 'premium';

interface DesignModeContextType {
  designMode: DesignMode;
  setDesignMode: (mode: DesignMode) => void;
  isClassic: boolean;
  isPremium: boolean;
}

const DesignModeContext = createContext<DesignModeContextType | undefined>(undefined);

const DESIGN_MODE_STORAGE_KEY = 'diabetes-analyzer-design-mode';

export const DesignModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [designMode, setDesignModeState] = useState<DesignMode>(() => {
    // Load from localStorage or default to classic
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DESIGN_MODE_STORAGE_KEY);
      // If saved mode is 'modern', convert to 'classic'
      if (saved === 'modern') {
        return 'classic';
      }
      return (saved as DesignMode) || 'classic';
    }
    return 'classic';
  });

  const setDesignMode = (mode: DesignMode) => {
    setDesignModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DESIGN_MODE_STORAGE_KEY, mode);
    }
  };

  useEffect(() => {
    // Apply CSS class to body for global styling
    document.body.className = document.body.className.replace(/design-mode-\w+/g, '');
    document.body.classList.add(`design-mode-${designMode}`);
  }, [designMode]);

  const value: DesignModeContextType = {
    designMode,
    setDesignMode,
    isClassic: designMode === 'classic',
    isPremium: designMode === 'premium',
  };

  return (
    <DesignModeContext.Provider value={value}>
      {children}
    </DesignModeContext.Provider>
  );
};

export const useDesignMode = (): DesignModeContextType => {
  const context = useContext(DesignModeContext);
  if (context === undefined) {
    throw new Error('useDesignMode must be used within a DesignModeProvider');
  }
  return context;
};
