import { useEffect, useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { Cloud, Thermometer, Droplets, ArrowDown } from 'lucide-react';
import { analyzeWeatherImpact } from '../services/weatherAnalysis';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

const WeatherImpact = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue } = useGlucoseFormatting();
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setWeatherError(null);
      },
      error => {
        console.error('Location error:', error);
        setWeatherError('Unable to get location for weather analysis');
      }
    );
  }, []);

  useEffect(() => {
    const fetchWeatherImpact = async () => {
      if (data?.entries && location) {
        try {
          const impact = await analyzeWeatherImpact(data.entries, location);
          setWeatherData(impact);
        } catch (err) {
          setWeatherError('Failed to fetch weather data');
          console.error('Weather analysis error:', err);
        }
      }
    };

    fetchWeatherImpact();
  }, [data, location]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (weatherError) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
        <p className="text-yellow-700 dark:text-yellow-200">{weatherError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Weather Impact Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Analyze how weather conditions affect your glucose levels
        </p>
      </div>

      {weatherData && (
        <>
          {/* Current Weather Conditions */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Current Weather</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Thermometer className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-blue-900 dark:text-blue-100">Temperature</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                  {weatherData.weatherConditions.temperature}°C
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-blue-900 dark:text-blue-100">Humidity</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                  {weatherData.weatherConditions.humidity}%
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <ArrowDown className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-blue-900 dark:text-blue-100">Pressure</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                  {weatherData.weatherConditions.pressure} hPa
                </p>
              </div>
            </div>
          </div>

          {/* Correlations */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-4">Weather Correlations</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">Temperature Impact</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 dark:bg-blue-400"
                      style={{ width: `${Math.abs(weatherData.correlations.temperatureCorrelation * 100)}%` }}
                    />
                  </div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {(weatherData.correlations.temperatureCorrelation * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">Humidity Impact</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 dark:bg-blue-400"
                      style={{ width: `${Math.abs(weatherData.correlations.humidityCorrelation * 100)}%` }}
                    />
                  </div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {(weatherData.correlations.humidityCorrelation * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">Pressure Impact</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 dark:bg-blue-400"
                      style={{ width: `${Math.abs(weatherData.correlations.pressureCorrelation * 100)}%` }}
                    />
                  </div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {(weatherData.correlations.pressureCorrelation * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Circadian Analysis */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-4">Time of Day Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(weatherData.circadianAnalysis).map(([period, stats]: [string, any]) => (
                <div key={period} className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 capitalize mb-2">
                    {period}
                  </h4>
                  <div className="space-y-1">
                    <p className="text-purple-800 dark:text-purple-200">
                      Mean: {stats?.mean ? formatGlucoseValue(stats.mean) : 'N/A'}
                    </p>
                    <p className="text-purple-800 dark:text-purple-200">
                      SD: ±{stats?.standardDeviation ? formatGlucoseValue(stats.standardDeviation) : 'N/A'}
                    </p>
                    <p className="text-purple-800 dark:text-purple-200">
                      Readings: {stats?.count || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WeatherImpact;