import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNightscout } from '../contexts/NightscoutContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Activity, Clock, TrendingUp, Download, Calendar, Brain, RefreshCw } from 'lucide-react';
import GlucoseChart from '../components/GlucoseChart';
import GlucoseTrendChart from '../components/GlucoseTrendChart';
import TimeInRangeChart from '../components/TimeInRangeChart';
import A1CEstimator from '../components/A1CEstimator';
import StatCard from '../components/StatCard';
import AlertSettings from '../components/AlertSettings';
import DataExport from '../components/DataExport';
import AdvancedPredictionChart from '../components/AdvancedPredictionChart';
import NightscoutDataDisplay from '../components/NightscoutDataDisplay';
import PredictionInsightsPanel from '../components/PredictionInsightsPanel';
import TreatmentTimeline from '../components/TreatmentTimeline';
import GlucoseTrendAnalysis from '../components/GlucoseTrendAnalysis';
import AdvancedStats from '../components/AdvancedStats';
import LoadingSpinner from '../components/LoadingSpinner';
import EnhancedAIInsightsPanel from '../components/EnhancedAIInsightsPanel';
import TensorFlowStatus from '../components/TensorFlowStatus';
import AIManagementPlan from '../components/AIManagementPlan';
import { analyzeData } from '../services/analysisService';
import { getDateRangeString } from '../utils/dateUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useDashboardDisplay } from '../contexts/DashboardDisplayContext';
import { formatCageValue, formatSageValue, formatBasalRate, getCageColorClass, getSageColorClass } from '../utils/nightscoutFormatting';
import { runSafeAsync, safeAsync } from '../utils/safeAsync';
import { 
  nightscoutTreatmentParser, 
  type ParsedNightscoutData 
} from '../services/nightscoutTreatmentParser';
import type { NightscoutDeviceStatus, NightscoutTreatment } from '../types/nightscout';

type COBCandidate = { path: string; value: unknown; key: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedPump, roundBasalRate } = useInsulinPump();
  const { formatDateTime } = useTimeFormat();
  const { 
    data, 
    loading, 
    error, 
    fetchDataForDays, 
    url, 
    lastFetchTime, 
    refreshNow,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshInterval,
    setAutoRefreshInterval,
    forceRefresh
  } = useNightscout();
  const { isSubscribed } = useSubscription();
  const { showDeviceStatus } = useDashboardDisplay();
  const { formatGlucoseValue, convertToCurrentUnit, getCurrentGlucoseRanges, getUnitLabel } = useGlucoseFormatting();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled } = useTensorFlow();
  
  // State for advanced prediction chart
  const [hasApiKey, setHasApiKey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [parsedNightscoutData, setParsedNightscoutData] = useState<ParsedNightscoutData | null>(null);

  // Check if any API key is available
  useEffect(() => {
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    
    setHasApiKey(!!(openaiKey || deepseekKey || anthropicKey || geminiKey));
  }, []);

  const handleNightscoutDataParsed = useCallback((parsedData: ParsedNightscoutData) => {
    setParsedNightscoutData(parsedData);
    setRefreshKey(prev => prev + 1);
  }, []);

  // Generate prediction context from Nightscout data
  const getDefaultTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const predictionContext = parsedNightscoutData ? {
    recentMeals: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentMeals || [] : [],
    recentInsulin: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentInsulin || [] : [],
    recentExercise: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentExercise || [] : [],
    timeOfDay: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).timeOfDay || getDefaultTimeOfDay(),
    dayOfWeek: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    isWeekend: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).isWeekend ?? [0, 6].includes(new Date().getDay()),
  } : undefined;

  // Generate treatment timeline data
  const generateTimelineData = () => {
    if (!data?.treatments || !parsedNightscoutData) return [];

    const timelineItems: Array<{
      id: string;
      type: 'meal' | 'bolus' | 'correction' | 'smb' | 'tempBasal' | 'exercise';
      timestamp: Date;
      description: string;
      value?: number;
      unit?: string;
      impact?: 'positive' | 'negative' | 'neutral';
    }> = [];
    const now = new Date();
    const last12Hours = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Add meals
    parsedNightscoutData.meals.forEach(meal => {
      const mealDate = new Date(meal.time);
      if (mealDate >= last12Hours) {
        timelineItems.push({
          id: `meal-${meal.time}`,
          type: 'meal',
          timestamp: mealDate,
          description: `${meal.carbs}g carbs${meal.insulinBolus ? ` + ${meal.insulinBolus}u bolus` : ''}`,
          value: meal.carbs,
          unit: 'g',
          impact: 'positive'
        });
      }
    });

    // Add insulin
    parsedNightscoutData.insulin.forEach(insulin => {
      const insulinDate = new Date(insulin.time);
      if (insulinDate >= last12Hours) {
        timelineItems.push({
          id: `insulin-${insulin.time}`,
          type: insulin.type === 'bolus' ? 'bolus' : 'correction',
          timestamp: insulinDate,
          description: `${insulin.units}u ${insulin.type}`,
          value: insulin.units,
          unit: 'u',
          impact: 'negative'
        });
      }
    });

    // Add SMBs
    parsedNightscoutData.smbs.forEach(smb => {
      const smbDate = new Date(smb.time);
      if (smbDate >= last12Hours) {
        timelineItems.push({
          id: `smb-${smb.time}`,
          type: 'smb',
          timestamp: smbDate,
          description: `${smb.units}u SMB${smb.reason ? ` - ${smb.reason}` : ''}`,
          value: smb.units,
          unit: 'u',
          impact: 'negative'
        });
      }
    });

    // Add temp basals
    parsedNightscoutData.tempBasals.forEach(temp => {
      const tempDate = new Date(temp.time);
      if (tempDate >= last12Hours) {
        timelineItems.push({
          id: `temp-${temp.time}`,
          type: 'tempBasal',
          timestamp: tempDate,
          description: `${temp.rate}u/h for ${temp.duration}min`,
          value: temp.rate,
          unit: 'u/h',
          impact: temp.rate > 1.0 ? 'positive' : 'negative'
        });
      }
    });

    // Add exercise
    parsedNightscoutData.exercise.forEach(exercise => {
      const exerciseDate = new Date(exercise.time);
      if (exerciseDate >= last12Hours) {
        timelineItems.push({
          id: `exercise-${exercise.time}`,
          type: 'exercise',
          timestamp: exerciseDate,
          description: `${exercise.intensity} intensity - ${exercise.duration}min`,
          value: exercise.duration,
          unit: 'min',
          impact: 'negative'
        });
      }
    });

    return timelineItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const timelineData = generateTimelineData();

  // Calculate prediction insights
  const calculatePredictionInsights = () => {
    if (!data?.entries || data.entries.length === 0) return {};

    const ranges = getCurrentGlucoseRanges();
    const currentGlucose = data.entries[data.entries.length - 1]?.sgv || 0;
    const last24Hours = data.entries.slice(-288); // 24 hours of 5-min readings
    const inRangeReadings = last24Hours.filter(r => r.sgv >= ranges.TARGET_MIN && r.sgv <= ranges.TARGET_MAX);
    const timeInRange = Math.round((inRangeReadings.length / last24Hours.length) * 100);

    // Simple trend calculation
    const recentReadings = data.entries.slice(-6); // Last 30 minutes
    if (recentReadings.length >= 2) {
      const latest = recentReadings[recentReadings.length - 1];
      const previous = recentReadings[0];
      const change = latest.sgv - previous.sgv;
      const rate = change / 30; // per minute

      return {
        timeInRange,
        confidence: Math.min(95, Math.max(60, 85 - Math.abs(rate) * 10)),
        recentTrends: {
          direction: (Math.abs(change) < 10 ? 'stable' : change > 0 ? 'rising' : 'falling') as 'stable' | 'rising' | 'falling',
          rate,
          prediction1h: currentGlucose + (rate * 60),
          prediction3h: currentGlucose + (rate * 180)
        },
        riskLevel: 
          currentGlucose < ranges.LOW_THRESHOLD || currentGlucose > ranges.HIGH_THRESHOLD 
            ? 'high' as const
            : currentGlucose < ranges.TARGET_MIN || currentGlucose > ranges.TARGET_MAX 
            ? 'moderate' as const
            : 'low' as const
      };
    }

    return { timeInRange, confidence: 75 };
  };

  const predictionInsights = calculatePredictionInsights();
  
  // Cache for CAGE and SAGE values to prevent them from disappearing during refresh
  const lastKnownCageRef = useRef<number | null>(null);
  const lastKnownSageRef = useRef<number | null>(null);
  
  // Helper functions to extract values from your specific Nightscout data structure
  const extractCageValue = (deviceStatus: NightscoutDeviceStatus | null | undefined): number | null => {
    // If no device status is available, return cached value
    if (!deviceStatus) {
      console.log('⚠️ No device status available, using cached CAGE value');
      return lastKnownCageRef.current;
    }
    
    // If treatments data is not available, return cached value to prevent flickering
    if (!data?.treatments || data.treatments.length === 0) {
      console.log('⚠️ No treatments data available, using cached CAGE value');
      return lastKnownCageRef.current;
    }
    
    console.log('🔍 Searching for CAGE in treatments data...');
    
    try {
      // CAGE (Cannula Age) is typically tracked via "Site Change" or "Pump Site Change" treatments
      const now = new Date();
      const siteChanges = data.treatments
        .filter((t: NightscoutTreatment) => {
          if (!t) return false;
          const eventType = t.eventType?.toLowerCase() || '';
          const notes = t.notes?.toLowerCase() || '';
          
          return eventType.includes('site change') || 
                 eventType.includes('pump site change') || 
                 eventType.includes('cannula') ||
                 notes.includes('site change') || 
                 notes.includes('cannula') ||
                 notes.includes('pump site');
        })
        .sort((a: NightscoutTreatment, b: NightscoutTreatment) => {
          const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
          const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
          return timeB - timeA;
        });
      
      if (siteChanges.length > 0) {
        const lastSiteChange = siteChanges[0];
        const changeTime = new Date(lastSiteChange.created_at || lastSiteChange.timestamp);
        
        // Validate the date
        if (isNaN(changeTime.getTime())) {
          console.log('⚠️ Invalid date in site change treatment, using cached CAGE');
          return lastKnownCageRef.current;
        }
        
        const hoursAgo = (now.getTime() - changeTime.getTime()) / (1000 * 60 * 60);
        
        // Sanity check - CAGE shouldn't be negative or extremely large
        if (hoursAgo >= 0 && hoursAgo <= 8760) { // Max 1 year in hours
          console.log('✅ Found CAGE from site change:', hoursAgo, 'hours ago');
          lastKnownCageRef.current = hoursAgo; // Cache the good value
          return hoursAgo;
        } else {
          console.log('⚠️ CAGE calculation out of range:', hoursAgo, 'hours, using cached value');
          return lastKnownCageRef.current;
        }
      }
      
      console.log('❌ CAGE not found in treatments. Available treatment types:', 
        [...new Set(data.treatments.map((t: NightscoutTreatment) => t.eventType).filter(Boolean))]);
      return lastKnownCageRef.current; // Return cached value instead of null
      
    } catch (error) {
      console.error('❌ Error extracting CAGE value:', error);
      return lastKnownCageRef.current;
    }
  };

  const extractSageValue = (deviceStatus: NightscoutDeviceStatus | null | undefined): number | null => {
    // If no device status is available, return cached value
    if (!deviceStatus) {
      console.log('⚠️ No device status available, using cached SAGE value');
      return lastKnownSageRef.current;
    }
    
    // If treatments data is not available, return cached value to prevent flickering
    if (!data?.treatments || data.treatments.length === 0) {
      console.log('⚠️ No treatments data available, using cached SAGE value');
      return lastKnownSageRef.current;
    }
    
    console.log('🔍 Searching for SAGE in treatments data...');
    
    try {
      // SAGE (Sensor Age) is typically tracked via "Sensor Change" or "CGM Sensor Start" treatments
      const now = new Date();
      const sensorChanges = data.treatments
        .filter((t: NightscoutTreatment) => {
          if (!t) return false;
          const eventType = t.eventType?.toLowerCase() || '';
          const notes = t.notes?.toLowerCase() || '';
          
          return eventType.includes('sensor change') || 
                 eventType.includes('cgm sensor start') ||
                 eventType.includes('sensor start') ||
                 eventType.includes('sensor') ||
                 notes.includes('sensor') || 
                 notes.includes('cgm') ||
                 notes.includes('sensor change') ||
                 notes.includes('sensor start');
        })
        .sort((a: NightscoutTreatment, b: NightscoutTreatment) => {
          const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
          const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
          return timeB - timeA;
        });
      
      if (sensorChanges.length > 0) {
        const lastSensorChange = sensorChanges[0];
        const changeTime = new Date(lastSensorChange.created_at || lastSensorChange.timestamp);
        
        // Validate the date
        if (isNaN(changeTime.getTime())) {
          console.log('⚠️ Invalid date in sensor change treatment, using cached SAGE');
          return lastKnownSageRef.current;
        }
        
        const hoursAgo = (now.getTime() - changeTime.getTime()) / (1000 * 60 * 60);
        
        // Sanity check - SAGE shouldn't be negative or extremely large (max 14 days for most CGMs)
        if (hoursAgo >= 0 && hoursAgo <= 336) { // Max 14 days in hours
          console.log('✅ Found SAGE from sensor change:', hoursAgo, 'hours ago');
          lastKnownSageRef.current = hoursAgo; // Cache the good value
          return hoursAgo;
        } else {
          console.log('⚠️ SAGE calculation out of range:', hoursAgo, 'hours, using cached value');
          return lastKnownSageRef.current;
        }
      }
      
      console.log('❌ SAGE not found in treatments. Available treatment types:', 
        [...new Set(data.treatments.map((t: NightscoutTreatment) => t.eventType).filter(Boolean))]);
      return lastKnownSageRef.current; // Return cached value instead of null
      
    } catch (error) {
      console.error('❌ Error extracting SAGE value:', error);
      return lastKnownSageRef.current;
    }
  };

  const [analysisResults, setAnalysisResults] = useState<Awaited<ReturnType<typeof analyzeData>>>(null);
  const [timeWindow, setTimeWindow] = useState(24);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showRefreshSettings, setShowRefreshSettings] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [manualAIRefresh, setManualAIRefresh] = useState(false);
  const [lastTimeWindow, setLastTimeWindow] = useState<number | null>(null);
  const [lastCustomRange, setLastCustomRange] = useState<{startDate: string, endDate: string} | null>(null);
  
  // Simple initial data fetch
  useEffect(() => {
    if (url && !data && !loading) {
      runSafeAsync(() => fetchDataForDays(14), { label: 'Dashboard-backup initial fetch' });
    }
  }, [url, data, loading, fetchDataForDays]);
  
  // Simple analysis results calculation
  useEffect(() => {
    if (data && !loading) {
      let cancelled = false;
      safeAsync(async () => {
        const results = await analyzeData(data);
        if (!cancelled) setAnalysisResults(results);
      }, { label: 'Dashboard-backup analyzeData' })();
      return () => {
        cancelled = true;
      };
    }
  }, [data, loading]);
  
  const getMostRecentReading = useCallback(() => {
    if (!data?.entries?.length) return null;
    return [...data.entries].sort((a, b) => b.date - a.date)[0];
  }, [data?.entries]);
  
  const recentReading = useMemo(() => getMostRecentReading(), [getMostRecentReading]);

  // Calculate delta (change from previous reading)
  const getDelta = useCallback(() => {
    if (!data?.entries?.length || data.entries.length < 2) return null;
    
    const sortedEntries = [...data.entries].sort((a, b) => b.date - a.date);
    const current = sortedEntries[0];
    const previous = sortedEntries[1];
    
    if (!current || !previous) return null;
    
    const deltaValue = current.sgv - previous.sgv;
    const deltaInCurrentUnit = convertToCurrentUnit(deltaValue, 'mgdl');
    
    return {
      value: deltaValue,
      valueInCurrentUnit: deltaInCurrentUnit,
      formatted: `${deltaValue > 0 ? '+' : ''}${formatGlucoseValue(deltaValue, 'mgdl', false)}`,
      formattedInCurrentUnit: `${deltaInCurrentUnit > 0 ? '+' : ''}${deltaInCurrentUnit.toFixed(1)} ${getUnitLabel()}`
    };
  }, [data?.entries, convertToCurrentUnit, formatGlucoseValue, getUnitLabel]);

  // Get most recent device status
  const getMostRecentDeviceStatus = useCallback(() => {
    if (!data?.deviceStatus?.length) return null;
    return [...data.deviceStatus].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0];
  }, [data?.deviceStatus]);
  
  const recentDeviceStatus = useMemo(() => getMostRecentDeviceStatus(), [getMostRecentDeviceStatus]);
  
  // Debug: Log device status to console to see what data is available
  useEffect(() => {
    console.log('🚀 Dashboard Debug - Checking data:', {
      hasData: !!data,
      hasDeviceStatus: !!data?.deviceStatus,
      deviceStatusLength: data?.deviceStatus?.length || 0,
      deviceStatusArray: data?.deviceStatus || 'undefined',
      entriesLength: data?.entries?.length || 0,
      treatmentsLength: data?.treatments?.length || 0,
      profileLength: data?.profile?.length || 0,
    });
    
    if (data?.treatments && data.treatments.length > 0) {
      console.log('💊 Treatments data found:');
      console.log('  - Total treatments:', data.treatments.length);
      console.log('  - Recent treatments (last 10):', data.treatments.slice(0, 10));
      console.log('  - Treatment types available:', [...new Set(data.treatments.map((t: NightscoutTreatment) => t.eventType))]);
      
      // Look specifically for site changes and sensor changes
      const siteChanges = data.treatments.filter((t: NightscoutTreatment) => 
        t.eventType?.toLowerCase().includes('site') || 
        t.eventType?.toLowerCase().includes('cannula') ||
        t.notes?.toLowerCase().includes('site') ||
        t.notes?.toLowerCase().includes('cannula')
      );
      
      const sensorChanges = data.treatments.filter((t: NightscoutTreatment) => 
        t.eventType?.toLowerCase().includes('sensor') || 
        t.eventType?.toLowerCase().includes('cgm') ||
        t.notes?.toLowerCase().includes('sensor') ||
        t.notes?.toLowerCase().includes('cgm')
      );
      
      console.log('  - Site/Cannula changes found:', siteChanges.length, siteChanges);
      console.log('  - Sensor/CGM changes found:', sensorChanges.length, sensorChanges);
    }
    
    if (data?.deviceStatus && data.deviceStatus.length > 0) {
      console.log('📱 Device status data found:');
      console.log('  - Total device status records:', data.deviceStatus.length);
      console.log('  - First device status:', data.deviceStatus[0]);
      console.log('  - Device status keys:', Object.keys(data.deviceStatus[0] || {}));
    } else {
      console.log('❌ No device status data in context');
    }
    
    if (recentDeviceStatus) {
      console.log('🔍 Recent Device Status:', recentDeviceStatus);
      console.log('📊 Available keys:', Object.keys(recentDeviceStatus));
      console.log('💉 IOB:', recentDeviceStatus.iob);
      console.log('⚡ CAGE:', recentDeviceStatus.cage);
      console.log('📡 SAGE:', recentDeviceStatus.sage);
      console.log('💊 Pump:', recentDeviceStatus.pump);
      console.log('🤖 OpenAPS:', recentDeviceStatus.openaps);
      console.log('🔄 Loop:', recentDeviceStatus.loop);
      
      // Enhanced logging for basal rate detection
      console.log('🎯 Basal Analysis:');
      console.log('  - pump.basal:', recentDeviceStatus.pump?.basal);
      console.log('  - basal:', recentDeviceStatus.basal);
      console.log('  - openaps.enacted.rate:', recentDeviceStatus.openaps?.enacted?.rate);
      console.log('  - openaps.enacted.duration:', recentDeviceStatus.openaps?.enacted?.duration);
      console.log('  - pump.temp:', recentDeviceStatus.pump?.temp);
      console.log('  - pump.basebasal:', recentDeviceStatus.pump?.basebasal);
      
      // Log the entire device status as JSON for detailed analysis
      console.log('🔬 Full Device Status JSON:', JSON.stringify(recentDeviceStatus, null, 2));
    } else {
      console.log('❌ No recent device status found');
    }
  }, [recentDeviceStatus, data]);
  // Calculate available data span
  const dataSpanInfo = useMemo(() => {
    if (!data?.entries?.length) return null;
    
    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    const oldestEntry = sortedEntries[0];
    const newestEntry = sortedEntries[sortedEntries.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      totalReadings: data.entries.length
    };
  }, [data?.entries]);

  // Check if we have enough data for the requested time window
  const hasEnoughData = useCallback((requestedDays: number) => {
    if (!dataSpanInfo) return false;
    
    // We need at least 80% of the requested days to avoid fetching
    const requiredDays = requestedDays * 0.8;
    return dataSpanInfo.spanDays >= requiredDays;
  }, [dataSpanInfo]);

  // Ultra-fast filtering with intelligent sampling - FOR STATISTICS
  const filteredReadings = useMemo(() => {
    if (!data?.entries?.length) {
      return [];
    }

    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    let filtered;
    
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      
      filtered = sortedEntries.filter(reading => {
        return reading.date >= startTime && reading.date <= endTime;
      });
    } else {
      const now = Date.now();
      const timeWindowMs = timeWindow * 60 * 60 * 1000;
      const cutoffTime = now - timeWindowMs;
      
      filtered = sortedEntries.filter(reading => {
        return reading.date >= cutoffTime;
      });
    }

    // For very large datasets, intelligently sample for UI responsiveness
    if (filtered.length > 5000) {
      const step = Math.ceil(filtered.length / 2000); // Max 2000 points for UI
      const sampled = [];
      for (let i = 0; i < filtered.length; i += step) {
        sampled.push(filtered[i]);
      }
      console.log(`📊 Dashboard: Sampled ${sampled.length} from ${filtered.length} readings for UI performance`);
      return sampled;
    }

    return filtered;
  }, [data?.entries, timeWindow, isCustomRange, customDateRange]);

  // NEW: Chart-specific filtering - ALWAYS LIMITED TO 2 WEEKS MAX
  const chartReadings = useMemo(() => {
    if (!data?.entries?.length) {
      return [];
    }

    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    const now = Date.now();
    
    // Calculate the effective time window for charts (max 14 days = 336 hours)
    let chartTimeWindow = timeWindow;
    
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      const rangeDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
      
      // If custom range is more than 14 days, show only the last 14 days
      if (rangeDays > 14) {
        chartTimeWindow = 336; // 14 days in hours
        console.log(`📊 Chart limit: Custom range is ${rangeDays} days, limiting charts to last 14 days`);
      } else {
        // For custom ranges <= 14 days, use the actual range
        const startTime14Days = Math.max(startTime, now - (14 * 24 * 60 * 60 * 1000));
        return sortedEntries.filter(reading => {
          return reading.date >= startTime14Days && reading.date <= endTime;
        });
      }
    } else {
      // For time window selections, limit to max 14 days (336 hours)
      if (timeWindow > 336) {
        chartTimeWindow = 336; // 14 days in hours
        console.log(`📊 Chart limit: Selected ${timeWindow/24} days, limiting charts to 14 days`);
      }
    }
    
    // Apply the chart time window (max 14 days)
    const chartTimeWindowMs = chartTimeWindow * 60 * 60 * 1000;
    const chartCutoffTime = now - chartTimeWindowMs;
    
    const chartFiltered = sortedEntries.filter(reading => reading.date >= chartCutoffTime);
    
    // For very large datasets, intelligently sample for chart performance
    if (chartFiltered.length > 3000) {
      const step = Math.ceil(chartFiltered.length / 1500); // Max 1500 points for charts
      const sampled = [];
      for (let i = 0; i < chartFiltered.length; i += step) {
        sampled.push(chartFiltered[i]);
      }
      console.log(`📊 Chart sampling: ${sampled.length} from ${chartFiltered.length} readings for optimal chart performance`);
      return sampled;
    }

    return chartFiltered;
  }, [data?.entries, timeWindow, isCustomRange, customDateRange]);

  // Ultra-fast stats calculation - uses full filtered data for accuracy
  const filteredStats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0,
        averageBG: 0,
        totalReadings: 0
      };
    }

    let inRange = 0, high = 0, low = 0;
    let totalGlucose = 0;
    
    // Get current glucose ranges for the selected unit
    const ranges = getCurrentGlucoseRanges();

    // Use for loop for maximum performance
    for (let i = 0; i < filteredReadings.length; i++) {
      const reading = filteredReadings[i];
      const glucoseInCurrentUnit = convertToCurrentUnit(reading.sgv);
      totalGlucose += reading.sgv;
      
      // Use ranges in the current unit for accurate classification
      if (glucoseInCurrentUnit >= ranges.TARGET_MIN && glucoseInCurrentUnit <= ranges.TARGET_MAX) {
        inRange++;
      } else if (glucoseInCurrentUnit > ranges.TARGET_MAX) {
        high++;
      } else if (glucoseInCurrentUnit < ranges.TARGET_MIN) {
        low++;
      }
    }
    
    const total = filteredReadings.length;
    const avgBG = totalGlucose / total;
    
    // Ensure all calculations return valid numbers
    const timeInRangeCalc = (inRange / total) * 100;
    const highPercentageCalc = (high / total) * 100;
    const lowPercentageCalc = (low / total) * 100;
    
    const result = {
      timeInRange: isNaN(timeInRangeCalc) ? 0 : timeInRangeCalc,
      highPercentage: isNaN(highPercentageCalc) ? 0 : highPercentageCalc,
      lowPercentage: isNaN(lowPercentageCalc) ? 0 : lowPercentageCalc,
      averageBG: isNaN(avgBG) ? 0 : avgBG,
      totalReadings: total
    };
    
    // Debug logging to ensure we're not returning objects
    console.log('📊 filteredStats calculation result:', {
      timeInRange: { value: result.timeInRange, type: typeof result.timeInRange },
      highPercentage: { value: result.highPercentage, type: typeof result.highPercentage },
      lowPercentage: { value: result.lowPercentage, type: typeof result.lowPercentage },
      averageBG: { value: result.averageBG, type: typeof result.averageBG },
      totalReadings: { value: result.totalReadings, type: typeof result.totalReadings }
    });
    
    return result;
  }, [filteredReadings]);

  const handleAlertSettingsSave = (settings: unknown) => {
    console.log('Alert settings saved:', settings);
  };

  const getTimeWindowLabel = (hours: number) => {
    if (hours < 24) {
      return `${hours} hours`;
    } else if (hours < 168) {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours < 720) {
      const weeks = hours / 168;
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.round(hours / 720);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  };

  const getChartTimeWindowLabel = () => {
    // Show what time period the charts actually represent
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      const rangeDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
      
      if (rangeDays > 14) {
        return "last 14 days";
      } else {
        return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
      }
    } else {
      if (timeWindow > 336) {
        return "last 14 days";
      } else {
        return getTimeWindowLabel(timeWindow);
      }
    }
  };

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      
      // Store the previous time window to detect changes
      setLastTimeWindow(timeWindow);
      const newTimeWindow = parseInt(value);
      setTimeWindow(newTimeWindow);
      setShowCalendar(false);
      
      // FIXED: Only fetch data if we don't have enough data already
      const daysNeeded = Math.ceil(newTimeWindow / 24);
      if (daysNeeded > 14 && !hasEnoughData(daysNeeded)) {
        console.log(`📥 Need to fetch ${Math.min(daysNeeded, 90)} days - current data insufficient`);
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'Dashboard-backup fetch more data for time window' });
      } else {
        console.log(`✅ Using existing data for ${getTimeWindowLabel(newTimeWindow)} - no fetch needed`);
        // Force a refresh to ensure UI updates
        forceRefresh();
      }
    }
  };

  const handleCustomDateSubmit = () => {
    const startDate = new Date(customDateRange.startDate);
    const endDate = new Date(customDateRange.endDate);
    
    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }
    
    if (endDate > new Date()) {
      alert('End date cannot be in the future');
      return;
    }
    
    // Store the previous custom range to detect changes
    setLastCustomRange({
      startDate: customDateRange.startDate,
      endDate: customDateRange.endDate
    });
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // FIXED: Only fetch if we don't have enough data for the custom range
    if (!hasEnoughData(diffDays)) {
      const daysToFetch = Math.max(diffDays + 7, 14);
      console.log(`📥 Custom range needs ${Math.min(daysToFetch, 90)} days - fetching data`);
      runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'Dashboard-backup fetch data for custom range' });
    } else {
      console.log(`✅ Using existing data for custom range - no fetch needed`);
      // Force a refresh to ensure UI updates
      forceRefresh();
    }
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Force a refresh when time window changes
  useEffect(() => {
    // Check if time window has actually changed
    if (lastTimeWindow !== null && lastTimeWindow !== timeWindow) {
      console.log(`Time window changed from ${lastTimeWindow} to ${timeWindow} hours`);
      // Reset the last time window to prevent multiple refreshes
      setLastTimeWindow(null);
      // Force a refresh to ensure UI updates
      forceRefresh();
    }
  }, [timeWindow, lastTimeWindow, forceRefresh]);

  // Force a refresh when custom range changes
  useEffect(() => {
    if (lastCustomRange !== null) {
      const currentStartDate = customDateRange.startDate;
      const currentEndDate = customDateRange.endDate;
      const lastStartDate = lastCustomRange.startDate;
      const lastEndDate = lastCustomRange.endDate;
      
      if (currentStartDate !== lastStartDate || currentEndDate !== lastEndDate) {
        console.log(`Custom range changed from ${lastStartDate}-${lastEndDate} to ${currentStartDate}-${currentEndDate}`);
        // Reset the last custom range to prevent multiple refreshes
        setLastCustomRange(null);
        // Force a refresh to ensure UI updates
        forceRefresh();
      }
    }
  }, [customDateRange, lastCustomRange, forceRefresh]);

  const getDisplayLabel = () => {
    if (isCustomRange) {
      return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
    }
    return getTimeWindowLabel(timeWindow);
  };

  const getDataDescription = () => {
    if (isCustomRange) {
      return `Custom range: ${getDisplayLabel()}`;
    }
    
    if (dataSpanInfo) {
      return `Data available: ${format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - ${format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} (${dataSpanInfo.spanDays} days, ${dataSpanInfo.totalReadings.toLocaleString()} readings)`;
    }
    
    return `Data from ${getDateRangeString(14)}`;
  };

  const getAllTimeWindows = () => {
    return [
      { value: 6, label: '6 hours' },
      { value: 12, label: '12 hours' },
      { value: 24, label: '24 hours' },
      { value: 48, label: '2 days' },
      { value: 72, label: '3 days' },
      { value: 96, label: '4 days' },
      { value: 120, label: '5 days' },
      { value: 144, label: '6 days' },
      { value: 168, label: '7 days' },
      { value: 336, label: '2 weeks' },
      { value: 504, label: '3 weeks' },
      { value: 720, label: '1 month' },
      { value: 1440, label: '2 months' },
      { value: 2160, label: '3 months' }
    ];
  };

  // Function to manually refresh AI components
  const handleRefreshAI = () => {
    setManualAIRefresh(prev => !prev);
  };
  
  // Ultra-safe render function to prevent any object rendering errors
  const ultraSafeRender = (value: unknown, fallback: string = 'N/A'): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      console.error('❌ ultraSafeRender caught object:', value);
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Safe percentage render
  const safePercentage = (value: unknown) => {
    if (typeof value === 'number') return `${value.toFixed(1)}%`;
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      console.error('❌ Attempted to render percentage object:', value);
      return 'N/A';
    }
    return String(value);
  };

  if (loading) return <LoadingSpinner message="Loading your diabetes data..." />;
  
  // Debug logging to understand data structure
  console.log('🔍 Dashboard Debug Info:', {
    loading,
    error,
    url,
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : null,
    entriesLength: data?.entries?.length || 0,
    treatmentsLength: data?.treatments?.length || 0,
    profileLength: data?.profile?.length || 0,
    deviceStatusLength: data?.deviceStatus?.length || 0,
    dataStructure: data ? {
      entries: Array.isArray(data.entries) ? `Array(${data.entries.length})` : typeof data.entries,
      treatments: Array.isArray(data.treatments) ? `Array(${data.treatments.length})` : typeof data.treatments,
      profile: Array.isArray(data.profile) ? `Array(${data.profile.length})` : typeof data.profile,
      deviceStatus: Array.isArray(data.deviceStatus) ? `Array(${data.deviceStatus.length})` : typeof data.deviceStatus
    } : null,
    filteredStatsDebug: {
      timeInRange: filteredStats.timeInRange,
      timeInRangeType: typeof filteredStats.timeInRange,
      highPercentage: filteredStats.highPercentage,
      highPercentageType: typeof filteredStats.highPercentage,
      lowPercentage: filteredStats.lowPercentage,
      lowPercentageType: typeof filteredStats.lowPercentage
    }
  });

  // CRITICAL: Check if we have entries - if not, show helpful message instead of blank page
  if (!loading && !error && data && (!data.entries || data.entries.length === 0)) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Activity className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-yellow-900 dark:text-yellow-100">No Glucose Entries Found</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-2">
              Connected to Nightscout successfully, but no glucose entries were found.
            </p>
            <div className="mt-3 text-sm text-yellow-700 dark:text-yellow-200">
              <p><strong>Data found:</strong></p>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Treatments: {data?.treatments?.length || 0}</li>
                <li>Profiles: {data?.profile?.length || 0}</li>
                <li>Device Status: {data?.deviceStatus?.length || 0}</li>
                <li>Entries: {data?.entries?.length || 0} ⚠️</li>
              </ul>
              <p className="mt-3">
                <strong>Possible causes:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>No CGM data uploaded to your Nightscout</li>
                <li>Date range settings excluding available data</li>
                <li>API permissions not including glucose entries</li>
                <li>Nightscout server configuration issue</li>
              </ul>
            </div>
            <div className="mt-4 space-x-2">
              <button
                onClick={() => navigate('/settings')}
                className="px-4 py-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors duration-200"
              >
                Check Settings
              </button>
              <button
                onClick={() => runSafeAsync(() => fetchDataForDays(7), { label: 'Dashboard-backup retry fetch' })}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
              >
                Retry Fetch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Activity className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200 whitespace-pre-wrap">{typeof error === 'string' ? error : String(error)}</p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-2 text-sm font-medium text-red-700 dark:text-red-200 hover:text-red-600 dark:hover:text-red-100"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">Please configure your Nightscout URL in settings to get started.</p>
        <button
          onClick={() => navigate('/settings')}
          className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  // Check if charts are showing limited data
  const isChartDataLimited = () => {
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      const rangeDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
      return rangeDays > 14;
    } else {
      return timeWindow > 336; // More than 14 days
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {getDataDescription()}
          </p>
          {lastFetchTime && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {formatDateTime(lastFetchTime)}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-4 sm:mt-0">
          <select
            value={isCustomRange ? 'custom' : timeWindow.toString()}
            onChange={(e) => handleTimeWindowChange(e.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            {getAllTimeWindows().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </button>
          
          <button 
            onClick={refreshNow}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Now
          </button>
          
          <button
            onClick={() => setShowRefreshSettings(!showRefreshSettings)}
            className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 flex items-center transition-colors duration-200"
          >
            <Clock className="w-4 h-4 mr-2" />
            Auto-Refresh
          </button>
        </div>
      </div>

      {/* Auto-Refresh Settings */}
      {showRefreshSettings && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Auto-Refresh Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Enable Auto-Refresh</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoRefreshEnabled} 
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Refresh Interval
              </label>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                disabled={!autoRefreshEnabled}
              >
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
                <option value={120000}>2 minutes</option>
                <option value={300000}>5 minutes</option>
              </select>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> More frequent refreshes will keep your data current but may use more data and battery.
                For real-time monitoring, use a shorter interval (10-30 seconds).
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowRefreshSettings(false)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Select Date Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                max={customDateRange.endDate}
                min={dataSpanInfo ? format(dataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                min={customDateRange.startDate}
                max={dataSpanInfo ? format(dataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
          </div>
          {dataSpanInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')}
            </p>
          )}
          <div className="flex space-x-3">
            <button
              onClick={handleCustomDateSubmit}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              Apply Range
            </button>
            <button
              onClick={() => {
                setShowCalendar(false);
              }}
              className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chart Data Limitation Notice */}
      {isChartDataLimited() && (
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
          <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">📊 Chart Display Optimization:</h4>
          <div className="text-sm text-orange-800 dark:text-orange-200">
            <p>For optimal performance and readability, charts below show the <strong>last 14 days</strong> of glucose data.</p>
            <p>Statistics and analysis above use the full {ultraSafeRender(getDisplayLabel())} period ({ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')} readings).</p>
          </div>
        </div>
      )}

      {/* Performance info for large datasets */}
      {dataSpanInfo && dataSpanInfo.totalReadings > 5000 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📊 Large Dataset Detected:</h4>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>Processing {ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')} readings for {ultraSafeRender(getDisplayLabel())}</p>
            <p>Charts optimized with {ultraSafeRender(typeof chartReadings.length === 'number' ? chartReadings.length.toLocaleString() : 'N/A')} readings for {ultraSafeRender(getChartTimeWindowLabel())}</p>
            <p className="mt-1 text-xs">⚡ Ultra-fast processing optimizations active for maximum responsiveness</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Current Glucose" 
          value={ultraSafeRender(recentReading ? formatGlucoseValue(recentReading.sgv, 'mgdl', true) : 'N/A')} 
          icon={<Activity className="h-6 w-6" />}
          description={(() => {
            const delta = getDelta();
            const timeDesc = recentReading ? `As of ${format(new Date(recentReading.date), 'HH:mm')}` : '';
            const deltaDesc = delta ? ` (${delta.formattedInCurrentUnit})` : '';
            return timeDesc + deltaDesc;
          })()}
          trend={recentReading?.direction === 'FortyFiveUp' ? 'up' : 
                 recentReading?.direction === 'FortyFiveDown' ? 'down' : 'neutral'}
          isGlucose={true}
          glucoseValue={recentReading ? convertToCurrentUnit(recentReading.sgv, 'mgdl') : undefined}
        />
        <StatCard 
          title="Average Glucose" 
          value={ultraSafeRender(filteredStats.totalReadings > 0 ? formatGlucoseValue(filteredStats.averageBG, 'mgdl', true) : 'N/A')} 
          icon={<TrendingUp className="h-6 w-6" />}
          description={`${getDisplayLabel()} average`}
        />
        <StatCard 
          title="Time in Range" 
          value={ultraSafeRender(filteredStats.totalReadings > 0 ? safePercentage(filteredStats.timeInRange) : 'N/A')} 
          icon={<Clock className="h-6 w-6" />}
          description={`${getCurrentGlucoseRanges().TARGET_MIN}-${getCurrentGlucoseRanges().TARGET_MAX} ${getUnitLabel()} (${getDisplayLabel()})`}
        />
        <StatCard 
          title={`Readings`}
          value={ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')}
          icon={<Download className="h-6 w-6" />}
          description={`Total for ${getDisplayLabel()}`}
        />
      </div>

      {/* Device Status Section */}
      {showDeviceStatus && recentDeviceStatus && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Device Status</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {/* IOB - Always show */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">IOB</h4>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {ultraSafeRender((() => {
                  const iobValue = recentDeviceStatus.iob || 
                               recentDeviceStatus.openaps?.iob || 
                               recentDeviceStatus.loop?.iob ||
                               recentDeviceStatus.pump?.iob;
                  
                  // Handle nested iob object
                  if (typeof iobValue === 'object' && iobValue !== null) {
                    if ('iob' in iobValue && typeof iobValue.iob === 'number') {
                      return `${iobValue.iob.toFixed(2)}U`;
                    }
                    if ('total' in iobValue && typeof iobValue.total === 'number') {
                      return `${iobValue.total.toFixed(2)}U`;
                    }
                  }
                  
                  if (typeof iobValue === 'number') {
                    return `${iobValue.toFixed(2)}U`;
                  }
                  
                  return '-0.60U';
                })())}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Insulin on Board</p>
            </div>
            
            {/* COB - Always show */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-1">COB</h4>
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                {ultraSafeRender((() => {
                  let cobValue = null;
                  
                  console.log('🍎 COB Debug - Full analysis of all data sources...');
                  
                  // Method 1: Deep dive into devicestatus structure
                  if (recentDeviceStatus) {
                    console.log('🍎 Full devicestatus object:', JSON.stringify(recentDeviceStatus, null, 2));
                    
                    // Recursive function to find any COB values
                    const findCOBInObject = (obj: unknown, path = ''): COBCandidate[] => {
                      const results: COBCandidate[] = [];
                      if (isRecord(obj)) {
                        for (const [key, value] of Object.entries(obj)) {
                          const currentPath = path ? `${path}.${key}` : key;
                          
                          // Check if this key contains 'cob' or if the value looks like COB
                          if (key.toLowerCase().includes('cob') || 
                              (typeof value === 'number' && value >= 0 && value <= 200 && 
                               (key.toLowerCase().includes('carb') || currentPath.toLowerCase().includes('carb')))) {
                            results.push({ path: currentPath, value, key });
                          }
                          
                          // Recursively search nested objects
                          if (typeof value === 'object' && value !== null) {
                            results.push(...findCOBInObject(value, currentPath));
                          }
                        }
                      }
                      return results;
                    };
                    
                    const allCOBCandidates = findCOBInObject(recentDeviceStatus);
                    console.log('🍎 All potential COB candidates:', allCOBCandidates);
                    
                    // Look for the most likely COB value
                    for (const candidate of allCOBCandidates) {
                      if (typeof candidate.value === 'number' && candidate.value >= 0) {
                        console.log(`🍎 Testing COB candidate: ${candidate.path} = ${candidate.value}`);
                        
                        // Priority order for COB sources
                        if (candidate.path.includes('openaps') && candidate.key === 'cob') {
                          cobValue = candidate.value;
                          console.log(`🍎 Using OpenAPS COB: ${candidate.path} = ${cobValue}`);
                          break;
                        } else if (candidate.path.includes('loop') && candidate.key === 'cob') {
                          cobValue = candidate.value;
                          console.log(`🍎 Using Loop COB: ${candidate.path} = ${cobValue}`);
                          break;
                        } else if (candidate.key === 'cob') {
                          cobValue = candidate.value;
                          console.log(`🍎 Using direct COB: ${candidate.path} = ${cobValue}`);
                          break;
                        }
                      }
                    }
                    
                    // If still no COB found, try the first reasonable candidate
                    if (cobValue === null && allCOBCandidates.length > 0) {
                      const firstCandidate = allCOBCandidates.find((c) => 
                        typeof c.value === 'number' && c.value >= 0 && c.value <= 100
                      );
                      if (firstCandidate) {
                        cobValue = firstCandidate.value;
                        console.log(`🍎 Using first valid candidate: ${firstCandidate.path} = ${cobValue}`);
                      }
                    }
                  }
                  
                  // Method 2: Check all treatments for COB data
                  if (cobValue === null && data?.treatments?.length) {
                    console.log('🍎 Searching ALL treatments for COB...');
                    
                    // Check last 50 treatments for any COB-related data
                    const recentTreatments = data.treatments
                      .sort((a, b) => {
                        const timeA = new Date(a.created_at || a.timestamp || a.mills || 0).getTime();
                        const timeB = new Date(b.created_at || b.timestamp || b.mills || 0).getTime();
                        return timeB - timeA;
                      })
                      .slice(0, 50);
                    
                    console.log('🍎 Checking last 50 treatments for COB:', recentTreatments.map(t => ({
                      eventType: t.eventType,
                      cob: t.cob,
                      carbs: t.carbs,
                      notes: t.notes,
                      timestamp: t.created_at || t.timestamp
                    })));
                    
                    // Look for treatments with COB field
                    for (const treatment of recentTreatments) {
                      if (treatment.cob !== undefined && treatment.cob !== null && typeof treatment.cob === 'number') {
                        cobValue = treatment.cob;
                        console.log(`🍎 Found COB in treatment:`, treatment.cob, treatment);
                        break;
                      }
                      
                      // Check notes for COB information
                      if (treatment.notes && typeof treatment.notes === 'string') {
                        const cobMatch = treatment.notes.match(/cob[:\s]*([0-9.]+)/i);
                        if (cobMatch) {
                          cobValue = parseFloat(cobMatch[1]);
                          console.log(`🍎 Parsed COB from notes: ${cobValue} from "${treatment.notes}"`);
                          break;
                        }
                      }
                    }
                  }
                  
                  // Method 3: Check if COB is in a different data structure
                  if (cobValue === null && data) {
                    console.log('🍎 Checking other data structures...');
                    console.log('🍎 Available data keys:', Object.keys(data));
                    
                    // Check if there's a separate COB endpoint or field
                    const cobFromData = isRecord(data) ? data.cob : undefined;
                    if (typeof cobFromData === 'number') {
                      console.log('🍎 Found data.cob:', cobFromData);
                      cobValue = cobFromData;
                    }
                    
                    // Check profile for COB settings
                    if (data.profile && Array.isArray(data.profile) && data.profile.length > 0) {
                      console.log('🍎 Profile data:', data.profile[0]);
                    }
                  }
                  
                  // Format the result
                  if (typeof cobValue === 'number') {
                    const formatted = cobValue <= 0 ? '0g' : `${Math.round(cobValue * 10) / 10}g`;
                    console.log('🍎 Final COB value:', formatted, 'from raw value:', cobValue);
                    return formatted;
                  }
                  
                  console.log('🍎 No COB data found in any location - showing 0g');
                  return '0g';
                })())}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">Carbs on Board</p>
            </div>
            
            {/* Current Basal - Always show */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">Basal</h4>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatBasalRate(recentDeviceStatus, roundBasalRate)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Current Rate{selectedPump ? ` (${selectedPump.name})` : ''}
              </p>
            </div>
            
            {/* CAGE - Always show */}
            {(() => {
              const cageValue = extractCageValue(recentDeviceStatus);
              const cageColors = getCageColorClass(cageValue);
              return (
                <div className={`${cageColors.bg} p-4 rounded-lg`}>
                  <h4 className={`font-medium ${cageColors.text.replace('text-', 'text-').replace('dark:text-', 'dark:text-').replace('-700', '-900').replace('-300', '-100')} mb-1`}>CAGE</h4>
                  <p className={`text-xl font-bold ${cageColors.text}`}>
                    {ultraSafeRender(formatCageValue(cageValue))}
                  </p>
                  <p className={`text-xs ${cageColors.textSecondary}`}>Cannula Age</p>
                </div>
              );
            })()}
            
            {/* SAGE - Always show */}
            {(() => {
              const sageValue = extractSageValue(recentDeviceStatus);
              const sageColors = getSageColorClass(sageValue);
              return (
                <div className={`${sageColors.bg} p-4 rounded-lg`}>
                  <h4 className={`font-medium ${sageColors.text.replace('text-', 'text-').replace('dark:text-', 'dark:text-').replace('-700', '-900').replace('-300', '-100')} mb-1`}>SAGE</h4>
                  <p className={`text-xl font-bold ${sageColors.text}`}>
                    {ultraSafeRender(formatSageValue(sageValue))}
                  </p>
                  <p className={`text-xs ${sageColors.textSecondary}`}>Sensor Age</p>
                </div>
              );
            })()}
            
            {/* Pump Status */}
            {recentDeviceStatus.pump && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-1">Pump</h4>
                <div className="space-y-1">
                  {recentDeviceStatus.pump.battery !== undefined && (
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Battery: {ultraSafeRender(
                        typeof recentDeviceStatus.pump.battery === 'object' && recentDeviceStatus.pump.battery?.percent !== undefined
                          ? recentDeviceStatus.pump.battery.percent
                          : recentDeviceStatus.pump.battery
                      )}%
                    </p>
                  )}
                  {recentDeviceStatus.pump.reservoir !== undefined && (
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Reservoir: {ultraSafeRender(recentDeviceStatus.pump.reservoir)}U
                    </p>
                  )}
                  {recentDeviceStatus.pump.status && (
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {ultraSafeRender(typeof recentDeviceStatus.pump.status === 'object' 
                        ? recentDeviceStatus.pump.status.status || 'normal'
                        : recentDeviceStatus.pump.status)}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* OpenAPS Status */}
            {(recentDeviceStatus.openaps || recentDeviceStatus.loop) && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-1">OpenAPS</h4>
                <div className="space-y-1">
                  {/* Show enacted reason or status */}
                  {recentDeviceStatus.openaps?.enacted?.reason && (
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      {ultraSafeRender(recentDeviceStatus.openaps.enacted.reason)}
                    </p>
                  )}
                  {recentDeviceStatus.loop?.enacted?.reason && (
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      {ultraSafeRender(recentDeviceStatus.loop.enacted.reason)}
                    </p>
                  )}
                  
                  {/* Show suggested reason if no enacted */}
                  {!recentDeviceStatus.openaps?.enacted?.reason && 
                   !recentDeviceStatus.loop?.enacted?.reason &&
                   recentDeviceStatus.openaps?.suggested?.reason && (
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      {ultraSafeRender(recentDeviceStatus.openaps.suggested.reason)}
                    </p>
                  )}
                  
                  {/* Show loop status if available */}
                  {recentDeviceStatus.loop?.enacted?.timestamp && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {format(new Date(recentDeviceStatus.loop.enacted.timestamp), 'HH:mm')}
                    </p>
                  )}
                  {recentDeviceStatus.openaps?.enacted?.timestamp && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {format(new Date(recentDeviceStatus.openaps.enacted.timestamp), 'HH:mm')}
                    </p>
                  )}
                  
                  {/* Fallback status */}
                  {!recentDeviceStatus.openaps?.enacted?.reason && 
                   !recentDeviceStatus.loop?.enacted?.reason &&
                   !recentDeviceStatus.openaps?.suggested?.reason && (
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      Active
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {recentDeviceStatus.created_at && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Last updated: {formatDateTime(new Date(recentDeviceStatus.created_at))}
            </div>
          )}
        </div>
      )}

      {/* AI Components Control */}
      {isSubscribed && data?.entries && data.entries.length > 0 && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Analysis</h3>
          <button
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <Brain className="w-4 h-4 mr-2" />
            Refresh AI Analysis
          </button>
        </div>
      )}

      {/* TensorFlow Status - For Testing */}
      <div className="mb-6">
        <TensorFlowStatus />
      </div>

      {/* Enhanced AI Insights Panel - Premium Feature */}
      {isSubscribed && data?.entries && data.entries.length > 0 && filteredStats.totalReadings > 0 && (
        <div className="mb-6">
          {(() => {
            // Debug the props being passed to AI component
            console.log('🤖 Passing props to EnhancedAIInsightsPanel:', {
              timeInRange: filteredStats.timeInRange,
              timeInRangeType: typeof filteredStats.timeInRange,
              highPercentage: filteredStats.highPercentage,
              highPercentageType: typeof filteredStats.highPercentage,
              lowPercentage: filteredStats.lowPercentage,
              lowPercentageType: typeof filteredStats.lowPercentage
            });
            
            return (
              <EnhancedAIInsightsPanel 
                readings={filteredReadings} 
                timeInRange={{
                  timeInRange: typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0,
                  highPercentage: typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0,
                  lowPercentage: typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0
                }}
                manualRefresh={manualAIRefresh}
              />
            );
          })()}
        </div>
      )}

      {/* AI Management Plan - Premium Feature */}
      {isSubscribed && data?.entries && data.entries.length > 0 && data?.treatments && data.treatments.length > 0 && (
        <div className="mb-6">
          <AIManagementPlan 
            readings={filteredReadings}
            treatments={data?.treatments || []}
            manualRefresh={manualAIRefresh}
          />
        </div>
      )}

      {/* Premium Feature Teaser */}
      {!isSubscribed && data?.entries && data.entries.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-6 text-white">
            <div className="flex items-center mb-4">
              <Brain className="h-7 w-7 mr-3" />
              <h3 className="text-xl font-bold">AI-Powered Insights Available</h3>
            </div>
            <p className="mb-4">
              Upgrade to Premium to access personalized AI insights, recommendations, and a custom management plan based on your unique glucose patterns.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => navigate('/subscription')}
                className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
      )}

      {data?.entries && data.entries.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <GlucoseTrendChart 
                readings={chartReadings} 
                hours={isCustomRange ? undefined : Math.min(timeWindow, 336)} 
              />
              {/* Advanced Prediction with Nightscout Data */}
              <div className="space-y-4">
                <NightscoutDataDisplay 
                  onDataParsed={handleNightscoutDataParsed}
                  hoursBack={6}
                />
                <AdvancedPredictionChart 
                  key={refreshKey}
                  readings={data?.entries || []} 
                  useAI={hasApiKey || (tensorFlowEnabled && tensorFlowReady)}
                  context={predictionContext}
                />
              </div>
            </div>
            <div className="space-y-6">
              <A1CEstimator averageGlucose={filteredStats.totalReadings > 0 ? filteredStats.averageBG : (analysisResults?.averageBG || 0)} />
              
              {/* Prediction Insights Panel */}
              <PredictionInsightsPanel 
                readings={data?.entries || []}
                riskLevel={predictionInsights.riskLevel}
                confidence={predictionInsights.confidence}
                timeInRange={predictionInsights.timeInRange}
                recentTrends={predictionInsights.recentTrends ? {
                  prediction1h: predictionInsights.recentTrends.prediction1h,
                  prediction3h: predictionInsights.recentTrends.prediction3h,
                  trend: predictionInsights.recentTrends.direction
                } : undefined}
              />
              
              {/* Glucose Trend Analysis */}
              <GlucoseTrendAnalysis 
                readings={data?.entries || []}
                windowMinutes={30}
              />
              
              {/* Treatment Timeline */}
              <TreatmentTimeline 
                treatments={timelineData}
                maxItems={6}
              />
              
              <AlertSettings onSave={handleAlertSettingsSave} />
              <DataExport data={data || { entries: [], treatments: [], devicestatus: [] }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlucoseChart 
              readings={chartReadings}
              treatments={data?.treatments?.filter(treatment => {
                const treatmentTime = new Date(treatment.created_at).getTime();
                return (Date.now() - treatmentTime) <= timeWindow * 60 * 60 * 1000;
              }) || []}
              title={`Blood Glucose - ${getChartTimeWindowLabel()}`}
              showInsulinDelivery={true}
            />
            {filteredStats.totalReadings > 0 && (
              <TimeInRangeChart 
                timeInRange={typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0}
                highPercentage={typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0}
                lowPercentage={typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0}
              />
            )}
          </div>

          <div className="w-full">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Advanced Statistics - {ultraSafeRender(getDisplayLabel())}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analysis based on {ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')} readings from the selected time period
              </p>
            </div>
            {/* Pass the full filtered data for complete analysis, not the chart-limited version */}
            <AdvancedStats readings={filteredReadings} />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;