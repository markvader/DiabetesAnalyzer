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
import { useDesignMode } from '../contexts/DesignModeContext';
import { Box, Paper, Typography, useTheme as useMuiTheme } from '@mui/material';

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
  const { isModern, isPremium } = useDesignMode();
  const muiTheme = useMuiTheme();
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
  const ultraSafeFormatPercentage = (value: unknown): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return formatPercentage(value);
    }
    if (typeof value === 'object' && value !== null) {
      console.error('❌ ultraSafeFormatPercentage caught object:', value);
      // If it's an object with percent property, extract it
      const rec = value as Record<string, unknown>;
      if (typeof rec.percent === 'number') {
        return formatPercentage(rec.percent);
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

  // Premium Design with Advanced Effects
  if (isPremium) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${muiTheme.palette.background.paper} 0%, ${muiTheme.palette.background.default} 100%)`,
          boxShadow: theme === 'dark' 
            ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.8)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${muiTheme.palette.success.main} 0%, ${muiTheme.palette.warning.main} 50%, ${muiTheme.palette.error.main} 100%)`,
          }
        }}
      >
        {/* Header with gradient */}
        <Box 
          sx={{ 
            mb: 3,
            pb: 2,
            borderBottom: `1px solid ${muiTheme.palette.divider}20`,
            position: 'relative'
          }}
        >
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              background: `linear-gradient(135deg, ${muiTheme.palette.primary.main} 0%, ${muiTheme.palette.secondary.main} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              mb: 1
            }}
          >
            Time in Range Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            📊 Comprehensive glucose range distribution
          </Typography>
        </Box>

        {/* Enhanced chart container with glow effects */}
        <Box sx={{ position: 'relative', height: 320, mb: 3 }}>
          {/* Background glow animation */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '25%',
              transform: 'translate(-50%, -50%)',
              width: 200,
              height: 200,
              background: `radial-gradient(circle, ${muiTheme.palette.success.main}15 0%, transparent 70%)`,
              borderRadius: '50%',
              filter: 'blur(20px)',
              opacity: 0.6,
              animation: 'pulse 3s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.4 },
                '50%': { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0.8 },
              },
            }}
          />
          
          <Doughnut data={data} options={options} />
          
          {/* Enhanced center display with gradient text */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '25%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 2
            }}
          >
            <Typography 
              variant="h2" 
              component="div" 
              sx={{ 
                fontWeight: 800,
                background: `linear-gradient(135deg, ${muiTheme.palette.success.main} 0%, ${muiTheme.palette.success.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                lineHeight: 1,
                textShadow: `0 2px 4px ${muiTheme.palette.success.main}20`,
                filter: 'drop-shadow(0 0 8px currentColor)',
              }}
            >
              {ultraSafeFormatPercentage(safeTimeInRange)}
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 600,
                mt: 0.5,
                background: `linear-gradient(135deg, ${muiTheme.palette.text.secondary} 0%, ${muiTheme.palette.text.primary} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              }}
            >
              In Range
            </Typography>
          </Box>
        </Box>
        
        {/* Enhanced range details with premium styling */}
        <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2.5, 
              background: `linear-gradient(135deg, ${muiTheme.palette.success.main}15 0%, ${muiTheme.palette.success.main}08 100%)`,
              borderRadius: 2,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${muiTheme.palette.success.main}20`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: muiTheme.palette.success.main,
              }
            }}
          >
            <Typography 
              variant="h5" 
              sx={{ 
                background: `linear-gradient(135deg, ${muiTheme.palette.success.main} 0%, ${muiTheme.palette.success.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontWeight: 700,
                mb: 0.5
              }}
            >
              {ultraSafeFormatPercentage(safeTimeInRange)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {formatGlucoseValue(ranges.TARGET_MIN, unit, false)}-{formatGlucoseValue(ranges.TARGET_MAX, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2.5, 
              background: `linear-gradient(135deg, ${muiTheme.palette.warning.main}15 0%, ${muiTheme.palette.warning.main}08 100%)`,
              borderRadius: 2,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${muiTheme.palette.warning.main}20`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: muiTheme.palette.warning.main,
              }
            }}
          >
            <Typography 
              variant="h5" 
              sx={{ 
                background: `linear-gradient(135deg, ${muiTheme.palette.warning.main} 0%, ${muiTheme.palette.warning.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontWeight: 700,
                mb: 0.5
              }}
            >
              {ultraSafeFormatPercentage(safeHighPercentage)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              &gt;{formatGlucoseValue(ranges.HIGH_THRESHOLD, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2.5, 
              background: `linear-gradient(135deg, ${muiTheme.palette.error.main}15 0%, ${muiTheme.palette.error.main}08 100%)`,
              borderRadius: 2,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${muiTheme.palette.error.main}20`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: muiTheme.palette.error.main,
              }
            }}
          >
            <Typography 
              variant="h5" 
              sx={{ 
                background: `linear-gradient(135deg, ${muiTheme.palette.error.main} 0%, ${muiTheme.palette.error.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontWeight: 700,
                mb: 0.5
              }}
            >
              {ultraSafeFormatPercentage(safeLowPercentage)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              &lt;{formatGlucoseValue(ranges.LOW_THRESHOLD, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
        </Box>

        {/* Premium insights section */}
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${muiTheme.palette.divider}20` }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
            🎯 Target: ≥70% time in range • 🔴 &lt;4% time below range • 🟠 &lt;25% time above range
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Modern Material UI Design
  if (isModern) {
    return (
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Time in Range
        </Typography>
        
        <Box sx={{ position: 'relative', height: 280, mb: 2 }}>
          <Doughnut data={data} options={options} />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '25%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}
          >
            <Typography 
              variant="h3" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                color: muiTheme.palette.success.main,
                lineHeight: 1
              }}
            >
              {ultraSafeFormatPercentage(safeTimeInRange)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In Range
            </Typography>
          </Box>
        </Box>
        
        {/* Range details */}
        <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: muiTheme.palette.success.main + '15',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ color: muiTheme.palette.success.main, fontWeight: 600 }}
            >
              {ultraSafeFormatPercentage(safeTimeInRange)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatGlucoseValue(ranges.TARGET_MIN, unit, false)}-{formatGlucoseValue(ranges.TARGET_MAX, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: muiTheme.palette.warning.main + '15',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ color: muiTheme.palette.warning.main, fontWeight: 600 }}
            >
              {ultraSafeFormatPercentage(safeHighPercentage)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              &gt;{formatGlucoseValue(ranges.HIGH_THRESHOLD, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: muiTheme.palette.error.main + '15',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ color: muiTheme.palette.error.main, fontWeight: 600 }}
            >
              {ultraSafeFormatPercentage(safeLowPercentage)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              &lt;{formatGlucoseValue(ranges.LOW_THRESHOLD, unit, false)} {getUnitLabel()}
            </Typography>
          </Paper>
        </Box>
      </Paper>
    );
  }

  // Classic Tailwind Design
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