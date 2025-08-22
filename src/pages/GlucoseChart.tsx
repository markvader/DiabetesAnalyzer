import React, { useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import GlucoseChart from '../components/GlucoseChart';
import LoadingSpinner from '../components/LoadingSpinner';

const GlucoseChartPage = () => {
  const { data, loading, error } = useNightscout();
  const [timeRange, setTimeRange] = useState(24);

  // Helper function to get time window label
  const getTimeWindowLabel = (hours: number) => {
    if (hours < 24) {
      return `${hours} hours`;
    } else {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    }
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
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Glucose Chart</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Detailed view of your glucose readings over time
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Time Range
        </label>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
        >
          <option value={6}>Last 6 hours</option>
          <option value={12}>Last 12 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={48}>Last 2 days</option>
          <option value={72}>Last 3 days</option>
          <option value={96}>Last 4 days</option>
          <option value={120}>Last 5 days</option>
          <option value={144}>Last 6 days</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>

      {data?.entries && (
        <GlucoseChart
          readings={data.entries.filter(reading => 
            (Date.now() - reading.date) <= timeRange * 60 * 60 * 1000
          )}
          title={`Blood Glucose - Last ${getTimeWindowLabel(timeRange)}`}
        />
      )}
    </div>
  );
};

export default GlucoseChartPage;