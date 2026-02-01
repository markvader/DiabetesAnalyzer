import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { fetchData } from '../services/nightscoutService';
import { formatNightscoutErrorForUser } from '../utils/nightscoutErrors';
import { runSafeAsync } from '../utils/safeAsync';
import { NightscoutContext, type NightscoutContextType, type NightscoutData } from './NightscoutContext';

// In-memory storage fallback
const memoryStorage = new Map<string, string>();

const getItemTimestampMs = (item: unknown): number | null => {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const candidate =
    record.date ??
    record.srvCreated ??
    record.mills ??
    record.created_at ??
    record.dateString ??
    record.createdAt;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === 'string') {
    const parsed = Date.parse(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const computeDataFingerprint = (next: NightscoutData): string => {
  const entries = next.entries;
  const treatments = next.treatments;
  const deviceStatus = next.deviceStatus;

  const entryFirst = entries.length > 0 ? getItemTimestampMs(entries[0]) : null;
  const entryLast = entries.length > 1 ? getItemTimestampMs(entries[entries.length - 1]) : entryFirst;
  const trFirst = treatments.length > 0 ? getItemTimestampMs(treatments[0]) : null;
  const trLast = treatments.length > 1 ? getItemTimestampMs(treatments[treatments.length - 1]) : trFirst;

  return [
    `e:${entries.length}:${entryFirst ?? 'n'}:${entryLast ?? 'n'}`,
    `t:${treatments.length}:${trFirst ?? 'n'}:${trLast ?? 'n'}`,
    `p:${next.profile.length}`,
    `d:${deviceStatus.length}`
  ].join('|');
};

export const NightscoutProvider = ({ children }: { children: ReactNode }) => {
  const [url, setUrlState] = useState<string>('');
  const [token, setTokenState] = useState<string>('');
  const [data, setData] = useState<NightscoutData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30000);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [detectedApiVersion, setDetectedApiVersionState] = useState<'v1' | 'v3' | null>('v1');
  const [analysisPeriod, setAnalysisPeriodState] = useState<number>(14);

  const isFetchingRef = useRef<boolean>(false);
  const lastSuccessfulFetchRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const backgroundAbortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const activeBackgroundRequestIdRef = useRef<number>(0);
  const initializingRef = useRef<boolean>(true);
  const autoRefreshTimerRef = useRef<number | null>(null);
  const backgroundFetchingRef = useRef<boolean>(false);
  const analysisPeriodRef = useRef<number>(analysisPeriod);
  const lastFetchSignatureRef = useRef<string | null>(null);
  const lastDataFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    analysisPeriodRef.current = analysisPeriod;
  }, [analysisPeriod]);

  useEffect(() => {
    if (initializingRef.current) {
      try {
        const storedUrl = localStorage.getItem('nightscoutUrl');
        const storedToken = localStorage.getItem('nightscoutToken');
        const storedAutoRefresh = localStorage.getItem('autoRefreshEnabled');
        const storedInterval = localStorage.getItem('autoRefreshInterval');
        const storedApiVersion = localStorage.getItem('detectedApiVersion');
        const storedAnalysisPeriod = localStorage.getItem('analysisPeriod');

        if (storedUrl) setUrlState(storedUrl);
        if (storedToken) setTokenState(storedToken);
        if (storedAutoRefresh !== null) setAutoRefreshEnabled(storedAutoRefresh === 'true');
        if (storedInterval) setAutoRefreshInterval(parseInt(storedInterval));
        if (storedApiVersion) setDetectedApiVersionState(storedApiVersion as 'v1' | 'v3');
        else setDetectedApiVersionState('v1');
        if (storedAnalysisPeriod) setAnalysisPeriodState(parseInt(storedAnalysisPeriod));
      } catch {
        const storedUrl = memoryStorage.get('nightscoutUrl');
        const storedToken = memoryStorage.get('nightscoutToken');
        const storedAutoRefresh = memoryStorage.get('autoRefreshEnabled');
        const storedInterval = memoryStorage.get('autoRefreshInterval');
        const storedApiVersion = memoryStorage.get('detectedApiVersion');

        if (storedUrl) setUrlState(storedUrl);
        if (storedToken) setTokenState(storedToken);
        if (storedAutoRefresh !== null) setAutoRefreshEnabled(storedAutoRefresh === 'true');
        if (storedInterval) setAutoRefreshInterval(parseInt(storedInterval));
        if (storedApiVersion) setDetectedApiVersionState(storedApiVersion as 'v1' | 'v3');
        else setDetectedApiVersionState('v1');
      }
      initializingRef.current = false;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Cleanup');
      abortControllerRef.current = null;
    }

    if (backgroundAbortControllerRef.current) {
      backgroundAbortControllerRef.current.abort('Cleanup');
      backgroundAbortControllerRef.current = null;
    }

    activeRequestIdRef.current += 1;
    activeBackgroundRequestIdRef.current += 1;
    isFetchingRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();

      if (autoRefreshTimerRef.current !== null) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [cleanup]);

  const setUrl = useCallback(
    (newUrl: string) => {
      const trimmedUrl = newUrl.trim();
      if (trimmedUrl !== url) {
        cleanup();
        setUrlState(trimmedUrl);
        try {
          localStorage.setItem('nightscoutUrl', trimmedUrl);
        } catch {
          memoryStorage.set('nightscoutUrl', trimmedUrl);
        }
        setError(null);
        lastSuccessfulFetchRef.current = 0;
        lastFetchSignatureRef.current = null;
        lastDataFingerprintRef.current = null;
        setData(null);
      }
    },
    [url, cleanup]
  );

  const setToken = useCallback(
    (newToken: string) => {
      const trimmedToken = newToken.trim();
      if (trimmedToken !== token) {
        cleanup();
        setTokenState(trimmedToken);
        try {
          localStorage.setItem('nightscoutToken', trimmedToken);
        } catch {
          memoryStorage.set('nightscoutToken', trimmedToken);
        }
        setError(null);
        lastSuccessfulFetchRef.current = 0;
        lastFetchSignatureRef.current = null;
        lastDataFingerprintRef.current = null;
        setData(null);
      }
    },
    [token, cleanup]
  );

  const setAnalysisPeriod = useCallback(
    (newPeriod: number) => {
      if (newPeriod !== analysisPeriod) {
        setAnalysisPeriodState(newPeriod);
        try {
          localStorage.setItem('analysisPeriod', newPeriod.toString());
        } catch {
          memoryStorage.set('analysisPeriod', newPeriod.toString());
        }
      }
    },
    [analysisPeriod]
  );

  useEffect(() => {
    try {
      localStorage.setItem('autoRefreshEnabled', autoRefreshEnabled.toString());
    } catch {
      memoryStorage.set('autoRefreshEnabled', autoRefreshEnabled.toString());
    }
  }, [autoRefreshEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('autoRefreshInterval', autoRefreshInterval.toString());
    } catch {
      memoryStorage.set('autoRefreshInterval', autoRefreshInterval.toString());
    }
  }, [autoRefreshInterval]);

  const setDetectedApiVersion = useCallback((version: 'v1' | 'v3' | null) => {
    setDetectedApiVersionState(version);
    try {
      if (version) {
        localStorage.setItem('detectedApiVersion', version);
      } else {
        localStorage.removeItem('detectedApiVersion');
      }
    } catch {
      if (version) {
        memoryStorage.set('detectedApiVersion', version);
      } else {
        memoryStorage.delete('detectedApiVersion');
      }
    }
  }, []);

  const fetchDataInBackground = useCallback(
    async (requestedDays: number) => {
      if (!mountedRef.current) return;

      if (!url?.trim()) {
        return;
      }

      if (isFetchingRef.current) {
        console.log('⏭️ Foreground fetch in progress, skipping background fetch');
        return;
      }

      if (backgroundFetchingRef.current) {
        console.log('⏭️ Background fetch already in progress, skipping');
        return;
      }

      const now = Date.now();
      const minTimeBetweenFetches = 5000;
      const sameParamsSoftTtlMs = 30000;

      const signature = JSON.stringify({
        url: url.trim(),
        token: token.trim(),
        apiVersion: detectedApiVersion || 'v1',
        days: requestedDays
      });

      if (
        lastFetchSignatureRef.current === signature &&
        lastSuccessfulFetchRef.current &&
        now - lastSuccessfulFetchRef.current < sameParamsSoftTtlMs
      ) {
        console.log('⏭️ Skipping background fetch: same params and recent');
        return;
      }

      if (lastSuccessfulFetchRef.current && now - lastSuccessfulFetchRef.current < minTimeBetweenFetches) {
        console.log(`⏭️ Rate limited: Last fetch was ${Math.round((now - lastSuccessfulFetchRef.current) / 1000)}s ago`);
        return;
      }

      if (backgroundAbortControllerRef.current) {
        backgroundAbortControllerRef.current.abort('Superseded');
      }

      const controller = new AbortController();
      backgroundAbortControllerRef.current = controller;
      const requestId = (activeBackgroundRequestIdRef.current += 1);
      backgroundFetchingRef.current = true;

      try {
        console.log(`🔄 Background fetch: ${requestedDays} days of data...`);

        const result = await fetchData(url, requestedDays, token, controller.signal, detectedApiVersion || 'v1');

        if (!mountedRef.current || result === null) {
          return;
        }

        if (requestId !== activeBackgroundRequestIdRef.current) {
          return;
        }

        const normalizedResult = {
          entries: result?.entries || [],
          treatments: result?.treatments || [],
          profile: result?.profile || [],
          deviceStatus: result?.deviceStatus || []
        };

        if (mountedRef.current) {
          const nextData: NightscoutData = {
            entries: normalizedResult.entries,
            treatments: normalizedResult.treatments,
            profile: normalizedResult.profile,
            deviceStatus: normalizedResult.deviceStatus
          };

          const fingerprint = computeDataFingerprint(nextData);
          if (fingerprint !== lastDataFingerprintRef.current) {
            lastDataFingerprintRef.current = fingerprint;
            setData(nextData);
            setLastFetchTime(new Date());
          }
          setError(null);
          lastSuccessfulFetchRef.current = now;
          lastFetchSignatureRef.current = signature;

          console.log(`✅ Background fetch complete: ${normalizedResult.entries.length} entries`);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Background request aborted:', err.message);
          return;
        }

        console.error('Background fetch error:', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mountedRef.current) {
          backgroundFetchingRef.current = false;
        }

        if (backgroundAbortControllerRef.current === controller) {
          backgroundAbortControllerRef.current = null;
        }
        controller.abort('Cleanup');
      }
    },
    [url, token, detectedApiVersion]
  );

  const fetchDataForDays = useCallback(
    async (requestedDays: number) => {
      if (!mountedRef.current) return;

      if (!url?.trim()) {
        setError('Please configure your Nightscout URL in Settings');
        return;
      }

      if (isFetchingRef.current) {
        console.log('⏭️ Fetch already in progress, skipping');
        return;
      }

      const now = Date.now();
      const minTimeBetweenFetches = 5000;
      const sameParamsSoftTtlMs = 30000;

      const signature = JSON.stringify({
        url: url.trim(),
        token: token.trim(),
        apiVersion: detectedApiVersion || 'v1',
        days: requestedDays
      });

      if (
        lastFetchSignatureRef.current === signature &&
        lastSuccessfulFetchRef.current &&
        now - lastSuccessfulFetchRef.current < sameParamsSoftTtlMs
      ) {
        console.log('⏭️ Skipping fetch: same params and recent');
        return;
      }

      if (lastSuccessfulFetchRef.current && now - lastSuccessfulFetchRef.current < minTimeBetweenFetches) {
        console.log(`⏭️ Rate limited: Last fetch was ${Math.round((now - lastSuccessfulFetchRef.current) / 1000)}s ago`);
        return;
      }

      if (backgroundAbortControllerRef.current) {
        backgroundAbortControllerRef.current.abort('Foreground fetch started');
        backgroundAbortControllerRef.current = null;
      }

      cleanup();
      abortControllerRef.current = new AbortController();
      const requestId = (activeRequestIdRef.current += 1);
      isFetchingRef.current = true;

      try {
        setLoading(true);
        setError(null);

        console.log(`📥 Fetching ${requestedDays} days of data...`);

        const result = await fetchData(
          url,
          requestedDays,
          token,
          abortControllerRef.current.signal,
          detectedApiVersion || 'v1'
        );

        if (!mountedRef.current || result === null) {
          return;
        }

        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        const normalizedResult = {
          entries: result?.entries || [],
          treatments: result?.treatments || [],
          profile: result?.profile || [],
          deviceStatus: result?.deviceStatus || []
        };

        if (mountedRef.current) {
          const nextData: NightscoutData = {
            entries: normalizedResult.entries,
            treatments: normalizedResult.treatments,
            profile: normalizedResult.profile,
            deviceStatus: normalizedResult.deviceStatus
          };

          const fingerprint = computeDataFingerprint(nextData);
          if (fingerprint !== lastDataFingerprintRef.current) {
            lastDataFingerprintRef.current = fingerprint;
            setData(nextData);
            setLastFetchTime(new Date());
          }
          setError(null);
          lastSuccessfulFetchRef.current = now;
          lastFetchSignatureRef.current = signature;

          console.log(`✅ Successfully fetched ${normalizedResult.entries.length} entries for ${requestedDays} days`);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request aborted:', err.message);
          return;
        }

        const errorMessage = formatNightscoutErrorForUser(err, {
          url,
          apiVersion: detectedApiVersion
        });

        setError(errorMessage);
        if (!lastSuccessfulFetchRef.current) {
          setData(null);
        }
      } finally {
        if (mountedRef.current && requestId === activeRequestIdRef.current) {
          setLoading(false);
          isFetchingRef.current = false;
        }
      }
    },
    [url, token, cleanup, detectedApiVersion]
  );

  const prefetchDataForDays = useCallback(
    async (requestedDays: number) => {
      await fetchDataInBackground(requestedDays);
    },
    [fetchDataInBackground]
  );

  const refreshNow = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchDataForDays(1);
  }, [fetchDataForDays]);

  const forceRefresh = useCallback(() => {
    console.log('🔄 Force refresh triggered');
    lastSuccessfulFetchRef.current = 0;
    lastFetchSignatureRef.current = null;
    setRefreshCounter((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (autoRefreshTimerRef.current !== null) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    console.log('🚫 Auto-refresh is temporarily disabled for debugging');

    return () => {
      if (autoRefreshTimerRef.current !== null) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (refreshCounter > 0) {
      console.log(`🔄 Refresh counter changed to ${refreshCounter}, fetching data...`);
      runSafeAsync(() => fetchDataForDays(analysisPeriodRef.current), { label: 'Nightscout forced refresh' });
    }
  }, [refreshCounter, fetchDataForDays]);

  const contextValue = useMemo<NightscoutContextType>(
    () => ({
      url,
      token,
      setUrl,
      setToken,
      data,
      loading,
      error,
      fetchDataForDays,
      prefetchDataForDays,
      lastFetchTime,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
      autoRefreshInterval,
      setAutoRefreshInterval,
      refreshNow,
      forceRefresh,
      detectedApiVersion,
      setDetectedApiVersion,
      analysisPeriod,
      setAnalysisPeriod
    }),
    [
      url,
      token,
      setUrl,
      setToken,
      data,
      loading,
      error,
      fetchDataForDays,
      prefetchDataForDays,
      lastFetchTime,
      autoRefreshEnabled,
      autoRefreshInterval,
      setAutoRefreshEnabled,
      setAutoRefreshInterval,
      refreshNow,
      forceRefresh,
      detectedApiVersion,
      setDetectedApiVersion,
      analysisPeriod,
      setAnalysisPeriod
    ]
  );

  return <NightscoutContext.Provider value={contextValue}>{children}</NightscoutContext.Provider>;
};
