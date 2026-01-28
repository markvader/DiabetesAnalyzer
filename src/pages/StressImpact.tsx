import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Brain, Calendar, Clock, AlertTriangle, Activity, TrendingUp, Heart, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { aiService } from '../services/aiService';
import { formatCostEstimate, getModelById } from '../constants/openaiModels';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';

type StressAnalysisResult = Awaited<ReturnType<typeof aiService.analyzeStressImpact>>;

const StressImpact = () => {
  const { data, loading, error, fetchDataForDays } = useNightscout();
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const [stressAnalysis, setStressAnalysis] = useState<StressAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
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

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => a.date - b.date);
  }, [data?.entries]);

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
    if (!entriesSortedAsc.length) return [];
    return sliceSortedByTimeRange(entriesSortedAsc, (reading) => reading.date, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  useEffect(() => {
    const analyzeStress = async () => {
      if (!filteredReadings.length) return;
      
      // Only analyze if manual refresh is triggered or we don't have analysis yet
      if (!stressAnalysis || manualRefresh) {
        setAiLoading(true);
        setAiError(null);
        
        try {
          const result = await aiService.analyzeStressImpact(filteredReadings, { unit, formatGlucoseValue, getUnitLabel });
          setStressAnalysis(result);
          // Reset manual refresh flag
          if (manualRefresh) setManualRefresh(false);
        } catch (err) {
          console.error('Error analyzing stress impact:', err);
          setAiError('An error occurred while analyzing stress impact.');
        } finally {
          setAiLoading(false);
        }
      }
    };
    
    runSafeAsync(() => analyzeStress(), { label: 'StressImpact analyzeStress effect' });
  }, [filteredReadings, manualRefresh, stressAnalysis, unit, formatGlucoseValue, getUnitLabel]);

  // Helper functions
  const getUsageLabel = () => {
    if (!stressAnalysis?.provider || !stressAnalysis?.model) return null;

    const modelInfo = getModelById(stressAnalysis.model);
    const modelLabel = modelInfo?.name || stressAnalysis.model;
    const tokens = stressAnalysis.tokenUsage;

    const tokensLabel =
      tokens && (tokens.inputTokens > 0 || tokens.outputTokens > 0)
        ? `${tokens.inputTokens} in / ${tokens.outputTokens} out`
        : null;
    const costLabel =
      stressAnalysis.costUSD != null
        ? `Cost ${formatCostEstimate(stressAnalysis.costUSD)}`
        : null;

    const parts = [`${stressAnalysis.provider} • ${modelLabel}`];
    if (tokensLabel) parts.push(tokensLabel);
    if (costLabel) parts.push(costLabel);
    return parts.join(' • ');
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
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'StressImpact fetch more data for time window' });
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
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'StressImpact fetch data for custom range' });
    
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

  // Handle manual refresh
  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || aiLoading) return <LoadingSpinner message={aiLoading ? "Analyzing stress impact..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stress Impact Analysis</h2>
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
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, 14)), { label: 'StressImpact refresh fetch data' });
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

      {/* Stress Impact Overview */}
      {stressAnalysis ? (
        <div className="space-y-6">
          {/* Stress Impact Score */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-white">
              <div className="flex items-center mb-4">
                <Heart className="h-7 w-7 mr-3" />
                <h3 className="text-xl font-bold">Stress Impact Analysis</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.2)" 
                        strokeWidth="10" 
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.8)" 
                        strokeWidth="10" 
                        strokeDasharray="283" 
                        strokeDashoffset={283 - (283 * stressAnalysis.stressImpactScore / 100)}
                        transform="rotate(-90 50 50)"
                      />
                      <text 
                        x="50" 
                        y="50" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize="24" 
                        fontWeight="bold"
                      >
                        {stressAnalysis.stressImpactScore}
                      </text>
                      <text 
                        x="50" 
                        y="65" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize="10"
                      >
                        Stress Impact
                      </text>
                    </svg>
                  </div>
                  <p className="mt-2 text-sm">
                    {stressAnalysis.stressImpactScore >= 80 ? 'Very High' : 
                     stressAnalysis.stressImpactScore >= 60 ? 'High' : 
                     stressAnalysis.stressImpactScore >= 40 ? 'Moderate' : 
                     stressAnalysis.stressImpactScore >= 20 ? 'Low' : 'Minimal'}
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium opacity-80">Rapid Rises</h4>
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      <span className="text-xl font-bold">
                        {stressAnalysis.rapidRises} detected
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium opacity-80">Glucose Variability</h4>
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      <span className="text-xl font-bold">
                        {stressAnalysis.variability}% CV
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Key Insight</h4>
                  <p className="text-sm">
                    {stressAnalysis.insights?.[0] || 'AI-powered analysis of stress impact on your glucose patterns'}
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Stress Insights</h3>
                {getUsageLabel() && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getUsageLabel()}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stressAnalysis.insights?.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">Stress Pattern Insights</h4>
                  <ul className="space-y-2">
                    {stressAnalysis.insights.map((insight: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {stressAnalysis.recommendations?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Stress Management Recommendations</h4>
                  <ul className="space-y-2">
                    {stressAnalysis.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {stressAnalysis.details && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {showDetails ? 'Hide details' : 'More details'}
                </button>

                {showDetails && (
                  <div className="mt-3 space-y-3 text-sm">
                    {stressAnalysis.details.executiveSummary && (
                      <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-gray-100">Executive summary</p>
                        <p className="text-gray-700 dark:text-gray-300">{stressAnalysis.details.executiveSummary}</p>
                      </div>
                    )}

                    {Array.isArray(stressAnalysis.details.safetyFlags) && stressAnalysis.details.safetyFlags.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <p className="font-medium text-red-900 dark:text-red-100">Safety flags</p>
                        <ul className="list-disc ml-5 text-red-800 dark:text-red-200">
                          {stressAnalysis.details.safetyFlags.map((flag: string, i: number) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(stressAnalysis.details.actionPlan7Days) && stressAnalysis.details.actionPlan7Days.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="font-medium text-blue-900 dark:text-blue-100">7-day plan</p>
                        <ul className="list-disc ml-5 text-blue-800 dark:text-blue-200">
                          {stressAnalysis.details.actionPlan7Days.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(stressAnalysis.details.dataQualityNotes) && stressAnalysis.details.dataQualityNotes.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <p className="font-medium text-yellow-900 dark:text-yellow-100">Data quality notes</p>
                        <ul className="list-disc ml-5 text-yellow-800 dark:text-yellow-200">
                          {stressAnalysis.details.dataQualityNotes.map((note: string, i: number) => (
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

          {/* Potential Stress Times */}
          {stressAnalysis.potentialStressTimes?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Potential Stress Periods</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stressAnalysis.potentialStressTimes.map((time, index: number) => (
                  <div key={index} className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">{time.timeOfDay}</h4>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                      {time.startHour}:00 - {time.endHour}:00
                    </p>
                    <div className="flex items-center">
                      <span className="text-sm text-orange-700 dark:text-orange-300 mr-2">Variability:</span>
                      <span className="font-medium text-orange-900 dark:text-orange-100">
                        {time.variability}% CV
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stress Management Strategies */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Stress Management Strategies</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Immediate Interventions</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-red-600 dark:text-red-400 mr-2">•</span>
                    <span>Use temporary basal rate increases during high-stress periods</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 dark:text-red-400 mr-2">•</span>
                    <span>Consider small correction boluses for stress-induced hyperglycemia</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 dark:text-red-400 mr-2">•</span>
                    <span>Practice deep breathing or progressive muscle relaxation</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 dark:text-red-400 mr-2">•</span>
                    <span>Monitor more frequently during high-stress events</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Long-term Strategies</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
                    <span>Regular mindfulness meditation or yoga practice</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
                    <span>Consistent physical activity to reduce stress hormones</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
                    <span>Adequate sleep and regular sleep schedule</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
                    <span>Consider stress management therapy or counseling</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">The Stress-Glucose Connection</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Stress hormones like cortisol and adrenaline can cause significant glucose rises by triggering glycogen release from the liver and increasing insulin resistance. This "fight or flight" response can persist for hours after a stressful event, making stress management an essential part of diabetes care.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Analyzing Stress Impact</h3>
          <p className="text-gray-600 dark:text-gray-400">
            We're analyzing your glucose patterns to identify potential stress impacts. This analysis looks for unexplained glucose rises, increased variability, and patterns that may correlate with stressful periods.
          </p>
        </div>
      )}
    </div>
  );
};

export default StressImpact;