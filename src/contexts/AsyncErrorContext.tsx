import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAsyncErrorEvent } from '../utils/safeAsync';

export type AsyncUserError = {
  ts: number;
  message: string;
  label?: string;
};

type AsyncErrorContextValue = {
  lastError: AsyncUserError | null;
  clearLastError: () => void;
};

const AsyncErrorContext = createContext<AsyncErrorContextValue | undefined>(undefined);

export const AsyncErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastError, setLastError] = useState<AsyncUserError | null>(null);

  useEffect(() => {
    const off = onAsyncErrorEvent((detail) => {
      setLastError({ ts: detail.ts, message: detail.message, label: detail.label });
    });

    const onUnhandledRejection = (evt: PromiseRejectionEvent) => {
      const reason = evt.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      setLastError({ ts: Date.now(), message, label: 'unhandledrejection' });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      off();
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const value = useMemo<AsyncErrorContextValue>(
    () => ({
      lastError,
      clearLastError: () => setLastError(null)
    }),
    [lastError]
  );

  return <AsyncErrorContext.Provider value={value}>{children}</AsyncErrorContext.Provider>;
};

export const useAsyncErrors = (): AsyncErrorContextValue => {
  const ctx = useContext(AsyncErrorContext);
  if (!ctx) throw new Error('useAsyncErrors must be used within AsyncErrorProvider');
  return ctx;
};
