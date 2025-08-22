import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import AdvancedStats from '../components/AdvancedStats';
import LoadingSpinner from '../components/LoadingSpinner';
import { Calendar, Clock } from 'lucide-react';

const AdvancedStatsPage = () => {
  const { data, loading, error, fetchDataForDays, forceRefresh } = useNightscout();
  
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
  const [lastTimeWindow, setLastTimeWindow] = useState<number | null>(null);
  const [lastCustomRange, setLastCustomRange] = useState<{startDate: string, endDate: string} | null>(null);

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
      // Store the previous time window to detect changes
      setLastTimeWindow(timeWindow);
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
    
    // Store the previous custom range to detect changes
    setLastCustomRange({
      startDate: customDateRange.startDate,
      endDate: customDateRange.endDate
    });
    
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

  if (loading) return <LoadingSpinner />;

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Advanced Statistics</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed statistical analysis for {getDisplayLabel()} ({filteredReadings.length} readings)
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
            Refresh
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

      {/* Debug Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📊 Statistics Info:</h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>🔍 Analyzing {filteredReadings.length} glucose readings for {getDisplayLabel()}</p>
          {dataSpanInfo && (
            <p>📈 Total available: {dataSpanInfo.totalReadings} readings spanning {dataSpanInfo.spanDays} days</p>
          )}
        </div>
      </div>

      {/* Advanced Statistics */}
      {filteredReadings.length > 0 ? (
        <div className="space-y-6">
          <AdvancedStats readings={filteredReadings} />
          
          <div className="bg-gray-800 dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4 text-gray-100 dark:text-gray-100">Understanding the Metrics</h3>
            <dl className="space-y-4">
              <div>
                <dt className="font-medium text-gray-100 dark:text-gray-100">Standard Deviation</dt>
                <dd className="text-gray-300 dark:text-gray-300">Measures the amount of variation in your glucose levels.</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-100 dark:text-gray-100">Glycemic Variability</dt>
                <dd className="text-gray-300 dark:text-gray-300">Shows how stable your glucose levels are over time.</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-100 dark:text-gray-100">Rate of Change</dt>
                <dd className="text-gray-300 dark:text-gray-300">Indicates how quickly your glucose levels are changing.</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No data available for the selected time period</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Try selecting a different time range or fetching more data</p>
        </div>
      )}
    </div>
  );
};

export default AdvancedStatsPage;