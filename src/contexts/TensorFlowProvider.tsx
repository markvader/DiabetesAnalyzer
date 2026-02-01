import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NightscoutEntry } from '../types/nightscout';
import { runSafeAsync } from '../utils/safeAsync';
import { TensorFlowContext, type TensorFlowContextType } from './TensorFlowContext';

interface TensorFlowServiceLike {
  initialize: () => Promise<void>;
  isReady: () => boolean;
  getModelInfo: () => unknown;
  analyzeGlucosePatterns: (readings: NightscoutEntry[]) => Promise<unknown>;
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Unknown error';
};

let tensorFlowService: TensorFlowServiceLike | null = null;
let tensorFlowServicePromise: Promise<TensorFlowServiceLike> | null = null;

const getTensorFlowService = async () => {
  if (tensorFlowService) return tensorFlowService;
  if (!tensorFlowServicePromise) {
    tensorFlowServicePromise = import('../services/tensorFlowAIService').then((mod) => {
      const ServiceCtor = (mod as unknown as { default: new () => TensorFlowServiceLike }).default;
      tensorFlowService = new ServiceCtor();
      return tensorFlowService;
    });
  }
  return tensorFlowServicePromise;
};

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
  const [modelInfo, setModelInfo] = useState<unknown | null>(null);

  const initializingRef = useRef(false);

  const initializeTensorFlow = useCallback(async () => {
    if (initializingRef.current) return;

    initializingRef.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      console.log('🤖 TensorFlow Context: Initializing...');

      const svc = await getTensorFlowService();
      await svc.initialize();

      const ready = svc.isReady();
      setIsReady(ready);

      if (ready) {
        const info = svc.getModelInfo();
        setModelInfo(info);
        console.log('✅ TensorFlow Context: Initialization successful', info);
      } else {
        console.log('⚠️ TensorFlow Context: Not ready after initialization');
        setError('TensorFlow model failed to initialize properly');
      }
    } catch (err: unknown) {
      console.error('❌ TensorFlow Context: Initialization failed', err);
      setError(getErrorMessage(err) || 'Failed to initialize TensorFlow');
      setIsReady(false);
    } finally {
      initializingRef.current = false;
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      runSafeAsync(() => initializeTensorFlow(), { label: 'TensorFlow initialize' });
    }
  }, [isEnabled, initializeTensorFlow]);

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

  const getAnalysis = async (readings: NightscoutEntry[]) => {
    if (!isReady || !isEnabled || readings.length === 0) {
      throw new Error('TensorFlow not ready or no data available');
    }

    try {
      const svc = await getTensorFlowService();
      return await svc.analyzeGlucosePatterns(readings);
    } catch (analysisError) {
      console.error('TensorFlow analysis failed:', analysisError);
      throw analysisError;
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

  return <TensorFlowContext.Provider value={value}>{children}</TensorFlowContext.Provider>;
};
