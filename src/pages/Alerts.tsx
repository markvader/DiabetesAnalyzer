import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { Howl } from 'howler';

const Alerts = () => {
  const { data } = useNightscout();
  const { convertToCurrentUnit, getCurrentGlucoseRanges, getUnitLabel } = useGlucoseFormatting();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  
  // Initialize thresholds based on current unit
  const ranges = getCurrentGlucoseRanges();
  const [highThreshold, setHighThreshold] = useState(ranges.HIGH_THRESHOLD);
  const [lowThreshold, setLowThreshold] = useState(ranges.LOW_THRESHOLD);
  const [noDataTimeout, setNoDataTimeout] = useState(15);
  const [lastReading, setLastReading] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sound effects
  const highAlert = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'],
    volume: 0.5,
    preload: true
  });

  const lowAlert = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3'],
    volume: 0.5,
    preload: true
  });

  const noDataAlert = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2872/2872-preview.mp3'],
    volume: 0.5,
    preload: true
  });

  useEffect(() => {
    if (!alertsEnabled || !data?.entries?.length) return;

    const latestReading = data.entries[data.entries.length - 1];
    const readingTime = new Date(latestReading.date);
    setLastReading(readingTime);

    // Check glucose thresholds
    const glucoseValue = convertToCurrentUnit(latestReading.sgv, 'mgdl');
    if (glucoseValue > highThreshold && soundEnabled) {
      highAlert.play();
    } else if (glucoseValue < lowThreshold && soundEnabled) {
      lowAlert.play();
    }

    // Check for no data
    const now = new Date();
    const timeDiff = now.getTime() - readingTime.getTime();
    if (timeDiff > noDataTimeout * 60 * 1000 && soundEnabled) {
      noDataAlert.play();
    }
  }, [data, alertsEnabled, highThreshold, lowThreshold, noDataTimeout, soundEnabled]);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Alert Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure glucose and data alerts
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`p-2 rounded-lg ${
                alertsEnabled 
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {alertsEnabled ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
            </button>
            <span className="text-gray-700 dark:text-gray-300">
              Alerts are {alertsEnabled ? 'enabled' : 'disabled'}
            </span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg ${
              soundEnabled 
                ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              High Glucose Alert ({getUnitLabel()})
            </label>
            <input
              type="number"
              value={highThreshold}
              onChange={(e) => setHighThreshold(parseFloat(e.target.value))}
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Low Glucose Alert ({getUnitLabel()})
            </label>
            <input
              type="number"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(parseFloat(e.target.value))}
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              No Data Alert Timeout (minutes)
            </label>
            <input
              type="number"
              value={noDataTimeout}
              onChange={(e) => setNoDataTimeout(parseInt(e.target.value))}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {lastReading && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last reading: {lastReading.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">About Alerts</h3>
        <ul className="list-disc list-inside space-y-2 text-blue-800 dark:text-blue-200">
          <li>High glucose alert will sound when your glucose exceeds {highThreshold} {getUnitLabel()}</li>
          <li>Low glucose alert will sound when your glucose falls below {lowThreshold} {getUnitLabel()}</li>
          <li>No data alert will sound if no readings are received for {noDataTimeout} minutes</li>
          <li>Alerts will only sound when both alerts and sound are enabled</li>
        </ul>
      </div>
    </div>
  );
};

export default Alerts;