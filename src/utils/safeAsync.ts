import { debugError } from './logger';

export type SafeAsyncOptions = {
  label?: string;
  onError?: (error: unknown) => void;
};

type AsyncFn<TArgs extends unknown[]> = (...args: TArgs) => Promise<unknown>;

type AsyncErrorEventDetail = {
  label?: string;
  message: string;
  error: unknown;
  ts: number;
};

const ASYNC_ERROR_EVENT = 'diabetesanalyzer:async-error';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const emitAsyncError = (detail: Omit<AsyncErrorEventDetail, 'ts'>) => {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<AsyncErrorEventDetail>(ASYNC_ERROR_EVENT, {
    detail: { ...detail, ts: Date.now() }
  });
  window.dispatchEvent(event);
};

export const onAsyncErrorEvent = (handler: (detail: AsyncErrorEventDetail) => void) => {
  if (typeof window === 'undefined') return () => {};

  const listener = (evt: Event) => {
    const ce = evt as CustomEvent<AsyncErrorEventDetail>;
    if (ce.detail) handler(ce.detail);
  };

  window.addEventListener(ASYNC_ERROR_EVENT, listener);
  return () => window.removeEventListener(ASYNC_ERROR_EVENT, listener);
};

export const safeAsync = <TArgs extends unknown[]>(fn: AsyncFn<TArgs>, options?: SafeAsyncOptions) => {
  return (...args: TArgs): void => {
    void fn(...args).catch((error: unknown) => {
      const label = options?.label;
      const message = getErrorMessage(error);

      debugError('Async error', { label, message, error });
      emitAsyncError({ label, message, error });

      options?.onError?.(error);
    });
  };
};

export const runSafeAsync = (fn: () => Promise<unknown>, options?: SafeAsyncOptions): void => {
  safeAsync(fn, options)();
};
