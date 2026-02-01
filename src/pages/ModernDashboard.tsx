import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Tab,
  Tabs,
  Fab,
  useTheme,
  alpha,
} from '@mui/material';
import { Add, Refresh, Analytics, TrendingUp } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { GlucoseMetricCard } from '../components/mui/GlucoseMetricCard';
import GlucoseChart from '../components/mui/GlucoseChart';
import TimeInRangeStats from '../components/mui/TimeInRangeStats';
import { AdvancedDataGrid } from '../components/mui/AdvancedDataGrid';
import { runSafeAsync } from '../utils/safeAsync';

interface GlucoseReading {
  id: string;
  timestamp: string;
  glucose: number;
  trend?: 'rising' | 'stable' | 'falling';
  rapidRising?: boolean;
  rapidFalling?: boolean;
  device?: string;
  notes?: string;
}

interface DashboardData {
  currentGlucose: number;
  trend: 'rising' | 'stable' | 'falling';
  lastUpdated: string;
  recentReadings: GlucoseReading[];
  timeInRangeData: {
    veryLow: number;
    low: number;
    target: number;
    high: number;
    veryHigh: number;
    totalReadings: number;
    averageGlucose: number;
    glucoseManagementIndicator: number;
    coefficientOfVariation: number;
    standardDeviation: number;
  };
  statistics: {
    averageGlucose: number;
    standardDeviation: number;
    timeInRange: number;
    lowEvents: number;
    highEvents: number;
  };
}

const ModernDashboard: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'3h' | '6h' | '12h' | '24h' | '7d'>('12h');
  const [data, setData] = useState<DashboardData | null>(null);

  // Mock data - replace with real API calls
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock data
      const mockReadings: GlucoseReading[] = Array.from({ length: 100 }, (_, i) => {
        const baseTime = new Date();
        baseTime.setHours(baseTime.getHours() - (99 - i) * 0.25);
        
        // Generate realistic glucose values with some patterns
        const baseGlucose = 120 + Math.sin(i * 0.1) * 40 + Math.random() * 30;
        const glucose = Math.max(50, Math.min(300, baseGlucose));
        
        return {
          id: `reading-${i}`,
          timestamp: baseTime.toISOString(),
          glucose: Math.round(glucose),
          trend: Math.random() > 0.7 ? 'rising' : Math.random() > 0.5 ? 'falling' : 'stable',
          rapidRising: glucose > 180 && Math.random() > 0.8,
          rapidFalling: glucose < 80 && Math.random() > 0.8,
          device: Math.random() > 0.5 ? 'Dexcom G6' : 'FreeStyle Libre',
          notes: Math.random() > 0.9 ? 'After meal' : undefined,
        };
      });

      const currentReading = mockReadings[mockReadings.length - 1];
      
      // Safety check to ensure we have data
      if (!currentReading || mockReadings.length === 0) {
        setError('Failed to generate mock data');
        setLoading(false);
        return;
      }

      const avgGlucose = mockReadings.reduce((sum, r) => sum + r.glucose, 0) / mockReadings.length;
      const stdDev = Math.sqrt(
        mockReadings.reduce((sum, r) => sum + Math.pow(r.glucose - avgGlucose, 2), 0) / mockReadings.length
      );
      
      // Calculate Time in Range percentages
      const veryLow = (mockReadings.filter(r => r.glucose < 54).length / mockReadings.length) * 100;
      const low = (mockReadings.filter(r => r.glucose >= 54 && r.glucose < 70).length / mockReadings.length) * 100;
      const target = (mockReadings.filter(r => r.glucose >= 70 && r.glucose <= 180).length / mockReadings.length) * 100;
      const high = (mockReadings.filter(r => r.glucose > 180 && r.glucose <= 250).length / mockReadings.length) * 100;
      const veryHigh = (mockReadings.filter(r => r.glucose > 250).length / mockReadings.length) * 100;

      const mockData: DashboardData = {
        currentGlucose: currentReading.glucose,
        trend: currentReading.trend || 'stable',
        lastUpdated: currentReading.timestamp,
        recentReadings: mockReadings,
        timeInRangeData: {
          veryLow,
          low,
          target,
          high,
          veryHigh,
          totalReadings: mockReadings.length,
          averageGlucose: avgGlucose,
          glucoseManagementIndicator: (avgGlucose + 46.7) / 28.7, // GMI formula
          coefficientOfVariation: (stdDev / avgGlucose) * 100,
          standardDeviation: stdDev,
        },
        statistics: {
          averageGlucose: avgGlucose,
          standardDeviation: stdDev,
          timeInRange: target,
          lowEvents: mockReadings.filter(r => r.glucose < 70).length,
          highEvents: mockReadings.filter(r => r.glucose > 180).length,
        },
      };

      setData(mockData);
      setLoading(false);
    };

    runSafeAsync(() => fetchData(), { label: 'ModernDashboard: fetchData' });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabContent = [
    {
      label: 'Overview',
      icon: <Analytics />,
      content: (
        <Grid container spacing={3}>
          {/* Current Status Cards */}
          <Grid item xs={12} md={4}>
            <GlucoseMetricCard
              title="Current Glucose"
              value={data?.currentGlucose || 0}
              unit="mg/dL"
              trend={data?.trend}
              lastUpdated={data?.lastUpdated}
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <GlucoseMetricCard
              title="Average (24h)"
              value={data?.statistics.averageGlucose || 0}
              unit="mg/dL"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <GlucoseMetricCard
              title="Time in Range"
              value={data?.timeInRangeData.target || 0}
              unit="%"
              loading={loading}
            />
          </Grid>

          {/* Glucose Chart */}
          <Grid item xs={12}>
            <GlucoseChart
              data={data?.recentReadings || []}
              loading={loading}
              title="Glucose Trends"
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              height={400}
            />
          </Grid>

          {/* Time in Range Stats */}
          <Grid item xs={12}>
            <TimeInRangeStats
              data={data?.timeInRangeData || {
                veryLow: 0,
                low: 0,
                target: 0,
                high: 0,
                veryHigh: 0,
                totalReadings: 0,
                averageGlucose: 0,
                glucoseManagementIndicator: 0,
                coefficientOfVariation: 0,
                standardDeviation: 0,
              }}
              loading={loading}
              expanded={false}
            />
          </Grid>
        </Grid>
      ),
    },
    {
      label: 'Data Analysis',
      icon: <TrendingUp />,
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AdvancedDataGrid
              data={data?.recentReadings || []}
              loading={loading}
              title="Recent Glucose Readings"
              pageSize={25}
              onRowClick={(reading) => console.log('Selected reading:', reading)}
            />
          </Grid>
        </Grid>
      ),
    },
    {
      label: 'Detailed Stats',
      icon: <Analytics />,
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TimeInRangeStats
              data={data?.timeInRangeData || {
                veryLow: 0,
                low: 0,
                target: 0,
                high: 0,
                veryHigh: 0,
                totalReadings: 0,
                averageGlucose: 0,
                glucoseManagementIndicator: 0,
                coefficientOfVariation: 0,
                standardDeviation: 0,
              }}
              loading={loading}
              expanded={true}
              showDetailedStats={true}
            />
          </Grid>
        </Grid>
      ),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 200,
              height: 200,
              background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.3)} 0%, transparent 70%)`,
              borderRadius: '50%',
              transform: 'translate(50%, -50%)',
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h3" fontWeight="bold" gutterBottom>
              Diabetes Monitor
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
              Advanced glucose tracking and analysis dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {data?.lastUpdated && `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`}
            </Typography>
          </Box>
        </Paper>
      </motion.div>

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ mb: 4, borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minHeight: 72,
              py: 2,
              '&.Mui-selected': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
              },
            },
          }}
        >
          {tabContent.map((tab, index) => (
            <Tab
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'column' }}>
                  {tab.icon}
                  <Typography variant="body2">{tab.label}</Typography>
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tabValue}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {tabContent[tabValue]?.content}
        </motion.div>
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Fab
          color="primary"
          onClick={() => runSafeAsync(() => handleRefresh(), { label: 'ModernDashboard: handleRefresh' })}
          disabled={refreshing}
          sx={{
            animation: refreshing ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        >
          <Refresh />
        </Fab>
        <Fab color="secondary">
          <Add />
        </Fab>
      </Box>
    </Container>
  );
};

export default ModernDashboard;
