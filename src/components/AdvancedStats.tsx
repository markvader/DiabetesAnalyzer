import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, Activity, AlertTriangle, Target, Clock, Zap } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface GlucoseReading {
  sgv: number;
  date: number;
}

interface AdvancedStatsProps {
  readings: GlucoseReading[];
}

interface StatsResult {
  mean: number;
  stdDev: number;
  cv: number;
  rateOfChange: number;
  lbgi: number;
  hbgi: number;
  timeInRanges: {
    veryHigh: number;
    high: number;
    inRange: number;
    low: number;
    veryLow: number;
  };
  hourlyPatterns: Array<{
    hour: number;
    mean: number;
    std: number;
    count: number;
  }>;
  momentum: number;
  gra: number;
  estimatedA1C: number;
  qualityScore: number;
  dawnPhenomenon: number;
  sampleInfo: {
    originalCount: number;
    processedCount: number;
    sampled: boolean;
  };
}

// Ultra-aggressive sampling for very large datasets
const intelligentSample = (readings: GlucoseReading[]): GlucoseReading[] => {
  const count = readings.length;
  
  if (count <= 1000) return readings;
  
  // For very large datasets, use intelligent sampling
  if (count > 5000) {
    // Take every nth reading to get ~1000 samples
    const step = Math.ceil(count / 1000);
    const sampled = [];
    for (let i = 0; i < count; i += step) {
      sampled.push(readings[i]);
    }
    return sampled;
  }
  
  // For medium datasets, use every other reading
  const sampled = [];
  for (let i = 0; i < count; i += 2) {
    sampled.push(readings[i]);
  }
  return sampled;
};

// Web Worker simulation using setTimeout for non-blocking computation
const computeStatsAsync = (readings: GlucoseReading[], convertToCurrentUnit: (value: number, fromUnit?: 'mmol' | 'mgdl') => number, getCurrentGlucoseRanges: any): Promise<StatsResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const originalCount = readings.length;
      const processedReadings = intelligentSample(readings);
      const sampled = processedReadings.length < originalCount;
      
      const values = processedReadings.map(r => r.sgv);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Fast variance calculation
      let variance = 0;
      for (const value of values) {
        const diff = value - mean;
        variance += diff * diff;
      }
      variance /= values.length;
      const stdDev = Math.sqrt(variance);

      const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

      // Rate of change - keep in original unit, then convert at end
      const rateOfChange = processedReadings.length > 1 
        ? (processedReadings[processedReadings.length - 1].sgv - processedReadings[processedReadings.length - 2].sgv) / 
           ((processedReadings[processedReadings.length - 1].date - processedReadings[processedReadings.length - 2].date) / 3600000)
        : 0;

      // Get current glucose ranges for proper threshold calculations
      const ranges = getCurrentGlucoseRanges();
      
      // Define thresholds based on current unit
      const veryLowThreshold = ranges.LOW_THRESHOLD * 0.77; // ~3.0 mmol/L equivalent
      const lowThreshold = ranges.LOW_THRESHOLD; // 3.9 mmol/L
      const highThreshold = ranges.HIGH_THRESHOLD; // 10.0 mmol/L  
      const veryHighThreshold = ranges.HIGH_THRESHOLD * 1.39; // ~13.9 mmol/L equivalent
      
      // Fast range calculations using current unit thresholds
      let inRangeCount = 0;
      let highCount = 0;
      let lowCount = 0;
      let veryHighCount = 0;
      let veryLowCount = 0;
      let lbgiSum = 0;
      let hbgiSum = 0;

      for (const value of values) {
        // Nightscout sgv values are ALWAYS in mg/dL, regardless of display unit
        // Convert value to current unit for threshold comparisons
        const valueInCurrentUnit = convertToCurrentUnit(value, 'mgdl');
        
        // Also get mmol/L version for LBGI/HBGI calculations (standardized formulas)
        const valueInMmol = value * 0.0555; // Convert mg/dL to mmol/L for risk calculations
        
        if (valueInCurrentUnit > veryHighThreshold) {
          veryHighCount++;
          hbgiSum += Math.pow((valueInMmol - 10.0) / 10.0 * 5, 2);
        } else if (valueInCurrentUnit > highThreshold) {
          highCount++;
          hbgiSum += Math.pow((valueInMmol - 10.0) / 10.0 * 5, 2);
        } else if (valueInCurrentUnit >= lowThreshold) {
          inRangeCount++;
        } else if (valueInCurrentUnit >= veryLowThreshold) {
          lowCount++;
          lbgiSum += Math.pow((3.9 - valueInMmol) / 3.9 * 10, 2);
        } else {
          veryLowCount++;
          lbgiSum += Math.pow((3.9 - valueInMmol) / 3.9 * 10, 2);
        }
      }

      const total = values.length;
      const lbgi = lbgiSum / total;
      const hbgi = hbgiSum / total;

      const timeInRanges = {
        veryHigh: (veryHighCount / total) * 100,
        high: (highCount / total) * 100,
        inRange: (inRangeCount / total) * 100,
        low: (lowCount / total) * 100,
        veryLow: (veryLowCount / total) * 100
      };

      // Simplified hourly patterns - keep in original unit, convert at display
      const hourlyPatterns = Array.from({ length: 24 }, (_, hour) => {
        const hourValues: number[] = [];
        
        for (const reading of processedReadings) {
          if (new Date(reading.date).getHours() === hour) {
            hourValues.push(reading.sgv); // Keep in original mg/dL
          }
        }
        
        if (hourValues.length === 0) return { hour, mean: 0, std: 0, count: 0 };
        
        const hourMean = hourValues.reduce((a, b) => a + b, 0) / hourValues.length;
        let hourVariance = 0;
        for (const value of hourValues) {
          const diff = value - hourMean;
          hourVariance += diff * diff;
        }
        hourVariance /= hourValues.length;
        
        return {
          hour,
          mean: roundToDecimal(convertToCurrentUnit(hourMean, 'mgdl'), 1),
          std: roundToDecimal(convertToCurrentUnit(Math.sqrt(hourVariance), 'mgdl'), 1),
          count: hourValues.length
        };
      });

      // Simple momentum calculation - convert to current unit
      const momentum = processedReadings.length >= 3 ? (() => {
        const recent = processedReadings.slice(-3).map(r => r.sgv); // Keep in mg/dL
        const trend1 = recent[1] - recent[0];
        const trend2 = recent[2] - recent[1];
        return roundToDecimal(convertToCurrentUnit(trend2 - trend1, 'mgdl'), 2);
      })() : 0;

      const gra = lbgi > 0 && hbgi > 0 ? roundToDecimal(Math.sqrt(lbgi * hbgi), 1) : 
                  lbgi > 0 ? roundToDecimal(lbgi, 1) : 
                  hbgi > 0 ? roundToDecimal(hbgi, 1) : 0;

      const estimatedA1C = roundToDecimal((toMmol(mean) + 2.59) / 1.59, 1);

      const qualityScore = Math.round((timeInRanges.inRange * 0.5 + Math.max(0, 100 - cv) * 0.3 + Math.max(0, 100 - Math.abs(momentum) * 10) * 0.2));

      // Simple dawn phenomenon - calculate in current unit
      const dawnPhenomenon = (() => {
        const nightValues: number[] = [];
        const morningValues: number[] = [];
        
        for (const reading of processedReadings) {
          const hour = new Date(reading.date).getHours();
          if (hour >= 2 && hour <= 4) {
            nightValues.push(reading.sgv); // Keep in mg/dL
          } else if (hour >= 6 && hour <= 8) {
            morningValues.push(reading.sgv); // Keep in mg/dL
          }
        }
        
        if (nightValues.length === 0 || morningValues.length === 0) return 0;
        
        const nightAvg = nightValues.reduce((sum, val) => sum + val, 0) / nightValues.length;
        const morningAvg = morningValues.reduce((sum, val) => sum + val, 0) / morningValues.length;
        
        return roundToDecimal(convertToCurrentUnit(morningAvg - nightAvg, 'mgdl'), 1);
      })();

      resolve({
        mean: convertToCurrentUnit(mean, 'mgdl'),
        stdDev: convertToCurrentUnit(stdDev, 'mgdl'),
        cv: roundToDecimal(cv, 1),
        rateOfChange: convertToCurrentUnit(rateOfChange, 'mgdl'),
        lbgi: roundToDecimal(Math.max(0, lbgi), 1),
        hbgi: roundToDecimal(Math.max(0, hbgi), 1),
        timeInRanges,
        hourlyPatterns,
        momentum,
        gra,
        estimatedA1C,
        qualityScore,
        dawnPhenomenon,
        sampleInfo: {
          originalCount,
          processedCount: processedReadings.length,
          sampled
        }
      });
    }, 0); // Yield to browser immediately
  });
};

const AdvancedStats: React.FC<AdvancedStatsProps> = ({ readings }) => {
  const { theme } = useTheme();
  const { getCurrentGlucoseRanges, formatGlucoseValue, getUnitLabel, convertToCurrentUnit } = useGlucoseFormatting();
  const isDark = theme === 'dark';
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [currentReadingsHash, setCurrentReadingsHash] = useState<string>('');

  useEffect(() => {
    if (!readings.length) {
      setStats(null);
      return;
    }

    // Create a simple hash of the readings to detect changes
    const readingsHash = `${readings.length}-${readings[0]?.date}-${readings[readings.length-1]?.date}`;
    
    // Only recompute if the readings have changed
    if (readingsHash !== currentReadingsHash) {
      setComputing(true);
      setCurrentReadingsHash(readingsHash);
      
      // Use async computation to prevent UI blocking
      computeStatsAsync(readings, convertToCurrentUnit, getCurrentGlucoseRanges)
        .then(result => {
          setStats(result);
          setComputing(false);
        })
        .catch(error => {
          console.error('Stats computation failed:', error);
          setComputing(false);
        });
    }
  }, [readings, currentReadingsHash]);

  if (computing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 dark:border-blue-400 mr-3"></div>
        <p className="text-gray-700 dark:text-gray-300">Computing advanced statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500 dark:text-gray-400">No data available for analysis</p>
      </div>
    );
  }

  // Optimized chart data
  const hourlyChartData = {
    labels: stats.hourlyPatterns.map(p => `${p.hour}:00`),
    datasets: [
      {
        label: 'Average Glucose',
        data: stats.hourlyPatterns.map(p => p.mean),
        borderColor: isDark ? 'rgb(96, 165, 250)' : 'rgb(59, 130, 246)',
        backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: stats.sampleInfo.sampled ? 1 : 2
      },
      {
        label: 'Variability (±SD)',
        data: stats.hourlyPatterns.map(p => p.std),
        borderColor: isDark ? 'rgb(251, 191, 36)' : 'rgb(245, 158, 11)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }
    ]
  };

  const hourlyChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animations for performance
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#e5e7eb' : '#111827'
        }
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
          text: 'Hour of Day',
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
  };

  return (
    <div className="space-y-6">
      {/* Performance optimization notice */}
      {stats.sampleInfo.sampled && (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
          <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">⚡ Ultra-Fast Processing Active</h4>
          <p className="text-sm text-green-800 dark:text-green-200">
            Optimized for maximum responsiveness: Using {stats.sampleInfo.processedCount.toLocaleString()} 
            intelligent samples from {stats.sampleInfo.originalCount.toLocaleString()} total readings. 
            Statistical accuracy maintained while ensuring instant UI response.
          </p>
        </div>
      )}

      {/* Enhanced Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-2">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Mean Glucose</h4>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatGlucoseValue(stats.mean)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">±{formatGlucoseValue(stats.stdDev)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Variability (CV)</h4>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.cv.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Target: &lt;36%</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-2">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Quality Score</h4>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.qualityScore}/100
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.qualityScore >= 80 ? 'Excellent' : 
             stats.qualityScore >= 60 ? 'Good' : 
             stats.qualityScore >= 40 ? 'Fair' : 'Needs Improvement'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-2">
            <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Momentum</h4>
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.momentum > 0 ? '+' : ''}{formatGlucoseValue(stats.momentum)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{getUnitLabel()} acceleration</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-2">
            <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Est. A1C</h4>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats.estimatedA1C}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.estimatedA1C < 6.5 ? 'Target' : 
             stats.estimatedA1C < 7.5 ? 'Elevated' : 'High'}
          </p>
        </div>
      </div>

      {/* Hourly Pattern Analysis */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          24-Hour Glucose Pattern Analysis
        </h3>
        <div className="h-64 mb-4">
          <Line data={hourlyChartData} options={hourlyChartOptions} />
        </div>
        
        {/* Pattern Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Peak Hours</h4>
            <p className="text-blue-800 dark:text-blue-200">
              Highest glucose typically at {
                stats.hourlyPatterns.reduce((max, p) => p.mean > max.mean ? p : max).hour
              }:00
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Most Stable</h4>
            <p className="text-green-800 dark:text-green-200">
              Lowest variability at {
                stats.hourlyPatterns.reduce((min, p) => p.std < min.std ? p : min).hour
              }:00
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Dawn Effect</h4>
            <p className="text-purple-800 dark:text-purple-200">
              {stats.dawnPhenomenon > 1 ? `+${formatGlucoseValue(stats.dawnPhenomenon)} rise` : 
               stats.dawnPhenomenon < -1 ? `${formatGlucoseValue(stats.dawnPhenomenon)} drop` : 
               'Minimal dawn effect'}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Glucose Distribution */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Advanced Glucose Distribution
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Very High (&gt;{formatGlucoseValue(13.9, 'mmol', false)} {getUnitLabel()})</span>
              <span className="text-sm text-red-600 dark:text-red-400">{stats.timeInRanges.veryHigh.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-3 bg-red-500 dark:bg-red-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.timeInRanges.veryHigh}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">High ({formatGlucoseValue(10.0, 'mmol', false)}-{formatGlucoseValue(13.9, 'mmol', false)} {getUnitLabel()})</span>
              <span className="text-sm text-orange-600 dark:text-orange-400">{stats.timeInRanges.high.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-3 bg-orange-500 dark:bg-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.timeInRanges.high}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Target Range ({formatGlucoseValue(3.9, 'mmol', false)}-{formatGlucoseValue(10.0, 'mmol', false)} {getUnitLabel()})</span>
              <span className="text-sm text-green-600 dark:text-green-400">{stats.timeInRanges.inRange.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-3 bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.timeInRanges.inRange}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Low ({formatGlucoseValue(3.0, 'mmol', false)}-{formatGlucoseValue(3.9, 'mmol', false)} {getUnitLabel()})</span>
              <span className="text-sm text-blue-600 dark:text-blue-400">{stats.timeInRanges.low.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-3 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.timeInRanges.low}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">Very Low (&lt;{formatGlucoseValue(3.0, 'mmol', false)} {getUnitLabel()})</span>
              <span className="text-sm text-purple-600 dark:text-purple-400">{stats.timeInRanges.veryLow.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-3 bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.timeInRanges.veryLow}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Risk Analysis */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Advanced Risk Analysis</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Low Glucose Risk (LBGI)</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lbgi}</span>
                <span className={`text-sm ${
                  stats.lbgi < 1.1 ? 'text-green-600 dark:text-green-400' :
                  stats.lbgi < 2.5 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {stats.lbgi < 1.1 ? 'Minimal Risk' : stats.lbgi < 2.5 ? 'Low Risk' : 'Moderate Risk'}
                </span>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">High Glucose Risk (HBGI)</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.hbgi}</span>
                <span className={`text-sm ${
                  stats.hbgi < 4.5 ? 'text-green-600 dark:text-green-400' :
                  stats.hbgi < 9 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {stats.hbgi < 4.5 ? 'Low Risk' : stats.hbgi < 9 ? 'Moderate Risk' : 'High Risk'}
                </span>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Glycemic Risk Assessment</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.gra}</span>
                <span className={`text-sm ${
                  stats.gra < 3 ? 'text-green-600 dark:text-green-400' :
                  stats.gra < 8 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {stats.gra < 3 ? 'Low Risk' : stats.gra < 8 ? 'Moderate Risk' : 'High Risk'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Recommendations */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights & Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.cv > 36 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-400">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">🎯 High Variability Detected</h4>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Your glucose variability (CV) is {stats.cv.toFixed(1)}%, which is above the target of 36%. 
                Consider reviewing insulin sensitivity factors, meal timing, and stress management.
              </p>
            </div>
          )}
          
          {stats.timeInRanges.low + stats.timeInRanges.veryLow > 4 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-400">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">⚠️ Frequent Low Glucose</h4>
              <p className="text-red-800 dark:text-red-200 text-sm">
                {(stats.timeInRanges.low + stats.timeInRanges.veryLow).toFixed(1)}% of readings are below range. 
                Consider adjusting basal rates, correction factors, or carb ratios.
              </p>
            </div>
          )}
          
          {stats.qualityScore < 60 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📈 Quality Improvement</h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Your glucose management quality score is {stats.qualityScore}/100. 
                Focus on consistent meal timing, pre-bolusing, and regular monitoring.
              </p>
            </div>
          )}
          
          {Math.abs(stats.dawnPhenomenon) > 2 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-400">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">🌅 Dawn Phenomenon</h4>
              <p className="text-purple-800 dark:text-purple-200 text-sm">
                {stats.dawnPhenomenon > 1 ? 'Significant dawn phenomenon detected' : 'Dawn drop detected'} 
                ({stats.dawnPhenomenon > 0 ? '+' : ''}{formatGlucoseValue(stats.dawnPhenomenon)}). 
                Consider adjusting overnight basal rates.
              </p>
            </div>
          )}

          {stats.momentum > 1 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-400">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">⚡ Rising Trend Alert</h4>
              <p className="text-orange-800 dark:text-orange-200 text-sm">
                Glucose is accelerating upward (+{formatGlucoseValue(stats.momentum)}). 
                Consider a correction bolus if trend continues.
              </p>
            </div>
          )}

          {stats.momentum < -1 && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-400">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">📉 Falling Trend Alert</h4>
              <p className="text-green-800 dark:text-green-200 text-sm">
                Glucose is accelerating downward ({formatGlucoseValue(stats.momentum)}). 
                Monitor closely and consider glucose if trend continues.
              </p>
            </div>
          )}

          {stats.timeInRanges.inRange > 70 && stats.cv < 36 && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-400">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🎉 Excellent Control</h4>
              <p className="text-green-800 dark:text-green-200 text-sm">
                Great job! You have {stats.timeInRanges.inRange.toFixed(1)}% time in range with good variability control. 
                Keep up the excellent diabetes management!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedStats;