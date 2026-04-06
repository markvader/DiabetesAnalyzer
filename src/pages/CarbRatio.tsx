import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNightscout } from '../contexts/NightscoutContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { analyzeData } from '../services/analysisService';
import SuggestionTable from '../components/SuggestionTable';
import LoadingSpinner from '../components/LoadingSpinner';
import GlucoseEventInsightsPanel from '../components/GlucoseEventInsightsPanel';
import { AlertTriangle, Brain, Shield, RefreshCw, Calendar, Clock, Sparkles } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { runSafeAsync } from '../utils/safeAsync';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { toMmol } from '../utils/glucoseUtils';
import { GLUCOSE_RANGES } from '../constants/glucoseRanges';
import type { NightscoutDeviceStatus } from '../types/nightscout';
import { useFilteredByTimeRange, useFilteredNightscoutData, useTimeSeriesSpanInfo } from '../hooks/useFilteredTimeSeriesData';

const CarbRatio = () => {
  const { data, loading, error, fetchDataForDays, analysisPeriod } = useNightscout();
  const { isPremium } = useDesignMode();
  const { formatGlucose } = useGlucoseUnits();
  const [analysisResults, setAnalysisResults] = useState<Awaited<ReturnType<typeof analyzeData>>>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  // Time selection state - use analysisPeriod from context
  const [timeWindow, setTimeWindow] = useState(() => analysisPeriod * 24); // Convert days to hours
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  }, [data?.entries]);

  const treatmentsSortedAsc = React.useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

  const getDeviceStatusMs = React.useCallback((status: NightscoutDeviceStatus): number => {
    const ms = status.mills ?? status.date;
    if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
    if (status.created_at) {
      const parsed = Date.parse(status.created_at);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }, []);

  const deviceStatusSortedAsc = React.useMemo(() => {
    if (!data?.deviceStatus?.length) return [];
    return [...data.deviceStatus].sort((a, b) => getDeviceStatusMs(a) - getDeviceStatusMs(b));
  }, [data?.deviceStatus, getDeviceStatusMs]);

  const selectedRange = React.useMemo(() => {
    if (isCustomRange) {
      return {
        startMs: startOfDay(new Date(customDateRange.startDate)).getTime(),
        endMs: endOfDay(new Date(customDateRange.endDate)).getTime()
      };
    }

    const endMs = Date.now();
    const startMs = endMs - timeWindow * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [isCustomRange, customDateRange.startDate, customDateRange.endDate, timeWindow]);

  // Update timeWindow when analysisPeriod changes
  useEffect(() => {
    if (!isCustomRange) {
      setTimeWindow(analysisPeriod * 24);
      setCustomDateRange({
        startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [analysisPeriod, isCustomRange]);

  // Fetch data when analysisPeriod changes
  useEffect(() => {
    runSafeAsync(() => fetchDataForDays(Math.max(analysisPeriod, 7)), { label: 'CarbRatio initial fetch' });
  }, [analysisPeriod, fetchDataForDays]);

  const { filteredReadings, filteredTreatments } = useFilteredNightscoutData(
    entriesSortedAsc,
    treatmentsSortedAsc,
    selectedRange,
    getEntryMs,
    getTreatmentMs
  );

  const filteredDeviceStatus = useFilteredByTimeRange(deviceStatusSortedAsc, getDeviceStatusMs, selectedRange);

  // Create filtered data object for analysis
  const filteredData = React.useMemo(() => {
    if (!data) return null;
    
    return {
      ...data,
      entries: filteredReadings,
      treatments: filteredTreatments,
      deviceStatus: filteredDeviceStatus
    };
  }, [data, filteredReadings, filteredTreatments, filteredDeviceStatus]);

  type HourlyGlucoseStats = {
    hour: number;
    count: number;
    avgSgvMgdl: number | null;
    inRangePct: number;
    lowPct: number;
    highPct: number;
  };

  const hourlyGlucoseStats: HourlyGlucoseStats[] = React.useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      sumSgvMgdl: 0,
      lowCount: 0,
      highCount: 0,
      inRangeCount: 0
    }));

    for (const reading of filteredReadings) {
      const hour = new Date(reading.date).getHours();
      const bucket = buckets[hour];
      if (!bucket) continue;

      const sgv = Number(reading.sgv);
      if (!Number.isFinite(sgv) || sgv <= 0) continue;

      bucket.count += 1;
      bucket.sumSgvMgdl += sgv;

      const mmol = toMmol(sgv);
      if (mmol < GLUCOSE_RANGES.TARGET_MIN) {
        bucket.lowCount += 1;
      } else if (mmol > GLUCOSE_RANGES.TARGET_MAX) {
        bucket.highCount += 1;
      } else {
        bucket.inRangeCount += 1;
      }
    }

    return buckets.map((b) => {
      const avgSgvMgdl = b.count ? b.sumSgvMgdl / b.count : null;
      const inRangePct = b.count ? (b.inRangeCount / b.count) * 100 : 0;
      const lowPct = b.count ? (b.lowCount / b.count) * 100 : 0;
      const highPct = b.count ? (b.highCount / b.count) * 100 : 0;
      return {
        hour: b.hour,
        count: b.count,
        avgSgvMgdl,
        inRangePct,
        lowPct,
        highPct
      };
    });
  }, [filteredReadings]);

  const hourlyStatsSummary = React.useMemo(() => {
    const avgPerHour = filteredReadings.length ? filteredReadings.length / 24 : 0;
    const minCount = Math.max(12, Math.floor(avgPerHour / 4));
    const eligible = hourlyGlucoseStats.filter((h) => h.count >= minCount);

    const topLow = [...eligible]
      .sort((a, b) => b.lowPct - a.lowPct)
      .filter((h) => h.lowPct > 0)
      .slice(0, 3);

    const topHigh = [...eligible]
      .sort((a, b) => b.highPct - a.highPct)
      .filter((h) => h.highPct > 0)
      .slice(0, 3);

    const worstTir = [...eligible]
      .sort((a, b) => a.inRangePct - b.inRangePct)
      .slice(0, 3);

    return { minCount, topLow, topHigh, worstTir };
  }, [filteredReadings.length, hourlyGlucoseStats]);

  const formatHourRange = (hour: number) => {
    const start = `${hour.toString().padStart(2, '0')}:00`;
    const end = `${hour.toString().padStart(2, '0')}:59`;
    return `${start}–${end}`;
  };

  type TherapyPatternSummary = {
    classification: string;
    confidence: number;
    notes: string[];
    stats: {
      carbEntries: number;
      carbAnnouncements: number;
      mealBoluses: number;
      insulinTreatments: number;
      insulinOnly: number;
      microBoluses: number;
      loopSignals: number;
    };
  };

  const therapyPattern = React.useMemo<TherapyPatternSummary>(() => {
    const carbEntries = filteredTreatments.filter((t) => (t.carbs ?? 0) > 0);
    const insulinTreatments = filteredTreatments.filter((t) => (t.insulin ?? t.units ?? 0) > 0);

    const carbAnnouncements = carbEntries.filter((t) => (t.insulin ?? t.units ?? 0) <= 0.05);
    const mealBoluses = carbEntries.filter((t) => (t.insulin ?? t.units ?? 0) > 0.05);

    const insulinOnly = insulinTreatments.filter((t) => (t.carbs ?? 0) <= 0);
    const microBoluses = insulinOnly.filter((t) => {
      const units = t.insulin ?? t.units ?? 0;
      return units > 0 && units <= 0.3;
    });

    const loopSignals = filteredDeviceStatus.filter((s) => {
      const openaps = (s.openaps ?? null) as Record<string, unknown> | null;
      const loop = (s.loop ?? null) as Record<string, unknown> | null;
      const hasOpenapsEnacted = !!(openaps && typeof openaps === 'object' && 'enacted' in openaps);
      const hasLoopEnacted = !!(loop && typeof loop === 'object' && 'enacted' in loop);
      return hasOpenapsEnacted || hasLoopEnacted;
    }).length;

    const stats = {
      carbEntries: carbEntries.length,
      carbAnnouncements: carbAnnouncements.length,
      mealBoluses: mealBoluses.length,
      insulinTreatments: insulinTreatments.length,
      insulinOnly: insulinOnly.length,
      microBoluses: microBoluses.length,
      loopSignals
    };

    const notes: string[] = [];

    if (stats.carbEntries < 5 && stats.insulinTreatments < 5 && stats.loopSignals === 0) {
      return {
        classification: 'Insufficient evidence (limited treatments/device status) ',
        confidence: 25,
        notes: ['Not enough carbs/insulin/deviceStatus events in the selected period to infer usage reliably.'],
        stats
      };
    }

    const carbAnnouncementPct = stats.carbEntries ? (stats.carbAnnouncements / stats.carbEntries) * 100 : 0;
    const mealBolusPct = stats.carbEntries ? (stats.mealBoluses / stats.carbEntries) * 100 : 0;
    const microBolusPct = stats.insulinOnly ? (stats.microBoluses / stats.insulinOnly) * 100 : 0;

    if (stats.loopSignals > 0 || (stats.microBoluses >= 10 && microBolusPct >= 40)) {
      notes.push('DeviceStatus suggests automated loop activity (OpenAPS/Loop enacted data) and/or many small insulin-only doses (SMB-like).');
      return {
        classification: 'APS automation likely (SMB/temp basals) ',
        confidence: stats.loopSignals > 0 ? 80 : 70,
        notes,
        stats
      };
    }

    if (stats.carbEntries >= 10 && carbAnnouncementPct >= 70 && stats.insulinTreatments < Math.max(3, Math.floor(stats.carbEntries * 0.3))) {
      notes.push('Most carb entries have no insulin recorded (carb announcements).');
      notes.push('Carb ratio suggestions can be less reliable if meal boluses aren\'t recorded in Nightscout.');
      return {
        classification: 'Carb announcements only (no bolus recorded) ',
        confidence: 75,
        notes,
        stats
      };
    }

    if (stats.carbEntries >= 5 && mealBolusPct >= 40) {
      notes.push('Many carb entries include insulin in the same treatment (typical bolus wizard / normal meal bolusing uploads).');
      return {
        classification: 'Normal meal boluses recorded (carbs + insulin) ',
        confidence: 70,
        notes,
        stats
      };
    }

    notes.push('Data looks mixed (some carbs-only, some insulin-only, limited clear loop signals).');
    return {
      classification: 'Mixed / unclear pattern ',
      confidence: 55,
      notes,
      stats
    };
  }, [filteredTreatments, filteredDeviceStatus]);

  useEffect(() => {
    const performAnalysis = async () => {
      if (!filteredData) return;
      
      // Run automatically on initial load (default 2 weeks) or when manual refresh is triggered
      if (!hasInitialLoad || manualRefresh) {
        setAnalyzing(true);
        try {
          const results = await analyzeData(filteredData);
          setAnalysisResults(results);
          
          // Mark initial load as complete and reset manual refresh flag
          if (!hasInitialLoad) {
            setHasInitialLoad(true);
          }
          if (manualRefresh) {
            setManualRefresh(false);
          }
        } catch (error) {
          console.error('Analysis failed:', error);
        } finally {
          setAnalyzing(false);
        }
      }
    };

    runSafeAsync(() => performAnalysis(), { label: 'CarbRatio performAnalysis effect' });
  }, [filteredData, manualRefresh, hasInitialLoad]);

  // Helper functions
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

  const getDisplayLabel = () => {
    if (isCustomRange) {
      return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
    }
    return getTimeWindowLabel(timeWindow);
  };

  const getAllTimeWindows = () => {
    return [
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

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      const newTimeWindow = parseInt(value);
      setTimeWindow(newTimeWindow);
      setShowCalendar(false);
      
      // Clear existing analysis when changing time period
      setAnalysisResults(null);
      
      // Fetch more data if needed for longer time periods
      const daysNeeded = Math.ceil(newTimeWindow / 24) + 1;
      if (daysNeeded > analysisPeriod) {
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'CarbRatio fetch more data for time window' });
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
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const daysToFetch = Math.max(diffDays + 7, analysisPeriod);
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'CarbRatio fetch data for custom range' });
    
    // Clear existing analysis when changing date range
    setAnalysisResults(null);
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = useTimeSeriesSpanInfo(entriesSortedAsc, getEntryMs);

  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || analyzing) return <LoadingSpinner message={analyzing ? "Running AI safety analysis..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!analysisResults?.currentProfile) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">No profile data available.</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h2 className={
            isPremium 
              ? "text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400 bg-clip-text text-transparent" 
              : "text-2xl font-bold text-gray-900 dark:text-gray-100"
          }>
            {isPremium && <Sparkles className="inline-block w-6 h-6 mr-2 text-green-500 animate-pulse" />}
            AI-Enhanced Carb Ratio Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis for {getDisplayLabel()}
          </p>
          {dataSpanInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
            </p>
          )}
        </div>
        
        {/* Time Selection and Refresh Controls */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
          <select
            value={isCustomRange ? 'custom' : timeWindow.toString()}
            onChange={(e) => handleTimeWindowChange(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            {getAllTimeWindows().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          
          <motion.button
            onClick={() => setShowCalendar(!showCalendar)}
            className={
              isPremium
                ? "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center justify-center transition-all duration-200 shadow-lg"
                : "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded flex items-center justify-center hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
            }
            whileHover={isPremium ? { scale: 1.05 } : {}}
            whileTap={isPremium ? { scale: 0.95 } : {}}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </motion.button>
          
          <button 
            onClick={() => {
              if (isCustomRange) {
                handleCustomDateSubmit();
              } else {
                const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, analysisPeriod)), { label: 'CarbRatio refresh fetch data' });
              }
            }}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh Data
          </button>
          
          <button 
            onClick={handleRefreshAI}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded flex items-center justify-center hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI
          </button>
        </div>
      </motion.div>

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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCustomDateSubmit}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              Apply Range
            </button>
            <button
              onClick={() => {
                setShowCalendar(false);
              }}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {analysisResults?.eventInsights && (
        <GlucoseEventInsightsPanel
          insights={analysisResults.eventInsights}
          focus="carb"
          title="Event Intelligence • Carb Ratio"
        />
      )}

      {/* Show empty state with manual refresh option when no analysis results */}
      {!analysisResults && !analyzing && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">AI-Enhanced Carb Ratio Analysis</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {(!filteredReadings.length || !filteredTreatments.length) ? (
              "Insufficient data for analysis. Please ensure you have glucose readings and treatment data for the selected time period."
            ) : hasInitialLoad ? (
              "No carb ratio analysis available. Click 'Refresh AI' to run analysis for the current time period."
            ) : (
              "              `Loading carb ratio analysis for the last ${analysisPeriod} day${analysisPeriod > 1 ? 's' : ''}...`"
            )}
          </p>
          {(filteredReadings.length && filteredTreatments.length && hasInitialLoad) && (
            <button 
              onClick={handleRefreshAI}
              className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center mx-auto transition-colors duration-200"
            >
              <Brain className="w-5 h-5 mr-2" />
              Start Carb Ratio Analysis
            </button>
          )}
        </div>
      )}

      {/* Analysis Results Section */}
      {analysisResults && (
        <div className="space-y-6">

      {/* Safety Warnings */}
      {analysisResults.safetyWarnings?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Critical Safety Warnings</h3>
          </div>
          
          <div className="space-y-3">
            {analysisResults.safetyWarnings.map((warning: string, index: number) => (
              <div key={index} className="bg-red-100 dark:bg-red-800/30 p-3 rounded border-l-4 border-red-500">
                <p className="text-red-800 dark:text-red-200 text-sm font-medium">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis Results */}
      {analysisResults.aiEnhanced && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Safety Analysis</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Safety Score: {analysisResults.aiEnhanced.safetyScore}/100 | 
              Hypo Risk: {analysisResults.aiEnhanced.hypoglycemiaRisk.toFixed(1)}%
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">AI Recommendations</h4>
              <div className="space-y-2">
                {analysisResults.aiEnhanced.aiInsights.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded border-l-4 border-purple-500">
                    <p className="text-purple-800 dark:text-purple-200 text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Risk Assessment</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">Overall Risk:</span>
                  <span className={`font-medium ${
                    analysisResults.aiEnhanced.aiInsights.riskAssessment === 'low' ? 'text-green-600 dark:text-green-400' :
                    analysisResults.aiEnhanced.aiInsights.riskAssessment === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {analysisResults.aiEnhanced.aiInsights.riskAssessment}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">AI Confidence:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {analysisResults.aiEnhanced.aiInsights.confidence}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium mb-1 text-gray-900 dark:text-gray-100">Time-of-Day Glucose Patterns</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hourly Low / Time-in-Range / High for the selected period
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              Min samples/hour: <span className="font-medium">{hourlyStatsSummary.minCount}</span>
              {hourlyStatsSummary.topLow[0] && (
                <div className="mt-1">Most lows: <span className="font-medium">{formatHourRange(hourlyStatsSummary.topLow[0].hour)}</span> ({hourlyStatsSummary.topLow[0].lowPct.toFixed(1)}%)</div>
              )}
              {hourlyStatsSummary.topHigh[0] && (
                <div>Most highs: <span className="font-medium">{formatHourRange(hourlyStatsSummary.topHigh[0].hour)}</span> ({hourlyStatsSummary.topHigh[0].highPct.toFixed(1)}%)</div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {hourlyGlucoseStats.map((h) => {
              const eligible = h.count >= hourlyStatsSummary.minCount;
              const bg = !eligible
                ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                : h.inRangePct >= 70
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : h.lowPct >= 8
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : h.highPct >= 35
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';

              return (
                <div
                  key={h.hour}
                  className={`border rounded-lg p-3 transition-colors duration-200 ${bg}`}
                  title={eligible ? undefined : `Low samples for this hour (n=${h.count}).`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{formatHourRange(h.hour)}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">n={h.count}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      <span className="font-medium">TIR</span>: {h.inRangePct.toFixed(1)}% · <span className="font-medium text-red-700 dark:text-red-300">Low</span>: {h.lowPct.toFixed(1)}% · <span className="font-medium text-orange-700 dark:text-orange-300">High</span>: {h.highPct.toFixed(1)}%
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {h.avgSgvMgdl != null ? `avg ${formatGlucose(h.avgSgvMgdl, 'mgdl', true)}` : 'avg —'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <div className="flex items-center mb-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Detected Therapy Pattern (Heuristic)</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">Confidence: {therapyPattern.confidence}%</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Likely: <span className="font-medium">{therapyPattern.classification.trim()}</span>
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded p-3">
              <div className="text-gray-900 dark:text-gray-100 font-medium mb-1">Treatments (selected period)</div>
              <div className="text-gray-700 dark:text-gray-300">Carb entries: <span className="font-medium">{therapyPattern.stats.carbEntries}</span></div>
              <div className="text-gray-700 dark:text-gray-300">Carb announcements (no insulin): <span className="font-medium">{therapyPattern.stats.carbAnnouncements}</span></div>
              <div className="text-gray-700 dark:text-gray-300">Meal boluses (carbs + insulin): <span className="font-medium">{therapyPattern.stats.mealBoluses}</span></div>
              <div className="text-gray-700 dark:text-gray-300">Insulin treatments: <span className="font-medium">{therapyPattern.stats.insulinTreatments}</span></div>
              <div className="text-gray-700 dark:text-gray-300">Insulin-only microboluses (≤0.3U): <span className="font-medium">{therapyPattern.stats.microBoluses}</span></div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded p-3">
              <div className="text-gray-900 dark:text-gray-100 font-medium mb-1">Loop signals</div>
              <div className="text-gray-700 dark:text-gray-300">DeviceStatus enacted (OpenAPS/Loop): <span className="font-medium">{therapyPattern.stats.loopSignals}</span></div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Note: This is a best-effort inference from Nightscout uploads; AAPS features like Dynamic ISF are not always directly identifiable.
              </div>
            </div>
          </div>

          {therapyPattern.notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {therapyPattern.notes.map((n, idx) => (
                <div key={idx} className="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded">
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>

        <SuggestionTable
          title="Ultra-Safe Carb Ratio Recommendations"
          currentValues={analysisResults.currentProfile.carbratio}
          suggestedValues={analysisResults.carbRatioSuggestions || []}
          unit="g/U"
        />

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Understanding Ultra-Safe Carb Ratios</h3>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              These ultra-conservative insulin-to-carb ratio suggestions prioritize preventing hypoglycemia above all else. 
              The analysis uses a safety-first approach with:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Maximum 5% adjustments (reduced from previous 10%)</li>
              <li>Special attention to post-meal hypoglycemia patterns</li>
              <li>AI-powered safety validation</li>
              <li>Pediatric-focused safety constraints</li>
            </ul>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md mt-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  <strong>Important:</strong> Always consult with your healthcare provider before making changes to your carb ratios.
                  These suggestions are based on pattern analysis and should be reviewed by your medical team.
                  Start with the smallest possible changes (1-2%) and monitor closely.
                </p>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CarbRatio;