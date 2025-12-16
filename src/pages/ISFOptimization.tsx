import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { format, subDays, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { Brain, Calendar, Clock, AlertTriangle, Thermometer, Calculator, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { aiService } from '../services/aiService';
import { formatCostEstimate, getModelById } from '../constants/openaiModels';

const ISFOptimization = () => {
  const { data, loading, error } = useNightscout();
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const { formatTimeString, formatDateTime } = useTimeFormat();
  const [isfAnalysis, setIsfAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Time selection state
  const [timeWindow, setTimeWindow] = useState(336); // Default to 2 weeks (336 hours)
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  // Note: Removed lastTimeWindow and lastCustomRange state as they're no longer needed
  // since we removed automatic refresh on time window changes

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

  // Note: Automatically loads ISF analysis on initial page load (2 weeks default)
  // Manual refresh required for other time periods to control AI API costs

  useEffect(() => {
    const analyzeISF = async () => {
      if (!filteredReadings.length || !filteredTreatments.length || !data?.profile?.length) return;
      
      // Run automatically on initial load (default 2 weeks) or when manual refresh is triggered
      if (!hasInitialLoad || manualRefresh) {
        setAiLoading(true);
        setAiError(null);
        
        try {
          // Get current profile
          const profiles = data.profile;
          let currentProfile = null;
          
          if (profiles?.length > 0) {
            const activeProfile = profiles[0];
            const defaultProfile = activeProfile.defaultProfile || 'Default';
            currentProfile = activeProfile.store?.[defaultProfile];
          }
          
          if (!currentProfile) {
            setAiError('No profile data available for ISF optimization.');
            setAiLoading(false);
            return;
          }
          
          const result = await aiService.optimizeInsulinSensitivity(filteredReadings, filteredTreatments, currentProfile, { unit, formatGlucoseValue, getUnitLabel });
          setIsfAnalysis(result);
          
          // Mark initial load as complete and reset manual refresh flag
          if (!hasInitialLoad) {
            setHasInitialLoad(true);
          }
          if (manualRefresh) {
            setManualRefresh(false);
          }
        } catch (err) {
          console.error('Error optimizing ISF:', err);
          setAiError('An error occurred while optimizing insulin sensitivity factors.');
        } finally {
          setAiLoading(false);
        }
      }
    };
    
    analyzeISF();
  }, [filteredReadings, filteredTreatments, data?.profile, manualRefresh, hasInitialLoad, unit]);

  // Convert ISF values to current unit
  const convertedISFAnalysis = React.useMemo(() => {
    if (!isfAnalysis) return null;

    const convertISFValue = (value: number) => {
      // ISF values are typically stored in mmol/L/U
      // Convert to mg/dL/U if user prefers mg/dL
      if (unit === 'mgdl' && typeof value === 'number') {
        return Math.round(value * 18); // Convert mmol/L/U to mg/dL/U
      }
      return value;
    };

    const convertISFArray = (isfArray: any[]) => {
      if (!isfArray) return [];
      return isfArray.map(item => ({
        ...item,
        rate: convertISFValue(item.rate),
        calculatedISF: convertISFValue(item.calculatedISF)
      }));
    };

    return {
      ...isfAnalysis,
      isfSuggestions: convertISFArray(isfAnalysis.isfSuggestions),
      calculatedISFs: convertISFArray(isfAnalysis.calculatedISFs)
    };
  }, [isfAnalysis, unit]);

  // Helper functions
  const getUsageLabel = () => {
    if (!convertedISFAnalysis?.provider || !convertedISFAnalysis?.model) return null;

    const modelInfo = getModelById(convertedISFAnalysis.model);
    const modelLabel = modelInfo?.name || convertedISFAnalysis.model;
    const tokens = convertedISFAnalysis.tokenUsage;

    const tokensLabel =
      tokens && (tokens.inputTokens > 0 || tokens.outputTokens > 0)
        ? `${tokens.inputTokens} in / ${tokens.outputTokens} out`
        : null;
    const costLabel =
      convertedISFAnalysis.costUSD != null
        ? `Cost ${formatCostEstimate(convertedISFAnalysis.costUSD)}`
        : null;

    const parts = [`${convertedISFAnalysis.provider} • ${modelLabel}`];
    if (tokensLabel) parts.push(tokensLabel);
    if (costLabel) parts.push(costLabel);
    return parts.join(' • ');
  };

  const timeWindowOptions = [
    { value: 168, label: '1 Week' },
    { value: 336, label: '2 Weeks' },
    { value: 504, label: '3 Weeks' },
    { value: 720, label: '1 Month' },
    { value: 1440, label: '2 Months' },
    { value: 2160, label: '3 Months' }
  ];

  const handleTimeWindowChange = (hours: number) => {
    setTimeWindow(hours);
    setIsCustomRange(false);
  };

  const handleCustomRangeSubmit = () => {
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Format time for display - uses user's preferred time format
  const formatTime = (timeStr: string) => {
    return formatTimeString(timeStr);
  };

  // Handle manual refresh
  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || aiLoading) return <LoadingSpinner message={aiLoading ? "Optimizing insulin sensitivity factors..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ISF Optimization</h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered insulin sensitivity factor analysis and optimization
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Time Period Selection */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <select
              value={isCustomRange ? 'custom' : timeWindow}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setShowCalendar(true);
                } else {
                  handleTimeWindowChange(Number(e.target.value));
                }
              }}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {timeWindowOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <button 
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI Analysis
          </button>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Select Date Range</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCalendar(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomRangeSubmit}
                className="flex-1 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Display */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            {isCustomRange ? (
              <>Analyzing custom range: {format(new Date(customDateRange.startDate), 'MMM dd, yyyy')} - {format(new Date(customDateRange.endDate), 'MMM dd, yyyy')}</>
            ) : (
              <>Analyzing last {timeWindowOptions.find(opt => opt.value === timeWindow)?.label.toLowerCase()} of data</>
            )}
            {filteredReadings && filteredReadings.length > 0 && (
              <span className="ml-2">({filteredReadings.length} glucose readings, {filteredTreatments?.length || 0} treatments)</span>
            )}
          </p>
        </div>
      </div>

      {aiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-2" />
            <p className="text-red-700 dark:text-red-400">{aiError}</p>
          </div>
        </div>
      )}

      {/* ISF Optimization Overview */}
      {isfAnalysis ? (
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-white">
              <div className="flex items-center mb-4">
                <Thermometer className="h-7 w-7 mr-3" />
                <h3 className="text-xl font-bold">Insulin Sensitivity Factor Optimization</h3>
              </div>
              <p className="mb-4">
                Your Insulin Sensitivity Factor (ISF) determines how much your blood glucose will drop in response to 1 unit of insulin. Optimizing this value is crucial for accurate correction boluses and automated insulin delivery systems.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Correction Boluses</h4>
                  <p className="text-2xl font-bold">{isfAnalysis.calculatedISFs?.length || 0}</p>
                  <p className="text-sm">Analyzed for ISF calculation</p>
                </div>
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Time Periods</h4>
                  <p className="text-2xl font-bold">{isfAnalysis.isfSuggestions?.length || 0}</p>
                  <p className="text-sm">With optimized ISF values</p>
                </div>
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Key Insight</h4>
                  <p className="text-sm">
                    {isfAnalysis.insights?.[0] || 'AI-powered optimization of your insulin sensitivity factors'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered ISF Insights</h3>
                {getUsageLabel() && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getUsageLabel()}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {convertedISFAnalysis?.insights?.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">ISF Pattern Insights</h4>
                  <ul className="space-y-2">
                    {convertedISFAnalysis.insights.map((insight: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {convertedISFAnalysis?.recommendations?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">ISF Recommendations</h4>
                  <ul className="space-y-2">
                    {convertedISFAnalysis.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {convertedISFAnalysis?.details && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {showDetails ? 'Hide details' : 'More details'}
                </button>

                {showDetails && (
                  <div className="mt-3 space-y-3 text-sm">
                    {convertedISFAnalysis.details.executiveSummary && (
                      <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-gray-100">Executive summary</p>
                        <p className="text-gray-700 dark:text-gray-300">{convertedISFAnalysis.details.executiveSummary}</p>
                      </div>
                    )}

                    {Array.isArray(convertedISFAnalysis.details.safetyFlags) && convertedISFAnalysis.details.safetyFlags.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <p className="font-medium text-red-900 dark:text-red-100">Safety flags</p>
                        <ul className="list-disc ml-5 text-red-800 dark:text-red-200">
                          {convertedISFAnalysis.details.safetyFlags.map((flag: string, i: number) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(convertedISFAnalysis.details.actionPlan7Days) && convertedISFAnalysis.details.actionPlan7Days.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="font-medium text-blue-900 dark:text-blue-100">7-day plan</p>
                        <ul className="list-disc ml-5 text-blue-800 dark:text-blue-200">
                          {convertedISFAnalysis.details.actionPlan7Days.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(convertedISFAnalysis.details.dataQualityNotes) && convertedISFAnalysis.details.dataQualityNotes.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <p className="font-medium text-yellow-900 dark:text-yellow-100">Data quality notes</p>
                        <ul className="list-disc ml-5 text-yellow-800 dark:text-yellow-200">
                          {convertedISFAnalysis.details.dataQualityNotes.map((note: string, i: number) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ISF Suggestions Table */}
          {convertedISFAnalysis?.isfSuggestions?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Optimized ISF Values</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Current ISF
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Suggested ISF
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {convertedISFAnalysis.isfSuggestions.map((isf: any, index: number) => {
                      // Find current ISF for this time
                      const currentProfile = data?.profile?.[0]?.store?.[data.profile[0].defaultProfile || 'Default'];
                      const currentIsf = currentProfile?.sens?.find((s: any) => s.time === isf.time)?.value || 0;
                      
                      // Convert current ISF to display unit
                      const convertedCurrentIsf = unit === 'mgdl' ? Math.round(currentIsf * 18) : currentIsf;
                      
                      // Calculate change percentage
                      const changePercent = convertedCurrentIsf ? ((isf.rate - convertedCurrentIsf) / convertedCurrentIsf) * 100 : 0;
                      
                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatTime(isf.time)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {convertedCurrentIsf} {getUnitLabel()}/U
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                            {isf.rate} {getUnitLabel()}/U
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`${
                              changePercent > 5 ? 'text-green-600 dark:text-green-400' :
                              changePercent < -5 ? 'text-red-600 dark:text-red-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                              {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Calculated ISF Data */}
          {convertedISFAnalysis?.calculatedISFs?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Calculator className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">ISF Calculation Data</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Insulin
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Pre-Glucose
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Post-Glucose
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Drop
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Calculated ISF
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {convertedISFAnalysis.calculatedISFs.slice(0, 10).map((calc: any, index: number) => {
                      // Check if time is a valid date string
                      const isValidDate = calc.time && !isNaN(new Date(calc.time).getTime());
                      
                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {isValidDate ? formatDateTime(new Date(calc.time)) : 'Invalid date'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {calc.insulin}U
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatGlucoseValue(calc.preGlucose, unit, true)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatGlucoseValue(calc.postGlucose, unit, true)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatGlucoseValue(calc.drop, unit, true)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                            {calc.calculatedISF} {getUnitLabel()}/U
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {convertedISFAnalysis.calculatedISFs.length > 10 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Showing 10 of {convertedISFAnalysis.calculatedISFs.length} calculations
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Implementation Guidance */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Implementation Guidance</h3>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Safety First Approach</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Always implement ISF changes gradually and conservatively. Start with small adjustments (5-10%) and monitor closely before making additional changes.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Testing New ISF Values</h4>
                  <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <li>• Start with one time period at a time</li>
                    <li>• Use small correction boluses to test</li>
                    <li>• Document results for each test</li>
                    <li>• Wait at least 4 hours between tests</li>
                    <li>• Avoid testing during or after exercise</li>
                  </ul>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Monitoring & Adjusting</h4>
                  <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
                    <li>• Check for post-correction lows</li>
                    <li>• Verify correction effectiveness</li>
                    <li>• Adjust in 5-10% increments</li>
                    <li>• Re-analyze after 1-2 weeks</li>
                    <li>• Consider seasonal variations</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Factors Affecting ISF</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm text-purple-800 dark:text-purple-200">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Time of day</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Physical activity</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Stress levels</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Hormonal cycles</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Illness/inflammation</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-2"></span>
                    <span>Sleep quality</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">ISF Optimization</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {(!filteredReadings.length || !filteredTreatments.length) ? (            "Insufficient data for analysis. Please ensure you have glucose readings and treatment data for the selected time period."
          ) : hasInitialLoad ? (
            "No ISF analysis available. Click 'Refresh AI' to run analysis for the current time period."
          ) : (
            "Loading ISF analysis for the last 2 weeks..."
          )}
          </p>
          {(filteredReadings.length && filteredTreatments.length && hasInitialLoad) && (
            <button 
              onClick={handleRefreshAI}
              className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center mx-auto transition-colors duration-200"
            >
              <Brain className="w-5 h-5 mr-2" />
              Refresh AI Analysis
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ISFOptimization;