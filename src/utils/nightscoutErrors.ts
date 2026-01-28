export type NightscoutErrorKind = 'AuthError' | 'RateLimited' | 'Timeout' | 'BadResponse';

type NightscoutErrorOptions = {
  status?: number;
  retryable?: boolean;
  cause?: unknown;
};

export class NightscoutError extends Error {
  public readonly kind: NightscoutErrorKind;
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(kind: NightscoutErrorKind, message: string, options?: NightscoutErrorOptions) {
    super(message);
    this.name = kind;
    this.kind = kind;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
  }
}

export class AuthError extends NightscoutError {
  constructor(message: string, options?: NightscoutErrorOptions) {
    super('AuthError', message, { ...options, retryable: false });
  }
}

export class RateLimitedError extends NightscoutError {
  constructor(message: string, options?: NightscoutErrorOptions) {
    super('RateLimited', message, { ...options, retryable: true });
  }
}

export class TimeoutError extends NightscoutError {
  constructor(message: string, options?: NightscoutErrorOptions) {
    super('Timeout', message, { ...options, retryable: true });
  }
}

export class BadResponseError extends NightscoutError {
  constructor(message: string, options?: NightscoutErrorOptions) {
    super('BadResponse', message, { ...options, retryable: options?.retryable ?? true });
  }
}

export const isNightscoutError = (error: unknown): error is NightscoutError => {
  return error instanceof NightscoutError;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const classifyNightscoutError = (error: unknown): NightscoutErrorKind => {
  if (isNightscoutError(error)) return error.kind;

  if (error instanceof Error) {
    const msg = error.message || '';
    const name = error.name || '';

    if (name === 'AbortError' || /timeout/i.test(msg) || /Request timeout/i.test(msg)) return 'Timeout';
    if (/(401|403)/.test(msg) || /auth/i.test(msg) || /forbidden/i.test(msg) || /unauthorized/i.test(msg)) return 'AuthError';
    if (/(429)/.test(msg) || /rate.?limit/i.test(msg) || /Too Many Requests/i.test(msg)) return 'RateLimited';
  }

  return 'BadResponse';
};

export const toNightscoutError = (error: unknown, options?: { status?: number; retryable?: boolean }): NightscoutError => {
  if (isNightscoutError(error)) return error;

  const kind = classifyNightscoutError(error);
  const message = getErrorMessage(error);
  const status = options?.status;

  switch (kind) {
    case 'AuthError':
      return new AuthError(message, { status, cause: error });
    case 'RateLimited':
      return new RateLimitedError(message, { status, cause: error });
    case 'Timeout':
      return new TimeoutError(message, { status, cause: error });
    case 'BadResponse':
    default:
      return new BadResponseError(message, { status, retryable: options?.retryable, cause: error });
  }
};

export const formatNightscoutErrorForUser = (
  error: unknown,
  context?: { url?: string; apiVersion?: 'v1' | 'v3' | null }
): string => {
  // Preserve the existing (very specific) guidance for WebContainer.
  if (error instanceof Error && error.name === 'WebContainerNetworkError') {
    return error.message;
  }

  const normalized = toNightscoutError(error);
  const host = (() => {
    const raw = context?.url?.trim();
    if (!raw) return null;
    try {
      return new URL(raw).hostname;
    } catch {
      return null;
    }
  })();

  const where = host ? ` (${host})` : '';
  const apiHint = context?.apiVersion ? ` (API ${context.apiVersion})` : '';

  const detail = (() => {
    const msg = normalized.message?.trim();
    if (!msg) return null;
    // Keep details short; avoid dumping big proxy strings into the UI.
    return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
  })();

  switch (normalized.kind) {
    case 'AuthError': {
      return [
        `Nightscout authentication failed${where}${apiHint}.`,
        `Fix: verify your token in Settings, and ensure the API version matches your token type (v1: API secret / access token, v3: Bearer token with read permissions).`,
        detail ? `Details: ${detail}` : null
      ].filter(Boolean).join('\n');
    }
    case 'RateLimited': {
      return [
        `Nightscout is rate limiting requests${where}${apiHint}.`,
        `Fix: wait 30–60s and retry; reduce the time range; consider disabling auto-refresh temporarily.`,
        detail ? `Details: ${detail}` : null
      ].filter(Boolean).join('\n');
    }
    case 'Timeout': {
      return [
        `Nightscout request timed out${where}${apiHint}.`,
        `Fix: try a smaller time range, or check whether your Nightscout server is under heavy load.`,
        detail ? `Details: ${detail}` : null
      ].filter(Boolean).join('\n');
    }
    case 'BadResponse':
    default: {
      return [
        `Nightscout returned an unexpected response${where}${apiHint}.`,
        `Fix: verify the URL is correct and reachable, and that your Nightscout instance is online.`,
        detail ? `Details: ${detail}` : null
      ].filter(Boolean).join('\n');
    }
  }
};
