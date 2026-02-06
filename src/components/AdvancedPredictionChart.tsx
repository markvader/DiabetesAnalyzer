import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { format, addMinutes } from 'date-fns';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Zap, 
  Target,
  Clock,
  Shield,
  BarChart3,
  Info
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { 
  advancedPredictionService, 
  type GlucoseReading, 
  type PredictionResult,
  type PredictionContext 
} from '../services/advancedPredictionService';
import LoadingSpinner from './LoadingSpinner';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LegendItem,
  TooltipItem,
  ScriptableContext
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdvancedPredictionChartProps {
  readings: GlucoseReading[];
  useAI?: boolean;
  context?: PredictionContext;
}

const AdvancedPredictionChart: React.FC<AdvancedPredictionChartProps> = ({ 
  readings, 
  useAI = false,
  context 
}) => {
  const { theme } = useTheme();
  const { isPremium } = useDesignMode();
  const { unit, formatGlucoseValue, convertToCurrentUnit } = useGlucoseFormatting();
  const isDark = theme === 'dark';
  const colors = isDark ? GLUCOSE_RANGES.COLORS.DARK : GLUCOSE_RANGES.COLORS;
  
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionHours, setPredictionHours] = useState(3);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<'predicted' | 'optimistic' | 'pessimistic'>('predicted');

  useEffect(() => {
    if (!readings.length) return;

    const generatePredictions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await advancedPredictionService.generateAdvancedPredictions(
          readings,
          context,
          predictionHours
        );
        setPredictionResult(result);
      } catch (err) {
        console.error('Error generating predictions:', err);
        setError('Failed to generate predictions');
      } finally {
        setLoading(false);
      }
    };

    generatePredictions();
  }, [readings, useAI, unit, predictionHours, context]);

  if (loading) {
    return (
      <div
        className={
          isPremium
            ? 'flex items-center justify-center h-96 bg-white/60 dark:bg-dark-800/60 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
            : 'flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md'
        }
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!predictionResult) return null;

  // Get historical data points (last 2 hours)
  const historicalData = readings
    .slice(-24)
    .map(reading => ({
      x: format(new Date(reading.date), 'HH:mm'),
      y: convertToCurrentUnit(reading.sgv)
    }));

  const lastReading = readings[readings.length - 1];
  const currentTime = new Date(lastReading.date);

  // Generate prediction data points based on selected scenario
  const selectedPredictions = selectedScenario === 'optimistic' 
    ? predictionResult.lowScenario
    : selectedScenario === 'pessimistic'
    ? predictionResult.highScenario
    : predictionResult.predictions;

  const predictionData = selectedPredictions.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  // Generate confidence bands
  const upperBandData = predictionResult.highScenario.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  const lowerBandData = predictionResult.lowScenario.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  // Create gradient for prediction
  const createGradient = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const color = selectedScenario === 'optimistic' ? 'rgba(34, 197, 94, 0.3)' 
      : selectedScenario === 'pessimistic' ? 'rgba(239, 68, 68, 0.3)'
      : isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(75, 192, 192, 0.3)';
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    return gradient;
  };

  const data = {
    datasets: [
      {
        label: 'Historical',
        data: historicalData,
        borderColor: colors.IN_RANGE,
        backgroundColor: 'transparent',
        pointRadius: 3,
        pointBackgroundColor: colors.IN_RANGE,
        borderWidth: 2,
        fill: false,
        tension: 0.2
      },
      // Confidence band (upper)
      {
        label: 'Confidence Band',
        data: upperBandData,
        borderColor: 'transparent',
        backgroundColor: function(context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return 'transparent';
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(156, 163, 175, 0.2)');
          gradient.addColorStop(1, 'transparent');
          return gradient;
        },
        pointRadius: 0,
        borderWidth: 0,
        fill: '+1',
        tension: 0.4
      },
      // Confidence band (lower)
      {
        label: '',
        data: lowerBandData,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 0,
        fill: false,
        tension: 0.4
      },
      {
        label: `${selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Prediction`,
        data: predictionData,
        borderColor: selectedScenario === 'optimistic' ? 'rgba(34, 197, 94, 1)' 
          : selectedScenario === 'pessimistic' ? 'rgba(239, 68, 68, 1)'
          : isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(75, 192, 192, 1)',
        backgroundColor: function(context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return 'transparent';
          return createGradient(ctx);
        },
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#e5e7eb' : '#111827',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          font: { size: 12 },
          filter: (legendItem: LegendItem) => legendItem.text !== ''
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDark ? '#e5e7eb' : '#111827',
        bodyColor: isDark ? '#e5e7eb' : '#111827',
        borderColor: isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            const label = context.dataset.label || '';
            if (label === '' || label === 'Confidence Band') return;
            const value = context.parsed.y;
            return `${label}: ${formatGlucoseValue(value, unit, true)}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'category' as const,
        grid: {
          color: isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 1)',
          drawBorder: false
        },
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          maxTicksLimit: 8
        }
      },
      y: {
        beginAtZero: false,
        grid: {
          color: isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 1)',
          drawBorder: false
        },
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          callback: function(value: string | number) {
            return formatGlucoseValue(Number(value), unit, true);
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  const getRiskIcon = (riskFactor: string) => {
    if (riskFactor.includes('hypoglycemia')) return <TrendingDown className="w-4 h-4 text-red-500" />;
    if (riskFactor.includes('hyperglycemia')) return <TrendingUp className="w-4 h-4 text-orange-500" />;
    if (riskFactor.includes('exercise')) return <Activity className="w-4 h-4 text-blue-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
      case 'rising': return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 'falling': return <TrendingDown className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-green-500" />;
    }
  };

  const isScenario = (value: string): value is 'predicted' | 'optimistic' | 'pessimistic' => {
    return value === 'predicted' || value === 'optimistic' || value === 'pessimistic';
  };

  return (
    <div className="space-y-6">
      {/* Prediction Chart */}
      <div
        className={
          isPremium
            ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
            : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 lg:mb-0">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Advanced Glucose Predictions
            </h3>
            {useAI && (
              <div className="flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                <Brain className="w-3 h-3 mr-1" />
                AI Enhanced
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Scenario Selector */}
            <select
              value={selectedScenario}
              onChange={(e) => {
                const next = e.target.value;
                if (isScenario(next)) setSelectedScenario(next);
              }}
              className={
                isPremium
                  ? 'px-3 py-1 text-sm border border-white/20 dark:border-white/10 rounded-md bg-white/50 dark:bg-white/5 text-gray-900 dark:text-gray-100 backdrop-blur'
                  : 'px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }
            >
              <option value="predicted">Predicted</option>
              <option value="optimistic">Optimistic</option>
              <option value="pessimistic">Pessimistic</option>
            </select>
            
            {/* Prediction Hours Selector */}
            <select
              value={predictionHours}
              onChange={(e) => setPredictionHours(Number(e.target.value))}
              className={
                isPremium
                  ? 'px-3 py-1 text-sm border border-white/20 dark:border-white/10 rounded-md bg-white/50 dark:bg-white/5 text-gray-900 dark:text-gray-100 backdrop-blur'
                  : 'px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={3}>3 Hours</option>
              <option value={6}>6 Hours</option>
            </select>
            
            {/* Advanced Metrics Toggle */}
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className={
                isPremium
                  ? 'flex items-center px-3 py-1 text-sm border border-white/20 dark:border-white/10 rounded-md bg-white/50 dark:bg-white/5 text-gray-900 dark:text-gray-100 hover:bg-white/70 dark:hover:bg-white/10 backdrop-blur'
                  : 'flex items-center px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
              }
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Metrics
            </button>
          </div>
        </div>
        
        <div className="h-96">
          <Line data={data} options={options} />
        </div>
      </div>

      {/* Prediction Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={
            isPremium
              ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
              : 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md'
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Confidence</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {predictionResult.confidence}%
              </p>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div
          className={
            isPremium
              ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
              : 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md'
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Time in Range</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {predictionResult.timeInRangePrediction.next3Hours}%
              </p>
            </div>
            <Target className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div
          className={
            isPremium
              ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
              : 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md'
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Short Term</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                {predictionResult.trendAnalysis.shortTerm}
              </p>
            </div>
            {getTrendIcon(predictionResult.trendAnalysis.shortTerm)}
          </div>
        </div>
        
        <div
          className={
            isPremium
              ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
              : 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md'
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Alerts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {predictionResult.alertPredictions.lowAlerts.length + predictionResult.alertPredictions.highAlerts.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Advanced Metrics Panel */}
      {showAdvancedMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time in Range Breakdown */}
          <div
            className={
              isPremium
                ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
                : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
            }
          >
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Time in Range Prediction
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Next Hour:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {predictionResult.timeInRangePrediction.next1Hour}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Next 2 Hours:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {predictionResult.timeInRangePrediction.next2Hours}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Next 3 Hours:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {predictionResult.timeInRangePrediction.next3Hours}%
                </span>
              </div>
            </div>
          </div>

          {/* Trend Analysis */}
          <div
            className={
              isPremium
                ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
                : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
            }
          >
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Trend Analysis
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Short Term:</span>
                <div className="flex items-center">
                  {getTrendIcon(predictionResult.trendAnalysis.shortTerm)}
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {predictionResult.trendAnalysis.shortTerm}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Medium Term:</span>
                <div className="flex items-center">
                  {getTrendIcon(predictionResult.trendAnalysis.mediumTerm)}
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {predictionResult.trendAnalysis.mediumTerm}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Long Term:</span>
                <div className="flex items-center">
                  {getTrendIcon(predictionResult.trendAnalysis.longTerm)}
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {predictionResult.trendAnalysis.longTerm}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {predictionResult.riskFactors.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border border-orange-200 dark:border-orange-700">
          <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Risk Factors Identified
          </h4>
          <div className="space-y-2">
            {predictionResult.riskFactors.map((risk, index) => (
              <div key={index} className="flex items-start">
                {getRiskIcon(risk)}
                <span className="ml-2 text-sm text-orange-800 dark:text-orange-200">{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {predictionResult.recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            AI Recommendations
          </h4>
          <div className="space-y-2">
            {predictionResult.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <span className="text-sm text-blue-800 dark:text-blue-200">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Timeline */}
      {(predictionResult.alertPredictions.lowAlerts.length > 0 || predictionResult.alertPredictions.highAlerts.length > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Predicted Alerts
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictionResult.alertPredictions.lowAlerts.length > 0 && (
              <div>
                <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Low Glucose Alerts:</h5>
                <div className="space-y-1">
                  {predictionResult.alertPredictions.lowAlerts.slice(0, 3).map((alert, index) => (
                    <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                      {Math.round(alert.time)} min: {alert.severity} hypoglycemia risk
                    </div>
                  ))}
                </div>
              </div>
            )}
            {predictionResult.alertPredictions.highAlerts.length > 0 && (
              <div>
                <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">High Glucose Alerts:</h5>
                <div className="space-y-1">
                  {predictionResult.alertPredictions.highAlerts.slice(0, 3).map((alert, index) => (
                    <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                      {Math.round(alert.time)} min: {alert.severity} hyperglycemia risk
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Disclaimer:</strong> These are AI-generated predictions for informational purposes only. 
          Always monitor your glucose levels regularly and follow your healthcare provider's advice. 
          Actual glucose values may vary significantly from predictions.
        </p>
      </div>
    </div>
  );
};

export default AdvancedPredictionChart;
