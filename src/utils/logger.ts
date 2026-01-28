type LogArgs = unknown[];

export type DebugLevel = 'log' | 'warn' | 'error';

export type DebugEvent = {
  id: number;
  ts: number;
  level: DebugLevel;
  args: LogArgs;
};

const DEBUG_BUFFER_MAX = 500;

let nextDebugEventId = 1;
const debugBuffer: DebugEvent[] = [];

const isConsoleDebugEnabled = (): boolean => {
  const flag = String(import.meta.env.VITE_DEBUG_LOGS || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
};

const pushDebugEvent = (level: DebugLevel, args: LogArgs) => {
  debugBuffer.push({ id: nextDebugEventId++, ts: Date.now(), level, args });
  if (debugBuffer.length > DEBUG_BUFFER_MAX) {
    debugBuffer.splice(0, debugBuffer.length - DEBUG_BUFFER_MAX);
  }
};

export const getDebugEvents = (): DebugEvent[] => debugBuffer.slice();

export const clearDebugEvents = () => {
  debugBuffer.length = 0;
};

const safeStringify = (value: unknown, maxLen = 25_000): string => {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === 'bigint') return String(v);
      if (typeof v === 'function') return '[Function]';
      if (typeof v === 'symbol') return String(v);
      if (v && typeof v === 'object') {
        if (seen.has(v as object)) return '[Circular]';
        seen.add(v as object);
      }
      return v;
    },
    2
  );

  if (typeof json !== 'string') return String(json);
  if (json.length <= maxLen) return json;
  return `${json.slice(0, maxLen)}\n…(truncated ${json.length - maxLen} chars)…`;
};

const formatArgs = (args: LogArgs): string => {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) {
        const name = a.name || 'Error';
        const msg = a.message || '';
        return `${name}${msg ? `: ${msg}` : ''}`;
      }
      try {
        return safeStringify(a, 10_000);
      } catch {
        return String(a);
      }
    })
    .join(' ');
};

export const formatDebugReport = (options?: { maxEvents?: number }): string => {
  const maxEvents = options?.maxEvents ?? 300;
  const events = debugBuffer.slice(Math.max(0, debugBuffer.length - maxEvents));

  const header = {
    generatedAt: new Date().toISOString(),
    mode: import.meta.env.MODE,
    debugConsoleEnabled: isConsoleDebugEnabled(),
    location: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  };

  const lines: string[] = [];
  lines.push('DiabetesAnalyzer debug report');
  lines.push(safeStringify(header, 10_000));
  lines.push('');

  for (const e of events) {
    const ts = new Date(e.ts).toISOString();
    lines.push(`[${ts}] ${e.level.toUpperCase()} ${formatArgs(e.args)}`);
  }

  return lines.join('\n');
};

export const copyDebugReport = async (options?: { maxEvents?: number }): Promise<string> => {
  const report = formatDebugReport(options);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(report);
  }
  return report;
};

export const debugLog = (...args: LogArgs) => {
  pushDebugEvent('log', args);
  if (!isConsoleDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

export const debugWarn = (...args: LogArgs) => {
  pushDebugEvent('warn', args);
  if (!isConsoleDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
};

export const debugError = (...args: LogArgs) => {
  pushDebugEvent('error', args);
  if (!isConsoleDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.error(...args);
};
