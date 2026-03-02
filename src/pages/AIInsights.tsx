import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNightscout } from '../contexts/NightscoutContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Brain, Calendar, Clock, RefreshCw, Cpu, Sparkles } from 'lucide-react';
import EnhancedAIInsightsPanel from '../components/EnhancedAIInsightsPanel';
import GlucoseEventInsightsPanel from '../components/GlucoseEventInsightsPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { toMmol } from '../utils/glucoseUtils';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getTreatmentMs } from '../utils/nightscoutTime';
import { analyzeGlucoseEventInsights } from '../services/glucoseEventInsightsService';

const AIInsights = () => {
  const { data, loading, error, fetchDataForDays } = useNightscout();
  const { isPremium } = useDesignMode();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled, error: tensorFlowError } = useTensorFlow();
  
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
  const [manualRefresh, setManualRefresh] = useState(false);

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

    const endMs = Date.now();
    const startMs = endMs - timeWindow * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [isCustomRange, customDateRange.startDate, customDateRange.endDate, timeWindow]);

  // Get filtered readings based on time selection
  const filteredReadings = React.useMemo(() => {
    if (!entriesSortedAsc.length) {
      return [];
    }

    return sliceSortedByTimeRange(entriesSortedAsc, (reading) => reading.date, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  const filteredTreatments = React.useMemo(() => {
    if (!treatmentsSortedAsc.length) {
      return [];
    }

    return sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange.startMs, selectedRange.endMs);
  }, [treatmentsSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  const eventInsights = React.useMemo(() => {
    return analyzeGlucoseEventInsights(filteredReadings, filteredTreatments, selectedRange);
  }, [filteredReadings, filteredTreatments, selectedRange]);

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
      const mmol = toMmol(reading.sgv);
      
      if (mmol >= 3.9 && mmol <= 10.0) {
        inRangeCount++;
      } else if (mmol > 10.0) {
        highCount++;
      } else if (mmol < 3.9) {
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
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'AIInsights fetch more data for time window' });
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
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'AIInsights fetch data for custom range' });
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (!entriesSortedAsc.length) return null;
    
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

  // Function to manually refresh AI analysis
  const handleRefreshAI = () => {
    setManualRefresh(prev => !prev);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h2 className={
              isPremium 
                ? "text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent" 
                : "text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100"
            }>
              {isPremium && <Sparkles className="inline-block w-5 h-5 sm:w-6 sm:h-6 mr-2 text-purple-500 animate-pulse" />}
              AI-Powered Insights
            </h2>
            {tensorFlowEnabled && (
              <motion.div 
                className={`flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium ${
                  tensorFlowReady 
                    ? isPremium
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : isPremium
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                }`}
                animate={isPremium ? { scale: [1, 1.05, 1] } : {}}
                transition={isPremium ? { duration: 2, repeat: Infinity } : {}}
              >
                <Cpu className="w-3 h-3 mr-1" />
                {tensorFlowReady ? 'TensorFlow Ready' : 'TensorFlow Loading...'}
              </motion.div>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            Advanced analysis for {getDisplayLabel()} ({filteredStats?.totalReadings || 0} readings)
            {tensorFlowEnabled && tensorFlowReady && (
              <span className="block sm:inline sm:ml-2 text-blue-600 dark:text-blue-400">
                • Private & Fast AI Processing
              </span>
            )}
          </p>
          {dataSpanInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
            </p>
          )}
          {tensorFlowError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              TensorFlow Error: {tensorFlowError}
            </p>
          )}
        </div>
        
        {/* Time Selection Controls */}
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
          
          <motion.button 
            onClick={() => {
              if (isCustomRange) {
                handleCustomDateSubmit();
              } else {
                const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, 14)), { label: 'AIInsights refresh fetch data' });
              }
            }}
            className={
              isPremium
                ? "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center transition-all duration-200 shadow-lg"
                : "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            }
            whileHover={isPremium ? { scale: 1.05 } : {}}
            whileTap={isPremium ? { scale: 0.95 } : {}}
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh Data
          </motion.button>
          
          <motion.button 
            onClick={handleRefreshAI}
            className={
              isPremium
                ? "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center justify-center transition-all duration-200 shadow-lg"
                : "w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded flex items-center justify-center hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
            }
            whileHover={isPremium ? { scale: 1.05 } : {}}
            whileTap={isPremium ? { scale: 0.95 } : {}}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI
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
                if (isCustomRange) {
                  setIsCustomRange(false);
                }
              }}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 sm:p-6 rounded-xl shadow-md text-white">
          <div className="flex items-center mb-3 sm:mb-4">
            <Brain className="h-6 w-6 sm:h-7 sm:w-7 mr-2 sm:mr-3" />
            <h3 className="text-lg sm:text-xl font-bold">AI-Powered Glucose Analysis</h3>
          </div>
          <p className="mb-4 text-sm sm:text-base leading-relaxed">
            Our advanced AI analyzes your glucose patterns to provide personalized insights and recommendations. 
            The analysis considers your time in range, variability, and specific patterns to help you optimize 
            your diabetes management, including event-driven safety recommendations for SMB, carb ratio, ISF, and basal settings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-6">
            <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
              <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Pattern Recognition</h4>
              <p className="text-xs sm:text-sm leading-relaxed">
                Identifies recurring patterns in your glucose data and correlates them with time of day, meals, and activities
              </p>
            </div>
            <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
              <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Personalized Insights</h4>
              <p className="text-xs sm:text-sm leading-relaxed">
                Provides tailored observations based on your unique glucose trends and management style
              </p>
            </div>
            <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
              <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Actionable Recommendations</h4>
              <p className="text-xs sm:text-sm leading-relaxed">
                Suggests specific, practical steps you can take to improve your diabetes management
              </p>
            </div>
          </div>
        </div>

        {filteredReadings.length > 0 ? (
          <EnhancedAIInsightsPanel 
            readings={filteredReadings} 
            timeInRange={filteredStats || {
              timeInRange: 0,
              highPercentage: 0,
              lowPercentage: 0
            }}
            manualRefresh={manualRefresh}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Data Available</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please select a time period with glucose data to generate AI insights.
            </p>
          </div>
        )}

        {eventInsights.period.totalReadings > 0 && (
          <GlucoseEventInsightsPanel
            insights={eventInsights}
            focus="openaps"
            title="Event Intelligence • Selected Period"
          />
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">How AI Analysis Works</h3>
        
        <div className="space-y-4">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-lg mr-4">
              1
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Data Processing</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Your glucose data is securely processed and analyzed for patterns, variability, and trends
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-lg mr-4">
              2
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">AI Analysis</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Advanced machine learning algorithms identify meaningful patterns and correlations in your data
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-lg mr-4">
              3
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Personalized Insights</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                The AI generates tailored insights and recommendations based on your unique data
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-lg mr-4">
              4
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Continuous Learning</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                The system improves over time as it analyzes more of your data and learns from your patterns
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> All AI analysis is performed securely and your data is never stored on external servers. 
            Always consult with your healthcare provider before making changes to your diabetes management.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsights;