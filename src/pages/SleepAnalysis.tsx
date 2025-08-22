import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Moon, Calendar, Clock, Bed, Sunrise, Brain, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { toMmol } from '../utils/glucoseUtils';
import { aiService } from '../services/aiService';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../contexts/ThemeContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SleepAnalysis = () => {
  const { data, loading, error, fetchDataForDays } = useNightscout();
  const { theme } = useTheme();
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const isDark = theme === 'dark';
  const [sleepAnalysis, setSleepAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);
  
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

  // Get night-time readings
  const nightReadings = React.useMemo(() => {
    return filteredReadings.filter(reading => {
      const hour = new Date(reading.date).getHours();
      return hour >= 22 || hour < 6;
    });
  }, [filteredReadings]);

  useEffect(() => {
    const analyzeSleep = async () => {
      if (!filteredReadings.length) return;
      
      // Only analyze if manual refresh is triggered or we don't have analysis yet
      if (!sleepAnalysis || manualRefresh) {
        setAiLoading(true);
        setAiError(null);
        
        try {
          const result = await aiService.analyzeSleepPatterns(filteredReadings, { unit, formatGlucoseValue, getUnitLabel });
          setSleepAnalysis(result);
          // Reset manual refresh flag
          if (manualRefresh) setManualRefresh(false);
        } catch (err) {
          console.error('Error analyzing sleep patterns:', err);
          setAiError('An error occurred while analyzing sleep patterns.');
        } finally {
          setAiLoading(false);
        }
      }
    };
    
    analyzeSleep();
  }, [filteredReadings, manualRefresh]);

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

  // Prepare chart data for night-time glucose patterns
  const nightChartData = React.useMemo(() => {
    if (!nightReadings.length) return null;
    
    // Group readings by hour
    const hourlyReadings: {[key: number]: number[]} = {};
    
    for (let i = 0; i < 24; i++) {
      hourlyReadings[i] = [];
    }
    
    nightReadings.forEach(reading => {
      const hour = new Date(reading.date).getHours();
      hourlyReadings[hour].push(reading.sgv);
    });
    
    // Calculate hourly averages
    const hourlyAverages = Object.entries(hourlyReadings).map(([hour, values]) => {
      if (values.length === 0) return { hour: parseInt(hour), avg: null, stdDev: null };
      
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Calculate standard deviation
      const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      return { 
        hour: parseInt(hour), 
        avg: unit === 'mgdl' ? avg : toMmol(avg),
        stdDev: unit === 'mgdl' ? stdDev : toMmol(stdDev)
      };
    }).filter(h => h.avg !== null);
    
    // Create night-time hours array (22-23, 0-5)
    const nightHours = [22, 23, 0, 1, 2, 3, 4, 5];
    
    // Get data for night hours only
    const labels = nightHours.map(h => `${h}:00`);
    const avgData = nightHours.map(h => {
      const hourData = hourlyAverages.find(data => data.hour === h);
      return hourData ? hourData.avg : null;
    });
    const stdDevData = nightHours.map(h => {
      const hourData = hourlyAverages.find(data => data.hour === h);
      return hourData ? hourData.stdDev : null;
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Average Glucose',
          data: avgData,
          borderColor: isDark ? 'rgb(96, 165, 250)' : 'rgb(59, 130, 246)',
          backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Variability (±SD)',
          data: stdDevData,
          borderColor: isDark ? 'rgb(251, 191, 36)' : 'rgb(245, 158, 11)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0.1
        }
      ]
    };
  }, [nightReadings, isDark]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: `Glucose (${getUnitLabel()})`,
          color: isDark ? '#e5e7eb' : '#111827'
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Hour of Night',
          color: isDark ? '#e5e7eb' : '#111827'
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      }
    }
  };

  if (loading || aiLoading) return <LoadingSpinner message={aiLoading ? "Analyzing sleep patterns..." : "Loading data..."} />;

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sleep Pattern Analysis</h2>
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

      {/* Sleep Analysis Overview */}
      {sleepAnalysis ? (
        <div className="space-y-6">
          {/* Sleep Quality Score */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-white">
              <div className="flex items-center mb-4">
                <Moon className="h-7 w-7 mr-3" />
                <h3 className="text-xl font-bold">Sleep Quality Analysis</h3>
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
                        strokeDashoffset={283 - (283 * sleepAnalysis.sleepQualityScore / 100)}
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
                        {sleepAnalysis.sleepQualityScore}
                      </text>
                      <text 
                        x="50" 
                        y="65" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize="10"
                      >
                        Sleep Score
                      </text>
                    </svg>
                  </div>
                  <p className="mt-2 text-sm">
                    {sleepAnalysis.sleepQualityScore >= 80 ? 'Excellent' : 
                     sleepAnalysis.sleepQualityScore >= 60 ? 'Good' : 
                     sleepAnalysis.sleepQualityScore >= 40 ? 'Fair' : 'Poor'}
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium opacity-80">Dawn Phenomenon</h4>
                    <div className="flex items-center">
                      <Sunrise className="h-5 w-5 mr-2" />
                      <span className="text-xl font-bold">
                        {sleepAnalysis.dawnPhenomenon > 0 ? '+' : ''}{formatGlucoseValue(sleepAnalysis.dawnPhenomenon)}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium opacity-80">Sleep Disruptions</h4>
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      <span className="text-xl font-bold">
                        {sleepAnalysis.sleepDisruptions} detected
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Key Insight</h4>
                  <p className="text-sm">
                    {sleepAnalysis.insights?.[0] || 'AI-powered analysis of your unique sleep patterns'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Night-time Glucose Chart */}
          {nightChartData && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Bed className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Night-time Glucose Patterns</h3>
              </div>
              
              <div className="h-64 mb-4">
                <Line data={nightChartData} options={chartOptions} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-2">Evening (22:00-00:00)</h4>
                  <p className="text-indigo-800 dark:text-indigo-200 text-sm">
                    {sleepAnalysis.dawnPhenomenon < 0 ? 
                      'Glucose tends to be higher in the evening than early morning.' : 
                      'Glucose typically starts to stabilize as you prepare for sleep.'}
                  </p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-2">Middle of Night (00:00-04:00)</h4>
                  <p className="text-indigo-800 dark:text-indigo-200 text-sm">
                    {sleepAnalysis.sleepDisruptions > 2 ? 
                      'Multiple glucose fluctuations detected during deep sleep hours.' : 
                      'This is typically your most stable glucose period.'}
                  </p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-2">Early Morning (04:00-06:00)</h4>
                  <p className="text-indigo-800 dark:text-indigo-200 text-sm">
                    {(() => {
                      // Convert threshold based on unit (1.5 mmol/L ≈ 27 mg/dL)
                      const threshold = unit === 'mgdl' ? 27 : 1.5;
                      const dawnValue = sleepAnalysis.dawnPhenomenon;
                      
                      if (dawnValue > threshold) {
                        return `Significant dawn phenomenon detected (+${formatGlucoseValue(dawnValue)} rise).`;
                      } else if (dawnValue > 0) {
                        return `Mild dawn effect observed (+${formatGlucoseValue(dawnValue)}).`;
                      } else {
                        return 'No significant dawn phenomenon detected.';
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Sleep Insights</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sleepAnalysis.insights?.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">Sleep Pattern Insights</h4>
                  <ul className="space-y-2">
                    {sleepAnalysis.insights.map((insight: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {sleepAnalysis.recommendations?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Sleep Recommendations</h4>
                  <ul className="space-y-2">
                    {sleepAnalysis.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Sleep Optimization Strategies */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Sleep Optimization Strategies</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">For Dawn Phenomenon</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                    <span>Consider increasing basal insulin between 3-6 AM</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                    <span>Avoid high-fat or high-protein snacks before bed</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                    <span>Experiment with different basal rate patterns</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                    <span>Consider using a temporary higher basal rate starting at 3 AM</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">For Better Sleep Quality</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Aim for glucose between {unit === 'mgdl' ? '90-144 mg/dL' : '5-8 mmol/L'} before bed</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Maintain consistent sleep and wake times</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Avoid caffeine and alcohol close to bedtime</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span>Consider using a higher target range overnight in closed loop systems</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Important Note</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Poor sleep quality and glucose management can create a vicious cycle. Hypoglycemia and hyperglycemia can disrupt sleep, while poor sleep can worsen insulin resistance and glucose control. Breaking this cycle often requires addressing both aspects simultaneously.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Moon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Sleep Data Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            To analyze sleep patterns, we need continuous glucose monitoring data during night hours (10 PM - 6 AM). Please ensure your CGM is active during sleep for accurate analysis.
          </p>
        </div>
      )}
    </div>
  );
};

export default SleepAnalysis;