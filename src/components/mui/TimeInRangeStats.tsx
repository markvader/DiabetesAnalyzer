import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface TimeInRangeData {
  veryLow: number; // <54 mg/dL
  low: number; // 54-69 mg/dL
  target: number; // 70-180 mg/dL
  high: number; // 181-250 mg/dL
  veryHigh: number; // >250 mg/dL
  totalReadings: number;
  averageGlucose: number;
  glucoseManagementIndicator: number; // GMI
  coefficientOfVariation: number; // CV%
  standardDeviation: number;
}

interface TimeInRangeStatsProps {
  data: TimeInRangeData;
  loading?: boolean;
  expanded?: boolean;
  showDetailedStats?: boolean;
}

const TimeInRangeStats: React.FC<TimeInRangeStatsProps> = ({
  data,
  loading = false,
  expanded: initialExpanded = false,
  showDetailedStats = true,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded);

  const ranges = [
    {
      name: 'Very Low',
      value: data.veryLow,
      color: theme.palette.diabetesColors.glucose.critical,
      target: '<5%',
      description: 'Below 54 mg/dL - Severe Hypoglycemia',
      icon: '🚨',
    },
    {
      name: 'Low',
      value: data.low,
      color: theme.palette.diabetesColors.glucose.low,
      target: '<4%',
      description: '54-69 mg/dL - Hypoglycemia',
      icon: '⚠️',
    },
    {
      name: 'Target',
      value: data.target,
      color: theme.palette.diabetesColors.glucose.target,
      target: '>70%',
      description: '70-180 mg/dL - Time in Range',
      icon: '🎯',
    },
    {
      name: 'High',
      value: data.high,
      color: theme.palette.diabetesColors.glucose.high,
      target: '<25%',
      description: '181-250 mg/dL - Hyperglycemia',
      icon: '📈',
    },
    {
      name: 'Very High',
      value: data.veryHigh,
      color: theme.palette.diabetesColors.glucose.critical,
      target: '<5%',
      description: 'Above 250 mg/dL - Severe Hyperglycemia',
      icon: '🔥',
    },
  ];

  const pieData = ranges.map(range => ({
    name: range.name,
    value: range.value,
    color: range.color,
  }));

  const barData = ranges.map(range => ({
    name: range.name,
    current: range.value,
    target: parseFloat(range.target.replace(/[<>%]/g, '')),
    color: range.color,
  }));

  const getTargetStatus = (current: number, target: string, isTarget: boolean = false) => {
    const targetValue = parseFloat(target.replace(/[<>%]/g, ''));
    const isGreaterThan = target.includes('>');
    const isLessThan = target.includes('<');

    if (isTarget) {
      return current >= targetValue ? 'excellent' : current >= targetValue * 0.8 ? 'good' : 'needs-improvement';
    }

    if (isGreaterThan) {
      return current >= targetValue ? 'excellent' : current >= targetValue * 0.8 ? 'good' : 'needs-improvement';
    }

    if (isLessThan) {
      return current <= targetValue ? 'excellent' : current <= targetValue * 1.5 ? 'good' : 'needs-improvement';
    }

    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return theme.palette.success.main;
      case 'good': return theme.palette.warning.main;
      case 'needs-improvement': return theme.palette.error.main;
      default: return theme.palette.info.main;
    }
  };

  const getGMIColor = (gmi: number) => {
    if (gmi <= 7) return theme.palette.success.main;
    if (gmi <= 8) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getCVColor = (cv: number) => {
    if (cv <= 33) return theme.palette.success.main;
    if (cv <= 36) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              border: `3px solid ${theme.palette.primary.light}`,
              borderTop: `3px solid ${theme.palette.primary.main}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          <Typography variant="h6">Loading Time in Range data...</Typography>
        </Box>
        <LinearProgress sx={{ borderRadius: 1 }} />
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
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight="bold" color="primary">
              Time in Range Analysis
            </Typography>
            <Chip
              label={`${data.totalReadings} readings`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Key Metrics */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
          <Card
            elevation={2}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
              color: 'white',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Time in Range
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {data.target.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Target: &gt;70%
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              background: `linear-gradient(135deg, ${getGMIColor(data.glucoseManagementIndicator)} 0%, ${alpha(getGMIColor(data.glucoseManagementIndicator), 0.8)} 100%)`,
              color: 'white',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                GMI (est. A1C)
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {data.glucoseManagementIndicator.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Avg: {data.averageGlucose.toFixed(0)} mg/dL
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              background: `linear-gradient(135deg, ${getCVColor(data.coefficientOfVariation)} 0%, ${alpha(getCVColor(data.coefficientOfVariation), 0.8)} 100%)`,
              color: 'white',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Variability (CV)
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {data.coefficientOfVariation.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                SD: {data.standardDeviation.toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Glucose Ranges */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Glucose Distribution
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
            {ranges.map((range, index) => {
              const status = getTargetStatus(range.value, range.target, range.name === 'Target');
              return (
                <motion.div
                  key={range.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    elevation={1}
                    sx={{
                      p: 2,
                      border: `2px solid ${alpha(range.color, 0.3)}`,
                      borderRadius: 2,
                      '&:hover': {
                        borderColor: range.color,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">{range.icon}</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {range.name}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={getTargetStatus(range.value, range.target, range.name === 'Target')}
                        sx={{
                          backgroundColor: getStatusColor(status),
                          color: 'white',
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h5" fontWeight="bold" color={range.color}>
                        {range.value.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Target: {range.target}
                      </Typography>
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={Math.min(range.value, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: alpha(range.color, 0.2),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: range.color,
                          borderRadius: 4,
                        },
                      }}
                    />

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {range.description}
                    </Typography>
                  </Card>
                </motion.div>
              );
            })}
          </Box>
        </Box>

        {/* Detailed Stats */}
        <AnimatePresence>
          {expanded && showDetailedStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Detailed Analysis
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 3 }}>
                {/* Pie Chart */}
                <Card elevation={2} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Distribution Overview
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }: any) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Percentage']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

                {/* Bar Chart */}
                <Card elevation={2} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Target vs Actual
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Percentage']} />
                        <Bar dataKey="current" fill={theme.palette.primary.main} name="Current" />
                        <Bar dataKey="target" fill={alpha(theme.palette.secondary.main, 0.7)} name="Target" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </motion.div>
  );
};

export default TimeInRangeStats;
