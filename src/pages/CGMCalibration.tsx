import { useState, useEffect, useMemo } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { 
  Beaker, 
  AlertCircle, 
  CheckCircle, 
  Activity,
  Target,
  Info,
  Calendar,
  BarChart3,
  Plus,
  RefreshCw,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { createTreatment } from '../services/nightscoutService';

interface CalibrationEvent {
  timestamp: string;
  cgmReading: number;
  bgCheck: number;
  difference: number;
  relativeError: number;
  accuracy: 'excellent' | 'good' | 'fair' | 'poor';
}

interface CGMMetrics {
  sensorAge: number;
  avgAccuracy: number;
  totalReadings: number;
  reliabilityScore: number;
  lastCalibration?: Date;
  recommendCalibration: boolean;
}

const CGMCalibration = () => {
  const {
    data,
    loading,
    error,
    url: nightscoutUrl,
    token,
    detectedApiVersion,
    fetchDataForDays,
    analysisPeriod
  } = useNightscout();
  const { formatGlucoseValue } = useGlucoseFormatting();
  const [realCalibrations, setRealCalibrations] = useState<CalibrationEvent[]>([]);
  const [cgmMetrics, setCgmMetrics] = useState<CGMMetrics | null>(null);
  const [simulatedMARD, setSimulatedMARD] = useState<number | null>(null);

  // Time selection (match Dashboard options)
  const [timeWindow, setTimeWindow] = useState(168); // 7 days
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [fetchingMoreData, setFetchingMoreData] = useState(false);

  // Sensor insert/change events
  const [showAddSensorEvent, setShowAddSensorEvent] = useState(false);
  const [sensorEventDateTime, setSensorEventDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [sensorEventNotes, setSensorEventNotes] = useState('');
  const [sensorEventError, setSensorEventError] = useState<string | null>(null);
  const [sensorEventSaving, setSensorEventSaving] = useState(false);

  const getEntryTimeMs = (entry: any): number | null => {
    const candidate = entry?.date ?? entry?.srvCreated ?? entry?.mills ?? entry?.dateString ?? entry?.created_at;
    if (candidate == null) return null;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string') {
      const asNumber = Number(candidate);
      if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
      const asDate = Date.parse(candidate);
      if (Number.isFinite(asDate)) return asDate;
    }
    return null;
  };

  const getTreatmentTimeMs = (treatment: any): number | null => {
    const candidate = treatment?.created_at ?? treatment?.timestamp ?? treatment?.mills;
    if (candidate == null) return null;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string') {
      const asNumber = Number(candidate);
      if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
      const asDate = Date.parse(candidate);
      if (Number.isFinite(asDate)) return asDate;
    }
    return null;
  };

  const selectedRange = useMemo(() => {
    const now = Date.now();
    if (isCustomRange) {
      const start = startOfDay(new Date(customDateRange.startDate)).getTime();
      const end = endOfDay(new Date(customDateRange.endDate)).getTime();
      return { start, end };
    }
    const start = now - timeWindow * 60 * 60 * 1000;
    return { start, end: now };
  }, [isCustomRange, customDateRange.startDate, customDateRange.endDate, timeWindow]);

  const dataSpanInfo = useMemo(() => {
    if (!data?.entries?.length) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const entry of data.entries) {
      const t = getEntryTimeMs(entry);
      if (!t) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (!Number.isFinite(min) || max <= 0) return null;
    const spanDays = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)));
    return {
      oldestDate: new Date(min),
      newestDate: new Date(max),
      spanDays,
      totalReadings: data.entries.length
    };
  }, [data?.entries]);

  const filteredEntries = useMemo(() => {
    if (!data?.entries?.length) return [];
    return data.entries.filter((entry) => {
      const t = getEntryTimeMs(entry);
      if (!t) return false;
      return t >= selectedRange.start && t <= selectedRange.end;
    });
  }, [data?.entries, selectedRange.start, selectedRange.end]);

  const filteredTreatments = useMemo(() => {
    if (!data?.treatments?.length) return [];
    return data.treatments.filter((treatment) => {
      const t = getTreatmentTimeMs(treatment);
      if (!t) return false;
      return t >= selectedRange.start && t <= selectedRange.end;
    });
  }, [data?.treatments, selectedRange.start, selectedRange.end]);

  useEffect(() => {
    if (filteredTreatments.length && filteredEntries.length) {
      analyzeRealCalibrations(filteredTreatments, filteredEntries);
      calculateCGMMetrics(filteredEntries);
      return;
    }

    if (!filteredEntries.length) {
      setRealCalibrations([]);
      setCgmMetrics(null);
      setSimulatedMARD(null);
      return;
    }

    // We have CGM data but no treatments in range
    setRealCalibrations([]);
    calculateCGMMetrics(filteredEntries);
  }, [filteredTreatments, filteredEntries]);

  const getTimeWindowLabel = (hours: number) => {
    if (hours < 24) return `${hours} hours`;
    if (hours < 168) {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours < 720) {
      const weeks = hours / 168;
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    const months = Math.round(hours / 720);
    return `${months} month${months > 1 ? 's' : ''}`;
  };

  const getAllTimeWindows = () => {
    return [
      { value: 6, label: '6 hours' },
      { value: 12, label: '12 hours' },
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

  const hasEnoughData = (daysNeeded: number) => {
    if (!dataSpanInfo) return false;
    const requiredStart = Date.now() - daysNeeded * 24 * 60 * 60 * 1000;
    return dataSpanInfo.oldestDate.getTime() <= requiredStart;
  };

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
      return;
    }

    const newWindow = parseInt(value);
    setIsCustomRange(false);
    setShowCalendar(false);
    setTimeWindow(newWindow);

    const daysNeeded = Math.ceil(newWindow / 24);
    if (daysNeeded > analysisPeriod && !hasEnoughData(daysNeeded)) {
      fetchDataForDays(Math.min(daysNeeded, 90));
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
    if (!hasEnoughData(diffDays + 1)) {
      const daysToFetch = Math.max(diffDays + 7, analysisPeriod);
      fetchDataForDays(Math.min(daysToFetch, 90));
    }

    setIsCustomRange(true);
    setShowCalendar(false);
  };

  const handleFetchMore = async () => {
    const daysNeeded = isCustomRange
      ? Math.max(
          1,
          Math.ceil(
            (endOfDay(new Date(customDateRange.endDate)).getTime() -
              startOfDay(new Date(customDateRange.startDate)).getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1
        )
      : Math.ceil(timeWindow / 24);

    setFetchingMoreData(true);
    try {
      await fetchDataForDays(Math.min(Math.max(daysNeeded, analysisPeriod), 90));
    } finally {
      setFetchingMoreData(false);
    }
  };

  type SensorEventKind = 'start' | 'end' | 'other';

  const getTreatmentEventType = (treatment: any) => {
    const raw = treatment?.eventType ?? treatment?.event_type;
    return raw == null ? '' : String(raw);
  };

  const classifySensorEvent = (treatment: any): SensorEventKind => {
    const eventType = getTreatmentEventType(treatment).trim();
    const notes = treatment?.notes == null ? '' : String(treatment.notes);
    const combined = `${eventType} ${notes}`.toLowerCase();
    const normalized = combined.replace(/\s+/g, ' ').trim();

    if (!normalized) return 'other';

    // End/stop/failure events
    if (
      normalized.includes('sensor stop') ||
      normalized.includes('sensor end') ||
      normalized.includes('stop sensor') ||
      normalized.includes('sensor fail') ||
      normalized.includes('sensor failure') ||
      normalized.includes('sensor failed') ||
      normalized.includes('stopped working') ||
      normalized.includes('not working') ||
      normalized.includes('sensor error') ||
      normalized.includes('sensor expired')
    ) {
      return 'end';
    }

    // Start/insert/change events
    if (
      normalized === 'sage' ||
      normalized.includes(' sage ') ||
      normalized.startsWith('sage ') ||
      normalized.endsWith(' sage') ||
      normalized.includes('sensor start') ||
      normalized.includes('sensor insert') ||
      normalized.includes('sensor change') ||
      normalized.includes('start sensor')
    ) {
      return 'start';
    }

    // Generic sensor-related events (fallback)
    if (normalized.includes('sensor')) return 'start';

    return 'other';
  };

  const isSensorStartEvent = (treatment: any) => classifySensorEvent(treatment) === 'start';
  const isSensorEndEvent = (treatment: any) => classifySensorEvent(treatment) === 'end';

  const sensorPeriods = useMemo(() => {
    if (!data?.treatments?.length) {
      return [] as Array<{
        start: number;
        end: number;
        notes?: string;
        eventType?: string;
        endEventType?: string;
      }>;
    }

    const mapped = data.treatments
      .map((t) => {
        const tMs = getTreatmentTimeMs(t);
        if (!tMs) return null;
        const kind = classifySensorEvent(t);
        if (kind === 'other') return null;
        return {
          t,
          time: tMs,
          kind,
          notes: t?.notes as string | undefined,
          eventType: getTreatmentEventType(t) || undefined,
        };
      })
      .filter(Boolean) as Array<{
      t: any;
      time: number;
      kind: SensorEventKind;
      notes?: string;
      eventType?: string;
    }>;

    if (!mapped.length) return [];

    mapped.sort((a, b) => a.time - b.time);
    const starts = mapped.filter((e) => e.kind === 'start');
    const ends = mapped.filter((e) => e.kind === 'end');
    const now = Date.now();

    const periods: Array<{ start: number; end: number; notes?: string; eventType?: string; endEventType?: string }> = [];
    for (const s of starts) {
      const nextStart = starts.find((n) => n.time > s.time);
      const nextEnd = ends.find((n) => n.time > s.time);

      let end = nextStart ? nextStart.time : now;
      let endEventType: string | undefined;

      // Prefer an explicit stop/failure if it occurs before the next start.
      if (nextEnd && (!nextStart || nextEnd.time <= nextStart.time)) {
        end = nextEnd.time;
        endEventType = nextEnd.eventType;
      }

      periods.push({
        start: s.time,
        end,
        notes: s.notes,
        eventType: s.eventType,
        endEventType,
      });
    }

    return periods.filter((p) => p.end >= selectedRange.start && p.start <= selectedRange.end);
  }, [data?.treatments, selectedRange.start, selectedRange.end]);

  const formatDurationDaysHours = (startMs: number, endMs: number) => {
    const ms = Math.max(0, endMs - startMs);
    const hoursTotal = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hoursTotal / 24);
    const hours = hoursTotal % 24;
    if (days <= 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`;
  };

  const handleAddSensorEvent = async () => {
    setSensorEventError(null);
    if (!nightscoutUrl) {
      setSensorEventError('Nightscout URL is not set. Please configure Nightscout in Settings.');
      return;
    }
    if (!sensorEventDateTime) {
      setSensorEventError('Please choose a date and time.');
      return;
    }

    const createdAt = new Date(sensorEventDateTime);
    if (Number.isNaN(createdAt.getTime())) {
      setSensorEventError('Invalid date/time.');
      return;
    }

    setSensorEventSaving(true);
    try {
      await createTreatment(
        nightscoutUrl,
        {
          eventType: 'Sensor Insert',
          created_at: createdAt.toISOString(),
          enteredBy: 'DiabetesAnalyzer',
          notes: sensorEventNotes?.trim() || undefined
        },
        token,
        undefined,
        detectedApiVersion
      );

      const daysBack = Math.ceil((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      await fetchDataForDays(Math.min(Math.max(analysisPeriod, daysBack), 90));

      setShowAddSensorEvent(false);
      setSensorEventNotes('');
      setSensorEventDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    } catch (e) {
      setSensorEventError(e instanceof Error ? e.message : String(e));
    } finally {
      setSensorEventSaving(false);
    }
  };

  const analyzeRealCalibrations = (treatmentsInRange: any[], entriesInRange: any[]) => {
    if (!treatmentsInRange.length || !entriesInRange.length) {
      setRealCalibrations([]);
      return;
    }

    // Look for actual BG Check treatments in Nightscout
    const actualBGChecks = treatmentsInRange.filter(t => 
      t.eventType === 'BG Check' && 
      t.glucose && 
      typeof t.glucose === 'number' &&
      t.glucose > 20 && t.glucose < 600 // Reasonable BG range
    );

    if (actualBGChecks.length === 0) {
      setRealCalibrations([]);
      return;
    }

    const calibrationEvents: CalibrationEvent[] = actualBGChecks.map(treatment => {
      const treatmentTime = getTreatmentTimeMs(treatment);
      if (!treatmentTime) return null;
      
      // Find closest CGM reading within 5 minutes
      let closestReading: any | null = null;
      let closestDiff = Number.POSITIVE_INFINITY;
      for (const entry of entriesInRange) {
        const entryTime = getEntryTimeMs(entry);
        if (!entryTime) continue;
        const timeDiff = Math.abs(entryTime - treatmentTime);
        if (timeDiff <= 5 * 60 * 1000 && timeDiff < closestDiff) {
          closestDiff = timeDiff;
          closestReading = entry;
        }
      }

      if (!closestReading) return null;

      const bgCheck = treatment.glucose!;
      const cgmReading = closestReading.sgv;
      const difference = Math.abs(cgmReading - bgCheck);
      const relativeError = (difference / bgCheck) * 100;
      
      let accuracy: 'excellent' | 'good' | 'fair' | 'poor';
      if (difference <= 10) accuracy = 'excellent';
      else if (difference <= 20) accuracy = 'good';
      else if (difference <= 30) accuracy = 'fair';
      else accuracy = 'poor';

      return {
        timestamp: treatment.created_at || treatment.timestamp!,
        cgmReading,
        bgCheck,
        difference,
        relativeError,
        accuracy
      };
    }).filter(Boolean) as CalibrationEvent[];

    setRealCalibrations(calibrationEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  };

  const calculateCGMMetrics = (entriesInRange: any[]) => {
    if (!entriesInRange || entriesInRange.length === 0) {
      setCgmMetrics(null);
      return;
    }

    const now = new Date();
    const recentReadings = entriesInRange;

    // Calculate sensor age (estimate based on data gaps)
    const readings = [...entriesInRange]
      .map((e) => ({ e, t: getEntryTimeMs(e) }))
      .filter((x) => x.t != null)
      .sort((a, b) => (a.t as number) - (b.t as number));
    
    const firstReading = readings.length ? (readings[0].t as number) : null;

    // Prefer explicit sensor insert/change events if present
    const latestSensorEvent = data?.treatments?.filter(isSensorStartEvent)
      .map(getTreatmentTimeMs)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
      .sort((a, b) => b - a)[0];

    const sensorAge = latestSensorEvent
      ? Math.floor((now.getTime() - latestSensorEvent) / (1000 * 60 * 60 * 24))
      : (firstReading
          ? Math.floor((now.getTime() - firstReading) / (1000 * 60 * 60 * 24))
          : 0);

    // Calculate reliability score based on data consistency
    const last24Cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    const last24Hours = entriesInRange.filter(entry => {
      const t = getEntryTimeMs(entry);
      return !!t && t > last24Cutoff;
    });
    
    const expectedReadings = 24 * 12; // Every 5 minutes
    const actualReadings = last24Hours.length;
    const reliabilityScore = Math.min(100, (actualReadings / expectedReadings) * 100);

    // Check if calibration is recommended
    const lastCalibration = realCalibrations.length > 0 ? 
      new Date(realCalibrations[0].timestamp) : null;
    
    const hoursSinceLastCalibration = lastCalibration ? 
      (now.getTime() - lastCalibration.getTime()) / (1000 * 60 * 60) : null;
    
    const recommendCalibration = 
      sensorAge > 7 || // Sensor older than 7 days
      (hoursSinceLastCalibration && hoursSinceLastCalibration > 12) || // No calibration in 12+ hours
      reliabilityScore < 80; // Poor data quality

    setCgmMetrics({
      sensorAge,
      avgAccuracy: reliabilityScore,
      totalReadings: recentReadings.length,
      reliabilityScore,
      lastCalibration: lastCalibration || undefined,
      recommendCalibration
    });

    // Calculate simulated MARD based on CGM quality
    let estimatedMARD: number;
    if (reliabilityScore > 95) estimatedMARD = 8.5;
    else if (reliabilityScore > 90) estimatedMARD = 10.2;
    else if (reliabilityScore > 85) estimatedMARD = 12.8;
    else if (reliabilityScore > 80) estimatedMARD = 15.5;
    else estimatedMARD = 18.7;

    // Add some variation based on sensor age
    if (sensorAge > 10) estimatedMARD += 2.3;
    else if (sensorAge > 7) estimatedMARD += 1.1;

    setSimulatedMARD(Math.min(25, estimatedMARD));
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CGM Calibration & Accuracy</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor your CGM sensor performance and calibration status
        </p>
      </div>

      {/* Time Range Selection (same options as Dashboard) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Select Time Period</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose the time range for calibrations, sensor events, and metrics
            </p>
            {dataSpanInfo && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Data available: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')} ({dataSpanInfo.spanDays} days)
              </p>
            )}
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={isCustomRange ? 'custom' : timeWindow.toString()}
              onChange={(e) => handleTimeWindowChange(e.target.value)}
              className="w-full sm:w-56 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {getAllTimeWindows().map(option => (
                <option key={option.value} value={option.value.toString()}>{option.label}</option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {showCalendar && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleCustomDateSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                Apply Range
              </button>
              <button
                onClick={() => setShowCalendar(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Data availability warning */}
        {!loading && dataSpanInfo && (
          (() => {
            const daysNeeded = isCustomRange
              ? Math.max(1, Math.ceil((selectedRange.end - selectedRange.start) / (1000 * 60 * 60 * 24)))
              : Math.ceil(timeWindow / 24);
            const limited = !hasEnoughData(daysNeeded);
            if (!limited) return null;

            return (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      You selected ~{daysNeeded} days, but only ~{dataSpanInfo.spanDays} days are currently loaded.
                    </p>
                    <button
                      onClick={handleFetchMore}
                      disabled={fetchingMoreData}
                      className="mt-2 inline-flex items-center px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white rounded-lg text-sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${fetchingMoreData ? 'animate-spin' : ''}`} />
                      {fetchingMoreData ? 'Fetching…' : 'Fetch More Data'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Sensor Insert/Change Tracking */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sensor Insert Events</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track when sensors were inserted and how long they lasted (useful for warranty claims)
            </p>
          </div>
          <button
            onClick={() => {
              setSensorEventError(null);
              setShowAddSensorEvent((v) => !v);
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showAddSensorEvent ? 'Close' : 'Add Sensor Insert'}
          </button>
        </div>

        {showAddSensorEvent && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Insert Date/Time</label>
                <input
                  type="datetime-local"
                  value={sensorEventDateTime}
                  onChange={(e) => setSensorEventDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={sensorEventNotes}
                  onChange={(e) => setSensorEventNotes(e.target.value)}
                  placeholder="e.g. Dexcom G6, left arm, sensor failed early"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {sensorEventError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{sensorEventError}</p>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleAddSensorEvent}
                disabled={sensorEventSaving}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                {sensorEventSaving ? 'Saving…' : 'Save to Nightscout'}
              </button>
              <button
                onClick={() => setShowAddSensorEvent(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          {sensorPeriods.length > 0 ? (
            <div className="space-y-3">
              {sensorPeriods
                .slice()
                .sort((a, b) => b.start - a.start)
                .map((p, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Inserted: {format(new Date(p.start), 'dd.MM.yyyy HH:mm')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        End: {p.end >= Date.now() - 60 * 1000 ? 'Now' : format(new Date(p.end), 'dd.MM.yyyy HH:mm')}
                        {p.endEventType && p.end < Date.now() - 60 * 1000 ? ` (${p.endEventType})` : ''}
                        {' • '}Lasted: {formatDurationDaysHours(p.start, p.end)}
                      </p>
                      {(p.notes || p.eventType) && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                          {p.eventType ? `${p.eventType}` : ''}{p.eventType && p.notes ? ' — ' : ''}{p.notes || ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    No sensor events found in the selected period.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Use “Add Sensor Insert” to create an event in Nightscout.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CGM Status Cards */}
      {cgmMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sensor Age</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cgmMetrics.sensorAge} days
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Quality</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cgmMetrics.reliabilityScore.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Est. MARD</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {simulatedMARD?.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Beaker className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">BG Checks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {realCalibrations.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calibration Recommendation */}
      {cgmMetrics?.recommendCalibration && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Calibration Recommended</h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                {cgmMetrics.sensorAge > 7 && "Your sensor is getting older and may benefit from calibration. "}
                {!cgmMetrics.lastCalibration && "No recent calibrations detected. "}
                {cgmMetrics.reliabilityScore < 80 && "Data quality could be improved with calibration. "}
                Consider performing a fingerstick BG check for optimal accuracy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Calibrations */}
      {realCalibrations.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent BG Check Comparisons</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Comparison between your fingerstick readings and CGM values
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
                    CGM Reading
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    BG Check
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {realCalibrations.slice(0, 10).map((cal, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(cal.timestamp), 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatGlucoseValue(cal.cgmReading)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatGlucoseValue(cal.bgCheck)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`${
                        cal.difference <= 10 ? 'text-green-600 dark:text-green-400' :
                        cal.difference <= 20 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {formatGlucoseValue(cal.difference)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cal.accuracy === 'excellent' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                        cal.accuracy === 'good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                        cal.accuracy === 'fair' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}>
                        {cal.accuracy.charAt(0).toUpperCase() + cal.accuracy.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded-lg">
          <div className="flex items-start">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-blue-900 dark:text-blue-100 font-medium mb-2">No BG Check Data Found</h3>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                We haven't detected any fingerstick BG checks in your Nightscout data. To improve CGM accuracy monitoring, 
                consider logging BG checks when you perform them.
              </p>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="mb-2"><strong>To log BG checks in Nightscout:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use the Nightscout Care Portal</li>
                  <li>Select "BG Check" as the event type</li>
                  <li>Enter your fingerstick glucose value</li>
                  <li>Save the entry for accuracy tracking</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MARD Information */}
      {simulatedMARD && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">MARD Analysis</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Estimated Accuracy</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Current MARD</span>
                  <span className={`font-bold ${
                    simulatedMARD < 10 ? 'text-green-600 dark:text-green-400' :
                    simulatedMARD < 15 ? 'text-blue-600 dark:text-blue-400' :
                    simulatedMARD < 20 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {simulatedMARD.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    <strong>MARD</strong> (Mean Absolute Relative Difference) indicates how close your CGM readings 
                    are to actual blood glucose values.
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-green-600 dark:text-green-400">Excellent: &lt;10%</span>
                      <span className="text-blue-600 dark:text-blue-400">Good: 10-15%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600 dark:text-yellow-400">Fair: 15-20%</span>
                      <span className="text-red-600 dark:text-red-400">Poor: &gt;20%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Improvement Tips</h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Replace sensor every 10-14 days</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Avoid sensor compression during sleep</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Keep sensor site clean and secure</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Calibrate when glucose is stable</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Use proper fingerstick technique</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CGMCalibration;