import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { Gauge, Settings, Activity, Clock, Droplet, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

interface PumpStatus {
  timestamp: string;
  battery: number;
  reservoir: number;
  iob: number;
  suspended: boolean;
  bolusing: boolean;
  tempBasal?: {
    rate: number;
    duration: number;
    timestamp: string;
  };
}

interface PumpHistoryEvent {
  timestamp: string;
  eventType?: string;
  notes?: string;
  battery?: number;
  reservoir?: number;
  suspended?: boolean;
}

interface ProfileScheduleEntry {
  time: string;
  value: number;
}

interface ActiveProfile {
  basal?: ProfileScheduleEntry[];
  sens?: ProfileScheduleEntry[];
  carbratio?: ProfileScheduleEntry[];
}

const PumpSettings = () => {
  const { data, loading, error } = useNightscout();
  const { unit, getUnitLabel } = useGlucoseFormatting();
  const { formatTimeString, formatTime } = useTimeFormat();
  const [pumpStatus, setPumpStatus] = useState<PumpStatus | null>(null);
  const [pumpHistory, setPumpHistory] = useState<PumpHistoryEvent[]>([]);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);

  useEffect(() => {
    if (data) {
      analyzePumpData();
    }
  }, [data, unit]);

  const analyzePumpData = () => {
    if (!data?.treatments || !data?.profile) return;

    // Get current profile
    const profiles = data.profile;
    if (profiles.length > 0) {
      const currentProfile = profiles[0];
      const defaultProfile = currentProfile.defaultProfile || 'Default';
      const storeProfile = currentProfile.store?.[defaultProfile];
      setActiveProfile(storeProfile && typeof storeProfile === 'object' ? (storeProfile as ActiveProfile) : null);
    }

    // Find pump status from treatments
    const pumpTreatments = data.treatments.filter(t => 
      t.eventType === 'Pump Status' || 
      t.eventType === 'Battery Change' ||
      t.eventType === 'Reservoir Change' ||
      t.notes?.includes('pump') ||
      t.notes?.includes('battery') ||
      t.notes?.includes('reservoir')
    );

    if (pumpTreatments.length > 0) {
      const latest = pumpTreatments[0];
      setPumpStatus({
        timestamp: latest.created_at,
        battery: latest.battery || 75, // Default values if not available
        reservoir: latest.reservoir || 150,
        iob: latest.iob || 0,
        suspended: latest.suspended || false,
        bolusing: latest.bolusing || false,
        tempBasal: latest.tempBasal
      });
    }

    // Get pump history
    const history: PumpHistoryEvent[] = pumpTreatments.slice(0, 10).map(treatment => ({
      timestamp: treatment.created_at,
      eventType: treatment.eventType,
      notes: treatment.notes,
      battery: treatment.battery,
      reservoir: treatment.reservoir,
      suspended: treatment.suspended
    }));

    setPumpHistory(history);
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pump Settings & Status</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor pump status, settings, and maintenance information
        </p>
      </div>

      {/* Pump Status Cards */}
      {pumpStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Battery</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {pumpStatus.battery}%
                </p>
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    pumpStatus.battery > 50 ? 'bg-green-500' : 
                    pumpStatus.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${pumpStatus.battery}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Droplet className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Reservoir</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {pumpStatus.reservoir}U
                </p>
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    pumpStatus.reservoir > 100 ? 'bg-green-500' : 
                    pumpStatus.reservoir > 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((pumpStatus.reservoir / 200) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">IOB</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {pumpStatus.iob.toFixed(2)}U
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                <p className={`text-lg font-bold ${
                  pumpStatus.suspended ? 'text-red-600 dark:text-red-400' : 
                  pumpStatus.bolusing ? 'text-blue-600 dark:text-blue-400' : 
                  'text-green-600 dark:text-green-400'
                }`}>
                  {pumpStatus.suspended ? 'Suspended' : 
                   pumpStatus.bolusing ? 'Bolusing' : 'Active'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Profile Settings */}
      {activeProfile && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Active Profile Settings</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Basal Rates */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Basal Rates</h4>
              <div className="space-y-2">
                {activeProfile.basal?.slice(0, 6).map((basal: ProfileScheduleEntry, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{formatTimeString(basal.time)}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{basal.value} U/h</span>
                  </div>
                ))}
                {activeProfile.basal?.length > 6 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    +{activeProfile.basal.length - 6} more entries...
                  </p>
                )}
              </div>
            </div>

            {/* ISF Settings */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Insulin Sensitivity</h4>
              <div className="space-y-2">
                {activeProfile.sens?.slice(0, 6).map((sens: ProfileScheduleEntry, index: number) => {
                  // Convert ISF value to current unit (mmol/L/U to mg/dL/U if needed)
                  const isfValue = unit === 'mgdl' ? Math.round(sens.value * 18) : sens.value;
                  
                  return (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{sens.time}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{isfValue} {getUnitLabel()}/U</span>
                    </div>
                  );
                })}
                {activeProfile.sens?.length > 6 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    +{activeProfile.sens.length - 6} more entries...
                  </p>
                )}
              </div>
            </div>

            {/* Carb Ratios */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Carb Ratios</h4>
              <div className="space-y-2">
                {activeProfile.carbratio?.slice(0, 6).map((ratio: ProfileScheduleEntry, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{ratio.time}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ratio.value} g/U</span>
                  </div>
                ))}
                {activeProfile.carbratio?.length > 6 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    +{activeProfile.carbratio.length - 6} more entries...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Basal */}
      {pumpStatus?.tempBasal && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Active Temporary Basal</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Rate</h4>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {pumpStatus.tempBasal.rate} U/h
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Duration</h4>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {pumpStatus.tempBasal.duration} min
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Started</h4>
              <p className="text-lg font-medium text-blue-700 dark:text-blue-300">
                {formatTime(new Date(pumpStatus.tempBasal.timestamp))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pump History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Pump Events</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Battery
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reservoir
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {pumpHistory.map((event, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {format(new Date(event.timestamp), 'dd.MM. HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {event.eventType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {event.battery ? `${event.battery}%` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {event.reservoir ? `${event.reservoir}U` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                    {event.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Alerts */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Maintenance Alerts</h3>
        </div>
        
        <div className="space-y-3">
          {pumpStatus && pumpStatus.battery < 20 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-red-800 dark:text-red-200 font-medium">Low Battery Alert</p>
              <p className="text-red-700 dark:text-red-300 text-sm">Battery level is at {pumpStatus.battery}%. Consider changing soon.</p>
            </div>
          )}
          
          {pumpStatus && pumpStatus.reservoir < 50 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
              <p className="text-orange-800 dark:text-orange-200 font-medium">Low Reservoir Alert</p>
              <p className="text-orange-700 dark:text-orange-300 text-sm">Reservoir has {pumpStatus.reservoir}U remaining. Plan for refill.</p>
            </div>
          )}
          
          {pumpStatus && pumpStatus.suspended && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-red-800 dark:text-red-200 font-medium">Pump Suspended</p>
              <p className="text-red-700 dark:text-red-300 text-sm">Insulin delivery is currently suspended. Check pump status.</p>
            </div>
          )}
          
          {(!pumpStatus || (pumpStatus.battery >= 20 && pumpStatus.reservoir >= 50 && !pumpStatus.suspended)) && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <p className="text-green-800 dark:text-green-200 font-medium">All Systems Normal</p>
              <p className="text-green-700 dark:text-green-300 text-sm">No maintenance alerts at this time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PumpSettings;