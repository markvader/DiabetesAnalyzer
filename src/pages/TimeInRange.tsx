import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import TimeInRangeChart from '../components/TimeInRangeChart';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import LoadingSpinner from '../components/LoadingSpinner';
import { useDesignMode } from '../contexts/DesignModeContext';
import { motion } from 'framer-motion';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { 
  Paper, 
  Typography, 
  Box, 
  Button,
  Select,
  MenuItem,
  FormControl,
  Alert,
  TextField,
  Chip,
  useTheme,
  alpha
} from '@mui/material';

const TimeInRange = () => {
  const { data, loading, error, fetchDataForDays, forceRefresh } = useNightscout();
  const { unit, formatGlucoseValue, getUnitLabel, getCurrentGlucoseRanges, convertToCurrentUnit } = useGlucoseFormatting();
  const { isModern, isPremium } = useDesignMode();
  const theme = useTheme();
  
  // Time selection state
  const [timeWindow, setTimeWindow] = useState(168); // Default to 7 days (168 hours)
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [lastTimeWindow, setLastTimeWindow] = useState<number | null>(null);
  const [lastCustomRange, setLastCustomRange] = useState<{startDate: string, endDate: string} | null>(null);

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => a.date - b.date);
  }, [data?.entries]);

  const selectedRange = React.useMemo(() => {
    if (isCustomRange) {
      return {
        startMs: startOfDay(new Date(customDateRange.startDate)).getTime(),
        endMs: endOfDay(new Date(customDateRange.endDate)).getTime()
      };
    }

    const endMs = Date.now();
    const startMs = endMs - timeWindow * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [isCustomRange, customDateRange.startDate, customDateRange.endDate, timeWindow]);

  // Get filtered readings based on time selection
  const filteredReadings = React.useMemo(() => {
    if (!entriesSortedAsc.length) return [];
    return sliceSortedByTimeRange(entriesSortedAsc, (reading) => reading.date, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  // Calculate time in range for the filtered readings
  const filteredStats = React.useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0,
        totalReadings: 0
      };
    }

    // Get current glucose ranges
    const ranges = getCurrentGlucoseRanges();

    // Count readings in each range
    let inRangeCount = 0;
    let highCount = 0;
    let lowCount = 0;

    filteredReadings.forEach((reading) => {
      const glucoseInCurrentUnit = convertToCurrentUnit(reading.sgv);
      
      if (glucoseInCurrentUnit >= ranges.TARGET_MIN && glucoseInCurrentUnit <= ranges.TARGET_MAX) {
        inRangeCount++;
      } else if (glucoseInCurrentUnit > ranges.TARGET_MAX) {
        highCount++;
      } else if (glucoseInCurrentUnit < ranges.TARGET_MIN) {
        lowCount++;
      }
    });
    
    const total = filteredReadings.length;
    
    const timeInRange = (inRangeCount / total) * 100;
    const highPercentage = (highCount / total) * 100;
    const lowPercentage = (lowCount / total) * 100;
    
    return {
      timeInRange,
      highPercentage,
      lowPercentage,
      totalReadings: total
    };
  }, [convertToCurrentUnit, filteredReadings, getCurrentGlucoseRanges]);

  // Force a refresh when time window changes
  useEffect(() => {
    // Check if time window has actually changed
    if (lastTimeWindow !== null && lastTimeWindow !== timeWindow) {
      console.log(`Time window changed from ${lastTimeWindow} to ${timeWindow} hours`);
      // Reset the last time window to prevent multiple refreshes
      setLastTimeWindow(null);
      // Force a refresh to ensure UI updates
      forceRefresh();
    }
  }, [timeWindow, lastTimeWindow, forceRefresh]);

  // Force a refresh when custom range changes
  useEffect(() => {
    if (lastCustomRange !== null) {
      const currentStartDate = customDateRange.startDate;
      const currentEndDate = customDateRange.endDate;
      const lastStartDate = lastCustomRange.startDate;
      const lastEndDate = lastCustomRange.endDate;
      
      if (currentStartDate !== lastStartDate || currentEndDate !== lastEndDate) {
        console.log(`Custom range changed from ${lastStartDate}-${lastEndDate} to ${currentStartDate}-${currentEndDate}`);
        // Reset the last custom range to prevent multiple refreshes
        setLastCustomRange(null);
        // Force a refresh to ensure UI updates
        forceRefresh();
      }
    }
  }, [customDateRange, lastCustomRange, forceRefresh]);

  // Helper functions
  const getTimeWindowLabel = (hours: number) => {
    if (hours < 24) {
      return `${hours} hours`;
    } else if (hours < 168) {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours < 720) {
      const weeks = hours / 168;
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.round(hours / 720);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  };

  const getDisplayLabel = () => {
    if (isCustomRange) {
      return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
    }
    return getTimeWindowLabel(timeWindow);
  };

  const getAllTimeWindows = () => {
    return [
      { value: 24, label: '24 hours' },
      { value: 48, label: '2 days' },
      { value: 72, label: '3 days' },
      { value: 96, label: '4 days' },
      { value: 120, label: '5 days' },
      { value: 144, label: '6 days' },
      { value: 168, label: '7 days' },
      { value: 336, label: '2 weeks' },
      { value: 504, label: '3 weeks' },
      { value: 720, label: '1 month' },
      { value: 1440, label: '2 months' },
      { value: 2160, label: '3 months' }
    ];
  };

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      // Store the previous time window to detect changes
      setLastTimeWindow(timeWindow);
      const newTimeWindow = parseInt(value);
      setTimeWindow(newTimeWindow);
      setShowCalendar(false);
      
      // Fetch more data if needed for longer time periods
      const daysNeeded = Math.ceil(newTimeWindow / 24) + 1;
      if (daysNeeded > 7) {
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'TimeInRange fetch more data for time window' });
      }
    }
  };

  const handleCustomDateSubmit = () => {
    const startDate = new Date(customDateRange.startDate);
    const endDate = new Date(customDateRange.endDate);
    
    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }
    
    if (endDate > new Date()) {
      alert('End date cannot be in the future');
      return;
    }
    
    // Store the previous custom range to detect changes
    setLastCustomRange({
      startDate: customDateRange.startDate,
      endDate: customDateRange.endDate
    });
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const daysToFetch = Math.max(diffDays + 7, 14);
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'TimeInRange fetch data for custom range' });
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (!entriesSortedAsc.length) return null;
    
    const oldestEntry = entriesSortedAsc[0];
    const newestEntry = entriesSortedAsc[entriesSortedAsc.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      totalReadings: entriesSortedAsc.length
    };
  }, [entriesSortedAsc]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    if (isPremium) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Alert 
            severity="error" 
            variant="outlined"
            sx={{ 
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.05)} 0%, ${alpha(theme.palette.error.light, 0.02)} 100%)`,
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {error}
            </Typography>
          </Alert>
        </motion.div>
      );
    }
    
    if (isModern) {
      return (
        <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      );
    }
    
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!filteredStats || filteredStats.totalReadings === 0) {
    if (isPremium) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Paper 
            elevation={6}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              }}
            />
            
            <Box sx={{ p: 4 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  mb: 2
                }}
              >
                📊 Time in Range Analysis
              </Typography>
              
              <Alert 
                severity="info" 
                variant="outlined"
                sx={{ 
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.light, 0.02)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  mt: 3
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  📈 No data available for analysis for {getDisplayLabel()}.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try selecting a different time range or fetching more data.
                </Typography>
              </Alert>
            </Box>
          </Paper>
        </motion.div>
      );
    }
    
    if (isModern) {
      return (
        <Paper elevation={2} sx={{ borderRadius: 3, p: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Time in Range Analysis
          </Typography>
          <Alert severity="info" variant="outlined" sx={{ borderRadius: 2, mt: 3 }}>
            <Typography>No data available for analysis for {getDisplayLabel()}.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try selecting a different time range or fetching more data.
            </Typography>
          </Alert>
        </Paper>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Time in Range Analysis</h2>
            <p className="text-gray-600 dark:text-gray-400">
              No data available for the selected time period
            </p>
          </div>
        </div>
        <div className="text-center p-8">
          <p className="text-gray-600 dark:text-gray-400">No data available for analysis for {getDisplayLabel()}.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Try selecting a different time range or fetching more data.</p>
        </div>
      </div>
    );
  }

  // Premium Design Implementation
  if (isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Paper 
          elevation={6}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            position: 'relative',
          }}
        >
          {/* Decorative gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 50%, ${theme.palette.primary.main} 100%)`,
            }}
          />
          
          <Box sx={{ p: 4 }}>
            {/* Premium Header */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
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
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.3)} 0%, transparent 70%)`,
                  borderRadius: '50%',
                }}
              />
              
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
                  <Box>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 700,
                        color: 'white',
                        mb: 1
                      }}
                    >
                      📊 Time in Range Analysis
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9, color: 'white' }}>
                      📈 Detailed breakdown for {getDisplayLabel()} ({filteredStats.totalReadings} readings)
                    </Typography>
                    {dataSpanInfo && (
                      <Typography variant="caption" sx={{ opacity: 0.8, color: 'white', display: 'block', mt: 0.5 }}>
                        Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
                      </Typography>
                    )}
                  </Box>
                  
                  {/* Premium Time Selection Controls */}
                  <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={1} sx={{ minWidth: { sm: 'auto', xs: '100%' } }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={isCustomRange ? 'custom' : timeWindow.toString()}
                        onChange={(e) => handleTimeWindowChange(e.target.value)}
                        sx={{
                          backgroundColor: alpha('#ffffff', 0.2),
                          color: '#ffffff',
                          backdropFilter: 'blur(10px)',
                          borderRadius: 2,
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-icon': { color: '#ffffff' },
                        }}
                      >
                        {getAllTimeWindows().map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                        <MenuItem value="custom">Custom Range</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Button
                      onClick={() => setShowCalendar(!showCalendar)}
                      variant="outlined"
                      size="small"
                      startIcon={<Calendar size={16} />}
                      sx={{
                        backgroundColor: alpha('#ffffff', 0.1),
                        color: '#ffffff',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha('#ffffff', 0.3)}`,
                        '&:hover': {
                          backgroundColor: alpha('#ffffff', 0.2),
                          border: `1px solid ${alpha('#ffffff', 0.5)}`,
                        },
                      }}
                    >
                      Calendar
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (isCustomRange) {
                          handleCustomDateSubmit();
                        } else {
                          const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                          runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, 14)), { label: 'TimeInRange refresh fetch data (premium)' });
                        }
                      }}
                      variant="outlined"
                      size="small"
                      startIcon={<Clock size={16} />}
                      sx={{
                        backgroundColor: alpha('#ffffff', 0.1),
                        color: '#ffffff',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha('#ffffff', 0.3)}`,
                        '&:hover': {
                          backgroundColor: alpha('#ffffff', 0.2),
                          border: `1px solid ${alpha('#ffffff', 0.5)}`,
                        },
                      }}
                    >
                      Refresh
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Premium Calendar Modal */}
            {showCalendar && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Paper 
                  elevation={3}
                  sx={{ 
                    p: 3, 
                    mb: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`,
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.secondary.main, mb: 3 }}>
                    📅 Select Date Range
                  </Typography>
                  <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3} sx={{ mb: 3 }}>
                    <TextField
                      type="date"
                      label="Start Date"
                      value={customDateRange.startDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      inputProps={{
                        max: customDateRange.endDate,
                        min: dataSpanInfo ? format(dataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined,
                      }}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          background: alpha(theme.palette.background.paper, 0.8),
                        },
                      }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="date"
                      label="End Date"
                      value={customDateRange.endDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      inputProps={{
                        min: customDateRange.startDate,
                        max: dataSpanInfo ? format(dataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                      }}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          background: alpha(theme.palette.background.paper, 0.8),
                        },
                      }}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                  {dataSpanInfo && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      📊 Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')}
                    </Typography>
                  )}
                  <Box display="flex" gap={2}>
                    <Button
                      onClick={handleCustomDateSubmit}
                      variant="contained"
                      sx={{
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        borderRadius: 2,
                      }}
                    >
                      Apply Range
                    </Button>
                    <Button
                      onClick={() => setShowCalendar(false)}
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Paper>
              </motion.div>
            )}

            {/* Premium Debug Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Alert 
                severity="success" 
                variant="outlined"
                sx={{ 
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.success.light, 0.02)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                  mb: 3
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  📊 <strong>Time in Range Info:</strong> Analyzing {filteredStats.totalReadings} glucose readings for {getDisplayLabel()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  🎯 Target range: {formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()}
                  {dataSpanInfo && (
                    <> • 📊 Total available: {dataSpanInfo.totalReadings} readings spanning {dataSpanInfo.spanDays} days</>
                  )}
                </Typography>
              </Alert>
            </motion.div>

            {/* Premium Main Content Grid */}
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 1fr' }} gap={3} sx={{ mb: 3 }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <TimeInRangeChart
                  timeInRange={typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0}
                  highPercentage={typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0}
                  lowPercentage={typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0}
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Paper 
                  elevation={3}
                  sx={{ 
                    p: 3, 
                    height: '100%',
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)`,
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main, mb: 3 }}>
                    🎯 Target Ranges - {getDisplayLabel()}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.08)} 100%)`,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.success.dark }}>
                        Target Range ({formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()})
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                        {typeof filteredStats.timeInRange === 'number' ? `${filteredStats.timeInRange.toFixed(1)}%` : 'N/A'}
                      </Typography>
                    </Paper>
                    
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)} 0%, ${alpha(theme.palette.warning.main, 0.08)} 100%)`,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.warning.dark }}>
                        High (&gt;{formatGlucoseValue(getCurrentGlucoseRanges().HIGH_THRESHOLD, unit, false)} {getUnitLabel()})
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                        {typeof filteredStats.highPercentage === 'number' ? `${filteredStats.highPercentage.toFixed(1)}%` : 'N/A'}
                      </Typography>
                    </Paper>
                    
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.main, 0.08)} 100%)`,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.error.dark }}>
                        Low (&lt;{formatGlucoseValue(getCurrentGlucoseRanges().LOW_THRESHOLD, unit, false)} {getUnitLabel()})
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                        {typeof filteredStats.lowPercentage === 'number' ? `${filteredStats.lowPercentage.toFixed(1)}%` : 'N/A'}
                      </Typography>
                    </Paper>
                  </Box>
                  
                  <Paper 
                    elevation={0}
                    sx={{ 
                      mt: 3, 
                      p: 2.5, 
                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.15)} 0%, ${alpha(theme.palette.info.main, 0.08)} 100%)`,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.info.dark, mb: 2 }}>
                      📊 Summary
                    </Typography>
                    <Box sx={{ color: theme.palette.info.dark }}>
                      <Typography variant="body2">• Total readings analyzed: {filteredStats.totalReadings}</Typography>
                      <Typography variant="body2">• Time period: {getDisplayLabel()}</Typography>
                      <Typography variant="body2">
                        • Target achievement: {filteredStats.timeInRange >= 70 ? '✅ Excellent' : filteredStats.timeInRange >= 50 ? '⚠️ Good' : '❌ Needs improvement'}
                      </Typography>
                    </Box>
                  </Paper>
                </Paper>
              </motion.div>
            </Box>

            {/* Premium Additional Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Paper 
                elevation={3}
                sx={{ 
                  p: 3, 
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`,
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.secondary.main, mb: 3 }}>
                  🔍 Time in Range Insights
                </Typography>
                <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      📈 Performance Analysis
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {filteredStats.timeInRange >= 70 && (
                        <Chip
                          label="✅ Excellent glucose control (≥70% TIR)"
                          sx={{
                            backgroundColor: alpha(theme.palette.success.main, 0.15),
                            color: theme.palette.success.dark,
                            fontWeight: 500,
                            justifyContent: 'flex-start'
                          }}
                        />
                      )}
                      {filteredStats.timeInRange >= 50 && filteredStats.timeInRange < 70 && (
                        <Chip
                          label="⚠️ Good control, room for improvement"
                          sx={{
                            backgroundColor: alpha(theme.palette.warning.main, 0.15),
                            color: theme.palette.warning.dark,
                            fontWeight: 500,
                            justifyContent: 'flex-start'
                          }}
                        />
                      )}
                      {filteredStats.timeInRange < 50 && (
                        <Chip
                          label="❌ Consider adjusting diabetes management"
                          sx={{
                            backgroundColor: alpha(theme.palette.error.main, 0.15),
                            color: theme.palette.error.dark,
                            fontWeight: 500,
                            justifyContent: 'flex-start'
                          }}
                        />
                      )}
                      {filteredStats.lowPercentage > 4 && (
                        <Chip
                          label="⚠️ High time below range (&gt;4%)"
                          sx={{
                            backgroundColor: alpha(theme.palette.error.main, 0.15),
                            color: theme.palette.error.dark,
                            fontWeight: 500,
                            justifyContent: 'flex-start'
                          }}
                        />
                      )}
                      {filteredStats.highPercentage > 25 && (
                        <Chip
                          label="⚠️ High time above range (&gt;25%)"
                          sx={{
                            backgroundColor: alpha(theme.palette.warning.main, 0.15),
                            color: theme.palette.warning.dark,
                            fontWeight: 500,
                            justifyContent: 'flex-start'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      🎯 Recommendations
                    </Typography>
                    <Box sx={{ color: 'text.secondary' }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>• Target: ≥70% time in range ({formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()})</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>• Target: &lt;4% time below range (&lt;{formatGlucoseValue(getCurrentGlucoseRanges().LOW_THRESHOLD, unit, false)} {getUnitLabel()})</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>• Target: &lt;25% time above range (&gt;{formatGlucoseValue(getCurrentGlucoseRanges().HIGH_THRESHOLD, unit, false)} {getUnitLabel()})</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>• Review patterns with your healthcare team</Typography>
                      <Typography variant="body2">• Consider CGM data trends for adjustments</Typography>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </motion.div>
          </Box>
        </Paper>
      </motion.div>
    );
  }

  // Classic Tailwind Design
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Time in Range Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed breakdown for {getDisplayLabel()} ({filteredStats.totalReadings} readings)
          </p>
          {dataSpanInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
            </p>
          )}
        </div>
        
        {/* Time Selection Controls */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-4 sm:mt-0">
          <select
            value={isCustomRange ? 'custom' : timeWindow.toString()}
            onChange={(e) => handleTimeWindowChange(e.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            {getAllTimeWindows().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </button>
          
          <button 
            onClick={() => {
              if (isCustomRange) {
                handleCustomDateSubmit();
              } else {
                const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, 14)), { label: 'TimeInRange refresh fetch data' });
              }
            }}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center transition-colors duration-200"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Select Date Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                max={customDateRange.endDate}
                min={dataSpanInfo ? format(dataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                min={customDateRange.startDate}
                max={dataSpanInfo ? format(dataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
          </div>
          {dataSpanInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')}
            </p>
          )}
          <div className="flex space-x-3">
            <button
              onClick={handleCustomDateSubmit}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              Apply Range
            </button>
            <button
              onClick={() => {
                setShowCalendar(false);
              }}
              className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
        <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">📊 Time in Range Info:</h4>
        <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
          <p>🎯 Analyzing {filteredStats.totalReadings} glucose readings for {getDisplayLabel()}</p>
          <p>📈 Target range: {formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()}</p>
          {dataSpanInfo && (
            <p>📊 Total available: {dataSpanInfo.totalReadings} readings spanning {dataSpanInfo.spanDays} days</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeInRangeChart
          timeInRange={typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0}
          highPercentage={typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0}
          lowPercentage={typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0}
        />
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
            Target Ranges - {getDisplayLabel()}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-green-600 dark:text-green-400 font-medium">Target Range ({formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()})</span>
              <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                {typeof filteredStats.timeInRange === 'number' ? `${filteredStats.timeInRange.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <span className="text-orange-500 dark:text-orange-400 font-medium">High (&gt;{formatGlucoseValue(getCurrentGlucoseRanges().HIGH_THRESHOLD, unit, false)} {getUnitLabel()})</span>
              <span className="font-bold text-orange-500 dark:text-orange-400 text-lg">
                {typeof filteredStats.highPercentage === 'number' ? `${filteredStats.highPercentage.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span className="text-red-600 dark:text-red-400 font-medium">Low (&lt;{formatGlucoseValue(getCurrentGlucoseRanges().LOW_THRESHOLD, unit, false)} {getUnitLabel()})</span>
              <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                {typeof filteredStats.lowPercentage === 'number' ? `${filteredStats.lowPercentage.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📊 Summary</h4>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p>• Total readings analyzed: {filteredStats.totalReadings}</p>
              <p>• Time period: {getDisplayLabel()}</p>
              <p>• Target achievement: {filteredStats.timeInRange >= 70 ? '✅ Excellent' : filteredStats.timeInRange >= 50 ? '⚠️ Good' : '❌ Needs improvement'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Time in Range Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">📈 Performance Analysis</h4>
            <div className="space-y-2 text-sm">
              {filteredStats.timeInRange >= 70 && (
                <div className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <span className="text-green-600 dark:text-green-400">✅ Excellent glucose control (≥70% TIR)</span>
                </div>
              )}
              {filteredStats.timeInRange >= 50 && filteredStats.timeInRange < 70 && (
                <div className="flex items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <span className="text-yellow-600 dark:text-yellow-400">⚠️ Good control, room for improvement</span>
                </div>
              )}
              {filteredStats.timeInRange < 50 && (
                <div className="flex items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <span className="text-red-600 dark:text-red-400">❌ Consider adjusting diabetes management</span>
                </div>
              )}
              {filteredStats.lowPercentage > 4 && (
                <div className="flex items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <span className="text-red-600 dark:text-red-400">⚠️ High time below range (&gt;4%)</span>
                </div>
              )}
              {filteredStats.highPercentage > 25 && (
                <div className="flex items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                  <span className="text-orange-600 dark:text-orange-400">⚠️ High time above range (&gt;25%)</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">🎯 Recommendations</h4>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>• Target: ≥70% time in range ({formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MIN, unit, false)}-{formatGlucoseValue(getCurrentGlucoseRanges().TARGET_MAX, unit, false)} {getUnitLabel()})</p>
              <p>• Target: &lt;4% time below range (&lt;{formatGlucoseValue(getCurrentGlucoseRanges().LOW_THRESHOLD, unit, false)} {getUnitLabel()})</p>
              <p>• Target: &lt;25% time above range (&gt;{formatGlucoseValue(getCurrentGlucoseRanges().HIGH_THRESHOLD, unit, false)} {getUnitLabel()})</p>
              <p>• Review patterns with your healthcare team</p>
              <p>• Consider CGM data trends for adjustments</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeInRange;
