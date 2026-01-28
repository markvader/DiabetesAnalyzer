import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { format, addMinutes } from 'date-fns';
import { Brain, TrendingUp, TrendingDown, Activity, AlertTriangle, Zap } from 'lucide-react';
import { roundToDecimal } from '../utils/mathUtils';
import { GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { useTheme } from '../contexts/ThemeContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { predictGlucose } from '../services/patternDetectionService';
import { aiService } from '../services/aiService';
import { safeJsonParseFromText } from '../utils/safeJson';
import { asNumber } from '../services/aiValidation';
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
  ScriptableContext,
  TooltipItem,
  Plugin
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

interface GlucoseReading {
  sgv: number;
  date: number;
  direction?: string;
}

interface PredictionChartProps {
  readings: GlucoseReading[];
  useAI?: boolean;
}

const PredictionChart: React.FC<PredictionChartProps> = ({ readings, useAI = false }) => {
  const { theme } = useTheme();
  const { unit, getUnitLabel, formatGlucoseValue, convertToCurrentUnit, getGlucoseColorForValue, getCurrentGlucoseRanges } = useGlucoseFormatting();
  const isDark = theme === 'dark';
  const colors = isDark ? GLUCOSE_RANGES.COLORS.DARK : GLUCOSE_RANGES.COLORS;
  const ranges = getCurrentGlucoseRanges();

  const [predictions, setPredictions] = useState<number[]>([]);
  const [highScenario, setHighScenario] = useState<number[]>([]);
  const [lowScenario, setLowScenario] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionMethod, setPredictionMethod] = useState<'ai' | 'ml'>('ml');
  const [predictionConfidence, setPredictionConfidence] = useState<number>(0);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);

  useEffect(() => {
    if (!readings.length) return;

    const generatePredictions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let predictedValues: number[] = [];
        
        if (useAI) {
          // Try to use AI-powered predictions if API key is available
          try {
            const aiPredictions = await getAIPredictions(readings);
            if (aiPredictions && aiPredictions.length > 0) {
              predictedValues = aiPredictions;
              setPredictionMethod('ai');
              setPredictionConfidence(85);
            } else {
              // Fallback to basic algorithm if AI fails
              predictedValues = await predictGlucose(readings);
              setPredictionMethod('ml');
              setPredictionConfidence(70);
            }
          } catch (err) {
            console.error('AI prediction failed, falling back to basic algorithm:', err);
            predictedValues = await predictGlucose(readings);
            setPredictionMethod('ml');
            setPredictionConfidence(70);
          }
        } else {
          // Use basic algorithm
          predictedValues = await predictGlucose(readings);
          setPredictionMethod('ml');
          setPredictionConfidence(70);
        }
        
        setPredictions(predictedValues);
        
        // Generate high/low scenarios with more sophisticated variance modeling
        const high = predictedValues.map((p, i) => {
          // Increase variance over time (further predictions are less certain)
          const varianceFactor = 1.05 + (i * 0.002);
          return Math.round(p * varianceFactor);
        });
        
        const low = predictedValues.map((p, i) => {
          // Increase variance over time (further predictions are less certain)
          const varianceFactor = 0.95 - (i * 0.002);
          return Math.round(p * varianceFactor);
        });
        
        setHighScenario(high);
        setLowScenario(low);
        
        // Assess risk based on predictions
        assessRisk(predictedValues, low);
      } catch (err) {
        console.error('Error generating predictions:', err);
        setError('Failed to generate predictions');
      } finally {
        setLoading(false);
      }
    };

    generatePredictions();
  }, [readings, useAI, unit]); // Add unit dependency to regenerate predictions when unit changes

  // Assess risk based on predictions
  const assessRisk = (predictedValues: number[], lowScenario: number[]) => {
    const minPredicted = Math.min(...lowScenario);
    const maxPredicted = Math.max(...predictedValues);
    
    // Convert values to current display unit for comparison with ranges
    const minInCurrentUnit = convertToCurrentUnit(minPredicted);
    const maxInCurrentUnit = convertToCurrentUnit(maxPredicted);
    
    // Define critical thresholds based on current unit
    const criticalLow = unit === 'mmol' ? 3.0 : convertToCurrentUnit(54, 'mgdl'); // 54 mg/dL = 3.0 mmol/L
    const lowThreshold = ranges.LOW_THRESHOLD;
    const highThreshold = ranges.HIGH_THRESHOLD;
    const criticalHigh = unit === 'mmol' ? 16.7 : convertToCurrentUnit(300, 'mgdl'); // 300 mg/dL = 16.7 mmol/L
    
    if (minInCurrentUnit < criticalLow) {
      setRiskAssessment('critical-low');
    } else if (minInCurrentUnit < lowThreshold) {
      setRiskAssessment('low');
    } else if (maxInCurrentUnit > criticalHigh) {
      setRiskAssessment('critical-high');
    } else if (maxInCurrentUnit > highThreshold) {
      setRiskAssessment('high');
    } else {
      setRiskAssessment('normal');
    }
  };

  // Function to get AI-powered predictions - OPTIMIZED FOR TOKEN USAGE
  const getAIPredictions = async (glucoseReadings: GlucoseReading[]): Promise<number[]> => {
    // Get recent readings for prediction (last 24 readings = 2 hours with 5-min intervals)
    const recentReadings = glucoseReadings.slice(-24);
    
    // Format the data for the AI - SIMPLIFIED TO REDUCE TOKENS
    const formattedReadings = recentReadings.map(r => ({
      value: r.sgv,
      direction: r.direction || 'NONE'
    }));
    
    // Prepare the prompt - OPTIMIZED FOR TOKEN USAGE
    const prompt = `
      Based on these glucose readings (mg/dL), predict the next 36 values at 5-min intervals:
      ${JSON.stringify(formattedReadings)}
      
      Return ONLY a JSON array of 36 predicted values, nothing else.
      Example: [120, 118, 115, ...]
    `;
    
    // Try each provider in order until one succeeds
    for (const provider of aiService['providers']) {
      try {
        console.log(`Attempting prediction with ${provider.name}`);
        
        let response;
        
        if (provider.name === 'Anthropic') {
          // Special handling for Anthropic API
          response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'user', content: prompt }
              ],
              max_tokens: 500 // Reduced from 1000 to 500
            })
          });
        } else {
          // OpenAI and DeepSeek compatible APIs
          response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: 'You are a diabetes management AI assistant specializing in glucose prediction.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              max_tokens: 500 // Reduced from 1000 to 500
            })
          });
        }
        
        if (!response.ok) {
          throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        let content;
        
        if (provider.name === 'Anthropic') {
          content = data.content[0].text;
        } else {
          content = data.choices[0].message.content;
        }
        
        // Try to parse JSON from the response
        try {
          const parsed = safeJsonParseFromText(String(content ?? ''));
          if (!parsed.ok) {
            console.error(`Failed to parse ${provider.name} prediction response:`, parsed.error);
            continue;
          }

          const value: unknown = parsed.value;
          const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
          const predictionsValue = isRecord(value) ? value['predictions'] : undefined;
          const predictionValue = isRecord(value) ? value['prediction'] : undefined;
          const candidateArray: unknown[] = Array.isArray(value)
            ? value
            : Array.isArray(predictionsValue)
              ? predictionsValue
              : Array.isArray(predictionValue)
                ? predictionValue
                : [];
          
          console.log(`${provider.name} prediction successful`);
          
          // Ensure we have exactly 36 predictions
          const lastSgv = recentReadings[recentReadings.length - 1]?.sgv ?? 100;
          const validPredictions = candidateArray
            .map(v => asNumber(v, lastSgv, 40, 400))
            .slice(0, 36);
          while (validPredictions.length < 36) {
            // If we don't have enough predictions, extrapolate from the last ones
            if (validPredictions.length >= 2) {
              const lastValue = validPredictions[validPredictions.length - 1];
              const secondLastValue = validPredictions[validPredictions.length - 2];
              const trend = lastValue - secondLastValue;
              validPredictions.push(Math.max(40, Math.min(400, lastValue + trend)));
            } else {
              // If we have less than 2 predictions, use the last reading
              validPredictions.push(recentReadings[recentReadings.length - 1].sgv);
            }
          }
          
          return validPredictions;
        } catch (parseError) {
          console.error(`Failed to parse ${provider.name} prediction response:`, parseError);
          continue; // Try next provider
        }
      } catch (error) {
        console.error(`${provider.name} prediction failed:`, error);
        continue; // Try next provider
      }
    }
    
    // If all providers fail, return empty array to trigger fallback
    return [];
  };

  // Get the most recent reading
  const lastReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const currentTime = lastReading ? new Date(lastReading.date) : new Date();

  // Get historical data points (last 2 hours)
  const historicalData = readings
    .slice(-24)
    .map(reading => ({
      x: format(new Date(reading.date), 'HH:mm'),
      y: convertToCurrentUnit(reading.sgv)
    }));

  // Generate prediction data points
  const predictionData = predictions.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  // Generate high/low scenario data points
  const highData = highScenario.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  const lowData = lowScenario.map((value, index) => ({
    x: format(addMinutes(currentTime, index * 5), 'HH:mm'),
    y: convertToCurrentUnit(value)
  }));

  // Create gradient for prediction line
  const createGradient = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(75, 192, 192, 0.4)');
    gradient.addColorStop(1, isDark ? 'rgba(96, 165, 250, 0)' : 'rgba(75, 192, 192, 0)');
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
      {
        label: 'Predicted',
        data: predictionData,
        borderColor: isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(75, 192, 192, 1)',
        backgroundColor: function(context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) {
            return null;
          }
          return createGradient(ctx);
        },
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 3,
        fill: true,
        tension: 0.4
      },
      {
        label: 'High Scenario',
        data: highData,
        borderColor: colors.HIGH,
        backgroundColor: 'transparent',
        borderDash: [3, 3],
        pointRadius: 0,
        borderWidth: 1.5,
        fill: false,
        tension: 0.4
      },
      {
        label: 'Low Scenario',
        data: lowData,
        borderColor: colors.LOW,
        backgroundColor: 'transparent',
        borderDash: [3, 3],
        pointRadius: 0,
        borderWidth: 1.5,
        fill: false,
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
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        titleColor: isDark ? '#e5e7eb' : '#111827',
        bodyColor: isDark ? '#e5e7eb' : '#111827',
        borderColor: isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatGlucoseValue(value, unit, true)}`;
          }
        }
      }
    },
    scales: {
      y: {
        min: ranges.DISPLAY_MIN,
        max: ranges.DISPLAY_MAX,
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#e5e7eb' : '#111827',
          callback: function(value: string | number) {
            return `${Number(value)} ${getUnitLabel()}`;
          }
        },
        title: {
          display: true,
          text: `Glucose (${getUnitLabel()})`,
          color: isDark ? '#e5e7eb' : '#111827',
          font: {
            size: 12,
            weight: 'normal'
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          maxTicksLimit: 12,
          color: isDark ? '#e5e7eb' : '#111827',
          font: {
            size: 11
          }
        },
        title: {
          display: true,
          text: 'Time',
          color: isDark ? '#e5e7eb' : '#111827',
          font: {
            size: 12,
            weight: 'normal'
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: 0.2,
        to: 0.4,
        loop: false
      }
    },
    elements: {
      line: {
        tension: 0.4
      }
    }
  };

  // Target range plugin
  const targetRangePlugin = {
    id: 'targetRange',
    beforeDraw(chart: ChartJS<'line'>) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      
      const highY = scales.y.getPixelForValue(ranges.HIGH_THRESHOLD);
      const lowY = scales.y.getPixelForValue(ranges.LOW_THRESHOLD);
      
      // High range (transparent red)
      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(220, 53, 69, 0.05)';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, highY - chartArea.top);
      
      // Target range (transparent green)
      ctx.fillStyle = isDark ? 'rgba(96, 165, 250, 0.05)' : 'rgba(53, 162, 235, 0.05)';
      ctx.fillRect(chartArea.left, highY, chartArea.width, lowY - highY);
      
      // Low range (transparent red)
      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(220, 53, 69, 0.05)';
      ctx.fillRect(chartArea.left, lowY, chartArea.width, chartArea.bottom - lowY);
    }
  } satisfies Plugin<'line'>;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Glucose Prediction</h3>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Generating predictions...</p>
            {useAI && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Using AI to analyze your unique glucose patterns</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Glucose Prediction</h3>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Glucose Prediction</h3>
          {predictionMethod === 'ai' && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full">
              AI-Powered
            </span>
          )}
        </div>
        {lastReading && (
          <div className="text-lg font-semibold flex items-center">
            <span className="text-gray-700 dark:text-gray-300 mr-2 text-sm">Current:</span>
            <span className={getGlucoseColorForValue(lastReading.sgv)}>
              {formatGlucoseValue(lastReading.sgv)}
            </span>
            {lastReading.direction && (
              <span className="ml-2">
                {getDirectionArrow(lastReading.direction)}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="h-72 mb-4">
        <Line data={data} options={options} plugins={[targetRangePlugin]} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            {predictions.length > 0 && predictions[0] > lastReading.sgv ? (
              <TrendingUp className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
            ) : (
              <TrendingDown className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
            )}
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Trend Analysis</h4>
          </div>
          <div className="text-blue-800 dark:text-blue-200">
            {predictions.length > 0 && lastReading && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Trend:</span>
                  <span className={`font-medium ${
                    predictions[0] > lastReading.sgv ? 'text-red-500 dark:text-red-400' : 
                    predictions[0] < lastReading.sgv ? 'text-green-500 dark:text-green-400' : 
                    'text-blue-500 dark:text-blue-400'
                  }`}>
                    {predictions[0] > lastReading.sgv ? 'Rising' : 
                     predictions[0] < lastReading.sgv ? 'Falling' : 
                     'Stable'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Rate:</span>
                  <span className="font-medium">
                    {predictions[0] > lastReading.sgv ? '+' : ''}
                    {formatGlucoseValue(predictions[0] - lastReading.sgv, 'mgdl', false)}/5min
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Activity className="h-5 w-5 text-purple-500 dark:text-purple-400 mr-2" />
            <h4 className="font-medium text-blue-900 dark:text-blue-100">3-Hour Forecast</h4>
          </div>
          <div className="text-blue-800 dark:text-blue-200">
            {predictions.length > 0 ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Range:</span>
                  <span className="font-medium">
                    {formatGlucoseValue(Math.min(...lowScenario), 'mgdl', true)} - {formatGlucoseValue(Math.max(...highScenario), 'mgdl', true)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Confidence:</span>
                  <span className="font-medium">{predictionConfidence}%</span>
                </div>
              </div>
            ) : 'Calculating predictions...'}
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            {riskAssessment && (
              <>
                {riskAssessment.includes('critical') ? (
                  <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
                ) : riskAssessment === 'high' || riskAssessment === 'low' ? (
                  <Zap className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mr-2" />
                ) : (
                  <Activity className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
                )}
              </>
            )}
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Risk Assessment</h4>
          </div>
          <div className="text-blue-800 dark:text-blue-200">
            {riskAssessment ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Status:</span>
                  <span className={`font-medium ${
                    riskAssessment === 'critical-low' ? 'text-red-500 dark:text-red-400' : 
                    riskAssessment === 'low' ? 'text-yellow-500 dark:text-yellow-400' : 
                    riskAssessment === 'critical-high' ? 'text-red-500 dark:text-red-400' : 
                    riskAssessment === 'high' ? 'text-yellow-500 dark:text-yellow-400' : 
                    'text-green-500 dark:text-green-400'
                  }`}>
                    {riskAssessment === 'critical-low' ? 'Critical Low Risk' : 
                     riskAssessment === 'low' ? 'Low Glucose Risk' : 
                     riskAssessment === 'critical-high' ? 'Critical High Risk' : 
                     riskAssessment === 'high' ? 'High Glucose Risk' : 
                     'Normal Range'}
                  </span>
                </div>
                <div className="text-sm mt-1">
                  {riskAssessment === 'critical-low' ? 'Urgent action may be needed' : 
                   riskAssessment === 'low' ? 'Monitor closely, consider carbs' : 
                   riskAssessment === 'critical-high' ? 'Correction may be needed' : 
                   riskAssessment === 'high' ? 'Monitor closely' : 
                   'Expected to stay in range'}
                </div>
              </div>
            ) : 'Assessing risk...'}
          </div>
        </div>
      </div>
      
      {/* Prediction details */}
      <div className="mt-6 bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Prediction Details</h4>
          <div className="flex items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Powered by:</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
              {predictionMethod === 'ai' ? 'AI Analysis' : 'Machine Learning'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">1 hour prediction:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {predictions.length >= 12 ? formatGlucoseValue(predictions[11], 'mgdl', true) : '–'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">3 hour prediction:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {predictions.length >= 36 ? formatGlucoseValue(predictions[35], 'mgdl', true) : '–'}
              </span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Lowest predicted:</span>
              <span className={`font-medium ${
                convertToCurrentUnit(Math.min(...lowScenario)) < ranges.LOW_THRESHOLD ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {formatGlucoseValue(Math.min(...lowScenario), 'mgdl', true)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Highest predicted:</span>
              <span className={`font-medium ${
                convertToCurrentUnit(Math.max(...highScenario)) > ranges.HIGH_THRESHOLD ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {formatGlucoseValue(Math.max(...highScenario), 'mgdl', true)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Note: Predictions are estimates based on historical patterns and should be used as a guide only.
          {predictionMethod === 'ai' ? ' AI analysis provides personalized predictions based on your unique glucose patterns.' : ''}
        </div>
      </div>
    </div>
  );

  function getDirectionArrow(direction: string) {
    switch (direction) {
      case 'DoubleUp':
        return <span className="text-red-500 dark:text-red-400">↑↑</span>;
      case 'SingleUp':
        return <span className="text-red-500 dark:text-red-400">↑</span>;
      case 'FortyFiveUp':
        return <span className="text-orange-500 dark:text-orange-400">↗</span>;
      case 'Flat':
        return <span className="text-green-500 dark:text-green-400">→</span>;
      case 'FortyFiveDown':
        return <span className="text-blue-500 dark:text-blue-400">↘</span>;
      case 'SingleDown':
        return <span className="text-blue-500 dark:text-blue-400">↓</span>;
      case 'DoubleDown':
        return <span className="text-purple-500 dark:text-purple-400">↓↓</span>;
      default:
        return null;
    }
  }
};

export default PredictionChart;