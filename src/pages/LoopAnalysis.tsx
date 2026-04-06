import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { lowerBoundByMs, upperBoundByMs } from '../utils/sortedTimeSeries';
import {
  extractDeviceStatusMetric,
  extractTreatmentMetric,
  getPredictionToleranceMgdl,
  getTherapyPlatformLabel,
  isAutomatedDosingTreatment
} from '../utils/therapyData';
import { 
  Activity, 
  Clock, 
  Zap, 
  Droplets,
  Cookie,
  Settings,
  CheckCircle,
  XCircle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
  Wifi,
  WifiOff,
  Battery,
  Gauge
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

interface LoopCycle {
  timestamp: string;
  timestampMs: number;
  glucose: number;
  trend: 'rising' | 'falling' | 'stable';
  iob: number;
  cob: number;
  recommendedBasal: number;
  actualBasal: number;
  basalType: 'regular' | 'temp' | 'smb';
  enacted: boolean;
  reason: string;
  duration: number;
  prediction: number;
  minPredBG: number;
  maxPredBG: number;
  eventualBG: number;
  sensitivity: number;
  carbRatio: number;
  target: number;
}

interface LoopStatus {
  isConnected: boolean;
  lastLoop: Date | null;
  currentIOB: number;
  currentCOB: number;
  activeTempBasal: {
    rate: number;
    duration: number;
    started: Date;
  } | null;
  pumpBattery: number;
  cgmStatus: 'connected' | 'disconnected' | 'calibrating';
  loopVersion: string;
}

interface LoopStats {
  totalCycles: number;
  enactedCycles: number;
  tempBasalCycles: number;
  smbCycles: number;
  enactmentRate: string;
  tempBasalRate: string;
  avgGlucose: number;
  avgIOB: string;
  avgCOB: string;
  predictionAccuracy: string;
  avgCycleTime: string | 0;
}

const LoopAnalysis = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue } = useGlucoseFormatting();
  const { selectedTherapyAlgorithm } = useInsulinPump();
  const [loopCycles, setLoopCycles] = useState<LoopCycle[]>([]);
  const [loopStats, setLoopStats] = useState<LoopStats | null>(null);
  const [loopStatus, setLoopStatus] = useState<LoopStatus | null>(null);

  const entriesSortedAsc = useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  }, [data?.entries]);

  const treatmentsSortedDesc = useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(b) - getTreatmentMs(a));
  }, [data?.treatments]);

  const deviceStatusSortedDesc = useMemo(() => {
    const deviceStatus = data?.deviceStatus;
    if (!deviceStatus?.length) return [];
    const getDeviceMs = (d: (typeof deviceStatus)[number]) => d.mills ?? d.date ?? (d.created_at ? Date.parse(d.created_at) : 0);
    return [...deviceStatus].sort((a, b) => getDeviceMs(b) - getDeviceMs(a));
  }, [data?.deviceStatus]);

  const calculateLoopStatus = useCallback(() => {
    if (!data?.treatments) {
      setLoopStatus(null);
      return;
    }

    console.log('🔍 Analyzing loop status with treatments:', data.treatments.length);
    
    const now = new Date();
    const nowMs = now.getTime();
    const recentTreatments = data.treatments.filter(t => 
      getTreatmentMs(t) > nowMs - 30 * 60 * 1000 // Last 30 minutes
    );

    console.log('🔍 Recent treatments (last 30min):', recentTreatments.length);

    // Find current IOB and COB from the selected platform first, then fallback.
    let currentIOB = 0;
    let currentCOB = 0;
    let lastLoop = null;

    // Method 1: Look for the most recent treatment with IOB/COB data
    const sortedTreatments = treatmentsSortedDesc;

    console.log('🔍 Checking recent treatments for IOB/COB data...');
    
    for (const treatment of sortedTreatments.slice(0, 100)) { // Check last 100 treatments
      const treatmentIob = extractTreatmentMetric(treatment, 'iob', selectedTherapyAlgorithm);
      if (treatmentIob !== null) {
        currentIOB = treatmentIob;
        lastLoop = new Date(treatment.created_at);
        console.log('✅ Found IOB in treatment:', currentIOB, treatment);
        break;
      }
    }

    // Search for COB similarly
    for (const treatment of sortedTreatments.slice(0, 100)) {
      const treatmentCob = extractTreatmentMetric(treatment, 'cob', selectedTherapyAlgorithm);
      if (treatmentCob !== null) {
        currentCOB = treatmentCob;
        console.log('✅ Found COB in treatment:', currentCOB, treatment);
        break;
      }
    }

    // Method 2: Check device status for IOB/COB
    if (data?.deviceStatus && data.deviceStatus.length > 0) {
      console.log('🔍 Checking device status for IOB/COB...');
      const latestDeviceStatus = deviceStatusSortedDesc[0];

      console.log('📱 Latest device status:', latestDeviceStatus);

      const statusIob = extractDeviceStatusMetric(latestDeviceStatus, 'iob', selectedTherapyAlgorithm);
      if (statusIob !== null) {
        currentIOB = statusIob;
        console.log('✅ Found IOB in device status:', currentIOB);
      }

      const statusCob = extractDeviceStatusMetric(latestDeviceStatus, 'cob', selectedTherapyAlgorithm);
      if (statusCob !== null) {
        currentCOB = statusCob;
        console.log('✅ Found COB in device status:', currentCOB);
      }
    }

    // Find active temp basal
    const activeTempBasal = data.treatments
      .filter(t => (t.eventType === 'Temp Basal' || t.eventType === 'Temporary basal') && t.duration)
      .find(t => {
        const startMs = getTreatmentMs(t);
        const endMs = startMs + (t.duration! * 60 * 1000);
        return nowMs >= startMs && nowMs <= endMs;
      });

    // Determine connection status
    const isConnected = lastLoop ? (nowMs - lastLoop.getTime()) < 15 * 60 * 1000 : false; // Connected if data within 15 min

    console.log('📊 Final loop status:', {
      isConnected,
      currentIOB,
      currentCOB,
      lastLoop: lastLoop?.toISOString(),
      activeTempBasal: activeTempBasal?.rate || 'none'
    });

    setLoopStatus({
      isConnected,
      lastLoop,
      currentIOB,
      currentCOB,
      activeTempBasal: activeTempBasal ? {
        rate: activeTempBasal.rate || activeTempBasal.absolute || 0,
        duration: activeTempBasal.duration || 0,
        started: new Date(activeTempBasal.created_at)
      } : null,
      pumpBattery: 100, // Default fallback when pump battery is not exposed in uploaded data
      cgmStatus: 'connected', // Default since we have glucose data
      loopVersion: getTherapyPlatformLabel(selectedTherapyAlgorithm)
    });
  }, [data?.deviceStatus, data?.treatments, deviceStatusSortedDesc, selectedTherapyAlgorithm, treatmentsSortedDesc]);

  const analyzeAdvancedLoop = useCallback(() => {
    if (!data?.treatments || !data?.entries) {
      setLoopStats(null);
      setLoopCycles([]);
      return;
    }

    console.log('🔍 Analyzing loop treatments...', data.treatments.length);

    const loopTreatments = data.treatments.filter((t) => {
      return isAutomatedDosingTreatment(t, selectedTherapyAlgorithm) && getTreatmentMs(t) > Date.now() - 24 * 60 * 60 * 1000;
    });

    console.log('🔍 Found loop treatments:', loopTreatments.length);

    if (loopTreatments.length === 0) {
      setLoopStats(null);
      setLoopCycles([]);
      return;
    }

    const cycles: LoopCycle[] = loopTreatments.map(treatment => {
      const timestamp = treatment.created_at;
      const treatmentTime = getTreatmentMs(treatment);
      
      // Find closest glucose reading
      const idx = lowerBoundByMs(entriesSortedAsc, getEntryMs, treatmentTime);
      const candidates = [
        idx > 0 ? entriesSortedAsc[idx - 1] : null,
        idx < entriesSortedAsc.length ? entriesSortedAsc[idx] : null,
      ].filter(Boolean) as typeof entriesSortedAsc;

      const closestReading = candidates.reduce((best, entry) => {
        if (!best) return entry;
        return Math.abs(getEntryMs(entry) - treatmentTime) < Math.abs(getEntryMs(best) - treatmentTime) ? entry : best;
      }, null as (typeof entriesSortedAsc)[number] | null) || entriesSortedAsc[entriesSortedAsc.length - 1];

      const closestOk = closestReading ? Math.abs(getEntryMs(closestReading) - treatmentTime) <= 5 * 60 * 1000 : false;
      const readingForDisplay = closestOk ? closestReading : entriesSortedAsc[entriesSortedAsc.length - 1];

      // Determine trend
      const histEnd = upperBoundByMs(entriesSortedAsc, getEntryMs, treatmentTime);
      const glucoseHistory = entriesSortedAsc.slice(Math.max(0, histEnd - 3), histEnd);
      
      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (glucoseHistory.length >= 2) {
        const change = glucoseHistory[glucoseHistory.length - 1].sgv - glucoseHistory[0].sgv;
        if (change > 10) trend = 'rising';
        else if (change < -10) trend = 'falling';
      }

      // Determine basal type from event metadata and insulin amount.
      let basalType: 'regular' | 'temp' | 'smb' = 'regular';
      const eventType = (treatment.eventType || '').toLowerCase();
      const notes = (treatment.notes || '').toLowerCase();
      
      if (eventType.includes('temp') || eventType.includes('temporary') || treatment.rate !== undefined || treatment.absolute !== undefined) {
        basalType = 'temp';
      } else if (eventType.includes('smb') || notes.includes('smb') || (treatment.insulin && treatment.insulin < 1)) {
        basalType = 'smb';
      }

      // Extract IOB and COB with better parsing
      const iob = extractTreatmentMetric(treatment, 'iob', selectedTherapyAlgorithm) ?? 0;
      const cob = extractTreatmentMetric(treatment, 'cob', selectedTherapyAlgorithm) ?? 0;

      return {
        timestamp,
        timestampMs: treatmentTime,
        glucose: readingForDisplay.sgv,
        trend,
        iob,
        cob,
        recommendedBasal: treatment.rate || treatment.absolute || treatment.insulin || 0,
        actualBasal: treatment.rate || treatment.absolute || treatment.insulin || 0,
        basalType,
        enacted: treatment.enacted !== false,
        reason: treatment.reason || treatment.notes || treatment.eventType || `${getTherapyPlatformLabel(selectedTherapyAlgorithm)} adjustment`,
        duration: treatment.duration || 30,
        prediction: treatment.predBGs?.[0] || readingForDisplay.sgv,
        minPredBG: treatment.predBGs ? Math.min(...treatment.predBGs) : readingForDisplay.sgv,
        maxPredBG: treatment.predBGs ? Math.max(...treatment.predBGs) : readingForDisplay.sgv,
        eventualBG: treatment.eventualBG || readingForDisplay.sgv,
        sensitivity: treatment.sensitivity || 45,
        carbRatio: treatment.carbRatio || 12,
        target: treatment.target || 100
      };
    });

    setLoopCycles(cycles.sort((a, b) => b.timestampMs - a.timestampMs));

    // Calculate enhanced statistics
    if (cycles.length > 0) {
      const enactedCycles = cycles.filter(c => c.enacted);
      const tempBasalCycles = cycles.filter(c => c.basalType === 'temp');
      const smbCycles = cycles.filter(c => c.basalType === 'smb');
      
      const avgGlucose = cycles.reduce((sum, c) => sum + c.glucose, 0) / cycles.length;
      const avgIOB = cycles.reduce((sum, c) => sum + c.iob, 0) / cycles.length;
      const avgCOB = cycles.reduce((sum, c) => sum + c.cob, 0) / cycles.length;
      
      const predictionTolerance = getPredictionToleranceMgdl(selectedTherapyAlgorithm);

      const accuratePredictions = cycles.filter(c => 
        Math.abs(c.prediction - c.glucose) <= predictionTolerance
      ).length;
      
      setLoopStats({
        totalCycles: cycles.length,
        enactedCycles: enactedCycles.length,
        tempBasalCycles: tempBasalCycles.length,
        smbCycles: smbCycles.length,
        enactmentRate: ((enactedCycles.length / cycles.length) * 100).toFixed(1),
        tempBasalRate: ((tempBasalCycles.length / cycles.length) * 100).toFixed(1),
        avgGlucose: avgGlucose,
        avgIOB: avgIOB.toFixed(2),
        avgCOB: avgCOB.toFixed(1),
        predictionAccuracy: ((accuratePredictions / cycles.length) * 100).toFixed(1),
        avgCycleTime: cycles.length > 1 ? 
          ((cycles[0].timestampMs - cycles[cycles.length - 1].timestampMs) / 
           (cycles.length - 1) / 60000).toFixed(1) : 0
      });
    } else {
      setLoopStats(null);
    }
  }, [data?.entries, data?.treatments, entriesSortedAsc, selectedTherapyAlgorithm]);

  useEffect(() => {
    analyzeAdvancedLoop();
    calculateLoopStatus();
  }, [analyzeAdvancedLoop, calculateLoopStatus]);

  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
      case 'rising': return <ArrowUp className="h-4 w-4 text-red-500" />;
      case 'falling': return <ArrowDown className="h-4 w-4 text-blue-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getBasalTypeIcon = (type: 'regular' | 'temp' | 'smb') => {
    switch (type) {
      case 'temp': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'smb': return <Zap className="h-4 w-4 text-purple-500" />;
      default: return <Droplets className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Advanced Loop Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive automated insulin delivery loop monitoring and performance analysis
        </p>
      </div>

      {/* Loop Status Dashboard */}
      {loopStatus && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center">
                  {loopStatus.isConnected ? (
                    <Wifi className="h-6 w-6 mr-2" />
                  ) : (
                    <WifiOff className="h-6 w-6 mr-2" />
                  )}
                  <h3 className="text-lg font-semibold">Loop Status</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  loopStatus.isConnected 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {loopStatus.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current IOB</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {loopStatus.currentIOB.toFixed(2)}U
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Cookie className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current COB</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {loopStatus.currentCOB.toFixed(1)}g
                    </p>
                  </div>
                </div>
              </div>
              
              {loopStatus.activeTempBasal && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                      <span className="font-medium text-orange-900 dark:text-orange-100">
                        Active Temp Basal
                      </span>
                    </div>
                    <span className="text-orange-800 dark:text-orange-200 font-bold">
                      {loopStatus.activeTempBasal.rate.toFixed(2)} U/h
                    </span>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Started: {format(loopStatus.activeTempBasal.started, 'HH:mm')} • 
                    Duration: {loopStatus.activeTempBasal.duration}min
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center">
                  <Battery className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pump Battery</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {loopStatus.pumpBattery}%
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">CGM Status</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {loopStatus.cgmStatus}
                    </p>
                  </div>
                </div>
              </div>
              
              {loopStatus.lastLoop && (
                <div className="text-center pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last Loop: {format(loopStatus.lastLoop, 'HH:mm:ss')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Loop Statistics Card */}
          {loopStats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">24h Statistics</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Cycles</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {loopStats.totalCycles}
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <p className="text-green-600 dark:text-green-400 text-sm font-medium">Enacted</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {loopStats.enactmentRate}%
                  </p>
                </div>
                
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                  <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Temp Basals</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {loopStats.tempBasalRate}%
                  </p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Pred. Accuracy</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {loopStats.predictionAccuracy}%
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg IOB</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{loopStats.avgIOB}U</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg COB</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{loopStats.avgCOB}g</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cycle Time</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{loopStats.avgCycleTime}min</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Data Message */}
      {!loopStats && !loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded-lg">
          <div className="flex items-start">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-blue-900 dark:text-blue-100 font-medium mb-2">No Loop Data Found</h3>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                We couldn't find any automated insulin delivery loop data in your Nightscout instance. 
                This could mean the loop is not running or no loop events have been recorded recently.
              </p>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="mb-2"><strong>Loop data includes:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Temporary basal rate changes</li>
                  <li>Automated dosing enacted treatments</li>
                  <li>IOB (Insulin on Board) calculations</li>
                  <li>COB (Carbs on Board) calculations</li>
                  <li>Prediction and recommendation data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Loop Cycles Table */}
      {loopCycles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Loop Cycles</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Detailed analysis of automated insulin delivery decisions
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Glucose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Recommended Basal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    IOB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    COB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loopCycles.slice(0, 20).map((cycle, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(cycle.timestamp), 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatGlucoseValue(cycle.glucose)}
                        </span>
                        <span className="ml-2">
                          {getTrendIcon(cycle.trend)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {cycle.recommendedBasal.toFixed(2)} U/h
                        </span>
                        <span className="ml-2">
                          {getBasalTypeIcon(cycle.basalType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cycle.duration}min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        cycle.iob > 2 ? 'text-red-600 dark:text-red-400' :
                        cycle.iob > 1 ? 'text-orange-600 dark:text-orange-400' :
                        'text-gray-900 dark:text-gray-100'
                      }`}>
                        {cycle.iob.toFixed(2)}U
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        cycle.cob > 30 ? 'text-orange-600 dark:text-orange-400' :
                        cycle.cob > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-gray-900 dark:text-gray-100'
                      }`}>
                        {cycle.cob}g
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cycle.enacted 
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}>
                          {cycle.enacted ? 'Enacted' : 'Not Enacted'}
                        </span>
                        {cycle.enacted ? (
                          <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 ml-1" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs">
                      <div className="truncate" title={cycle.reason}>
                        {cycle.reason}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Analytics */}
      {loopStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Gauge className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loop Performance</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-green-800 dark:text-green-200 font-medium">Enactment Rate</span>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                  {loopStats.enactmentRate}%
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-blue-800 dark:text-blue-200 font-medium">Prediction Accuracy</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                  {loopStats.predictionAccuracy}%
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <span className="text-orange-800 dark:text-orange-200 font-medium">Temp Basal Usage</span>
                <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                  {loopStats.tempBasalRate}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loop Insights</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">
                  Loop cycles every {loopStats.avgCycleTime} minutes on average
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">
                  {loopStats.enactmentRate}% of recommendations successfully enacted
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">
                  Average glucose during loop cycles: {formatGlucoseValue(loopStats.avgGlucose)}
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">
                  {loopStats.smbCycles > 0
                    ? `${loopStats.smbCycles} ${selectedTherapyAlgorithm === 'loop' ? 'automated bolus' : 'SMB'} deliveries detected`
                    : `No ${selectedTherapyAlgorithm === 'loop' ? 'automated bolus' : 'SMB'} deliveries in recent data`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoopAnalysis;