import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Activity, Calendar, Clock, Dumbbell, TrendingDown, TrendingUp, AlertTriangle, Brain, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { aiService } from '../services/aiService';

const ExerciseImpact = () => {
  const { data, loading, error, fetchDataForDays } = useNightscout();
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const [exerciseAnalysis, setExerciseAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  
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

  // Get filtered readings based on time selection
  const filteredReadings = React.useMemo(() => {
    if (!data?.entries?.length) {
      return [];
    }

    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      
      return sortedEntries.filter(reading => {
        return reading.date >= startTime && reading.date <= endTime;
      });
    } else {
      const now = Date.now();
      const timeWindowMs = timeWindow * 60 * 60 * 1000;
      const cutoffTime = now - timeWindowMs;
      
      return sortedEntries.filter(reading => {
        return reading.date >= cutoffTime;
      });
    }
  }, [data?.entries, timeWindow, isCustomRange, customDateRange]);

  // Get filtered treatments based on time selection
  const filteredTreatments = React.useMemo(() => {
    if (!data?.treatments?.length) {
      return [];
    }

    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      
      return data.treatments.filter(treatment => {
        const treatmentTime = new Date(treatment.created_at).getTime();
        return treatmentTime >= startTime && treatmentTime <= endTime;
      });
    } else {
      const now = Date.now();
      const timeWindowMs = timeWindow * 60 * 60 * 1000;
      const cutoffTime = now - timeWindowMs;
      
      return data.treatments.filter(treatment => {
        const treatmentTime = new Date(treatment.created_at).getTime();
        return treatmentTime >= cutoffTime;
      });
    }
  }, [data?.treatments, timeWindow, isCustomRange, customDateRange]);

  useEffect(() => {
    const analyzeExercise = async () => {
      // Skip if no data or already loading
      if (aiLoading || (!filteredReadings.length && !filteredTreatments.length)) {
        return;
      }
      
      // Only analyze if manual refresh is triggered or we don't have analysis yet
      if (!exerciseAnalysis || manualRefresh) {
        try {
          setAiLoading(true);
          setAiError(null);
          
          const result = await aiService.analyzeExerciseImpact(
            filteredReadings, 
            filteredTreatments, 
            { unit, formatGlucoseValue, getUnitLabel }
          );
          
          setExerciseAnalysis(result);
          
          // Reset manual refresh flag
          if (manualRefresh) {
            setManualRefresh(false);
          }
        } catch (err) {
          console.error('Error analyzing exercise impact:', err);
          setAiError(err instanceof Error ? err.message : 'An error occurred while analyzing exercise impact.');
        } finally {
          setAiLoading(false);
        }
      }
    };
    
    // Add a small delay to prevent rapid re-renders
    const timeoutId = setTimeout(analyzeExercise, 100);
    return () => clearTimeout(timeoutId);
  }, [filteredReadings.length, filteredTreatments.length, manualRefresh, unit]);

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
        fetchDataForDays(Math.min(daysNeeded, 90));
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
    fetchDataForDays(Math.min(daysToFetch, 90));
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
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

  // Handle manual refresh
  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || aiLoading) return <LoadingSpinner message={aiLoading ? "Analyzing exercise impact..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">Render Error: {renderError}</p>
        <button 
          onClick={() => setRenderError(null)}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }  try {
    return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Exercise Impact Analysis</h2>
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
            onClick={() => {
              if (isCustomRange) {
                handleCustomDateSubmit();
              } else {
                const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                fetchDataForDays(Math.max(daysNeeded, 14));
              }
            }}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center transition-colors duration-200"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh Data
          </button>
          
          <button 
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI
          </button>
        </div>
      </div>

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

      {aiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-2" />
            <p className="text-red-700 dark:text-red-400">{aiError}</p>
          </div>
        </div>
      )}

      {/* Exercise Impact Overview */}
      {exerciseAnalysis ? (
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-white">
              <div className="flex items-center mb-4">
                <Activity className="h-7 w-7 mr-3" />
                <h3 className="text-xl font-bold">Exercise Impact Analysis</h3>
              </div>
              <p className="mb-4">
                Understanding how different types of exercise affect your glucose levels can help you optimize your diabetes management during and after physical activity.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Exercise Events</h4>
                  <p className="text-2xl font-bold">{exerciseAnalysis?.exerciseTypes?.length || 0}</p>
                  <p className="text-sm">Different activity types analyzed</p>
                </div>
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Glucose Impact</h4>
                  <div className="flex items-center">
                    {exerciseAnalysis?.exerciseTypes?.some((t: any) => (t?.glucoseImpact || 0) < 0) ? (
                      <TrendingDown className="h-6 w-6 text-green-300 mr-2" />
                    ) : (
                      <TrendingUp className="h-6 w-6 text-red-300 mr-2" />
                    )}
                    <p className="text-xl font-bold">
                      {exerciseAnalysis?.exerciseTypes?.some((t: any) => (t?.glucoseImpact || 0) < 0) ? 
                        'Mostly Lowering' : 'Mostly Neutral/Raising'}
                    </p>
                  </div>
                </div>
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Personalized Insights</h4>
                  <p className="text-sm">
                    {exerciseAnalysis?.insights?.[0] || 'AI-powered analysis of your unique exercise patterns'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Exercise Insights</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exerciseAnalysis.insights?.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">Exercise Insights</h4>
                  <ul className="space-y-2">
                    {exerciseAnalysis.insights.map((insight: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {exerciseAnalysis.recommendations?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Exercise Recommendations</h4>
                  <ul className="space-y-2">
                    {exerciseAnalysis.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Exercise Type Analysis */}
          {exerciseAnalysis?.exerciseTypes?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Dumbbell className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Exercise Type Analysis</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exerciseAnalysis.exerciseTypes.map((type: any, index: number) => {
                  if (!type) return null;
                  
                  return (
                    <div key={index} className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">{type.type || 'Unknown Exercise'}</h4>
                      <div className="flex items-center mb-2">
                        <span className="text-green-800 dark:text-green-200 mr-2">Glucose Impact:</span>
                        <span className={`font-medium ${
                          (type.glucoseImpact || 0) < -1 ? 'text-blue-600 dark:text-blue-400' :
                          (type.glucoseImpact || 0) > 1 ? 'text-red-600 dark:text-red-400' :
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {(type.glucoseImpact || 0) > 0 ? '+' : ''}{
                            (() => {
                              const impact = type.glucoseImpact || 0;
                              if (unit === 'mgdl') {
                                return Math.round(impact * 18);
                              } else {
                                return typeof impact === 'number' ? impact.toFixed(1) : '0.0';
                              }
                            })()
                          } {getUnitLabel()}
                        </span>
                      </div>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        {type.recommendation || 'No specific recommendation available'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exercise Strategies */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Exercise Management Strategies</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">For Aerobic Exercise</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-600 dark:text-green-400 mr-2">•</span>
                    <span>Reduce basal insulin by 50-80% during activity</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 dark:text-green-400 mr-2">•</span>
                    <span>Start with glucose above {formatGlucoseValue(126, 'mgdl', true)}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 dark:text-green-400 mr-2">•</span>
                    <span>Consume 15-30g carbs per hour of activity</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 dark:text-green-400 mr-2">•</span>
                    <span>Monitor for delayed hypoglycemia (up to 24 hours later)</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">For Anaerobic/HIIT Exercise</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>May need small correction bolus after intense activity</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Consider temporary higher target during and after</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Watch for glucose rise during activity</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Monitor for delayed drops several hours later</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Important Safety Note</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Always have fast-acting glucose available during exercise. Consider using temporary targets in your closed loop system during and after exercise. Strategies should be personalized based on your specific response patterns.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Exercise Data Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            To analyze exercise impact, please log exercise events in your Nightscout. You can do this by adding treatments with "Exercise" as the event type or including exercise-related keywords in the notes.
          </p>
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error('ExerciseImpact render error:', error);
    setRenderError(error instanceof Error ? error.message : 'Unknown render error');
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">Something went wrong rendering this page.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  }
};

export default ExerciseImpact;