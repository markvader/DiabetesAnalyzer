import React, { useMemo } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { 
  nightscoutTreatmentParser, 
  type ParsedNightscoutData 
} from '../services/nightscoutTreatmentParser';
import { 
  Utensils, 
  Syringe, 
  Activity, 
  Zap, 
  Clock, 
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface NightscoutDataDisplayProps {
  onDataParsed?: (parsedData: ParsedNightscoutData) => void;
  hoursBack?: number;
}

const NightscoutDataDisplay: React.FC<NightscoutDataDisplayProps> = ({ 
  onDataParsed, 
  hoursBack = 12 
}) => {
  const { data, loading, error, lastFetchTime } = useNightscout();
  const { isPremium } = useDesignMode();

  // Parse treatments data whenever it changes
  const parsedData = useMemo(() => {
    if (!data?.treatments || data.treatments.length === 0) {
      return {
        meals: [],
        insulin: [],
        exercise: [],
        tempBasals: [],
        smbs: [],
        carbAnnouncements: []
      };
    }

    try {
      const parsed = nightscoutTreatmentParser.parseTreatments(data.treatments, hoursBack);
      onDataParsed?.(parsed);
      return parsed;
    } catch (error) {
      console.error('Error parsing Nightscout treatments:', error);
      return {
        meals: [],
        insulin: [],
        exercise: [],
        tempBasals: [],
        smbs: [],
        carbAnnouncements: []
      };
    }
  }, [data?.treatments, hoursBack, onDataParsed]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffMinutes = Math.round((now - timestamp) / 60000);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const totalEvents = parsedData.meals.length + 
                     parsedData.insulin.length + 
                     parsedData.exercise.length + 
                     parsedData.tempBasals.length + 
                     parsedData.smbs.length + 
                     parsedData.carbAnnouncements.length;

  if (loading) {
    return (
      <div
        className={
          isPremium
            ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
            : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
        }
      >
        <div className="flex items-center justify-center">
          <RefreshCw className="w-5 h-5 mr-2 animate-spin text-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">Loading Nightscout data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-700">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
          <div>
            <h3 className="font-medium text-red-900 dark:text-red-100">Nightscout Connection Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.treatments) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <div className="flex items-center">
          <Info className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h3 className="font-medium text-yellow-900 dark:text-yellow-100">No Nightscout Connection</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Please configure your Nightscout URL and token in Settings to automatically load treatment data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isPremium
          ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
          : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
      }
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Nightscout Data (Last {hoursBack}h)
        </h3>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
          {totalEvents} events found
        </div>
      </div>

      {lastFetchTime && (
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          Last updated: {formatTimeAgo(lastFetchTime.getTime())}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
          <Utensils className="w-5 h-5 mx-auto mb-1 text-orange-500" />
          <div className="text-sm font-medium text-orange-900 dark:text-orange-100">{parsedData.meals.length}</div>
          <div className="text-xs text-orange-700 dark:text-orange-300">Meals</div>
        </div>

        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <Syringe className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{parsedData.insulin.length}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Insulin</div>
        </div>

        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
          <Zap className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <div className="text-sm font-medium text-purple-900 dark:text-purple-100">{parsedData.smbs.length}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">SMBs</div>
        </div>

        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <Activity className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <div className="text-sm font-medium text-green-900 dark:text-green-100">{parsedData.exercise.length}</div>
          <div className="text-xs text-green-700 dark:text-green-300">Exercise</div>
        </div>

        <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
          <Clock className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
          <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{parsedData.tempBasals.length}</div>
          <div className="text-xs text-indigo-700 dark:text-indigo-300">Temp Basals</div>
        </div>

        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <Utensils className="w-5 h-5 mx-auto mb-1 text-gray-500" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{parsedData.carbAnnouncements.length}</div>
          <div className="text-xs text-gray-700 dark:text-gray-300">Carb Alerts</div>
        </div>
      </div>

      {/* Recent Events List */}
      {totalEvents > 0 && (
        <div className="space-y-4">
          {/* Recent Meals */}
          {parsedData.meals.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                <Utensils className="w-4 h-4 mr-1 text-orange-500" />
                Recent Meals
              </h4>
              <div className="space-y-1">
                {parsedData.meals.slice(0, 3).map((meal, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between">
                    <span>{meal.carbs}g carbs{meal.insulinBolus ? ` + ${meal.insulinBolus}u insulin` : ''}</span>
                    <span className="text-xs">{formatTime(meal.time)}</span>
                  </div>
                ))}
                {parsedData.meals.length > 3 && (
                  <div className="text-xs text-gray-500">+ {parsedData.meals.length - 3} more meals</div>
                )}
              </div>
            </div>
          )}

          {/* Recent Insulin */}
          {parsedData.insulin.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                <Syringe className="w-4 h-4 mr-1 text-blue-500" />
                Recent Insulin
              </h4>
              <div className="space-y-1">
                {parsedData.insulin.slice(0, 3).map((insulin, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between">
                    <span>{insulin.units}u {insulin.type}</span>
                    <span className="text-xs">{formatTime(insulin.time)}</span>
                  </div>
                ))}
                {parsedData.insulin.length > 3 && (
                  <div className="text-xs text-gray-500">+ {parsedData.insulin.length - 3} more doses</div>
                )}
              </div>
            </div>
          )}

          {/* Recent SMBs */}
          {parsedData.smbs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-1 text-purple-500" />
                Recent SMBs
              </h4>
              <div className="space-y-1">
                {parsedData.smbs.slice(0, 3).map((smb, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between">
                    <span>{smb.units}u SMB{smb.reason ? ` (${smb.reason})` : ''}</span>
                    <span className="text-xs">{formatTime(smb.time)}</span>
                  </div>
                ))}
                {parsedData.smbs.length > 3 && (
                  <div className="text-xs text-gray-500">+ {parsedData.smbs.length - 3} more SMBs</div>
                )}
              </div>
            </div>
          )}

          {/* Recent Exercise */}
          {parsedData.exercise.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                <Activity className="w-4 h-4 mr-1 text-green-500" />
                Recent Exercise
              </h4>
              <div className="space-y-1">
                {parsedData.exercise.slice(0, 3).map((exercise, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between">
                    <span>{exercise.intensity} intensity for {exercise.duration} min</span>
                    <span className="text-xs">{formatTime(exercise.time)}</span>
                  </div>
                ))}
                {parsedData.exercise.length > 3 && (
                  <div className="text-xs text-gray-500">+ {parsedData.exercise.length - 3} more sessions</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {totalEvents === 0 && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No treatment events found in the last {hoursBack} hours.</p>
          <p className="text-xs mt-1">Make sure your Nightscout contains treatment data.</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          <strong>Auto-detected from Nightscout:</strong> {nightscoutTreatmentParser.getSummary(parsedData)}
        </p>
      </div>
    </div>
  );
};

export default NightscoutDataDisplay;
