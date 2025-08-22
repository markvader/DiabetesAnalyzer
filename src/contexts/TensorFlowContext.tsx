import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import TensorFlowAIService from '../services/tensorFlowAIService';

// Create a singleton instance
const tensorFlowService = new TensorFlowAIService();

interface TensorFlowContextType {
  isReady: boolean;
  isEnabled: boolean;
  isInitializing: boolean;
  error: string | null;
  modelInfo: any;
  toggleEnabled: (enabled: boolean) => Promise<void>;
  reinitialize: () => Promise<void>;
  getAnalysis: (readings: any[]) => Promise<any>;
}

const TensorFlowContext = createContext<TensorFlowContextType | undefined>(undefined);

interface TensorFlowProviderProps {
  children: ReactNode;
}

export const TensorFlowProvider: React.FC<TensorFlowProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem('tensorflow_enabled');
    return stored === null ? true : stored === 'true';
  });
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState(null);

  // Initialize TensorFlow on mount
  useEffect(() => {
    if (isEnabled) {
      initializeTensorFlow();
    }
  }, [isEnabled]);

  const initializeTensorFlow = async () => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      console.log('🤖 TensorFlow Context: Initializing...');
      
      // Initialize the service
      await tensorFlowService.initialize();
      
      // Check if it's ready
      const ready = tensorFlowService.isReady();
      setIsReady(ready);
      
      if (ready) {
        const info = tensorFlowService.getModelInfo();
        setModelInfo(info);
        console.log('✅ TensorFlow Context: Initialization successful', info);
      } else {
        console.log('⚠️ TensorFlow Context: Not ready after initialization');
        setError('TensorFlow model failed to initialize properly');
      }
    } catch (err: any) {
      console.error('❌ TensorFlow Context: Initialization failed', err);
      setError(err.message || 'Failed to initialize TensorFlow');
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem('tensorflow_enabled', enabled.toString());
    
    if (enabled) {
      await initializeTensorFlow();
    } else {
      setIsReady(false);
      setError(null);
      setModelInfo(null);
    }
  };

  const reinitialize = async () => {
    if (isEnabled) {
      await initializeTensorFlow();
    }
  };

  const getAnalysis = async (readings: any[]) => {
    if (!isReady || !isEnabled || readings.length === 0) {
      throw new Error('TensorFlow not ready or no data available');
    }

    try {
      return await tensorFlowService.analyzeGlucosePatterns(readings);
    } catch (error) {
      console.error('TensorFlow analysis failed:', error);
      throw error;
    }
  };

  const value: TensorFlowContextType = {
    isReady,
    isEnabled,
    isInitializing,
    error,
    modelInfo,
    toggleEnabled,
    reinitialize,
    getAnalysis
  };

  return (
    <TensorFlowContext.Provider value={value}>
      {children}
    </TensorFlowContext.Provider>
  );
};

export const useTensorFlow = (): TensorFlowContextType => {
  const context = useContext(TensorFlowContext);
  if (context === undefined) {
    throw new Error('useTensorFlow must be used within a TensorFlowProvider');
  }
  return context;
};
