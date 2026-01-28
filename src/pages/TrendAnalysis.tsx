import { useState, useEffect, useMemo } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { TrendingUp, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { predictGlucose } from '../services/patternDetectionService';
import LoadingSpinner from '../components/LoadingSpinner';
import { Line } from 'react-chartjs-2';
import { format, addMinutes } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { runSafeAsync } from '../utils/safeAsync';

const TrendAnalysis = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue, convertToCurrentUnit, getUnitLabel } = useGlucoseFormatting();
  const [predictions, setPredictions] = useState<number[]>([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const lastReading = data?.entries?.length ? data.entries[data.entries.length - 1] : null;

  useEffect(() => {
    let isMounted = true;

    const fetchPredictions = async () => {
      if (data?.entries && data.entries.length >= 24) {
        setPredictionLoading(true);
        try {
          // Use a smaller subset of recent readings for prediction
          const recentReadings = data.entries.slice(-48);
          const result = await predictGlucose(recentReadings);
          if (isMounted) {
            setPredictions(result);
          }
        } catch (err) {
          console.error('Error calculating predictions:', err);
          if (isMounted) {
            setPredictions([]);
          }
        }
        if (isMounted) {
          setPredictionLoading(false);
        }
      }
    };

  runSafeAsync(() => fetchPredictions(), { label: 'TrendAnalysis: fetchPredictions' });

    return () => {
      isMounted = false;
    };
  }, [data?.entries]);

  // Memoized chart configuration
  const chartData = useMemo(() => {
    if (!lastReading || predictions.length === 0) return { labels: [], datasets: [] };
    
    return {
      labels: predictions.map((_, i) => 
        format(addMinutes(new Date(lastReading.date), i * 15), 'HH:mm')
      ),
      datasets: [
        {
          label: 'Predicted Glucose',
          data: predictions.map(p => convertToCurrentUnit(p, 'mgdl')),
          borderColor: isDark ? 'rgb(96, 165, 250)' : 'rgb(75, 192, 192)',
          backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(75, 192, 192, 0.1)',
          tension: 0.1,
          fill: true
        }
      ]
    };
  }, [predictions, lastReading, convertToCurrentUnit, isDark]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: `Glucose (${getUnitLabel()})`,
          color: isDark ? '#e5e7eb' : '#111827'
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time',
          color: isDark ? '#e5e7eb' : '#111827'
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
      }
    }
  }), [isDark, getUnitLabel]);

  if (loading || predictionLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!lastReading || predictions.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
        <p className="text-yellow-700 dark:text-yellow-200">
          Not enough glucose data available for trend analysis. At least 24 readings are required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trend Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Advanced glucose trend analysis and predictions
        </p>
      </div>

      {/* Prediction Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Glucose Predictions</h3>
        </div>
        
        <div className="h-64 mb-4">
          <Line data={chartData} options={chartOptions} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Current Trend</h4>
            <div className="flex items-center">
              {predictions[0] > lastReading.sgv ? (
                <ArrowUpRight className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
              )}
              <span className="text-blue-800 dark:text-blue-200">
                {predictions[0] > lastReading.sgv ? 'Rising' : 'Falling'} trend predicted
              </span>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">3-Hour Prediction</h4>
            <div className="text-blue-800 dark:text-blue-200">
              Predicted range: {formatGlucoseValue(Math.min(...predictions), 'mgdl', false)} - {formatGlucoseValue(Math.max(...predictions), 'mgdl', false)} {getUnitLabel()}
            </div>
          </div>
        </div>
      </div>

      {/* Trend Insights */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Trend Insights</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Pattern Recognition</h4>
            <p className="text-purple-800 dark:text-purple-200">
              The prediction model uses machine learning to analyze your historical glucose patterns
              and predict future values. It takes into account factors like time of day and recent
              glucose trends.
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Accuracy Metrics</h4>
            <p className="text-purple-800 dark:text-purple-200">
              Predictions are most accurate in the short term (30-60 minutes) and become less
              certain over longer periods. Always use these predictions as guidance rather than
              absolute values.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendAnalysis;