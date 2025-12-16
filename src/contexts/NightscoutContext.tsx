import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { fetchData } from '../services/nightscoutService';

interface NightscoutData {
  entries: any[];
  treatments: any[];
  profile: any[];
  deviceStatus: any[];
}

interface NightscoutContextType {
  url: string;
  token: string;
  setUrl: (url: string) => void;
  setToken: (token: string) => void;
  data: NightscoutData | null;
  loading: boolean;
  error: string | null;
  fetchDataForDays: (days: number) => Promise<void>;
  lastFetchTime: Date | null;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (interval: number) => void;
  refreshNow: () => Promise<void>;
  forceRefresh: () => void;
  detectedApiVersion: 'v1' | 'v3' | null;
  setDetectedApiVersion: (version: 'v1' | 'v3' | null) => void;
  analysisPeriod: number;
  setAnalysisPeriod: (days: number) => void;
}

const NightscoutContext = createContext<NightscoutContextType>({
  url: '',
  token: '',
  setUrl: () => {},
  setToken: () => {},
  data: null,
  loading: false,
  error: null,
  fetchDataForDays: async () => {},
  lastFetchTime: null,
  autoRefreshEnabled: true,
  setAutoRefreshEnabled: () => {},
  autoRefreshInterval: 60000,
  setAutoRefreshInterval: () => {},
  refreshNow: async () => {},
  forceRefresh: () => {},
  detectedApiVersion: null,
  setDetectedApiVersion: () => {},
  analysisPeriod: 14,
  setAnalysisPeriod: () => {}
});

export const useNightscout = () => useContext(NightscoutContext);

// In-memory storage fallback
const memoryStorage = new Map<string, string>();

export const NightscoutProvider = ({ children }: { children: ReactNode }) => {
  const [url, setUrlState] = useState<string>('');
  const [token, setTokenState] = useState<string>('');
  const [data, setData] = useState<NightscoutData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false); // Disabled by default to prevent data replacement issues
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30000); // 30 seconds default
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [detectedApiVersion, setDetectedApiVersionState] = useState<'v1' | 'v3' | null>('v1'); // Default to v1
  const [analysisPeriod, setAnalysisPeriodState] = useState<number>(14); // Default to 14 days
  
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

  // Initialize state from storage
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
        else setDetectedApiVersionState('v1'); // Default to v1 if not stored
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
        else setDetectedApiVersionState('v1'); // Default to v1 if not stored
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

    // Bump request IDs so any in-flight responses become stale
    activeRequestIdRef.current += 1;
    activeBackgroundRequestIdRef.current += 1;
    isFetchingRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      
      // Clear auto-refresh timer on unmount
      if (autoRefreshTimerRef.current !== null) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [cleanup]);

  const setUrl = useCallback((newUrl: string) => {
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
      setData(null);
      // Don't reset API version when URL changes - let user choose
    }
  }, [url, cleanup]);

  const setToken = useCallback((newToken: string) => {
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
      setData(null);
      // Don't reset API version when token changes - let user choose
    }
  }, [token, cleanup]);

  const setAnalysisPeriod = useCallback((newPeriod: number) => {
    if (newPeriod !== analysisPeriod) {
      setAnalysisPeriodState(newPeriod);
      try {
        localStorage.setItem('analysisPeriod', newPeriod.toString());
      } catch {
        memoryStorage.set('analysisPeriod', newPeriod.toString());
      }
    }
  }, [analysisPeriod]);

  // Update auto-refresh settings in storage
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

  // Function to set detected API version and store it
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

  // Background fetch function that doesn't set loading state
  const fetchDataInBackground = useCallback(async (requestedDays: number) => {
    if (!mountedRef.current) return;
    
    if (!url?.trim()) {
      return;
    }

    // Never run background fetch while a foreground fetch is active
    if (isFetchingRef.current) {
      console.log('⏭️ Foreground fetch in progress, skipping background fetch');
      return;
    }

    if (backgroundFetchingRef.current) {
      console.log('⏭️ Background fetch already in progress, skipping');
      return;
    }

    const now = Date.now();
    const minTimeBetweenFetches = 5000; // 5 seconds minimum

    // Simple rate limiting
    if (lastSuccessfulFetchRef.current && 
        (now - lastSuccessfulFetchRef.current) < minTimeBetweenFetches) {
      console.log(`⏭️ Rate limited: Last fetch was ${Math.round((now - lastSuccessfulFetchRef.current) / 1000)}s ago`);
      return;
    }

    // Cancel any prior background request
    if (backgroundAbortControllerRef.current) {
      backgroundAbortControllerRef.current.abort('Superseded');
    }

    // Create a new abort controller + request id for this request
    const controller = new AbortController();
    backgroundAbortControllerRef.current = controller;
    const requestId = (activeBackgroundRequestIdRef.current += 1);
    backgroundFetchingRef.current = true;
    
    try {
      console.log(`🔄 Background fetch: ${requestedDays} days of data...`);
      
      const result = await fetchData(
        url, 
        requestedDays, 
        token, 
        controller.signal,
        detectedApiVersion || 'v1'
      );

      if (!mountedRef.current || result === null) {
        return;
      }

      // Stale-request guard
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
        setData({
          entries: normalizedResult.entries,
          treatments: normalizedResult.treatments,
          profile: normalizedResult.profile,
          deviceStatus: normalizedResult.deviceStatus
        });
        setLastFetchTime(new Date());
        setError(null);
        lastSuccessfulFetchRef.current = now;
        
        console.log(`✅ Background fetch complete: ${normalizedResult.entries.length} entries`);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Background request aborted:', err.message);
        return;
      }
      
      console.error('Background fetch error:', err instanceof Error ? err.message : 'Unknown error');
      
      // Don't update error state for background fetches
      // This prevents error messages from appearing during auto-refresh
    } finally {
      if (mountedRef.current) {
        backgroundFetchingRef.current = false;
      }

      // Only clear if we're still the latest background controller
      if (backgroundAbortControllerRef.current === controller) {
        backgroundAbortControllerRef.current = null;
      }
      controller.abort('Cleanup');
    }
  }, [url, token, detectedApiVersion, setDetectedApiVersion]);

  const fetchDataForDays = useCallback(async (requestedDays: number) => {
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
    const minTimeBetweenFetches = 5000; // 5 seconds minimum (reduced from 10s)

    // Simple rate limiting - only check time, not data complexity
    if (lastSuccessfulFetchRef.current && 
        (now - lastSuccessfulFetchRef.current) < minTimeBetweenFetches) {
      console.log(`⏭️ Rate limited: Last fetch was ${Math.round((now - lastSuccessfulFetchRef.current) / 1000)}s ago`);
      return;
    }

    // Cancel any background request to prevent data overwrite races
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

      // Stale-request guard
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
        setData({
          entries: normalizedResult.entries,
          treatments: normalizedResult.treatments,
          profile: normalizedResult.profile,
          deviceStatus: normalizedResult.deviceStatus
        });
        setLastFetchTime(new Date());
        setError(null);
        lastSuccessfulFetchRef.current = now;
        
        console.log(`✅ Successfully fetched ${normalizedResult.entries.length} entries for ${requestedDays} days`);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      // Stale-request guard
      if (requestId !== activeRequestIdRef.current) {
        return;
      }
      
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request aborted:', err.message);
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      
      setError(errorMessage);
      if (!lastSuccessfulFetchRef.current) {
        setData(null);
      }
    } finally {
      // Only the latest request should be able to flip loading/isFetching
      if (mountedRef.current && requestId === activeRequestIdRef.current) {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [url, token, cleanup, detectedApiVersion, setDetectedApiVersion]);

  // Function to manually refresh data
  const refreshNow = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    // Fetch just the last day for current data
    await fetchDataForDays(1);
  }, [fetchDataForDays]);

  // Force a refresh by incrementing the counter
  const forceRefresh = useCallback(() => {
    console.log('🔄 Force refresh triggered');
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Auto-refresh functionality - TEMPORARILY DISABLED for debugging
  useEffect(() => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current !== null) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    // DISABLED: Auto-refresh is temporarily disabled to prevent issues
    // This will be re-enabled once the root cause is identified
    console.log('🚫 Auto-refresh is temporarily disabled for debugging');
    
    return () => {
      if (autoRefreshTimerRef.current !== null) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, []);

  // Force a refresh when the refresh counter changes
  useEffect(() => {
    if (refreshCounter > 0) {
      console.log(`🔄 Refresh counter changed to ${refreshCounter}, fetching data...`);
      fetchDataForDays(analysisPeriod); // Fetch based on analysis period setting for a forced refresh
    }
  }, [refreshCounter, fetchDataForDays]);

  const contextValue = useMemo(() => ({
    url,
    token,
    setUrl,
    setToken,
    data,
    loading,
    error,
    fetchDataForDays,
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
  }), [url, token, data, loading, error, lastFetchTime, 
       autoRefreshEnabled, autoRefreshInterval, 
       detectedApiVersion, analysisPeriod]);

  return (
    <NightscoutContext.Provider value={contextValue}>
      {children}
    </NightscoutContext.Provider>
  );
};