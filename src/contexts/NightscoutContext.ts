import { createContext, useContext } from 'react';
import type { NightscoutFetchResult } from '../types/nightscout';

export type NightscoutData = Omit<NightscoutFetchResult, 'detectedApiVersion'>;

export interface NightscoutContextType {
  url: string;
  token: string;
  setUrl: (url: string) => void;
  setToken: (token: string) => void;
  data: NightscoutData | null;
  loading: boolean;
  error: string | null;
  fetchDataForDays: (days: number) => Promise<void>;
  prefetchDataForDays: (days: number) => Promise<void>;
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

export const NightscoutContext = createContext<NightscoutContextType>({
  url: '',
  token: '',
  setUrl: () => {},
  setToken: () => {},
  data: null,
  loading: false,
  error: null,
  fetchDataForDays: async () => {},
  prefetchDataForDays: async () => {},
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

export default NightscoutContext;
