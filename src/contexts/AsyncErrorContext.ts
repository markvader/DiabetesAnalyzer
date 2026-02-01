import { createContext, useContext } from 'react';

export type AsyncUserError = {
  ts: number;
  message: string;
  label?: string;
};

export type AsyncErrorContextValue = {
  lastError: AsyncUserError | null;
  clearLastError: () => void;
};

export const AsyncErrorContext = createContext<AsyncErrorContextValue | undefined>(undefined);

export const useAsyncErrors = (): AsyncErrorContextValue => {
  const ctx = useContext(AsyncErrorContext);
  if (!ctx) throw new Error('useAsyncErrors must be used within AsyncErrorProvider');
  return ctx;
};

export default AsyncErrorContext;
