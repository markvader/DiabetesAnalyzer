import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { Target, Activity, TrendingUp, AlertCircle, Clock, Zap } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

interface LoopCycle {
  timestamp: string;
  glucose: number;
  iob: number;
  cob: number;
  recommendedBasal: number;
  enacted: boolean;
  reason: string;
  duration: number;
}

const LoopAnalysis = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue } = useGlucoseFormatting();
  const [loopCycles, setLoopCycles] = useState<LoopCycle[]>([]);
  const [loopStats, setLoopStats] = useState<any>(null);

  useEffect(() => {
    if (data?.treatments) {
      analyzeLoopCycles();
    }
  }, [data, formatGlucoseValue]);

  const analyzeLoopCycles = () => {
    if (!data?.treatments || !data?.entries) {
      setLoopStats(null);
      setLoopCycles([]);
      return;
    }

    // Filter loop treatments
    const loopTreatments = data.treatments.filter(t => 
      t.eventType === 'Temp Basal' || 
      (t.notes && (t.notes.includes('Loop') || t.notes.includes('OpenAPS')))
    );

    if (loopTreatments.length === 0) {
      setLoopStats(null);
      setLoopCycles([]);
      return;
    }

    const cycles: LoopCycle[] = loopTreatments.map(treatment => {
      const timestamp = treatment.created_at;
      const treatmentTime = new Date(timestamp).getTime();
      
      // Find closest glucose reading
      const closestReading = data.entries.reduce((closest, reading) => {
        const readingTime = new Date(reading.date).getTime();
        const currentDiff = Math.abs(readingTime - treatmentTime);
        const closestDiff = Math.abs(new Date(closest.date).getTime() - treatmentTime);
        return currentDiff < closestDiff ? reading : closest;
      });

      return {
        timestamp,
        glucose: closestReading.sgv,
        iob: treatment.iob || 0,
        cob: treatment.cob || 0,
        recommendedBasal: treatment.rate || treatment.absolute || 0,
        enacted: treatment.enacted !== false,
        reason: treatment.reason || treatment.notes || 'Loop adjustment',
        duration: treatment.duration || 30
      };
    });

    setLoopCycles(cycles.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

    // Calculate statistics
    if (cycles.length > 0) {
      const enactedCycles = cycles.filter(c => c.enacted);
      const avgGlucose = cycles.reduce((sum, c) => sum + c.glucose, 0) / cycles.length;
      const avgBasal = cycles.reduce((sum, c) => sum + c.recommendedBasal, 0) / cycles.length;
      
      // Loop frequency analysis
      const last24h = cycles.filter(c => 
        new Date(c.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );

      setLoopStats({
        totalCycles: cycles.length,
        enactedCycles: enactedCycles.length,
        enactmentRate: ((enactedCycles.length / cycles.length) * 100).toFixed(1),
        avgGlucose: avgGlucose,
        avgBasal: avgBasal.toFixed(2),
        last24h: last24h.length,
        avgCycleTime: cycles.length > 1 ? 
          ((new Date(cycles[0].timestamp).getTime() - new Date(cycles[cycles.length - 1].timestamp).getTime()) / 
           (cycles.length - 1) / 60000).toFixed(1) : 0
      });
    } else {
      setLoopStats(null);
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loop Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Automated insulin delivery loop performance and decision analysis
        </p>
      </div>

      {/* Loop Statistics */}
      {loopStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cycles</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loopStats.totalCycles}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Enactment Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loopStats.enactmentRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Cycle Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loopStats.avgCycleTime}min
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loopStats.last24h}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loopStats && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-700 dark:text-yellow-400">
            No loop data found. This could mean the loop is not running or no loop events have been recorded.
          </p>
        </div>
      )}

      {/* Loop Cycles Table */}
      {loopCycles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Loop Cycles</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Glucose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Recommended Basal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    IOB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    COB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loopCycles.slice(0, 20).map((cycle, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(cycle.timestamp), 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatGlucoseValue(cycle.glucose, 'mgdl', true)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                      {cycle.recommendedBasal.toFixed(2)} U/h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cycle.duration}min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cycle.iob.toFixed(2)}U
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cycle.cob}g
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cycle.enacted 
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}>
                        {cycle.enacted ? 'Enacted' : 'Not Enacted'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {cycle.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loop Performance Insights */}
      {loopStats && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loop Performance Insights</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Loop Frequency</h4>
              <p className="text-blue-800 dark:text-blue-200">
                Loop runs every {loopStats.avgCycleTime} minutes on average
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Enactment Success</h4>
              <p className="text-green-800 dark:text-green-200">
                {loopStats.enactmentRate}% of recommendations were enacted
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Average Glucose</h4>
              <p className="text-purple-800 dark:text-purple-200">
                {formatGlucoseValue(loopStats.avgGlucose, 'mgdl', true)} during loop cycles
              </p>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">Average Basal</h4>
              <p className="text-orange-800 dark:text-orange-200">
                {loopStats.avgBasal} U/h recommended basal rate
              </p>
            </div>
          </div>
        </div>
      )}

      {/* About Loop */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">About Automated Insulin Delivery Loop</h3>
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <p>
            The automated insulin delivery loop continuously monitors glucose levels and adjusts insulin delivery 
            to maintain glucose within target range.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Loop cycles typically run every 5 minutes</li>
            <li>Each cycle considers current glucose, IOB, COB, and trends</li>
            <li>Recommendations may include temporary basal rate changes or SMB delivery</li>
            <li>Not all recommendations are enacted due to safety constraints</li>
            <li>High enactment rates indicate good loop performance and settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoopAnalysis;