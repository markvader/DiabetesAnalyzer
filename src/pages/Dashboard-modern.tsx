import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNightscout } from '../contexts/NightscoutContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Activity, Clock, TrendingUp, Download, Calendar, Brain, RefreshCw, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Existing Components
import GlucoseChart from '../components/GlucoseChart';
import GlucoseTrendChart from '../components/GlucoseTrendChart';
import TimeInRangeChart from '../components/TimeInRangeChart';
import A1CEstimator from '../components/A1CEstimator';
import StatCard from '../components/StatCard';
import AlertSettings from '../components/AlertSettings';
import DataExport from '../components/DataExport';
import AdvancedPredictionChart from '../components/AdvancedPredictionChart';
import NightscoutDataDisplay from '../components/NightscoutDataDisplay';
import PredictionInsightsPanel from '../components/PredictionInsightsPanel';
import TreatmentTimeline from '../components/TreatmentTimeline';
import GlucoseTrendAnalysis from '../components/GlucoseTrendAnalysis';
import AdvancedStats from '../components/AdvancedStats';
import EnhancedAIInsightsPanel from '../components/EnhancedAIInsightsPanel';
import TensorFlowStatus from '../components/TensorFlowStatus';
import AIManagementPlan from '../components/AIManagementPlan';

// Services and Utils
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useDashboardDisplay } from '../contexts/DashboardDisplayContext';
import { formatCageValue, formatSageValue, formatBasalRate, getCageColorClass, getSageColorClass } from '../utils/nightscoutFormatting';
import { 
  nightscoutTreatmentParser, 
  type ParsedNightscoutData 
} from '../services/nightscoutTreatmentParser';
import { cn } from '../utils/cn';

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedPump, roundBasalRate } = useInsulinPump();
  const { formatDateTime } = useTimeFormat();
  const { 
    data, 
    loading, 
    error, 
    url, 
    lastFetchTime, 
    refreshNow,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshInterval,
    setAutoRefreshInterval
  } = useNightscout();
  const { isSubscribed } = useSubscription();
  const { showDeviceStatus } = useDashboardDisplay();
  const { formatGlucoseValue, convertToCurrentUnit, getCurrentGlucoseRanges, getUnitLabel } = useGlucoseFormatting();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled } = useTensorFlow();
  
  // State for UI controls and data
  const [hasApiKey, setHasApiKey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [parsedNightscoutData, setParsedNightscoutData] = useState<ParsedNightscoutData | null>(null);
  const [showRefreshSettings, setShowRefreshSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [manualAIRefresh, setManualAIRefresh] = useState(0);

  // All the existing state and logic from original Dashboard
  const [timeWindow, setTimeWindow] = useState(24);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Check if any API key is available
  useEffect(() => {
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    
    setHasApiKey(!!(openaiKey || deepseekKey || anthropicKey || geminiKey));
  }, []);

  const handleNightscoutDataParsed = useCallback((parsedData: ParsedNightscoutData) => {
    setParsedNightscoutData(parsedData);
    setRefreshKey(prev => prev + 1);
  }, []);

  // All the existing helper functions from the original Dashboard
  const getDefaultTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const predictionContext = parsedNightscoutData ? {
    recentMeals: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentMeals || [] : [],
    recentInsulin: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentInsulin || [] : [],
    recentExercise: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentExercise || [] : [],
    timeOfDay: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).timeOfDay || getDefaultTimeOfDay(),
    dayOfWeek: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    isWeekend: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).isWeekend ?? [0, 6].includes(new Date().getDay()),
  } : undefined;

  // Calculate stats and readings (keeping all original logic)
  const filteredReadings = useMemo(() => {
    if (!data?.entries) return [];
    
    let startTime: Date;
    let endTime: Date = new Date();
    
    if (isCustomRange) {
      startTime = startOfDay(new Date(customDateRange.startDate));
      endTime = endOfDay(new Date(customDateRange.endDate));
    } else {
      startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    }
    
    return data.entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startTime && entryDate <= endTime;
    });
  }, [data, timeWindow, isCustomRange, customDateRange]);

  const chartReadings = useMemo(() => {
    if (filteredReadings.length <= 4032) return filteredReadings;
    return filteredReadings.slice(-4032);
  }, [filteredReadings]);

  const filteredStats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        totalReadings: 0,
        averageBG: 0,
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0
      };
    }

    const ranges = getCurrentGlucoseRanges();
    const inRangeReadings = filteredReadings.filter(r => 
      r.sgv >= ranges.TARGET_MIN && r.sgv <= ranges.TARGET_MAX
    );
    const highReadings = filteredReadings.filter(r => r.sgv > ranges.TARGET_MAX);
    const lowReadings = filteredReadings.filter(r => r.sgv < ranges.TARGET_MIN);
    
    const totalReadings = filteredReadings.length;
    const averageBG = filteredReadings.reduce((sum, r) => sum + r.sgv, 0) / totalReadings;
    
    return {
      totalReadings,
      averageBG,
      timeInRange: Math.round((inRangeReadings.length / totalReadings) * 100),
      highPercentage: Math.round((highReadings.length / totalReadings) * 100),
      lowPercentage: Math.round((lowReadings.length / totalReadings) * 100)
    };
  }, [filteredReadings, getCurrentGlucoseRanges]);

  const recentReading = data?.entries?.[data.entries.length - 1];
  const recentDeviceStatus = data?.deviceStatus?.[0];

  // Time window management
  const getAllTimeWindows = () => [
    { value: 3, label: '3 Hours' },
    { value: 6, label: '6 Hours' },
    { value: 12, label: '12 Hours' },
    { value: 24, label: '24 Hours' },
    { value: 48, label: '2 Days' },
    { value: 72, label: '3 Days' },
    { value: 168, label: '1 Week' },
    { value: 336, label: '2 Weeks' },
    { value: 720, label: '1 Month' },
    { value: 2160, label: '3 Months' }
  ];

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      setTimeWindow(parseInt(value));
    }
  };

  const handleCustomDateSubmit = () => {
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  const getDisplayLabel = () => {
    if (isCustomRange) {
      return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
    }
    const option = getAllTimeWindows().find(opt => opt.value === timeWindow);
    return option?.label || `${timeWindow} Hours`;
  };

  const getChartTimeWindowLabel = () => {
    const chartHours = Math.min(timeWindow, 336);
    if (chartHours <= 24) return `${chartHours} Hours`;
    if (chartHours <= 168) return `${Math.round(chartHours / 24)} Days`;
    return `${Math.round(chartHours / 168)} Weeks`;
  };

  const getDataDescription = () => {
    if (!data?.entries || data.entries.length === 0) {
      return "No glucose data available";
    }
    return `Glucose monitoring data from ${url || 'Nightscout'}`;
  };

  const handleAlertSettingsSave = (settings: any) => {
    // Save logic here
    console.log('Alert settings saved:', settings);
  };

  const handleRefreshAI = () => {
    setManualAIRefresh(prev => prev + 1);
  };

  const getDelta = () => {
    if (!data?.entries || data.entries.length < 2) return null;
    
    const latest = data.entries[data.entries.length - 1];
    const previous = data.entries[data.entries.length - 2];
    
    if (!latest || !previous) return null;
    
    const delta = latest.sgv - previous.sgv;
    const formattedInCurrentUnit = formatGlucoseValue(Math.abs(delta), 'mgdl', true);
    
    return {
      value: delta,
      formattedInCurrentUnit: `${delta > 0 ? '+' : ''}${formattedInCurrentUnit}`
    };
  };

  const safePercentage = (value: any): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${value}%`;
    }
    return '0%';
  };

  const ultraSafeRender = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    return 'N/A';
  };

  // Extract functions for device status (simplified versions)
  const lastKnownCageRef = useRef<number | null>(null);
  const lastKnownSageRef = useRef<number | null>(null);

  const extractCageValue = (deviceStatus: any): number | null => {
    if (!deviceStatus || !data?.treatments) return lastKnownCageRef.current;
    
    const now = new Date();
    const siteChanges = data.treatments
      .filter((t: any) => {
        if (!t) return false;
        const eventType = t.eventType?.toLowerCase() || '';
        const notes = t.notes?.toLowerCase() || '';
        
        return eventType.includes('site change') || 
               eventType.includes('pump site change') || 
               eventType.includes('cannula') ||
               notes.includes('site change') || 
               notes.includes('cannula') ||
               notes.includes('pump site');
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
    
    if (siteChanges.length > 0) {
      const lastSiteChange = siteChanges[0];
      const changeTime = new Date(lastSiteChange.created_at || lastSiteChange.timestamp);
      
      if (!isNaN(changeTime.getTime())) {
        const hoursAgo = (now.getTime() - changeTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo >= 0 && hoursAgo <= 8760) {
          lastKnownCageRef.current = hoursAgo;
          return hoursAgo;
        }
      }
    }
    
    return lastKnownCageRef.current;
  };

  const extractSageValue = (deviceStatus: any): number | null => {
    if (!deviceStatus || !data?.treatments) return lastKnownSageRef.current;
    
    const now = new Date();
    const sensorChanges = data.treatments
      .filter((t: any) => {
        if (!t) return false;
        const eventType = t.eventType?.toLowerCase() || '';
        const notes = t.notes?.toLowerCase() || '';
        
        return eventType.includes('sensor') || 
               eventType.includes('cgm') ||
               notes.includes('sensor') || 
               notes.includes('cgm');
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
    
    if (sensorChanges.length > 0) {
      const lastSensorChange = sensorChanges[0];
      const changeTime = new Date(lastSensorChange.created_at || lastSensorChange.timestamp);
      
      if (!isNaN(changeTime.getTime())) {
        const hoursAgo = (now.getTime() - changeTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo >= 0 && hoursAgo <= 8760) {
          lastKnownSageRef.current = hoursAgo;
          return hoursAgo;
        }
      }
    }
    
    return lastKnownSageRef.current;
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading dashboard data..." />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Alert 
          variant="danger" 
          title="Data Loading Error"
        >
          <div className="space-y-3">
            <p>Unable to load dashboard data: {error}</p>
            <Button onClick={refreshNow} size="sm">
              Try Again
            </Button>
          </div>
        </Alert>
      </motion.div>
    );
  }

  // Render no data state
  if (!data?.entries || data.entries.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <DashboardHeader 
          title="Dashboard"
          subtitle="No glucose data available"
        />
        <Alert 
          type="warning" 
          title="No Data Available"
          description="Please check your Nightscout connection and ensure there is glucose data to display."
          action={
            <Button onClick={() => navigate('/settings')} size="sm">
              Check Settings
            </Button>
          }
        />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Modern Dashboard Header */}
      <DashboardHeader 
        title="Dashboard" 
        subtitle={getDataDescription()}
        lastUpdated={lastFetchTime ? formatDateTime(lastFetchTime) : undefined}
        actions={[
          {
            label: 'Custom Range',
            icon: Calendar,
            onClick: () => setShowCalendar(!showCalendar),
            variant: 'secondary'
          },
          {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: refreshNow,
            variant: 'primary'
          },
          {
            label: 'Auto-Refresh',
            icon: autoRefreshEnabled ? Pause : Play,
            onClick: () => setShowRefreshSettings(!showRefreshSettings),
            variant: 'secondary'
          }
        ]}
      />

      {/* Time Window Selection */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Period
            </label>
            <select
              value={isCustomRange ? 'custom' : timeWindow.toString()}
              onChange={(e) => handleTimeWindowChange(e.target.value)}
              className={cn(
                "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600",
                "rounded-lg shadow-sm bg-white dark:bg-gray-700",
                "text-gray-900 dark:text-gray-100",
                "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                "transition-colors duration-200"
              )}
            >
              {getAllTimeWindows().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isCustomRange ? 'primary' : 'secondary'}>
              {getDisplayLabel()}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Auto-Refresh Settings */}
      <AnimatePresence>
        {showRefreshSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="elevated" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Auto-Refresh Settings
                </h3>
                <Badge variant={autoRefreshEnabled ? 'success' : 'secondary'}>
                  {autoRefreshEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Enable Auto-Refresh</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoRefreshEnabled} 
                      onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className={cn(
                      "w-11 h-6 rounded-full peer transition-colors duration-200",
                      "peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300",
                      "bg-gray-200 dark:bg-gray-700",
                      "peer-checked:bg-primary-600",
                      "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                      "after:bg-white after:border-gray-300 after:border after:rounded-full",
                      "after:h-5 after:w-5 after:transition-all",
                      "peer-checked:after:translate-x-full peer-checked:after:border-white"
                    )}></div>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Refresh Interval
                  </label>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                    className={cn(
                      "w-full px-3 py-2 border border-gray-300 dark:border-gray-600",
                      "rounded-lg shadow-sm bg-white dark:bg-gray-700",
                      "text-gray-900 dark:text-gray-100",
                      "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-colors duration-200"
                    )}
                    disabled={!autoRefreshEnabled}
                  >
                    <option value={10000}>10 seconds</option>
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                    <option value={120000}>2 minutes</option>
                    <option value={300000}>5 minutes</option>
                  </select>
                </div>
                
                <Alert 
                  type="info"
                  title="Refresh Settings Note"
                  description="More frequent refreshes keep your data current but may use more data and battery. For real-time monitoring, use shorter intervals (10-30 seconds)."
                />
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowRefreshSettings(false)}
                    variant="primary"
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Date Range Calendar */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="elevated" className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Select Date Range
              </h3>
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
                    className={cn(
                      "w-full px-3 py-2 border border-gray-300 dark:border-gray-600",
                      "rounded-lg shadow-sm bg-white dark:bg-gray-700",
                      "text-gray-900 dark:text-gray-100",
                      "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                      "transition-colors duration-200"
                    )}
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
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className={cn(
                      "w-full px-3 py-2 border border-gray-300 dark:border-gray-600",
                      "rounded-lg shadow-sm bg-white dark:bg-gray-700",
                      "text-gray-900 dark:text-gray-100",
                      "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                      "transition-colors duration-200"
                    )}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowCalendar(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCustomDateSubmit}
                  variant="primary"
                >
                  Apply Range
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Notices */}
      {filteredStats.totalReadings > 2016 && (
        <Alert 
          type="info"
          title="Chart Display Optimization"
          description={`For optimal performance, charts show the last 14 days of data. Statistics use the full ${getDisplayLabel()} period (${filteredStats.totalReadings.toLocaleString()} readings).`}
        />
      )}

      {/* Main Metrics Grid */}
      <MetricsGrid>
        <StatCard 
          title="Current Glucose" 
          value={ultraSafeRender(recentReading ? formatGlucoseValue(recentReading.sgv, 'mgdl', true) : 'N/A')} 
          icon={<Activity className="h-6 w-6" />}
          description={(() => {
            const delta = getDelta();
            const timeDesc = recentReading ? `As of ${format(new Date(recentReading.date), 'HH:mm')}` : '';
            const deltaDesc = delta ? ` (${delta.formattedInCurrentUnit})` : '';
            return timeDesc + deltaDesc;
          })()}
          trend={recentReading?.direction === 'FortyFiveUp' ? 'up' : 
                 recentReading?.direction === 'FortyFiveDown' ? 'down' : 'neutral'}
          isGlucose={true}
          glucoseValue={recentReading ? convertToCurrentUnit(recentReading.sgv, 'mgdl') : undefined}
        />
        <StatCard 
          title="Average Glucose" 
          value={ultraSafeRender(filteredStats.totalReadings > 0 ? formatGlucoseValue(filteredStats.averageBG, 'mgdl', true) : 'N/A')} 
          icon={<TrendingUp className="h-6 w-6" />}
          description={`${getDisplayLabel()} average`}
        />
        <StatCard 
          title="Time in Range" 
          value={ultraSafeRender(filteredStats.totalReadings > 0 ? safePercentage(filteredStats.timeInRange) : 'N/A')} 
          icon={<Clock className="h-6 w-6" />}
          description={`${getCurrentGlucoseRanges().TARGET_MIN}-${getCurrentGlucoseRanges().TARGET_MAX} ${getUnitLabel()} (${getDisplayLabel()})`}
        />
        <StatCard 
          title="Readings"
          value={ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')}
          icon={<Download className="h-6 w-6" />}
          description={`Total for ${getDisplayLabel()}`}
        />
      </MetricsGrid>

      {/* Device Status Section */}
      {showDeviceStatus && recentDeviceStatus && (
        <Card variant="elevated" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Device Status
            </h3>
            <Badge variant="success">
              Connected
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {/* IOB */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-700"
            >
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">IOB</h4>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {ultraSafeRender((() => {
                  let iobValue = recentDeviceStatus.iob || 
                               recentDeviceStatus.openaps?.iob || 
                               recentDeviceStatus.loop?.iob ||
                               recentDeviceStatus.pump?.iob;
                  
                  if (typeof iobValue === 'object' && iobValue !== null) {
                    if ('iob' in iobValue && typeof iobValue.iob === 'number') {
                      return `${iobValue.iob.toFixed(2)}U`;
                    }
                    if ('total' in iobValue && typeof iobValue.total === 'number') {
                      return `${iobValue.total.toFixed(2)}U`;
                    }
                  }
                  
                  if (typeof iobValue === 'number') {
                    return `${iobValue.toFixed(2)}U`;
                  }
                  
                  return '0.00U';
                })())}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Insulin on Board</p>
            </motion.div>
            
            {/* COB */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-700"
            >
              <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">COB</h4>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                0g {/* Simplified for now - original has complex COB extraction logic */}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">Carbs on Board</p>
            </motion.div>
            
            {/* Current Basal */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-700"
            >
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">Basal</h4>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatBasalRate(recentDeviceStatus, roundBasalRate)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Current Rate{selectedPump ? ` (${selectedPump.name})` : ''}
              </p>
            </motion.div>
            
            {/* CAGE */}
            {(() => {
              const cageValue = extractCageValue(recentDeviceStatus);
              const cageColors = getCageColorClass(cageValue);
              return (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`${cageColors.bg} p-4 rounded-xl border ${cageColors.bg.includes('red') ? 'border-red-200 dark:border-red-700' : cageColors.bg.includes('yellow') ? 'border-yellow-200 dark:border-yellow-700' : 'border-green-200 dark:border-green-700'}`}
                >
                  <h4 className={`font-semibold ${cageColors.text.replace('-700', '-900').replace('-300', '-100')} mb-1`}>CAGE</h4>
                  <p className={`text-2xl font-bold ${cageColors.text}`}>
                    {ultraSafeRender(formatCageValue(cageValue))}
                  </p>
                  <p className={`text-xs ${cageColors.textSecondary}`}>Cannula Age</p>
                </motion.div>
              );
            })()}
            
            {/* SAGE */}
            {(() => {
              const sageValue = extractSageValue(recentDeviceStatus);
              const sageColors = getSageColorClass(sageValue);
              return (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`${sageColors.bg} p-4 rounded-xl border ${sageColors.bg.includes('red') ? 'border-red-200 dark:border-red-700' : sageColors.bg.includes('yellow') ? 'border-yellow-200 dark:border-yellow-700' : 'border-green-200 dark:border-green-700'}`}
                >
                  <h4 className={`font-semibold ${sageColors.text.replace('-700', '-900').replace('-300', '-100')} mb-1`}>SAGE</h4>
                  <p className={`text-2xl font-bold ${sageColors.text}`}>
                    {ultraSafeRender(formatSageValue(sageValue))}
                  </p>
                  <p className={`text-xs ${sageColors.textSecondary}`}>Sensor Age</p>
                </motion.div>
              );
            })()}
          </div>
          
          {recentDeviceStatus.created_at && (
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Last updated: {formatDateTime(new Date(recentDeviceStatus.created_at))}
            </div>
          )}
        </Card>
      )}

      {/* AI Components Section */}
      {isSubscribed && data?.entries && data.entries.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI-Powered Analysis
            </h3>
            <Button
              onClick={handleRefreshAI}
              variant="secondary"
              size="sm"
              icon={Brain}
            >
              Refresh AI Analysis
            </Button>
          </div>

          {/* TensorFlow Status */}
          <TensorFlowStatus />

          {/* Enhanced AI Insights Panel */}
          {filteredStats.totalReadings > 0 && (
            <EnhancedAIInsightsPanel 
              readings={filteredReadings} 
              timeInRange={{
                timeInRange: typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0,
                highPercentage: typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0,
                lowPercentage: typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0
              }}
              manualRefresh={manualAIRefresh}
            />
          )}

          {/* AI Management Plan */}
          {data?.treatments && data.treatments.length > 0 && (
            <AIManagementPlan 
              readings={filteredReadings}
              treatments={data?.treatments || []}
              manualRefresh={manualAIRefresh}
            />
          )}
        </div>
      )}

      {/* Premium Feature Teaser */}
      {!isSubscribed && data?.entries && data.entries.length > 0 && (
        <Card variant="gradient" className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="p-3 bg-white/20 rounded-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">
                AI-Powered Insights Available
              </h3>
              <p className="text-white/90 mb-4">
                Upgrade to Premium to access personalized AI insights, recommendations, and a custom management plan based on your unique glucose patterns.
              </p>
              <Button
                onClick={() => navigate('/subscription')}
                variant="secondary"
                className="bg-white text-primary-700 hover:bg-gray-100"
              >
                Upgrade to Premium
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartContainer title={`Glucose Trends - ${getChartTimeWindowLabel()}`}>
            <GlucoseTrendChart 
              readings={chartReadings} 
              hours={isCustomRange ? undefined : Math.min(timeWindow, 336)} 
            />
          </ChartContainer>
          
          {/* Advanced Prediction with Nightscout Data */}
          <div className="space-y-4">
            <NightscoutDataDisplay 
              onDataParsed={handleNightscoutDataParsed}
              hoursBack={6}
            />
            <ChartContainer title="AI Predictions">
              <AdvancedPredictionChart 
                key={refreshKey}
                readings={data?.entries || []} 
                useAI={hasApiKey || (tensorFlowEnabled && tensorFlowReady)}
                context={predictionContext}
              />
            </ChartContainer>
          </div>
        </div>
        
        <div className="space-y-6">
          <A1CEstimator averageGlucose={filteredStats.totalReadings > 0 ? filteredStats.averageBG : 0} />
          
          {/* Prediction Insights Panel */}
          <PredictionInsightsPanel 
            readings={data?.entries || []}
            riskLevel="low"
            confidence={75}
            timeInRange={filteredStats.timeInRange}
          />
          
          {/* Glucose Trend Analysis */}
          <GlucoseTrendAnalysis 
            readings={data?.entries || []}
            windowMinutes={30}
          />
          
          {/* Treatment Timeline */}
          <TreatmentTimeline 
            treatments={[]}
            maxItems={6}
          />
          
          <AlertSettings onSave={handleAlertSettingsSave} />
          <DataExport data={data || { entries: [], treatments: [], devicestatus: [] }} />
        </div>
      </div>

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title={`Blood Glucose - ${getChartTimeWindowLabel()}`}>
          <GlucoseChart 
            readings={chartReadings}
            treatments={data?.treatments?.filter(treatment => {
              const treatmentTime = new Date(treatment.created_at).getTime();
              return (Date.now() - treatmentTime) <= timeWindow * 60 * 60 * 1000;
            }) || []}
            title={`Blood Glucose - ${getChartTimeWindowLabel()}`}
            showInsulinDelivery={true}
          />
        </ChartContainer>
        
        {filteredStats.totalReadings > 0 && (
          <ChartContainer title="Time in Range">
            <TimeInRangeChart 
              timeInRange={typeof filteredStats.timeInRange === 'number' ? filteredStats.timeInRange : 0}
              highPercentage={typeof filteredStats.highPercentage === 'number' ? filteredStats.highPercentage : 0}
              lowPercentage={typeof filteredStats.lowPercentage === 'number' ? filteredStats.lowPercentage : 0}
            />
          </ChartContainer>
        )}
      </div>

      {/* Advanced Statistics */}
      <Card variant="elevated" className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Advanced Statistics - {ultraSafeRender(getDisplayLabel())}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analysis based on {ultraSafeRender(typeof filteredStats.totalReadings === 'number' ? filteredStats.totalReadings.toLocaleString() : 'N/A')} readings from the selected time period
          </p>
        </div>
        <AdvancedStats readings={filteredReadings} />
      </Card>
    </motion.div>
  );
};

export default Dashboard;
