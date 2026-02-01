import { useEffect, useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import LoadingSpinner from '../components/LoadingSpinner';
import SunCalc from 'suncalc';
import type { NightscoutEntry } from '../types/nightscout';

type CircadianSegment = {
  mean: number;
  standardDeviation: number;
  count: number;
  values: number[];
};

type CircadianData = {
  dawn: CircadianSegment | null;
  day: CircadianSegment | null;
  dusk: CircadianSegment | null;
  night: CircadianSegment | null;
  sunTimes: ReturnType<typeof SunCalc.getTimes>;
};

const CircadianRhythm = () => {
  const { data, loading, error } = useNightscout();
  const { getUnitLabel, convertToCurrentUnit } = useGlucoseFormatting();
  const { formatTime } = useTimeFormat();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [circadianData, setCircadianData] = useState<CircadianData | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      error => {
        console.error('Location error:', error);
      }
    );
  }, []);

  useEffect(() => {
    if (data?.entries && location) {
      const sunTimes = SunCalc.getTimes(new Date(), location.latitude, location.longitude);
      
      const analyzeTimeSegment = (readings: NightscoutEntry[]) => {
        if (!readings.length) return null;
        const values = readings.map(r => r.sgv); // Keep values in mg/dL
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        
        return {
          mean, // Keep in mg/dL
          standardDeviation: Math.sqrt(variance), // Keep in mg/dL
          count: values.length,
          values // Keep in mg/dL
        };
      };

      const dawnStartHours = sunTimes.dawn.getHours() + sunTimes.dawn.getMinutes() / 60;
      const sunriseHours = sunTimes.sunrise.getHours() + sunTimes.sunrise.getMinutes() / 60;
      const sunsetHours = sunTimes.sunset.getHours() + sunTimes.sunset.getMinutes() / 60;
      const nightStartHours = sunTimes.night.getHours() + sunTimes.night.getMinutes() / 60;

      const dawnReadings: NightscoutEntry[] = [];
      const dayReadings: NightscoutEntry[] = [];
      const duskReadings: NightscoutEntry[] = [];
      const nightReadings: NightscoutEntry[] = [];

      for (const reading of data.entries) {
        const date = new Date(reading.date);
        const hours = date.getHours() + date.getMinutes() / 60;

        if (hours >= dawnStartHours && hours < sunriseHours) {
          dawnReadings.push(reading);
        } else if (hours >= sunriseHours && hours < sunsetHours) {
          dayReadings.push(reading);
        } else if (hours >= sunsetHours && hours < nightStartHours) {
          duskReadings.push(reading);
        }

        if (!(hours >= dawnStartHours && hours < nightStartHours)) {
          nightReadings.push(reading);
        }
      }

      setCircadianData({
        dawn: analyzeTimeSegment(dawnReadings),
        day: analyzeTimeSegment(dayReadings),
        dusk: analyzeTimeSegment(duskReadings),
        night: analyzeTimeSegment(nightReadings),
        sunTimes
      });
    }
  }, [data, location]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const chartData = circadianData ? {
    labels: ['Dawn', 'Day', 'Dusk', 'Night'],
    datasets: [
      {
        label: 'Average Glucose',
        data: [
          circadianData.dawn ? convertToCurrentUnit(circadianData.dawn.mean) : null,
          circadianData.day ? convertToCurrentUnit(circadianData.day.mean) : null,
          circadianData.dusk ? convertToCurrentUnit(circadianData.dusk.mean) : null,
          circadianData.night ? convertToCurrentUnit(circadianData.night.mean) : null
        ],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: `Glucose (${getUnitLabel()})`
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Circadian Rhythm Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Analyze glucose patterns throughout different times of the day
        </p>
      </div>

      {circadianData && (
        <>
          {/* Sun Times */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Solar Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Sunrise className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-blue-900 dark:text-blue-100">Dawn</span>
                </div>
                <p className="text-lg font-medium text-blue-700 dark:text-blue-300 mt-2">
                  {formatTime(circadianData.sunTimes.dawn)}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Sun className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                  <span className="text-yellow-900 dark:text-yellow-100">Sunrise</span>
                </div>
                <p className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mt-2">
                  {formatTime(circadianData.sunTimes.sunrise)}
                </p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Sunset className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                  <span className="text-orange-900 dark:text-orange-100">Sunset</span>
                </div>
                <p className="text-lg font-medium text-orange-700 dark:text-orange-300 mt-2">
                  {formatTime(circadianData.sunTimes.sunset)}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Moon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="text-purple-900 dark:text-purple-100">Night</span>
                </div>
                <p className="text-lg font-medium text-purple-700 dark:text-purple-300 mt-2">
                  {formatTime(circadianData.sunTimes.night)}
                </p>
              </div>
            </div>
          </div>

          {/* Glucose Pattern Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Daily Glucose Pattern</h3>
            <div className="h-64">
              {chartData && <Line data={chartData} options={chartOptions} />}
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Time Period Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(circadianData).map(([period, stats]: [string, any]) => {
                if (period === 'sunTimes' || !stats) return null;
                
                const getIcon = () => {
                  switch (period) {
                    case 'dawn': return <Sunrise className="h-5 w-5" />;
                    case 'day': return <Sun className="h-5 w-5" />;
                    case 'dusk': return <Sunset className="h-5 w-5" />;
                    case 'night': return <Moon className="h-5 w-5" />;
                    default: return null;
                  }
                };

                const getColors = () => {
                  switch (period) {
                    case 'dawn': return 'text-blue-600 dark:text-blue-400';
                    case 'day': return 'text-yellow-600 dark:text-yellow-400';
                    case 'dusk': return 'text-orange-600 dark:text-orange-400';
                    case 'night': return 'text-purple-600 dark:text-purple-400';
                    default: return '';
                  }
                };

                return (
                  <div key={period} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <span className={getColors()}>{getIcon()}</span>
                      <h4 className="ml-2 font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {period}
                      </h4>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-700 dark:text-gray-300">
                        Mean: {convertToCurrentUnit(stats.mean).toFixed(1)} {getUnitLabel()}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        SD: ±{convertToCurrentUnit(stats.standardDeviation).toFixed(1)} {getUnitLabel()}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        Readings: {stats.count}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Circadian Insights</h3>
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Dawn Phenomenon</h4>
                <p className="text-green-800 dark:text-green-200">
                  {circadianData.dawn.mean > circadianData.night.mean ? 
                    'Dawn phenomenon detected: Higher glucose levels in early morning compared to night.' :
                    'No significant dawn phenomenon observed.'}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Daily Variation</h4>
                <p className="text-blue-800 dark:text-blue-200">
                  Highest variability observed during {
                    Object.entries(circadianData)
                      .filter(([k]) => k !== 'sunTimes')
                      .reduce((a, [k, v]) => {
                        const segment = v as { standardDeviation: number } | null;
                        const currentValue = a.value as { standardDeviation: number } | null;
                        return segment && segment.standardDeviation > (currentValue?.standardDeviation || 0) ? 
                          {period: k, value: segment} : a;
                      }, {period: '', value: null as { standardDeviation: number } | null}).period
                  } period.
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Recommendations</h4>
                <ul className="list-disc list-inside text-purple-800 dark:text-purple-200">
                  <li>Consider adjusting basal rates during periods of higher variability</li>
                  <li>Monitor dawn phenomenon and adjust overnight basal if needed</li>
                  <li>Review meal timing in relation to circadian patterns</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CircadianRhythm;