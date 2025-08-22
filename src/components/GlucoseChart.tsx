import React from 'react';
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
import { format } from 'date-fns';
import { GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTheme } from '../contexts/ThemeContext';

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
  dateString: string;
}

interface GlucoseChartProps {
  readings: GlucoseReading[];
  title?: string;
}

const GlucoseChart: React.FC<GlucoseChartProps> = ({ readings, title = 'Glucose Readings' }) => {
  const { theme } = useTheme();
  const { getCurrentGlucoseRanges, convertToCurrentUnit, unit } = useGlucoseFormatting();
  const isDark = theme === 'dark';

  const colors = isDark ? GLUCOSE_RANGES.COLORS.DARK : GLUCOSE_RANGES.COLORS;

  const processedData = React.useMemo(() => {
    if (!readings || readings.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    const sortedReadings = [...readings].sort((a, b) => a.date - b.date);
    
    const labels = sortedReadings.map(reading => 
      format(new Date(reading.date), 'dd.MM. HH:mm')
    );
    
    const glucoseValues = sortedReadings.map(reading => convertToCurrentUnit(reading.sgv, 'mgdl'));
    const ranges = getCurrentGlucoseRanges();

    // Create continuous segments for each range
    const segments = {
      inRange: [] as { start: number; data: number[] }[],
      high: [] as { start: number; data: number[] }[],
      low: [] as { start: number; data: number[] }[]
    };

    let currentSegment = {
      type: null as 'inRange' | 'high' | 'low' | null,
      start: 0,
      data: [] as number[]
    };

    glucoseValues.forEach((value, index) => {
      let type: 'inRange' | 'high' | 'low';
      
      if (value > ranges.HIGH_THRESHOLD) {
        type = 'high';
      } else if (value < ranges.LOW_THRESHOLD) {
        type = 'low';
      } else {
        type = 'inRange';
      }

      if (type !== currentSegment.type) {
        if (currentSegment.type) {
          segments[currentSegment.type].push({
            start: currentSegment.start,
            data: currentSegment.data
          });
        }
        currentSegment = {
          type,
          start: index,
          data: []
        };
      }
      currentSegment.data.push(value);
    });

    // Add the last segment
    if (currentSegment.type) {
      segments[currentSegment.type].push({
        start: currentSegment.start,
        data: currentSegment.data
      });
    }

    // Create datasets for each segment
    const datasets: any[] = [];

    // Process in-range segments
    segments.inRange.forEach((segment, i) => {
      const data = new Array(segment.start).fill(null).concat(segment.data);
      if (data.length < labels.length) {
        data.push(...new Array(labels.length - data.length).fill(null));
      }
      datasets.push({
        label: i === 0 ? 'In Range' : 'In Range (continued)',
        data,
        borderColor: colors.IN_RANGE,
        backgroundColor: colors.IN_RANGE_BG,
        pointRadius: 2,
        tension: 0.1,
        fill: false,
        showLine: true
      });
    });

    // Process high segments
    segments.high.forEach((segment, i) => {
      const data = new Array(segment.start).fill(null).concat(segment.data);
      if (data.length < labels.length) {
        data.push(...new Array(labels.length - data.length).fill(null));
      }
      datasets.push({
        label: i === 0 ? 'High' : 'High (continued)',
        data,
        borderColor: colors.HIGH,
        backgroundColor: colors.HIGH_BG,
        pointRadius: 2,
        tension: 0.1,
        fill: false,
        showLine: true
      });
    });

    // Process low segments
    segments.low.forEach((segment, i) => {
      const data = new Array(segment.start).fill(null).concat(segment.data);
      if (data.length < labels.length) {
        data.push(...new Array(labels.length - data.length).fill(null));
      }
      datasets.push({
        label: i === 0 ? 'Low' : 'Low (continued)',
        data,
        borderColor: colors.LOW,
        backgroundColor: colors.LOW_BG,
        pointRadius: 2,
        tension: 0.1,
        fill: false,
        showLine: true
      });
    });
    
    return {
      labels,
      datasets
    };
  }, [readings, colors, getCurrentGlucoseRanges, convertToCurrentUnit, unit]);
  
  const options: ChartOptions<'line'> = React.useMemo(() => {
    const ranges = getCurrentGlucoseRanges();
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            filter: (item: any) => !item.text.includes('(continued)'),
            color: isDark ? '#e5e7eb' : '#111827'
          }
        },
        title: {
          display: !!title,
          text: title,
          color: isDark ? '#e5e7eb' : '#111827'
        },
        tooltip: {
          intersect: false,
          mode: 'index',
          callbacks: {
            label: function(context: any) {
              const value = context.parsed.y;
              const formattedValue = unit === 'mmol' ? value.toFixed(1) : Math.round(value);
              return `${context.dataset.label}: ${formattedValue} ${unit === 'mmol' ? 'mmol/L' : 'mg/dL'}`;
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
            callback: function(value) {
              return unit === 'mmol' ? Number(value).toFixed(1) : Math.round(Number(value));
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
            color: isDark ? '#e5e7eb' : '#111827'
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }, [isDark, title, getCurrentGlucoseRanges, unit]);
  
  const targetRangePlugin = React.useMemo(() => {
    const ranges = getCurrentGlucoseRanges();
    
    return {
      id: 'targetRange',
      beforeDraw(chart: any) {
        const { ctx, chartArea, scales } = chart;
        
        const highY = scales.y.getPixelForValue(ranges.HIGH_THRESHOLD);
        ctx.fillStyle = colors.HIGH_BG;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, highY - chartArea.top);
        
        const lowY = scales.y.getPixelForValue(ranges.LOW_THRESHOLD);
        ctx.fillStyle = colors.IN_RANGE_BG;
        ctx.fillRect(chartArea.left, highY, chartArea.width, lowY - highY);
        
        ctx.fillStyle = colors.LOW_BG;
        ctx.fillRect(chartArea.left, lowY, chartArea.width, chartArea.bottom - lowY);
      }
    };
  }, [colors, getCurrentGlucoseRanges, unit]);
  
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md transition-colors duration-200">
      <div className="h-64 sm:h-80">
        {readings && readings.length > 0 ? (
          <Line 
            data={processedData} 
            options={options} 
            plugins={[targetRangePlugin]}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">No glucose data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlucoseChart;