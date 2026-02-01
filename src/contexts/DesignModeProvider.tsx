import React, { useEffect, useState } from 'react';
import { DesignModeContext, type DesignMode, type DesignModeContextType } from './DesignModeContext';

const DESIGN_MODE_STORAGE_KEY = 'diabetes-analyzer-design-mode';

export const DesignModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [designMode, setDesignModeState] = useState<DesignMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DESIGN_MODE_STORAGE_KEY);
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
    document.body.className = document.body.className.replace(/design-mode-\w+/g, '');
    document.body.classList.add(`design-mode-${designMode}`);
  }, [designMode]);

  const value: DesignModeContextType = {
    designMode,
    setDesignMode,
    isClassic: designMode === 'classic',
    isPremium: designMode === 'premium'
  };

  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
};
