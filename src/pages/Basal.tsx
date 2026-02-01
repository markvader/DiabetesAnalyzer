import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { analyzeData } from '../services/analysisService';
import { useDesignMode } from '../contexts/DesignModeContext';
import SuggestionTable from '../components/SuggestionTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { AlertTriangle, Brain, Shield, RefreshCw, Calendar, Clock } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getTreatmentMs } from '../utils/nightscoutTime';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Card,
  CardContent,
  Chip,
  Stack,
  Modal,
  Fade,
  useTheme,
  alpha
} from '@mui/material';
import { 
  CalendarToday, 
  Refresh, 
  Security, 
  Psychology,
  Schedule
} from '@mui/icons-material';

const Basal = () => {
  const { data, loading, error, fetchDataForDays, analysisPeriod } = useNightscout();
  const { isModern } = useDesignMode();
  const theme = useTheme();
  const [analysisResults, setAnalysisResults] = useState<Awaited<ReturnType<typeof analyzeData>>>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  // Time selection state - use analysisPeriod from context
  const [timeWindow, setTimeWindow] = useState(() => analysisPeriod * 24); // Convert days to hours
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => a.date - b.date);
  }, [data?.entries]);

  const treatmentsSortedAsc = React.useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

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

  // Update timeWindow when analysisPeriod changes
  useEffect(() => {
    if (!isCustomRange) {
      setTimeWindow(analysisPeriod * 24);
      setCustomDateRange({
        startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [analysisPeriod, isCustomRange]);

  // Fetch data when analysisPeriod changes
  useEffect(() => {
    runSafeAsync(() => fetchDataForDays(Math.max(analysisPeriod, 7)), { label: 'Basal initial fetch' });
  }, [analysisPeriod, fetchDataForDays]);

  // Get filtered readings based on time selection
  const filteredReadings = React.useMemo(() => {
    if (!entriesSortedAsc.length) {
      return [];
    }

    return sliceSortedByTimeRange(entriesSortedAsc, (reading) => reading.date, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  // Get filtered treatments based on time selection
  const filteredTreatments = React.useMemo(() => {
    if (!treatmentsSortedAsc.length) {
      return [];
    }

    return sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange.startMs, selectedRange.endMs);
  }, [treatmentsSortedAsc, selectedRange.startMs, selectedRange.endMs]);

  // Create filtered data object for analysis
  const filteredData = React.useMemo(() => {
    if (!data) return null;
    
    return {
      ...data,
      entries: filteredReadings,
      treatments: filteredTreatments
    };
  }, [data, filteredReadings, filteredTreatments]);

  useEffect(() => {
    const performAnalysis = async () => {
      if (!filteredData) return;
      
      // Run automatically on initial load (default 2 weeks) or when manual refresh is triggered
      if (!hasInitialLoad || manualRefresh) {
        setAnalyzing(true);
        try {
          const results = await analyzeData(filteredData);
          setAnalysisResults(results);
          
          // Mark initial load as complete and reset manual refresh flag
          if (!hasInitialLoad) {
            setHasInitialLoad(true);
          }
          if (manualRefresh) {
            setManualRefresh(false);
          }
        } catch (error) {
          console.error('Analysis failed:', error);
        } finally {
          setAnalyzing(false);
        }
      }
    };

    runSafeAsync(() => performAnalysis(), { label: 'Basal performAnalysis effect' });
  }, [filteredData, manualRefresh, hasInitialLoad]);

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
      const newTimeWindow = parseInt(value);
      setTimeWindow(newTimeWindow);
      setShowCalendar(false);
      
      // Clear existing analysis when changing time period
      setAnalysisResults(null);
      
      // Fetch more data if needed for longer time periods
      const daysNeeded = Math.ceil(newTimeWindow / 24) + 1;
      if (daysNeeded > analysisPeriod) {
        runSafeAsync(() => fetchDataForDays(Math.min(daysNeeded, 90)), { label: 'Basal fetch more data for time window' });
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
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const daysToFetch = Math.max(diffDays + 7, analysisPeriod);
    runSafeAsync(() => fetchDataForDays(Math.min(daysToFetch, 90)), { label: 'Basal fetch data for custom range' });
    
    // Clear existing analysis when changing date range
    setAnalysisResults(null);
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (!data?.entries?.length) return null;
    
    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    const oldestEntry = sortedEntries[0];
    const newestEntry = sortedEntries[sortedEntries.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      totalReadings: data.entries.length
    };
  }, [data?.entries]);

  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || analyzing) return <LoadingSpinner message={analyzing ? "Running AI safety analysis..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!analysisResults?.currentProfile) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">No profile data available.</p>
      </div>
    );
  }

  // Modern Material UI Design
  if (isModern) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', sm: 'center' }} gap={2}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  AI-Enhanced Basal Rate Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Analysis for {getDisplayLabel()}
                </Typography>
                {dataSpanInfo && (
                  <Typography variant="caption" color="text.secondary">
                    Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
                  </Typography>
                )}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={isCustomRange ? 'custom' : timeWindow.toString()}
                    label="Time Period"
                    onChange={(e) => handleTimeWindowChange(e.target.value)}
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
                  variant="outlined"
                  startIcon={<CalendarToday />}
                  onClick={() => setShowCalendar(!showCalendar)}
                  size="small"
                >
                  Calendar
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Schedule />}
                  onClick={() => {
                    if (isCustomRange) {
                      handleCustomDateSubmit();
                    } else {
                      const daysNeeded = Math.ceil(timeWindow / 24) + 1;
                      runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, analysisPeriod)), { label: 'Basal refresh fetch data (modern)' });
                    }
                  }}
                  size="small"
                >
                  Refresh Data
                </Button>
                
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={handleRefreshAI}
                  size="small"
                >
                  Refresh AI
                </Button>
              </Stack>
            </Box>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Calendar Modal */}
            <Modal
              open={showCalendar}
              onClose={() => setShowCalendar(false)}
              closeAfterTransition
            >
              <Fade in={showCalendar}>
                <Paper
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: 500 },
                    maxWidth: '90vw',
                    borderRadius: 3,
                    p: 3
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    Select Date Range
                  </Typography>
                  <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} sx={{ mb: 3 }}>
                    <TextField
                      type="date"
                      label="Start Date"
                      value={customDateRange.startDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      inputProps={{
                        max: customDateRange.endDate,
                        min: dataSpanInfo ? format(dataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined
                      }}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="date"
                      label="End Date"
                      value={customDateRange.endDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      inputProps={{
                        min: customDateRange.startDate,
                        max: dataSpanInfo ? format(dataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                      }}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                  {dataSpanInfo && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2}>
                    <Button variant="contained" onClick={handleCustomDateSubmit}>
                      Apply Range
                    </Button>
                    <Button variant="outlined" onClick={() => setShowCalendar(false)}>
                      Cancel
                    </Button>
                  </Stack>
                </Paper>
              </Fade>
            </Modal>

            {/* Show empty state with manual refresh option when no analysis results */}
            {!analysisResults && !analyzing && (
              <Card elevation={0} sx={{ textAlign: 'center', py: 4, backgroundColor: alpha(theme.palette.info.main, 0.05) }}>
                <CardContent>
                  <Security sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    AI-Enhanced Basal Rate Analysis
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {(!filteredReadings.length || !filteredTreatments.length) ? (
                      "Insufficient data for analysis. Please ensure you have glucose readings and treatment data for the selected time period."
                    ) : hasInitialLoad ? (
                      "No basal rate analysis available. Click 'Refresh AI' to run analysis for the current time period."
                    ) : (
                      `Loading basal rate analysis for the last ${analysisPeriod} day${analysisPeriod > 1 ? 's' : ''}...`
                    )}
                  </Typography>
                  {(filteredReadings.length && filteredTreatments.length && hasInitialLoad) && (
                    <Button 
                      variant="contained"
                      size="large"
                      startIcon={<Psychology />}
                      onClick={handleRefreshAI}
                      sx={{ borderRadius: 2 }}
                    >
                      Start Basal Analysis
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Analysis Results Section */}
            {analysisResults && (
              <Box sx={{ mt: 3, '& > *:not(:last-child)': { mb: 3 } }}>
                {/* Safety Warnings */}
                {analysisResults.safetyWarnings?.length > 0 && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      borderRadius: 2,
                      '& .MuiAlert-message': { width: '100%' }
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Security />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Critical Safety Warnings
                      </Typography>
                    </Box>
                    <Stack spacing={1}>
                      {analysisResults.safetyWarnings.map((warning: string, index: number) => (
                        <Paper 
                          key={index} 
                          elevation={0}
                          sx={{ 
                            p: 1.5, 
                            backgroundColor: alpha(theme.palette.error.main, 0.1),
                            borderLeft: 4,
                            borderColor: theme.palette.error.main
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {warning}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {/* AI Analysis Results */}
                {analysisResults.aiEnhanced && (
                  <Card elevation={2} sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Psychology color="secondary" />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            AI Safety Analysis
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label={`Safety Score: ${analysisResults.aiEnhanced.safetyScore}/100`}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                          <Chip 
                            label={`Hypo Risk: ${analysisResults.aiEnhanced.hypoglycemiaRisk.toFixed(1)}%`}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </Stack>
                      </Box>

                      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
                        <Paper elevation={0} sx={{ p: 2.5, backgroundColor: alpha(theme.palette.secondary.main, 0.08), borderRadius: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            AI Recommendations
                          </Typography>
                          <Stack spacing={1}>
                            {analysisResults.aiEnhanced.aiInsights.recommendations.map((rec: string, index: number) => (
                              <Paper 
                                key={index} 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                                  borderLeft: 4,
                                  borderColor: theme.palette.secondary.main
                                }}
                              >
                                <Typography variant="body2">{rec}</Typography>
                              </Paper>
                            ))}
                          </Stack>
                        </Paper>
                        
                        <Paper elevation={0} sx={{ p: 2.5, backgroundColor: alpha(theme.palette.info.main, 0.08), borderRadius: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            Risk Assessment
                          </Typography>
                          <Stack spacing={2}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" color="text.secondary">Overall Risk:</Typography>
                              <Chip 
                                label={analysisResults.aiEnhanced.aiInsights.riskAssessment}
                                size="small"
                                color={
                                  analysisResults.aiEnhanced.aiInsights.riskAssessment === 'low' ? 'success' :
                                  analysisResults.aiEnhanced.aiInsights.riskAssessment === 'medium' ? 'warning' : 'error'
                                }
                              />
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" color="text.secondary">AI Confidence:</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {analysisResults.aiEnhanced.aiInsights.confidence}%
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Box sx={{ '& > *:not(:last-child)': { mb: 3 } }}>
                  <SuggestionTable
                    title="Ultra-Safe Basal Rate Recommendations"
                    currentValues={analysisResults.currentProfile.basal}
                    suggestedValues={analysisResults.basalSuggestions || []}
                    unit="U/hr"
                  />

                  <Card elevation={2} sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Understanding Ultra-Safe Basal Rates
                      </Typography>
                      <Stack spacing={2}>
                        <Typography variant="body1" color="text.secondary">
                          These ultra-conservative basal rate suggestions prioritize preventing hypoglycemia above all else. 
                          The analysis uses a safety-first approach with:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
                          <Typography component="li" variant="body2" color="text.secondary">
                            Maximum 5% adjustments (reduced from previous 10%)
                          </Typography>
                          <Typography component="li" variant="body2" color="text.secondary">
                            Hypoglycemia prevention as the top priority
                          </Typography>
                          <Typography component="li" variant="body2" color="text.secondary">
                            AI-powered safety validation
                          </Typography>
                          <Typography component="li" variant="body2" color="text.secondary">
                            Pediatric-focused safety constraints
                          </Typography>
                        </Box>
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                          <Typography variant="body2">
                            <strong>Important:</strong> Always consult with your healthcare provider before making changes to your basal rates.
                            These suggestions are based on pattern analysis and should be reviewed by your medical team.
                            Start with the smallest possible changes (1-2%) and monitor closely.
                          </Typography>
                        </Alert>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Container>
    );
  }

  // Classic Tailwind Design
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI-Enhanced Basal Rate Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis for {getDisplayLabel()}
          </p>
          {dataSpanInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
            </p>
          )}
        </div>
        
        {/* Time Selection and Refresh Controls */}
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
                runSafeAsync(() => fetchDataForDays(Math.max(daysNeeded, analysisPeriod)), { label: 'Basal refresh fetch data' });
              }
            }}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center transition-colors duration-200"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh Data
          </button>
          
          <button 
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI
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

      {/* Show empty state with manual refresh option when no analysis results */}
      {!analysisResults && !analyzing && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">AI-Enhanced Basal Rate Analysis</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {(!filteredReadings.length || !filteredTreatments.length) ? (
              "Insufficient data for analysis. Please ensure you have glucose readings and treatment data for the selected time period."
            ) : hasInitialLoad ? (
              "No basal rate analysis available. Click 'Refresh AI' to run analysis for the current time period."
            ) : (
              `Loading basal rate analysis for the last ${analysisPeriod} day${analysisPeriod > 1 ? 's' : ''}...`
            )}
          </p>
          {(filteredReadings.length && filteredTreatments.length && hasInitialLoad) && (
            <button 
              onClick={handleRefreshAI}
              className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center mx-auto transition-colors duration-200"
            >
              <Brain className="w-5 h-5 mr-2" />
              Start Basal Analysis
            </button>
          )}
        </div>
      )}

      {/* Analysis Results Section */}
      {analysisResults && (
        <div className="space-y-6">

      {/* Safety Warnings */}
      {analysisResults.safetyWarnings?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Critical Safety Warnings</h3>
          </div>
          
          <div className="space-y-3">
            {analysisResults.safetyWarnings.map((warning: string, index: number) => (
              <div key={index} className="bg-red-100 dark:bg-red-800/30 p-3 rounded border-l-4 border-red-500">
                <p className="text-red-800 dark:text-red-200 text-sm font-medium">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis Results */}
      {analysisResults.aiEnhanced && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Safety Analysis</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Safety Score: {analysisResults.aiEnhanced.safetyScore}/100 | 
              Hypo Risk: {analysisResults.aiEnhanced.hypoglycemiaRisk.toFixed(1)}%
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">AI Recommendations</h4>
              <div className="space-y-2">
                {analysisResults.aiEnhanced.aiInsights.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded border-l-4 border-purple-500">
                    <p className="text-purple-800 dark:text-purple-200 text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Risk Assessment</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">Overall Risk:</span>
                  <span className={`font-medium ${
                    analysisResults.aiEnhanced.aiInsights.riskAssessment === 'low' ? 'text-green-600 dark:text-green-400' :
                    analysisResults.aiEnhanced.aiInsights.riskAssessment === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {analysisResults.aiEnhanced.aiInsights.riskAssessment}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">AI Confidence:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {analysisResults.aiEnhanced.aiInsights.confidence}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <SuggestionTable
          title="Ultra-Safe Basal Rate Recommendations"
          currentValues={analysisResults.currentProfile.basal}
          suggestedValues={analysisResults.basalSuggestions || []}
          unit="U/hr"
        />

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Understanding Ultra-Safe Basal Rates</h3>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              These ultra-conservative basal rate suggestions prioritize preventing hypoglycemia above all else. 
              The analysis uses a safety-first approach with:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Maximum 5% adjustments (reduced from previous 10%)</li>
              <li>Hypoglycemia prevention as the top priority</li>
              <li>AI-powered safety validation</li>
              <li>Pediatric-focused safety constraints</li>
            </ul>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md mt-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  <strong>Important:</strong> Always consult with your healthcare provider before making changes to your basal rates.
                  These suggestions are based on pattern analysis and should be reviewed by your medical team.
                  Start with the smallest possible changes (1-2%) and monitor closely.
                </p>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Basal;