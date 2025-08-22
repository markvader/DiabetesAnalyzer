import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend,
  ChartOptions
} from 'chart.js';
import { formatPercentage } from '../utils/mathUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TimeInRangeProps {
  timeInRange: number;
  highPercentage: number;
  lowPercentage: number;
}

const TimeInRangeChart: React.FC<TimeInRangeProps> = ({ 
  timeInRange, 
  highPercentage, 
  lowPercentage 
}) => {
  const { theme } = useTheme();
  const { unit, getCurrentGlucoseRanges, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const isDark = theme === 'dark';
  
  // Defensive coding: ensure we have numbers, not objects
  const safeTimeInRange = typeof timeInRange === 'number' ? timeInRange : 0;
  const safeHighPercentage = typeof highPercentage === 'number' ? highPercentage : 0;
  const safeLowPercentage = typeof lowPercentage === 'number' ? lowPercentage : 0;
  
  // Debug logging to catch the issue
  if (typeof timeInRange !== 'number' || typeof highPercentage !== 'number' || typeof lowPercentage !== 'number') {
    console.error('❌ TimeInRangeChart received non-number props:', {
      timeInRange: { value: timeInRange, type: typeof timeInRange },
      highPercentage: { value: highPercentage, type: typeof highPercentage },
      lowPercentage: { value: lowPercentage, type: typeof lowPercentage }
    });
  }
  
  // Ultra-safe percentage formatter to prevent {percent} object errors
  const ultraSafeFormatPercentage = (value: any): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return formatPercentage(value);
    }
    if (typeof value === 'object' && value !== null) {
      console.error('❌ ultraSafeFormatPercentage caught object:', value);
      // If it's an object with percent property, extract it
      if ('percent' in value && typeof value.percent === 'number') {
        return formatPercentage(value.percent);
      }
      return '0.0%';
    }
    console.error('❌ ultraSafeFormatPercentage received invalid value:', value, typeof value);
    return '0.0%';
  };
  
  const ranges = getCurrentGlucoseRanges();

  const data = {
    labels: [
      `In Range (${formatGlucoseValue(ranges.TARGET_MIN, unit, false)}-${formatGlucoseValue(ranges.TARGET_MAX, unit, false)} ${getUnitLabel()})`, 
      `High (>${formatGlucoseValue(ranges.HIGH_THRESHOLD, unit, false)} ${getUnitLabel()})`, 
      `Low (<${formatGlucoseValue(ranges.LOW_THRESHOLD, unit, false)} ${getUnitLabel()})`
    ],
    datasets: [
      {
        data: [safeTimeInRange, safeHighPercentage, safeLowPercentage],
        backgroundColor: [
          isDark ? 'rgba(96, 165, 250, 0.7)' : 'rgba(75, 192, 75, 0.7)',
          isDark ? 'rgba(251, 191, 36, 0.7)' : 'rgba(255, 159, 64, 0.7)',
          isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(255, 99, 132, 0.7)',
        ],
        borderColor: [
          isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(75, 192, 75, 1)',
          isDark ? 'rgba(251, 191, 36, 1)' : 'rgba(255, 159, 64, 1)',
          isDark ? 'rgba(239, 68, 68, 1)' : 'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          padding: 20,
          boxWidth: 15,
          color: isDark ? '#e5e7eb' : '#111827',
          font: {
            size: 12
          },
          generateLabels: (chart) => {
            const labels = ChartJS.defaults.plugins.legend.labels.generateLabels!(chart);
            return labels.map(label => ({
              ...label,
              text: label.text?.split(' (')[0] || ''
            }));
          }
        },
        title: {
          display: true,
          padding: { bottom: 10 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw ? ultraSafeFormatPercentage(Number(context.raw)) : '';
            return `${label}: ${value}`;
          }
        }
      }
    },
    cutout: '70%',
    layout: {
      padding: {
        right: 100 // Add padding to accommodate legend
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full transition-colors duration-200">
      <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Time in Range</h3>
      <div className="relative h-64">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ left: '-50px' }}>
          <div className="text-center">
            <span className="block text-3xl font-bold text-green-600 dark:text-green-400">
              {ultraSafeFormatPercentage(safeTimeInRange)}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">In Range</span>
          </div>
        </div>
      </div>
      
      {/* Range details below the chart */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
          <div className="text-green-600 dark:text-green-400 font-semibold">{ultraSafeFormatPercentage(safeTimeInRange)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{formatGlucoseValue(ranges.TARGET_MIN, unit, false)}-{formatGlucoseValue(ranges.TARGET_MAX, unit, false)} {getUnitLabel()}</div>
        </div>
        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <div className="text-orange-500 dark:text-orange-400 font-semibold">{ultraSafeFormatPercentage(safeHighPercentage)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">&gt;{formatGlucoseValue(ranges.HIGH_THRESHOLD, unit, false)} {getUnitLabel()}</div>
        </div>
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <div className="text-red-500 dark:text-red-400 font-semibold">{ultraSafeFormatPercentage(safeLowPercentage)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">&lt;{formatGlucoseValue(ranges.LOW_THRESHOLD, unit, false)} {getUnitLabel()}</div>
        </div>
      </div>
    </div>
  );
};

export default TimeInRangeChart;