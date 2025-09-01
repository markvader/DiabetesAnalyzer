import React, { useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import GlucoseChart from '../components/GlucoseChart';
import LoadingSpinner from '../components/LoadingSpinner';

const GlucoseChartPage = () => {
  const { data, loading, error } = useNightscout();
  const [timeRange, setTimeRange] = useState(24);
  const [showInsulinDelivery, setShowInsulinDelivery] = useState(true);

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
          Detailed view of your glucose readings over time with optional insulin delivery overlays
        </p>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          <p>Nightscout-style treatment visualization:</p>
          <div className="flex flex-wrap gap-4 mt-1">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full inline-block mr-1"></span>
              SMBs (green dots on glucose line)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-2 bg-blue-500 inline-block mr-1"></span>
              Insulin boluses (compact blue bars)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-2 bg-amber-500 inline-block mr-1"></span>
              Carbs (compact orange bars)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-purple-500 rounded-sm inline-block mr-1"></span>
              Temp basals (purple markers at bottom)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
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
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Display Options
          </label>
          <div className="mt-1 flex items-center">
            <input
              type="checkbox"
              id="showInsulinDelivery"
              checked={showInsulinDelivery}
              onChange={(e) => setShowInsulinDelivery(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <label htmlFor="showInsulinDelivery" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              Show insulin delivery (SMBs, Boluses, Temp Basals)
            </label>
          </div>
        </div>
      </div>

      {data?.entries && (
        <GlucoseChart
          readings={data.entries.filter(reading => 
            (Date.now() - reading.date) <= timeRange * 60 * 60 * 1000
          )}
          treatments={data.treatments?.filter(treatment => {
            const treatmentTime = new Date(treatment.created_at).getTime();
            return (Date.now() - treatmentTime) <= timeRange * 60 * 60 * 1000;
          }) || []}
          title={`Blood Glucose - Last ${getTimeWindowLabel(timeRange)}`}
          showInsulinDelivery={showInsulinDelivery}
        />
      )}
    </div>
  );
};

export default GlucoseChartPage;