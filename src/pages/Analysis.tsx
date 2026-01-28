import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNightscout } from '../contexts/NightscoutContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { runSafeAsync } from '../utils/safeAsync';
import { getDateRangeString } from '../utils/dateUtils';
import { analyzeData } from '../services/analysisService';
import { Activity, Droplet, Cookie, Brain, TrendingUp, Sun, Cloud, Calendar, Clock, Sparkles } from 'lucide-react';
import { detectGlucosePatterns, analyzeMealPatterns, identifyMealClusters } from '../services/patternDetectionService';
import { analyzeWeatherImpact } from '../services/weatherAnalysis';
import { analyzeInsulinSensitivity } from '../services/insulinSensitivityAnalysis';
import SuggestionTable from '../components/SuggestionTable';
import GlucoseChart from '../components/GlucoseChart';
import AdvancedStats from '../components/AdvancedStats';
import LoadingSpinner from '../components/LoadingSpinner';
import AIInsightsPanel from '../components/AIInsightsPanel';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getTreatmentMs } from '../utils/nightscoutTime';

const Analysis = () => {
  const { data, loading, error, fetchDataForDays } = useNightscout();
  const { isPremium } = useDesignMode();
  const { isSubscribed } = useSubscription();
  const { formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<ReturnType<typeof detectGlucosePatterns> | null>(null);
  const [mealPatterns, setMealPatterns] = useState<ReturnType<typeof analyzeMealPatterns> | null>(null);
  const [mealClusters, setMealClusters] = useState<ReturnType<typeof identifyMealClusters> | null>(null);
  const [weatherImpact, setWeatherImpact] = useState<Awaited<ReturnType<typeof analyzeWeatherImpact>>>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [insulinSensitivity, setInsulinSensitivity] = useState<ReturnType<typeof analyzeInsulinSensitivity> | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Awaited<ReturnType<typeof analyzeData>>>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // Time selection state
  const [timeWindow, setTimeWindow] = useState(168); // Default to 7 days (168 hours)
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  
  useEffect(() => {
    // Get user's location for weather analysis
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setWeatherError(null);
      },
      error => {
        console.error('Location error:', error);
        setWeatherError('Unable to get location for weather analysis');
      }
    );
  }, []);

  useEffect(() => {
    if (!data && !loading) {
      runSafeAsync(() => fetchDataForDays(14), { label: 'Analysis initial fetch' });
    }
  }, [data, loading, fetchDataForDays]);

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => a.date - b.date);
  }, [data?.entries]);

  const treatmentsSortedAsc = React.useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

  const selectedRange = React.useMemo(() => {
    if (isCustomRange) {
      return {
        startMs: startOfDay(new Date(customDateRange.startDate)).getTime(),
        endMs: endOfDay(new Date(customDateRange.endDate)).getTime()
      };
    }

    const now = Date.now();
    const timeWindowMs = timeWindow * 60 * 60 * 1000;
    return { startMs: now - timeWindowMs, endMs: now };
  }, [timeWindow, isCustomRange, customDateRange]);

  // Get filtered readings based on time selection
  const filteredReadings = React.useMemo(() => {
    if (entriesSortedAsc.length === 0) return [];
    return sliceSortedByTimeRange(entriesSortedAsc, (e) => e.date, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange]);

  // Get filtered treatments based on time selection
  const filteredTreatments = React.useMemo(() => {
    if (treatmentsSortedAsc.length === 0) return [];
    return sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange.startMs, selectedRange.endMs);
  }, [treatmentsSortedAsc, selectedRange]);

  // Calculate time in range for filtered readings
  const filteredStats = React.useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0,
        totalReadings: 0
      };
    }

    let inRangeCount = 0;
    let highCount = 0;
    let lowCount = 0;

    filteredReadings.forEach((reading) => {
      // reading.sgv is always in mg/dL from Nightscout
      if (reading.sgv >= 70 && reading.sgv <= 180) { // 3.9-10.0 mmol/L = 70-180 mg/dL
        inRangeCount++;
      } else if (reading.sgv > 180) {
        highCount++;
      } else if (reading.sgv < 70) {
        lowCount++;
      }
    });
    
    const total = filteredReadings.length;
    
    return {
      timeInRange: (inRangeCount / total) * 100,
      highPercentage: (highCount / total) * 100,
      lowPercentage: (lowCount / total) * 100,
      totalReadings: total
    };
  }, [filteredReadings]);

  useEffect(() => {
    const processData = async () => {
      if (filteredReadings.length && filteredTreatments.length) {
        try {
          if (!import.meta.env.VITE_OPENWEATHER_API_KEY) {
            setWeatherError('Weather analysis is disabled. Please configure OpenWeather API key.');
          }

          const [
            glucosePatterns,
            mealPatternsData,
            mealClustersData,
            weatherImpactData,
            insulinSensitivityData
          ] = await Promise.all([
            detectGlucosePatterns(filteredReadings),
            analyzeMealPatterns(filteredReadings, filteredTreatments),
            identifyMealClusters(filteredTreatments, filteredReadings),
            location ? analyzeWeatherImpact(filteredReadings, location) : null,
            analyzeInsulinSensitivity(filteredReadings, filteredTreatments)
          ]);
          
          setPatterns(glucosePatterns);
          setMealPatterns(mealPatternsData);
          setMealClusters(mealClustersData);
          setWeatherImpact(weatherImpactData);
          setInsulinSensitivity(insulinSensitivityData);
        } catch (err) {
          console.error('Error processing patterns:', err);
          setPatterns(null);
          setMealPatterns(null);
          setMealClusters(null);
          setWeatherImpact(null);
          setInsulinSensitivity(null);
        }
      }
    };

    runSafeAsync(() => processData(), { label: 'Analysis processData effect' });
  }, [filteredReadings, filteredTreatments, location]);

  // Analyze data when available
  useEffect(() => {
    const runAnalysis = async () => {
      if (data) {
        setAnalysisLoading(true);
        try {
          const results = await analyzeData(data);
          setAnalysisResults(results);
        } catch (err) {
          console.error('Error analyzing data:', err);
          setAnalysisResults(null);
        } finally {
          setAnalysisLoading(false);
        }
      } else {
        setAnalysisResults(null);
      }
    };
    
    runSafeAsync(() => runAnalysis(), { label: 'Analysis runAnalysis effect' });
  }, [data]);
  
  const currentProfile = analysisResults?.currentProfile;

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
      
      // Fetch more data if needed for longer time periods
      const daysNeeded = Math.ceil(newTimeWindow / 24) + 1;
      if (daysNeeded > 7) {
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'Analysis fetch more data for time window' });
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
    
    const daysToFetch = Math.max(diffDays + 7, 14);
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'Analysis fetch data for custom range' });
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (entriesSortedAsc.length === 0) return null;

    const oldestEntry = entriesSortedAsc[0];
    const newestEntry = entriesSortedAsc[entriesSortedAsc.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      totalReadings: entriesSortedAsc.length
    };
  }, [entriesSortedAsc]);
  
  if (loading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Activity className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">No data available for analysis. Please fetch data first.</p>
        <button
          onClick={() => runSafeAsync(() => fetchDataForDays(14), { label: 'Analysis fetch data (no data state)' })}
          className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
        >
          Fetch Data
        </button>
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
              ? "text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent" 
              : "text-2xl font-bold text-gray-900 dark:text-gray-100"
          }>
            {isPremium && <Sparkles className="inline-block w-6 h-6 mr-2 text-blue-500 animate-pulse" />}
            Advanced Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis for {getDisplayLabel()} ({filteredReadings.length} readings)
          </p>
          {dataSpanInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
            </p>
          )}
        </div>
        
        {/* Time Selection Controls */}
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
          
          {!isCustomRange && (
            <motion.button
              onClick={() => setShowCalendar(!showCalendar)}
              className={
                isPremium
                  ? "px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center transition-all duration-200 shadow-lg"
                  : "px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
              }
              whileHover={isPremium ? { scale: 1.05 } : {}}
              whileTap={isPremium ? { scale: 0.95 } : {}}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </motion.button>
          )}
          
          <motion.button 
            onClick={() => {
              if (isCustomRange) {
                handleCustomDateSubmit();
              } else {
                const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, 14)), { label: 'Analysis refresh fetch data' });
              }
            }}
            className={
              isPremium
                ? "px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center transition-all duration-200 shadow-lg"
                : "px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center transition-colors duration-200"
            }
            whileHover={isPremium ? { scale: 1.05 } : {}}
            whileTap={isPremium ? { scale: 0.95 } : {}}
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </motion.button>
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
                if (isCustomRange) {
                  setIsCustomRange(false);
                }
              }}
              className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📊 Analysis Info:</h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>🔍 Analyzing {filteredReadings.length} glucose readings and {filteredTreatments.length} treatments for {getDisplayLabel()}</p>
          {dataSpanInfo && (
            <p>📈 Total available: {dataSpanInfo.totalReadings} readings spanning {dataSpanInfo.spanDays} days</p>
          )}
        </div>
      </div>

      {/* AI Insights Panel - Premium Feature */}
      {isSubscribed && filteredReadings.length > 0 && (
        <AIInsightsPanel 
          readings={filteredReadings} 
          timeInRange={filteredStats}
        />
      )}

      {/* Advanced Statistics Section with Time-Filtered Data */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Advanced Statistics</h3>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getDisplayLabel()} • {filteredReadings.length} readings
          </div>
        </div>
        
        {filteredReadings.length > 0 ? (
          <AdvancedStats readings={filteredReadings} />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No data available for the selected time period</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Try selecting a different time range or fetching more data</p>
          </div>
        )}
      </div>

      {/* Pattern Analysis */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Pattern Detection</h3>
          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
            {getDisplayLabel()}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns?.map((pattern, index) => (
            <div key={index} className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100">{pattern.timeOfDay}</h4>
              <div className="mt-2 space-y-1">
                <p className="text-purple-800 dark:text-purple-200">
                  Average: {formatGlucoseValue(pattern.avgGlucose, 'mgdl', true)}
                </p>
                <p className="text-purple-800 dark:text-purple-200">
                  Variability: ±{formatGlucoseValue(pattern.variability, 'mgdl', true)}
                </p>
                <p className={`${
                  pattern.trend === 'rising' 
                    ? 'text-red-600 dark:text-red-400' 
                    : pattern.trend === 'falling' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  Trend: {pattern.trend}
                </p>
                <p className={`${
                  pattern.risk === 'high' 
                    ? 'text-red-600 dark:text-red-400' 
                    : pattern.risk === 'medium' 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : 'text-green-600 dark:text-green-400'
                } font-medium`}>
                  Risk Level: {pattern.risk}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weather Impact Analysis */}
      {weatherError ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Cloud className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">{weatherError}</p>
            </div>
          </div>
        </div>
      ) : weatherImpact && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 transition-colors duration-200">
          <div className="flex items-center mb-4">
            <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Weather Impact</h3>
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {getDisplayLabel()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Current Conditions</h4>
              <div className="mt-2 space-y-1">
                <p className="text-blue-800 dark:text-blue-200">
                  Temperature: {weatherImpact.weatherConditions.temperature}°C
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Humidity: {weatherImpact.weatherConditions.humidity}%
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Weather: {weatherImpact.weatherConditions.weather}
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Correlations</h4>
              <div className="mt-2 space-y-1">
                <p className="text-blue-800 dark:text-blue-200">
                  Temperature Impact: {weatherImpact.correlations.temperatureCorrelation}
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Humidity Impact: {weatherImpact.correlations.humidityCorrelation}
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Pressure Impact: {weatherImpact.correlations.pressureCorrelation}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insulin Sensitivity Analysis */}
      {insulinSensitivity && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 transition-colors duration-200">
          <div className="flex items-center mb-4">
            <Droplet className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Insulin Sensitivity</h3>
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {getDisplayLabel()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {insulinSensitivity.map((segment, index) => (
              <div key={index} className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  {segment.start}:00 - {segment.end}:00
                </h4>
                <div className="mt-2 space-y-1">
                  <p className="text-green-800 dark:text-green-200">
                    Sensitivity: {segment.sensitivity} {getUnitLabel()}/U
                  </p>
                  <div className="flex items-center">
                    <div className="flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded">
                      <div 
                        className="h-2 bg-green-500 dark:bg-green-400 rounded"
                        style={{ width: `${segment.confidence * 100}%` }}
                      />
                    </div>
                    <span className="ml-2 text-sm text-green-800 dark:text-green-200">
                      {Math.round(segment.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Circadian Rhythm Analysis */}
      {weatherImpact?.circadianAnalysis && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 transition-colors duration-200">
          <div className="flex items-center mb-4">
            <Sun className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Circadian Analysis</h3>
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {getDisplayLabel()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(weatherImpact.circadianAnalysis).map(([period, stats]) => (
              <div key={period} className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-orange-900 dark:text-orange-100 capitalize">
                  {period}
                </h4>
                <div className="mt-2 space-y-1">
                  <p className="text-orange-800 dark:text-orange-200">
                    Mean: {stats?.mean ? formatGlucoseValue(stats.mean, 'mgdl', true) : 'N/A'}
                  </p>
                  <p className="text-orange-800 dark:text-orange-200">
                    SD: ±{stats?.standardDeviation ? formatGlucoseValue(stats.standardDeviation, 'mgdl', true) : 'N/A'}
                  </p>
                  <p className="text-orange-800 dark:text-orange-200">
                    Readings: {stats?.count || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Original Analysis Components - Only show if we have analysis results and profile */}
      {analysisResults && currentProfile && (
        <>
          <SuggestionTable
            title="Basal Rates"
            currentValues={currentProfile.basal}
            suggestedValues={analysisResults.basalSuggestions}
            unit="U/hr"
          />
          
          <SuggestionTable
            title="ISF Settings"
            currentValues={currentProfile.sens}
            suggestedValues={analysisResults.isfSuggestions}
            unit={`${getUnitLabel()}/U`}
          />
          
          <SuggestionTable
            title="Carb Ratios"
            currentValues={currentProfile.carbratio}
            suggestedValues={analysisResults.carbRatioSuggestions}
            unit="g/U"
          />
        </>
      )}

      {/* Show message if profile analysis isn't available */}
      {!analysisResults && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h3 className="text-yellow-900 dark:text-yellow-100 font-medium mb-2">
            Profile Analysis Unavailable
          </h3>
          <p className="text-yellow-800 dark:text-yellow-200">
            Pump profile data is not available. Profile suggestions (basal rates, ISF, carb ratios) cannot be calculated, 
            but pattern analysis is still available above.
          </p>
        </div>
      )}

      {/* Premium Feature Teaser */}
      {!isSubscribed && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md overflow-hidden">
          <div className="p-6 text-white">
            <div className="flex items-center mb-4">
              <Brain className="h-7 w-7 mr-3" />
              <h3 className="text-xl font-bold">AI-Powered Analysis Available</h3>
            </div>
            <p className="mb-4">
              Upgrade to Premium to access advanced AI insights, personalized recommendations, and detailed pattern analysis based on your unique glucose data.
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
    </motion.div>
  );
};

export default Analysis;