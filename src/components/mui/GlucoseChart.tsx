import React from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GlucoseReading {
  timestamp: string;
  glucose: number;
  trend?: 'rising' | 'stable' | 'falling';
  rapidRising?: boolean;
  rapidFalling?: boolean;
}

interface GlucoseChartProps {
  data: GlucoseReading[];
  loading?: boolean;
  title?: string;
  showTargetRange?: boolean;
  targetLow?: number;
  targetHigh?: number;
  height?: number;
  timeRange?: '3h' | '6h' | '12h' | '24h' | '7d';
  onTimeRangeChange?: (range: '3h' | '6h' | '12h' | '24h' | '7d') => void;
}

const GlucoseChart: React.FC<GlucoseChartProps> = ({
  data,
  loading = false,
  title = 'Glucose Levels',
  showTargetRange = true,
  targetLow = 70,
  targetHigh = 180,
  height = 400,
  timeRange = '12h',
  onTimeRangeChange,
}) => {
  const theme = useTheme();

  const getGlucoseColor = (glucose: number) => {
    if (glucose < 54) return theme.palette.diabetesColors.glucose.critical;
    if (glucose < 70) return theme.palette.diabetesColors.glucose.low;
    if (glucose <= 180) return theme.palette.diabetesColors.glucose.target;
    if (glucose <= 250) return theme.palette.diabetesColors.glucose.high;
    return theme.palette.diabetesColors.glucose.critical;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: GlucoseReading }>;
    label?: unknown;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper
          elevation={8}
          sx={{
            p: 2,
            border: `2px solid ${getGlucoseColor(data.glucose)}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            {new Date(data.timestamp).toLocaleString()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography variant="h6" color={getGlucoseColor(data.glucose)}>
              {data.glucose} mg/dL
            </Typography>
            {data.trend === 'rising' && <TrendingUp size={16} color={theme.palette.warning.main} />}
            {data.trend === 'falling' && <TrendingDown size={16} color={theme.palette.info.main} />}
            {data.trend === 'stable' && <Minus size={16} color={theme.palette.text.secondary} />}
          </Box>
          {data.rapidRising && (
            <Chip
              label="Rapid Rise"
              size="small"
              color="warning"
              sx={{ mt: 1, fontSize: '0.7rem' }}
            />
          )}
          {data.rapidFalling && (
            <Chip
              label="Rapid Fall"
              size="small"
              color="error"
              sx={{ mt: 1, fontSize: '0.7rem' }}
            />
          )}
        </Paper>
      );
    }
    return null;
  };

  const timeRangeOptions = [
    { value: '3h', label: '3H' },
    { value: '6h', label: '6H' },
    { value: '12h', label: '12H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
  ];

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-block', marginBottom: 16 }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                border: `4px solid ${theme.palette.primary.light}`,
                borderTop: `4px solid ${theme.palette.primary.main}`,
                borderRadius: '50%',
              }}
            />
          </motion.div>
          <Typography variant="body2" color="text.secondary">
            Loading glucose data...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" color="primary">
            {title}
          </Typography>
          {onTimeRangeChange && (
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, value) => value && onTimeRangeChange(value)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.5,
                  border: `1px solid ${theme.palette.divider}`,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                  },
                },
              }}
            >
              {timeRangeOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Box>

        <Box sx={{ height: height - 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme.palette.divider}
                opacity={0.5}
              />
              
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                stroke={theme.palette.text.secondary}
                fontSize={12}
              />
              
              <YAxis
                domain={['dataMin - 20', 'dataMax + 20']}
                stroke={theme.palette.text.secondary}
                fontSize={12}
                label={{ value: 'mg/dL', angle: -90, position: 'insideLeft' }}
              />

              {showTargetRange && (
                <>
                  <ReferenceLine
                    y={targetLow}
                    stroke={theme.palette.diabetesColors.glucose.low}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ value: `Target Low (${targetLow})`, position: 'insideTopLeft' }}
                  />
                  <ReferenceLine
                    y={targetHigh}
                    stroke={theme.palette.diabetesColors.glucose.high}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ value: `Target High (${targetHigh})`, position: 'insideTopLeft' }}
                  />
                </>
              )}

              <Area
                type="monotone"
                dataKey="glucose"
                stroke="none"
                fill="url(#glucoseGradient)"
              />

              <Line
                type="monotone"
                dataKey="glucose"
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                dot={{
                  stroke: theme.palette.primary.main,
                  strokeWidth: 2,
                  fill: theme.palette.background.paper,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  stroke: theme.palette.primary.main,
                  strokeWidth: 2,
                  fill: theme.palette.primary.main,
                }}
              />

              <Tooltip content={<CustomTooltip />} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={`Readings: ${data.length}`}
            color="primary"
            variant="outlined"
          />
          {data.length > 0 && (
            <>
              <Chip
                size="small"
                label={`Latest: ${data[data.length - 1]?.glucose} mg/dL`}
                sx={{ 
                  backgroundColor: getGlucoseColor(data[data.length - 1]?.glucose),
                  color: 'white',
                }}
              />
              <Chip
                size="small"
                label={`Avg: ${Math.round(data.reduce((sum, reading) => sum + reading.glucose, 0) / data.length)} mg/dL`}
                color="info"
                variant="outlined"
              />
            </>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
};

export default GlucoseChart;
