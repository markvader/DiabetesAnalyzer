import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { Beaker, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface CalibrationEvent {
  timestamp: string;
  glucose: number;
  slope: number;
  intercept: number;
  scale: number;
  bgCheck?: number;
  difference?: number;
}

const CGMCalibration = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue } = useGlucoseFormatting();
  const [calibrations, setCalibrations] = useState<CalibrationEvent[]>([]);
  const [calibrationStats, setCalibrationStats] = useState<any>(null);
  const [accuracy, setAccuracy] = useState<any>(null);

  useEffect(() => {
    if (data?.treatments) {
      analyzeCalibrations();
    }
  }, [data]);

  const analyzeCalibrations = () => {
    if (!data?.treatments || !data?.entries) {
      setCalibrationStats(null);
      setAccuracy(null);
      setCalibrations([]);
      return;
    }

    // Filter calibration events
    const calibrationTreatments = data.treatments.filter(t => 
      t.eventType === 'BG Check' || 
      t.eventType === 'Calibration' ||
      t.glucose ||
      t.notes?.toLowerCase().includes('calibration') ||
      t.notes?.toLowerCase().includes('bg check')
    );

    if (calibrationTreatments.length === 0) {
      setCalibrationStats(null);
      setAccuracy(null);
      setCalibrations([]);
      return;
    }

    const events: CalibrationEvent[] = calibrationTreatments.map(treatment => {
      const timestamp = treatment.created_at;
      const treatmentTime = new Date(timestamp).getTime();
      
      // Find closest CGM reading
      const closestReading = data.entries.reduce((closest, reading) => {
        const readingTime = new Date(reading.date).getTime();
        const currentDiff = Math.abs(readingTime - treatmentTime);
        const closestDiff = Math.abs(new Date(closest.date).getTime() - treatmentTime);
        return currentDiff < closestDiff ? reading : closest;
      });

      const bgCheck = treatment.glucose || treatment.bgCheck;
      const difference = bgCheck ? Math.abs(closestReading.sgv - bgCheck) : undefined;

      return {
        timestamp,
        glucose: closestReading.sgv,
        slope: treatment.slope || 1.0,
        intercept: treatment.intercept || 0,
        scale: treatment.scale || 1.0,
        bgCheck,
        difference
      };
    });

    setCalibrations(events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

    // Calculate statistics
    if (events.length > 0) {
      const validComparisons = events.filter(e => e.bgCheck && e.difference !== undefined);
      
      if (validComparisons.length > 0) {
        const avgDifference = validComparisons.reduce((sum, e) => sum + e.difference!, 0) / validComparisons.length;
        const maxDifference = Math.max(...validComparisons.map(e => e.difference!));
        const accurateReadings = validComparisons.filter(e => e.difference! <= 20).length; // Within 20 mg/dL
        
        setCalibrationStats({
          totalCalibrations: events.length,
          validComparisons: validComparisons.length,
          avgDifference: avgDifference.toFixed(1),
          maxDifference: maxDifference.toFixed(1),
          accuracy: ((accurateReadings / validComparisons.length) * 100).toFixed(1),
          last24h: events.filter(e => 
            new Date(e.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
          ).length
        });

        // Calculate MARD (Mean Absolute Relative Difference)
        const mardValues = validComparisons.map(e => 
          Math.abs(e.glucose - e.bgCheck!) / e.bgCheck! * 100
        );
        const mard = mardValues.reduce((sum, val) => sum + val, 0) / mardValues.length;

        setAccuracy({
          mard: mard.toFixed(1),
          within20: accurateReadings,
          within15: validComparisons.filter(e => e.difference! <= 15).length,
          within10: validComparisons.filter(e => e.difference! <= 10).length
        });
      } else {
        setCalibrationStats(null);
        setAccuracy(null);
      }
    } else {
      setCalibrationStats(null);
      setAccuracy(null);
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CGM Calibration Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor CGM accuracy and calibration performance
        </p>
      </div>

      {/* Calibration Statistics */}
      {calibrationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Beaker className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calibrations</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {calibrationStats.totalCalibrations}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Accuracy</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {calibrationStats.accuracy}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Difference</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatGlucoseValue(parseFloat(calibrationStats.avgDifference), 'mgdl', true)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {calibrationStats.last24h}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!calibrationStats && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-700 dark:text-yellow-400">
            No calibration data found. This could mean no BG checks or calibrations have been recorded.
          </p>
        </div>
      )}

      {/* Accuracy Metrics */}
      {accuracy && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Accuracy Metrics</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">MARD</h4>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {accuracy.mard}%
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">Mean Absolute Relative Difference</p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Within {formatGlucoseValue(20, 'mgdl', true)}</h4>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {accuracy.within20}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Readings within target</p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Within {formatGlucoseValue(15, 'mgdl', true)}</h4>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {accuracy.within15}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">High accuracy readings</p>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">Within {formatGlucoseValue(10, 'mgdl', true)}</h4>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {accuracy.within10}
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">Excellent accuracy</p>
            </div>
          </div>
        </div>
      )}

      {/* Calibration Events Table */}
      {calibrations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Calibration Events</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    CGM Reading
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    BG Check
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Slope
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {calibrations.slice(0, 20).map((cal, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(cal.timestamp), 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatGlucoseValue(cal.glucose, 'mgdl', true)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cal.bgCheck ? formatGlucoseValue(cal.bgCheck, 'mgdl', true) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cal.difference ? (
                        <span className={`${
                          cal.difference <= 10 ? 'text-green-600 dark:text-green-400' :
                          cal.difference <= 20 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {formatGlucoseValue(cal.difference, 'mgdl', true)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cal.slope.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cal.difference ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cal.difference <= 10 ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                          cal.difference <= 20 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                          'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}>
                          {cal.difference <= 10 ? 'Excellent' :
                           cal.difference <= 20 ? 'Good' : 'Poor'}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                          N/A
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CGM Accuracy Guidelines */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">CGM Accuracy Guidelines</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Accuracy Standards</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <span className="text-green-800 dark:text-green-200">{`Excellent (≤${formatGlucoseValue(10, 'mgdl', true)})`}</span>
                <span className="text-green-600 dark:text-green-400">Target for critical decisions</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <span className="text-blue-800 dark:text-blue-200">{`Good (≤${formatGlucoseValue(20, 'mgdl', true)})`}</span>
                <span className="text-blue-600 dark:text-blue-400">Acceptable for most uses</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <span className="text-yellow-800 dark:text-yellow-200">{`Fair (≤${formatGlucoseValue(30, 'mgdl', true)})`}</span>
                <span className="text-yellow-600 dark:text-yellow-400">May need calibration</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                <span className="text-red-800 dark:text-red-200">{`Poor (>${formatGlucoseValue(30, 'mgdl', true)})`}</span>
                <span className="text-red-600 dark:text-red-400">Requires attention</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Calibration Tips</h4>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 text-sm">
              <li>Calibrate when glucose is stable (not rising or falling rapidly)</li>
              <li>Use clean hands and proper technique for BG checks</li>
              <li>Calibrate at different glucose levels (high, normal, low)</li>
              <li>Avoid calibrating immediately after meals or exercise</li>
              <li>Consider sensor age - newer sensors may be more accurate</li>
              <li>Check for sensor compression or adhesive issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CGMCalibration;