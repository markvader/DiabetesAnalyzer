import React from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useTheme } from '../contexts/ThemeContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import { Box, Paper, Typography, useTheme as useMuiTheme } from '@mui/material';
import { motion } from 'framer-motion';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  ScatterController,
  Title,
  Tooltip,
  Legend
);

interface GlucoseReading {
  sgv: number;
  date: number;
  direction?: string;
}

interface Treatment {
  created_at: string;
  eventType?: string;
  insulin?: number;
  carbs?: number;
  notes?: string;
  enteredBy?: string;
  absolute?: number;
  rate?: number;
  duration?: number;
  percent?: number;
  [key: string]: any;
}

interface GlucoseChartProps {
  readings: GlucoseReading[];
  treatments?: Treatment[];
  showInsulinDelivery?: boolean;
  title?: string;
}

const GlucoseChart: React.FC<GlucoseChartProps> = ({
  readings,
  treatments,
  title,
  showInsulinDelivery = false,
}) => {
  const { convertToCurrentUnit, formatGlucoseValue, unit, getCurrentGlucoseRanges } = useGlucoseFormatting();
  const { theme } = useTheme();
  const { isModern, isPremium } = useDesignMode();
  const muiTheme = useMuiTheme();
  const isDark = theme === 'dark';
  const colors = isDark ? GLUCOSE_RANGES.COLORS.DARK : GLUCOSE_RANGES.COLORS;

  const processTreatmentOverlays = React.useCallback(() => {
    if (!showInsulinDelivery || !treatments || treatments.length === 0) {
      return [];
    }

    const overlayDatasets = [];
    const ranges = getCurrentGlucoseRanges();

    // SMBs as small green dots positioned at glucose line level
    const smbData: { x: number; y: number; treatment?: Treatment }[] = [];
    const insulinBoluses: { x: number; y: number; treatment?: Treatment }[] = [];
    const carbBoluses: { x: number; y: number; treatment?: Treatment }[] = [];

    treatments.forEach(t => {
      const treatmentTime = new Date(t.created_at).getTime();
      
      // Check for any insulin delivery (be flexible about field names)
      const insulinValue = t.insulin || (t as any).units || (t as any).amount;
      if (insulinValue && insulinValue > 0) {
        // For SMBs, find closest glucose reading for positioning
        const isSMB = t.notes?.includes('SMB') || 
                      t.enteredBy?.includes('openaps') || 
                      t.eventType === 'Correction Bolus' ||
                      t.eventType === 'SMB' ||
                      (insulinValue < 1.5 && (t.eventType?.includes('Bolus') || t.eventType?.includes('Correction')));
        
        if (isSMB) {
          const glucoseReading = readings?.find(r => 
            Math.abs(r.date - treatmentTime) < 15 * 60 * 1000
          );
          const yPosition = glucoseReading ? convertToCurrentUnit(glucoseReading.sgv) : ranges.TARGET_MIN + 1;
          
          smbData.push({
            x: treatmentTime,
            y: yPosition,
            treatment: t
          });
        } else {
          // Regular boluses as compact blue bars
          insulinBoluses.push({
            x: treatmentTime,
            y: Math.max(insulinValue * 5, 5),
            treatment: t
          });
        }
      }
      
      // Check for carbs (be flexible about field names)
      const carbValue = t.carbs || (t as any).carbohydrates || (t as any).glucose;
      if (carbValue && carbValue > 0) {
        carbBoluses.push({
          x: treatmentTime,
          y: Math.max(carbValue, 5),
          treatment: t
        });
      }
    });

    // SMBs as small green dots
    if (smbData.length > 0) {
      overlayDatasets.push({
        type: 'scatter' as const,
        label: 'SMBs',
        data: smbData,
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
        pointRadius: 3,
        pointHoverRadius: 5,
        showLine: false,
        yAxisID: 'y'
      });
    }

    // Insulin boluses as compact blue bars
    if (insulinBoluses.length > 0) {
      overlayDatasets.push({
        type: 'bar' as const,
        label: 'Insulin',
        data: insulinBoluses,
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        borderWidth: 1,
        barThickness: 8,
        maxBarThickness: 12,
        yAxisID: 'y3'
      });
    }

    // Carbs as compact orange bars
    if (carbBoluses.length > 0) {
      overlayDatasets.push({
        type: 'bar' as const,
        label: 'Carbs',
        data: carbBoluses,
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
        borderWidth: 1,
        barThickness: 8,
        maxBarThickness: 12,
        yAxisID: 'y4'
      });
    }

    // Temporary basal rates as very small purple markers
    const tempBasalData = treatments
      .filter(t => {
        const isBasal = t.eventType === 'Temp Basal' || 
                       t.eventType?.includes('basal') || 
                       t.eventType?.includes('Basal') ||
                       (t.absolute !== undefined || t.rate !== undefined);
        return isBasal;
      })
      .map(t => ({
        x: new Date(t.created_at).getTime(),
        y: ranges.LOW_THRESHOLD * 0.98,
        treatment: t
      }));

    if (tempBasalData.length > 0) {
      overlayDatasets.push({
        type: 'scatter' as const,
        label: 'Temp Basals',
        data: tempBasalData,
        backgroundColor: '#8b5cf6',
        borderColor: '#8b5cf6',
        pointRadius: 1,
        pointHoverRadius: 3,
        pointStyle: 'rect',
        showLine: false,
        yAxisID: 'y'
      });
    }
    
    return overlayDatasets;
  }, [treatments, showInsulinDelivery, readings, getCurrentGlucoseRanges, convertToCurrentUnit]);

  const processedData = React.useMemo(() => {
    if (!readings || readings.length === 0) {
      return {
        datasets: []
      };
    }
    
    const sortedReadings = [...readings].sort((a, b) => a.date - b.date);
    const ranges = getCurrentGlucoseRanges();

    const datasets: any[] = [];

    // Create continuous segments for each range
    let currentSegment: { type: 'inRange' | 'high' | 'low' | null; data: { x: number; y: number }[] } = {
      type: null,
      data: []
    };

    const segmentCounts = { inRange: 0, high: 0, low: 0 };

    const addSegmentDataset = (segment: typeof currentSegment, segmentIndex: number = 0) => {
      if (segment.data.length === 0) return;

      const colors_map = {
        inRange: { border: colors.IN_RANGE, bg: colors.IN_RANGE_BG, label: 'In Range' },
        high: { border: colors.HIGH, bg: colors.HIGH_BG, label: 'High' },
        low: { border: colors.LOW, bg: colors.LOW_BG, label: 'Low' }
      };

      const colorConfig = colors_map[segment.type!];
      const label = segmentIndex === 0 ? colorConfig.label : `${colorConfig.label} (continued)`;
      
      datasets.push({
        type: 'line' as const,
        label: label,
        data: segment.data,
        borderColor: colorConfig.border,
        backgroundColor: colorConfig.bg,
        pointRadius: 2,
        tension: 0.1,
        fill: false,
        showLine: true,
        yAxisID: 'y'
      });
    };

    sortedReadings.forEach((reading) => {
      const value = convertToCurrentUnit(reading.sgv, 'mgdl');
      const dataPoint = { x: reading.date, y: value };
      
      let rangeType: 'inRange' | 'high' | 'low';
      if (value > ranges.HIGH_THRESHOLD) {
        rangeType = 'high';
      } else if (value < ranges.LOW_THRESHOLD) {
        rangeType = 'low';
      } else {
        rangeType = 'inRange';
      }

      // If range type changed, save current segment and start new one
      if (rangeType !== currentSegment.type) {
        if (currentSegment.type) {
          addSegmentDataset(currentSegment, segmentCounts[currentSegment.type]);
          segmentCounts[currentSegment.type]++;
        }
        currentSegment = {
          type: rangeType,
          data: [dataPoint]
        };
      } else {
        currentSegment.data.push(dataPoint);
      }
    });

    // Add the final segment
    if (currentSegment.type) {
      addSegmentDataset(currentSegment, segmentCounts[currentSegment.type]);
    }
    
    // Add treatment overlays if enabled
    const treatmentDatasets = processTreatmentOverlays();
    datasets.push(...treatmentDatasets);
    
    return {
      datasets
    };
  }, [readings, colors, getCurrentGlucoseRanges, convertToCurrentUnit, processTreatmentOverlays]);
  
  const options: ChartOptions<'line' | 'bar' | 'scatter'> = React.useMemo(() => {
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
              const dataPoint = context.dataset.data[context.dataIndex];
              const treatment = dataPoint?.treatment;

              if (context.dataset.label === 'SMBs') {
                const insulinAmount = treatment?.insulin || treatment?.units || treatment?.amount || 0;
                const eventType = treatment?.eventType || 'SMB';
                const enteredBy = treatment?.enteredBy ? ` (${treatment.enteredBy})` : '';
                const notes = treatment?.notes ? ` - ${treatment.notes}` : '';
                return `${eventType}: ${insulinAmount.toFixed(2)}U (at ${value?.toFixed(1)} ${unit})${enteredBy}${notes}`;
              } else if (context.dataset.label === 'Insulin') {
                const insulinAmount = treatment?.insulin || treatment?.units || treatment?.amount || 0;
                const eventType = treatment?.eventType || 'Bolus';
                const notes = treatment?.notes ? ` - ${treatment.notes}` : '';
                return `${eventType}: ${insulinAmount.toFixed(2)}U${notes}`;
              } else if (context.dataset.label === 'Carbs') {
                const carbAmount = treatment?.carbs || treatment?.carbohydrates || 0;
                const eventType = treatment?.eventType || 'Meal';
                return `${eventType}: ${carbAmount}g carbs`;
              } else if (context.dataset.label === 'Temp Basals') {
                const rate = treatment?.rate || treatment?.absolute;
                const percent = treatment?.percent;
                const duration = treatment?.duration;
                const eventType = treatment?.eventType || 'Temp Basal';
                
                let rateInfo = '';
                if (rate !== undefined) {
                  rateInfo = `${rate.toFixed(2)}U/h`;
                } else if (percent !== undefined) {
                  rateInfo = `${percent}% of basal`;
                } else {
                  rateInfo = 'Rate unknown';
                }
                
                if (duration) {
                  rateInfo += ` for ${duration}min`;
                }
                
                return `${eventType}: ${rateInfo}`;
              } else {
                const formattedValue = unit === 'mmol' ? value.toFixed(1) : Math.round(value);
                return `${context.dataset.label}: ${formattedValue} ${unit === 'mmol' ? 'mmol/L' : 'mg/dL'}`;
              }
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
          type: 'time',
          time: {
            displayFormats: {
              hour: 'HH:mm',
              day: 'dd.MM'
            },
            tooltipFormat: 'dd.MM.yyyy HH:mm'
          },
          grid: {
            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            maxTicksLimit: 12,
            color: isDark ? '#e5e7eb' : '#111827'
          }
        },
        y3: {
          type: 'linear',
          display: false,
          position: 'right',
          min: 0,
          max: 50,
          grid: {
            drawOnChartArea: false
          }
        },
        y4: {
          type: 'linear',
          display: false,
          position: 'right',
          min: 0,
          max: 150,
          grid: {
            drawOnChartArea: false
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
  
  // Premium Design with Advanced Effects
  if (isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring" }}
      >
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
              background: `linear-gradient(90deg, ${muiTheme.palette.primary.main} 0%, ${muiTheme.palette.secondary.main} 50%, ${muiTheme.palette.primary.main} 100%)`,
            }
          }}
        >
          {/* Premium header */}
          {title && (
            <Box sx={{ mb: 3, pb: 2, borderBottom: `1px solid ${muiTheme.palette.divider}20` }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${muiTheme.palette.primary.main} 0%, ${muiTheme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {title}
              </Typography>
            </Box>
          )}

          {/* Enhanced chart container */}
          <Box 
            sx={{ 
              height: { xs: 280, sm: 360 },
              position: 'relative',
              '& canvas': {
                borderRadius: 2,
                boxShadow: `0 4px 16px ${muiTheme.palette.primary.main}08`,
              }
            }}
          >
            {readings && readings.length > 0 ? (
              <Chart 
                type="line"
                data={processedData} 
                options={options} 
                plugins={[targetRangePlugin]}
              />
            ) : (
              <Box 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${muiTheme.palette.background.default} 0%, ${muiTheme.palette.background.paper} 100%)`,
                  borderRadius: 2,
                  border: `1px dashed ${muiTheme.palette.divider}`,
                }}
              >
                <Typography 
                  color="text.secondary" 
                  sx={{ 
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}
                >
                  📊 No glucose data available
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    Connect your CGM to see glucose trends
                  </Typography>
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </motion.div>
    );
  }

  // Modern Material UI Design  
  if (isModern) {
    return (
      <Paper 
        elevation={2}
        sx={{ 
          p: 3,
          borderRadius: 2,
          backgroundColor: muiTheme.palette.background.paper,
        }}
      >
        {title && (
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {title}
          </Typography>
        )}
        <Box sx={{ height: { xs: 256, sm: 320 } }}>
          {readings && readings.length > 0 ? (
            <Chart 
              type="line"
              data={processedData} 
              options={options} 
              plugins={[targetRangePlugin]}
            />
          ) : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">No glucose data available</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    );
  }

  // Classic Tailwind Design
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md transition-colors duration-200">
      <div className="h-64 sm:h-80">
        {readings && readings.length > 0 ? (
          <Chart 
            type="line"
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