import React, { useState, useEffect, useCallback } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { Zap, Activity, TrendingUp, AlertTriangle, Clock, Target, CheckCircle, Settings, Shield, Brain, Cookie, RefreshCw, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import AIOpenAPSOptimizer from '../components/AIOpenAPSOptimizer';
import GlucoseEventInsightsPanel from '../components/GlucoseEventInsightsPanel';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { analyzeUltraSafeOpenAPS } from '../services/ultraSafeOpenAPSAnalysis';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { runSafeAsync } from '../utils/safeAsync';
import { getTreatmentMs } from '../utils/nightscoutTime';
import { lowerBoundByMs, upperBoundByMs, sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';
import { toMmol } from '../utils/glucoseUtils';
import { GLUCOSE_RANGES } from '../constants/glucoseRanges';
import { nightscoutTreatmentParser } from '../services/nightscoutTreatmentParser';
import { analyzeGlucoseEventInsights } from '../services/glucoseEventInsightsService';

type UltraSafeOpenAPSResult = Awaited<ReturnType<typeof analyzeUltraSafeOpenAPS>>;

type AiOptimizationResult = NonNullable<React.ComponentProps<typeof AIOpenAPSOptimizer>['onOptimizationComplete']> extends (
  result: infer R
) => void
  ? R
  : never;

interface SMBStats {
  totalEvents: number;
  totalInsulin: string;
  avgSMB: string;
  maxSMB: string;
  avgGlucose: number;
  effectiveness: string;
  last24h: number;
  carbRelatedSMBs: number;
  avgCarbSMB: string;
}

interface SMBEvent {
  timestamp: string;
  timestampMs: number;
  glucose: number;
  iob: number;
  cob: number;
  smbDelivered: number;
  reason: string;
  delta: number;
  eventualBG: number;
}

type HourlySmbOutcome = {
  hour: number;
  count: number;
  avgUnits: number | null;
  effectivePct: number;
  postSmbLowPct: number;
  avgDrop2hMgdl: number | null;
  avgStartBgMgdl: number | null;
};

const OpenAPSSMB = () => {
  const { data, loading, error } = useNightscout();
  const { selectedTherapyAlgorithm } = useInsulinPump();
  const { formatGlucoseValue, convertToCurrentUnit } = useGlucoseFormatting();
  const [smbEvents, setSmbEvents] = useState<SMBEvent[]>([]);
  const [_smbStats, setSmbStats] = useState<SMBStats | null>(null);
  const [openapsAnalysis, setOpenapsAnalysis] = useState<UltraSafeOpenAPSResult | null>(null);
  const [aiOptimization, setAiOptimization] = useState<AiOptimizationResult | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  // Time selection state
  const [timeWindow, setTimeWindow] = useState(336); // Default to 2 weeks (336 hours)
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isCustomRange, setIsCustomRange] = useState(false);

  const selectedRange = React.useMemo(() => {
    const now = Date.now();
    if (isCustomRange) {
      const startMs = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endMs = endOfDay(new Date(customDateRange.endDate)).getTime();
      return { startMs, endMs };
    }
    const timeWindowMs = timeWindow * 60 * 60 * 1000;
    return { startMs: now - timeWindowMs, endMs: now };
  }, [customDateRange.endDate, customDateRange.startDate, isCustomRange, timeWindow]);

  const entriesSortedAsc = React.useMemo(() => {
    if (!data?.entries?.length) return [] as NightscoutEntry[];
    return [...data.entries].sort((a, b) => a.date - b.date);
  }, [data?.entries]);

  const treatmentsSortedAsc = React.useMemo(() => {
    if (!data?.treatments?.length) return [] as NightscoutTreatment[];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

  // Get filtered data based on time selection
  const filteredData = React.useMemo(() => {
    if (!data?.entries?.length || !data?.treatments?.length) {
      return null;
    }

    const filteredEntries = sliceSortedByTimeRange(entriesSortedAsc, (e) => e.date, selectedRange.startMs, selectedRange.endMs);
    const filteredTreatments = sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange.startMs, selectedRange.endMs);

    return {
      ...data,
      entries: filteredEntries,
      treatments: filteredTreatments
    };
  }, [data, entriesSortedAsc, selectedRange.endMs, selectedRange.startMs, treatmentsSortedAsc]);

  type HourlyGlucoseStats = {
    hour: number;
    count: number;
    avgSgvMgdl: number | null;
    inRangePct: number;
    lowPct: number;
    highPct: number;
  };

  const hourlyGlucoseStats: HourlyGlucoseStats[] = React.useMemo(() => {
    const readings = filteredData?.entries ?? [];
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      sumSgvMgdl: 0,
      lowCount: 0,
      highCount: 0,
      inRangeCount: 0
    }));

    for (const reading of readings) {
      const hour = new Date(reading.date).getHours();
      const bucket = buckets[hour];
      if (!bucket) continue;

      const sgv = Number(reading.sgv);
      if (!Number.isFinite(sgv) || sgv <= 0) continue;

      bucket.count += 1;
      bucket.sumSgvMgdl += sgv;

      const mmol = toMmol(sgv);
      if (mmol < GLUCOSE_RANGES.TARGET_MIN) bucket.lowCount += 1;
      else if (mmol > GLUCOSE_RANGES.TARGET_MAX) bucket.highCount += 1;
      else bucket.inRangeCount += 1;
    }

    return buckets.map((b) => {
      const avgSgvMgdl = b.count ? b.sumSgvMgdl / b.count : null;
      const inRangePct = b.count ? (b.inRangeCount / b.count) * 100 : 0;
      const lowPct = b.count ? (b.lowCount / b.count) * 100 : 0;
      const highPct = b.count ? (b.highCount / b.count) * 100 : 0;
      return {
        hour: b.hour,
        count: b.count,
        avgSgvMgdl,
        inRangePct,
        lowPct,
        highPct
      };
    });
  }, [filteredData?.entries]);

  const hourlyStatsSummary = React.useMemo(() => {
    const total = filteredData?.entries?.length ?? 0;
    const avgPerHour = total ? total / 24 : 0;
    const minCount = Math.max(12, Math.floor(avgPerHour / 4));
    const eligible = hourlyGlucoseStats.filter((h) => h.count >= minCount);

    const topLow = [...eligible]
      .sort((a, b) => b.lowPct - a.lowPct)
      .filter((h) => h.lowPct > 0)
      .slice(0, 3);

    const topHigh = [...eligible]
      .sort((a, b) => b.highPct - a.highPct)
      .filter((h) => h.highPct > 0)
      .slice(0, 3);

    const worstTir = [...eligible]
      .sort((a, b) => a.inRangePct - b.inRangePct)
      .slice(0, 3);

    return { minCount, topLow, topHigh, worstTir };
  }, [filteredData?.entries?.length, hourlyGlucoseStats]);

  const overallTir = React.useMemo(() => {
    const readings = filteredData?.entries ?? [];
    if (!readings.length) {
      return {
        count: 0,
        avgSgvMgdl: null as number | null,
        lowPct: 0,
        inRangePct: 0,
        highPct: 0
      };
    }

    let sum = 0;
    let low = 0;
    let high = 0;
    let inRange = 0;

    for (const r of readings) {
      const sgv = Number(r.sgv);
      if (!Number.isFinite(sgv) || sgv <= 0) continue;
      sum += sgv;
      const mmol = toMmol(sgv);
      if (mmol < GLUCOSE_RANGES.TARGET_MIN) low += 1;
      else if (mmol > GLUCOSE_RANGES.TARGET_MAX) high += 1;
      else inRange += 1;
    }

    const count = low + high + inRange;
    const avgSgvMgdl = count ? sum / count : null;
    return {
      count,
      avgSgvMgdl,
      lowPct: count ? (low / count) * 100 : 0,
      inRangePct: count ? (inRange / count) * 100 : 0,
      highPct: count ? (high / count) * 100 : 0
    };
  }, [filteredData?.entries]);

  const smbBehaviorPresets = React.useMemo(() => {
    const base = aiOptimization?.optimizedSettings ?? {
      smbMaxMinutes: 60,
      smbDeliveryRatio: 0.5,
      enableSMBWithCOB: true,
      enableSMBWithTemptarget: true,
      enableSMBAlways: false,
      carbsReqThreshold: 4,
      highTemptargetRaisesSensitivity: true,
      lowTemptargetLowersSensitivity: true
    };

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const lowRisk = overallTir.lowPct < 2 && (openapsAnalysis?.hypoglycemiaRiskScore ?? 100) < 20;

    const emergency = {
      smbMaxMinutes: clamp(Math.round(base.smbMaxMinutes * 0.6), 20, 45),
      smbDeliveryRatio: clamp(base.smbDeliveryRatio * 0.6, 0.15, 0.35),
      enableSMBWithCOB: overallTir.lowPct < 5,
      enableSMBWithTemptarget: true,
      enableSMBAlways: false,
      carbsReqThreshold: clamp(Math.round(base.carbsReqThreshold * 1.8), 6, 12),
      highTemptargetRaisesSensitivity: true,
      lowTemptargetLowersSensitivity: true
    };

    const conservative = {
      smbMaxMinutes: clamp(Math.round(base.smbMaxMinutes * 0.85), 30, 60),
      smbDeliveryRatio: clamp(base.smbDeliveryRatio * 0.85, 0.25, 0.5),
      enableSMBWithCOB: overallTir.lowPct < 8,
      enableSMBWithTemptarget: true,
      enableSMBAlways: false,
      carbsReqThreshold: clamp(Math.round(base.carbsReqThreshold * 1.25), 4, 10),
      highTemptargetRaisesSensitivity: true,
      lowTemptargetLowersSensitivity: true
    };

    const standard = {
      smbMaxMinutes: clamp(Math.round(base.smbMaxMinutes * 1.1), 45, 90),
      smbDeliveryRatio: clamp(base.smbDeliveryRatio * 1.1, 0.4, 0.75),
      enableSMBWithCOB: true,
      enableSMBWithTemptarget: true,
      enableSMBAlways: lowRisk && overallTir.inRangePct >= 60,
      carbsReqThreshold: clamp(Math.round(base.carbsReqThreshold * 0.9), 3, 6),
      highTemptargetRaisesSensitivity: true,
      lowTemptargetLowersSensitivity: true
    };

    return { emergency, conservative, standard };
  }, [aiOptimization?.optimizedSettings, openapsAnalysis?.hypoglycemiaRiskScore, overallTir.inRangePct, overallTir.lowPct]);

  const eventInsights = React.useMemo(() => {
    const entries = filteredData?.entries ?? [];
    const treatments = filteredData?.treatments ?? [];
    return analyzeGlucoseEventInsights(entries, treatments, selectedRange);
  }, [filteredData?.entries, filteredData?.treatments, selectedRange]);

  const smbOutcomesByHour = React.useMemo(() => {
    const readingsAsc = filteredData?.entries ?? [];
    if (!smbEvents.length || readingsAsc.length === 0) {
      return {
        minCount: 3,
        outcomes: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: 0,
          avgUnits: null,
          effectivePct: 0,
          postSmbLowPct: 0,
          avgDrop2hMgdl: null,
          avgStartBgMgdl: null
        })) as HourlySmbOutcome[],
        worstHypo: [] as HourlySmbOutcome[],
        worstEffectiveness: [] as HourlySmbOutcome[]
      };
    }

    const getReadingMs = (e: NightscoutEntry) => e.date;
    const pickInRange = (startMs: number, endMs: number) => {
      const startIndex = lowerBoundByMs(readingsAsc, getReadingMs, startMs);
      const endIndex = upperBoundByMs(readingsAsc, getReadingMs, endMs);
      if (endIndex <= startIndex) return [] as NightscoutEntry[];
      return readingsAsc.slice(startIndex, endIndex);
    };

    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      sumUnits: 0,
      sumStartBg: 0,
      sumDrop2h: 0,
      drop2hCount: 0,
      effectiveCount: 0,
      postSmbLowCount: 0
    }));

    for (const smb of smbEvents) {
      const hour = new Date(smb.timestampMs).getHours();
      const bucket = buckets[hour];
      if (!bucket) continue;

      const startBg = Number(smb.glucose);
      if (!Number.isFinite(startBg) || startBg <= 0) continue;

      bucket.count += 1;
      bucket.sumUnits += smb.smbDelivered;
      bucket.sumStartBg += startBg;

      // Effectiveness: average BG in (t+20m .. t+2h) is lower than start
      const futureWindow = pickInRange(smb.timestampMs + 20 * 60 * 1000, smb.timestampMs + 2 * 60 * 60 * 1000);
      if (futureWindow.length > 0) {
        const sum = futureWindow.reduce((acc, r) => acc + Number(r.sgv || 0), 0);
        const avgFuture = sum / futureWindow.length;
        const drop = startBg - avgFuture;
        bucket.sumDrop2h += drop;
        bucket.drop2hCount += 1;
        if (drop >= 5) bucket.effectiveCount += 1;
      }

      // Hypo risk: any low in (t .. t+3h)
      const hypoWindow = pickInRange(smb.timestampMs, smb.timestampMs + 3 * 60 * 60 * 1000);
      const hadLow = hypoWindow.some((r) => {
        const sgv = Number(r.sgv);
        if (!Number.isFinite(sgv) || sgv <= 0) return false;
        return toMmol(sgv) < GLUCOSE_RANGES.TARGET_MIN;
      });
      if (hadLow) bucket.postSmbLowCount += 1;
    }

    const outcomes: HourlySmbOutcome[] = buckets.map((b) => {
      const avgUnits = b.count ? b.sumUnits / b.count : null;
      const avgStartBgMgdl = b.count ? b.sumStartBg / b.count : null;
      const avgDrop2hMgdl = b.drop2hCount ? b.sumDrop2h / b.drop2hCount : null;
      const effectivePct = b.drop2hCount ? (b.effectiveCount / b.drop2hCount) * 100 : 0;
      const postSmbLowPct = b.count ? (b.postSmbLowCount / b.count) * 100 : 0;
      return {
        hour: b.hour,
        count: b.count,
        avgUnits,
        effectivePct,
        postSmbLowPct,
        avgDrop2hMgdl,
        avgStartBgMgdl
      };
    });

    const avgPerHour = smbEvents.length / 24;
    const minCount = Math.max(3, Math.floor(avgPerHour / 2));
    const eligible = outcomes.filter((o) => o.count >= minCount);

    const worstHypo = [...eligible]
      .sort((a, b) => b.postSmbLowPct - a.postSmbLowPct)
      .filter((o) => o.postSmbLowPct > 0)
      .slice(0, 3);

    const worstEffectiveness = [...eligible]
      .sort((a, b) => a.effectivePct - b.effectivePct)
      .slice(0, 3);

    return { minCount, outcomes, worstHypo, worstEffectiveness };
  }, [filteredData?.entries, smbEvents]);

  const smbSetupSummary = React.useMemo(() => {
    const starting = openapsAnalysis?.recommendedStartingLevel;
    const tier = starting === 'standard' ? 'Standard' : starting === 'conservative' ? 'Conservative' : 'Emergency-Safe';

    const reasons: string[] = [];
    if (overallTir.count > 0) {
      reasons.push(`Selected-period TIR: ${overallTir.inRangePct.toFixed(1)}% · Low: ${overallTir.lowPct.toFixed(1)}% · High: ${overallTir.highPct.toFixed(1)}%`);
      if (overallTir.avgSgvMgdl != null) {
        reasons.push(`Average glucose: ${formatGlucoseValue(overallTir.avgSgvMgdl, 'mgdl', true)}`);
      }
    }

    if (eventInsights.period.totalReadings > 0) {
      reasons.push(
        `Event burden: ${eventInsights.eventCounts.hypo} hypo / ${eventInsights.eventCounts.hyper} hyper (${eventInsights.eventCounts.severeHypo} severe lows)`
      );
    }

    if (hourlyStatsSummary.worstTir[0]) {
      const h = hourlyStatsSummary.worstTir[0];
      reasons.push(`Worst hour TIR: ${h.hour.toString().padStart(2, '0')}:00–${h.hour.toString().padStart(2, '0')}:59 (${h.inRangePct.toFixed(1)}% TIR)`);
    }
    if (hourlyStatsSummary.topLow[0]) {
      const h = hourlyStatsSummary.topLow[0];
      reasons.push(`Most lows: ${h.hour.toString().padStart(2, '0')}:00–${h.hour.toString().padStart(2, '0')}:59 (${h.lowPct.toFixed(1)}% low)`);
    }
    if (hourlyStatsSummary.topHigh[0]) {
      const h = hourlyStatsSummary.topHigh[0];
      reasons.push(`Most highs: ${h.hour.toString().padStart(2, '0')}:00–${h.hour.toString().padStart(2, '0')}:59 (${h.highPct.toFixed(1)}% high)`);
    }

    if (smbOutcomesByHour.worstHypo[0]) {
      const h = smbOutcomesByHour.worstHypo[0];
      reasons.push(`Post-${dosingModeLowerLabel} lows highest: ${h.hour.toString().padStart(2, '0')}:00–${h.hour.toString().padStart(2, '0')}:59 (${h.postSmbLowPct.toFixed(1)}% of ${dosingModeLowerLabel} events followed by a low in 3h)`);
    }
    if (smbOutcomesByHour.worstEffectiveness[0] && smbOutcomesByHour.worstEffectiveness[0].count > 0) {
      const h = smbOutcomesByHour.worstEffectiveness[0];
      reasons.push(`${dosingModeLabel} least effective: ${h.hour.toString().padStart(2, '0')}:00–${h.hour.toString().padStart(2, '0')}:59 (${h.effectivePct.toFixed(1)}% show a ≥5 mg/dL drop over ~2h)`);
    }

    const hardSafety = overallTir.lowPct >= 2.0 || (openapsAnalysis?.hypoglycemiaRiskScore ?? 0) >= 40;
    const recommendedTier = hardSafety ? 'Emergency-Safe' : tier;

    return {
      recommendedTier,
      confidence: openapsAnalysis?.safetyChecks?.dataQuality === 'high' ? 'higher' : openapsAnalysis ? 'medium' : 'low',
      reasons
    };
  }, [dosingModeLabel, dosingModeLowerLabel, eventInsights.eventCounts.hypo, eventInsights.eventCounts.hyper, eventInsights.eventCounts.severeHypo, eventInsights.period.totalReadings, formatGlucoseValue, hourlyStatsSummary.topHigh, hourlyStatsSummary.topLow, hourlyStatsSummary.worstTir, openapsAnalysis, overallTir.avgSgvMgdl, overallTir.count, overallTir.highPct, overallTir.inRangePct, overallTir.lowPct, smbOutcomesByHour.worstEffectiveness, smbOutcomesByHour.worstHypo]);

   
  const analyzeSMBEvents = useCallback(() => {
    if (!filteredData?.treatments || !filteredData?.entries) {
      setSmbStats(null);
      setSmbEvents([]);
      return;
    }

    const readingsAsc = filteredData.entries;

    const getReadingMs = (e: NightscoutEntry) => e.date;

    const findClosestReading = (targetMs: number): NightscoutEntry => {
      if (readingsAsc.length === 0) return { date: targetMs, mills: targetMs, sgv: 0 } as NightscoutEntry;
      const idx = lowerBoundByMs(readingsAsc, getReadingMs, targetMs);
      if (idx <= 0) return readingsAsc[0];
      if (idx >= readingsAsc.length) return readingsAsc[readingsAsc.length - 1];
      const after = readingsAsc[idx];
      const before = readingsAsc[idx - 1];
      return (targetMs - before.date) <= (after.date - targetMs) ? before : after;
    };

    const findPreviousReading = (targetMs: number): NightscoutEntry | null => {
      // Previous reading in (targetMs-15m, targetMs-5m)
      const latestAllowedMs = targetMs - 5 * 60 * 1000;
      const earliestAllowedMs = targetMs - 15 * 60 * 1000;
      const endIndex = upperBoundByMs(readingsAsc, getReadingMs, latestAllowedMs);
      const candidateIndex = endIndex - 1;
      if (candidateIndex < 0) return null;
      const candidate = readingsAsc[candidateIndex];
      return candidate.date >= earliestAllowedMs ? candidate : null;
    };

    const analysisHours = Math.max(1, Math.ceil((selectedRange.endMs - selectedRange.startMs) / (60 * 60 * 1000)));
    const parsed = nightscoutTreatmentParser.parseTreatments(filteredData.treatments, analysisHours, selectedRange.endMs);
    const smbs = parsed.smbs;

    if (smbs.length === 0) {
      setSmbStats(null);
      setSmbEvents([]);
      return;
    }

    const events: SMBEvent[] = smbs.map((smb) => {
      const treatmentTime = smb.time;
      const timestamp = new Date(treatmentTime).toISOString();
      
      // Find closest glucose reading
      const closestReading = findClosestReading(treatmentTime);

      // Calculate delta from previous reading
      const previousReading = findPreviousReading(treatmentTime);

      const delta = previousReading ? closestReading.sgv - previousReading.sgv : 0;

      return {
        timestamp,
        timestampMs: treatmentTime,
        glucose: closestReading.sgv,
        iob: 0,
        cob: 0,
        smbDelivered: smb.units,
        reason: smb.reason || 'SMB delivery',
        delta,
        eventualBG: closestReading.sgv
      };
    });

    setSmbEvents(events.sort((a, b) => b.timestampMs - a.timestampMs));

    // Calculate statistics
    if (events.length > 0) {
      const totalInsulin = events.reduce((sum, e) => sum + e.smbDelivered, 0);
      const avgSMB = totalInsulin / events.length;
      const maxSMB = Math.max(...events.map(e => e.smbDelivered));
      const avgGlucose = events.reduce((sum, e) => sum + e.glucose, 0) / events.length;
      
      // Effectiveness analysis
      const effectiveEvents = events.filter(e => {

        const startMs = e.timestampMs;
        const endMs = e.timestampMs + 2 * 60 * 60 * 1000;
        const startIndex = upperBoundByMs(readingsAsc, getReadingMs, startMs);
        const endIndex = upperBoundByMs(readingsAsc, getReadingMs, endMs);
        if (endIndex <= startIndex) return false;

        let sum = 0;
        let count = 0;
        for (let i = startIndex; i < endIndex; i++) {
          sum += readingsAsc[i].sgv;
          count++;
        }
        if (count === 0) return false;
        const avgFutureGlucose = sum / count;
        return avgFutureGlucose < e.glucose; // Automated dosing was effective if glucose decreased
      });

      // Analyze carb-related automated dosing events
      const carbRelatedSMBs = events.filter(e => e.cob > 0);
      const avgCarbSMB = carbRelatedSMBs.length > 0 
        ? carbRelatedSMBs.reduce((sum, e) => sum + e.smbDelivered, 0) / carbRelatedSMBs.length 
        : 0;

      setSmbStats({
        totalEvents: events.length,
        totalInsulin: totalInsulin.toFixed(2),
        avgSMB: avgSMB.toFixed(3),
        maxSMB: maxSMB.toFixed(3),
        avgGlucose: avgGlucose, // Keep in mg/dL, format on display
        effectiveness: ((effectiveEvents.length / events.length) * 100).toFixed(1),
        last24h: events.filter(e => 
          e.timestampMs > Date.now() - 24 * 60 * 60 * 1000
        ).length,
        carbRelatedSMBs: carbRelatedSMBs.length,
        avgCarbSMB: avgCarbSMB.toFixed(3)
      });
    } else {
      setSmbStats(null);
    }
  }, [filteredData, selectedRange.endMs, selectedRange.startMs]);

  const analyzeOpenAPSSettings = useCallback(async () => {
    if (!filteredData?.entries || !filteredData?.treatments) return;

    setAiAnalysisLoading(true);
    
    try {
      // Get current profile
      const profiles = data?.profile;
      let currentProfile = null;
      
      if (profiles && profiles.length > 0) {
        const activeProfile = profiles[0];
        const defaultProfile = activeProfile.defaultProfile || 'Default';
        currentProfile = activeProfile.store?.[defaultProfile];
      }

      const analysis = await analyzeUltraSafeOpenAPS(
        filteredData.entries, 
        filteredData.treatments, 
        currentProfile,
        selectedTherapyAlgorithm
      );
      setOpenapsAnalysis(analysis);
    } catch (error) {
      console.error(`${selectedTherapyAlgorithm === 'loop' ? 'Loop' : 'AAPS'} analysis failed:`, error);
    } finally {
      setAiAnalysisLoading(false);
    }
  }, [data?.profile, filteredData, selectedTherapyAlgorithm]);

  useEffect(() => {
    // Run automatically on initial load (default 2 weeks) or when manual refresh is triggered
    if (filteredData && (!hasInitialLoad || manualRefresh)) {
      analyzeSMBEvents();
      runSafeAsync(() => analyzeOpenAPSSettings(), { label: 'OpenAPSSMB: analyzeOpenAPSSettings' });

      // Mark initial load as complete and reset manual refresh flag
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
      }
      if (manualRefresh) {
        setManualRefresh(false);
      }
    }
  }, [analyzeOpenAPSSettings, analyzeSMBEvents, filteredData, hasInitialLoad, manualRefresh]);

  const handleRefreshAI = () => {
    setManualRefresh(prev => !prev);
  };

  if (loading || aiAnalysisLoading) return <LoadingSpinner message={aiAnalysisLoading ? "Running AI safety analysis..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const timeWindowOptions = [
    { value: 168, label: '1 Week' },
    { value: 336, label: '2 Weeks' },
    { value: 504, label: '3 Weeks' },
    { value: 720, label: '1 Month' },
    { value: 1440, label: '2 Months' },
    { value: 2160, label: '3 Months' }
  ];

  const platformLabel = selectedTherapyAlgorithm === 'loop' ? 'Loop' : 'OpenAPS / AAPS';
  const dosingModeLabel = selectedTherapyAlgorithm === 'loop' ? 'Automated Dosing' : 'SMB';
  const dosingModeLowerLabel = selectedTherapyAlgorithm === 'loop' ? 'automated dosing' : 'SMB';

  const handleTimeWindowChange = (hours: number) => {
    setTimeWindow(hours);
    setIsCustomRange(false);
  };

  const handleCustomRangeSubmit = () => {
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  if (!filteredData && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ultra-Safe {platformLabel} {dosingModeLabel} Analysis</h2>
            <p className="text-gray-600 dark:text-gray-400">
              AI-Enhanced safety-first analysis with pediatric-focused recommendations
            </p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No {platformLabel} Data Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            No {platformLabel} treatments found for the selected time period. Please check your Nightscout data or try a different time range.
          </p>
          <button 
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center mx-auto transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ultra-Safe {platformLabel} {dosingModeLabel} Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-Enhanced safety-first analysis with pediatric-focused recommendations
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          {/* Time Period Selection */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <select
              value={isCustomRange ? 'custom' : timeWindow}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setShowCalendar(true);
                } else {
                  handleTimeWindowChange(Number(e.target.value));
                }
              }}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {timeWindowOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <button 
            onClick={handleRefreshAI}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center justify-center transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI Analysis
          </button>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Select Date Range</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setShowCalendar(false)}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomRangeSubmit}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Display */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            {isCustomRange ? (
              <>Analyzing custom range: {format(new Date(customDateRange.startDate), 'MMM dd, yyyy')} - {format(new Date(customDateRange.endDate), 'MMM dd, yyyy')}</>
            ) : (
              <>Analyzing last {timeWindowOptions.find(opt => opt.value === timeWindow)?.label.toLowerCase()} of data</>
            )}
            {filteredData?.entries && filteredData.entries.length > 0 && (
              <span className="ml-2">({filteredData.entries.length} glucose readings, {filteredData.treatments?.length || 0} treatments)</span>
            )}
          </p>
        </div>
      </div>

      {eventInsights.period.totalReadings > 0 && (
        <GlucoseEventInsightsPanel
          insights={eventInsights}
          focus="openaps"
          title={`Event Intelligence • ${platformLabel} ${dosingModeLabel}`}
        />
      )}

      {/* Critical Safety Alert */}
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-900 dark:text-red-100">CRITICAL SAFETY UPDATE</h3>
        </div>
        
        <div className="space-y-4 text-red-800 dark:text-red-200">
          <div>
            <h4 className="font-medium mb-2">⚠️ Previous Settings Were Too Conservative</h4>
            <p className="text-sm">
              Based on your feedback about high blood glucose levels, we've added a new "Standard" settings tier that's more aggressive 
              than the Conservative settings. This will help maintain glucose in range while still prioritizing safety.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">🛡️ Safety Features</h4>
            <ul className="text-sm space-y-1 list-disc list-inside ml-4">
              <li>AI-powered hypoglycemia risk assessment</li>
              <li>Three-tier settings: Emergency-Safe → Conservative → Standard</li>
              <li>Pediatric-specific safety multipliers</li>
              <li>Real-time safety warnings and contraindications</li>
              <li>Special carbohydrate coverage analysis for {dosingModeLabel}</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">🚨 Safety Protocol</h4>
            <p className="text-sm">
              <strong>ALWAYS start with Emergency-Safe settings</strong>, monitor for 72+ hours, then move to Conservative, 
              and finally to Standard settings if needed to maintain glucose in range.
            </p>
          </div>
        </div>
      </div>

      {/* AI therapy optimizer */}
      {filteredData && (
        <AIOpenAPSOptimizer 
          readings={filteredData.entries} 
          treatments={filteredData.treatments}
          analysisDays={isCustomRange ? 
            Math.max(1, Math.ceil((selectedRange.endMs - selectedRange.startMs) / (1000 * 60 * 60 * 24))) :
            Math.ceil(timeWindow / 24)
          }
          therapyAlgorithm={selectedTherapyAlgorithm}
          onOptimizationComplete={setAiOptimization}
        />
      )}

      {/* AI Analysis Summary */}
      {openapsAnalysis && (
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg shadow-md text-white">
          <div className="flex items-center mb-4">
            <div className="bg-white/20 p-2 rounded-lg mr-3">
              <Brain className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-medium">AI Safety Analysis Summary</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-400 rounded-full mr-3"></div>
                <span>Hypoglycemia Risk Score: {openapsAnalysis.hypoglycemiaRiskScore}/100</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
                <span>Safety Level: {openapsAnalysis.safetyLevel}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                <span>Recommended Start: {openapsAnalysis.recommendedStartingLevel}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-400 rounded-full mr-3"></div>
                <span>Data Quality: {openapsAnalysis.safetyChecks.dataQuality}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-400 rounded-full mr-3"></div>
                <span>Variability Risk: {openapsAnalysis.safetyChecks.variabilityRisk}</span>
              </div>
              {openapsAnalysis.aiAnalysis && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full mr-3"></div>
                  <span>AI Confidence: {openapsAnalysis.aiAnalysis.confidence}%</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Carb Coverage Analysis */}
          {openapsAnalysis.carbCoverage && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <h4 className="font-medium mb-2">Carbohydrate Coverage Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-400 rounded-full mr-3"></div>
                  <span>Recommended {dosingModeLabel} Coverage: {openapsAnalysis.carbCoverage.recommendedSMBCoverage}U</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-pink-400 rounded-full mr-3"></div>
                  <span>Carb Ratio Adjustment: {openapsAnalysis.carbCoverage.carbRatioAdjustment > 0 ? '+' : ''}{openapsAnalysis.carbCoverage.carbRatioAdjustment * 100}%</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/80">{openapsAnalysis.carbCoverage.mealPatternAnalysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Hourly Time-in-Range (selected period) */}
      {filteredData?.entries?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium mb-1 text-gray-900 dark:text-gray-100">Hourly Time-in-Range</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Low / TIR / High by hour-of-day for the selected period
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              Min samples/hour: <span className="font-medium">{hourlyStatsSummary.minCount}</span>
              {overallTir.avgSgvMgdl != null && (
                <div className="mt-1">Avg: <span className="font-medium">{formatGlucoseValue(overallTir.avgSgvMgdl, 'mgdl', true)}</span></div>
              )}
              <div className="mt-1">TIR: <span className="font-medium">{overallTir.inRangePct.toFixed(1)}%</span> · Low: <span className="font-medium">{overallTir.lowPct.toFixed(1)}%</span> · High: <span className="font-medium">{overallTir.highPct.toFixed(1)}%</span></div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {hourlyGlucoseStats.map((h) => {
              const eligible = h.count >= hourlyStatsSummary.minCount;
              const bg = !eligible
                ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                : h.inRangePct >= 70
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : h.lowPct >= 8
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : h.highPct >= 35
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';

              return (
                <div
                  key={h.hour}
                  className={`border rounded-lg p-3 transition-colors duration-200 ${bg}`}
                  title={eligible ? undefined : `Low samples for this hour (n=${h.count}).`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {h.hour.toString().padStart(2, '0')}:00–{h.hour.toString().padStart(2, '0')}:59
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">n={h.count}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      <span className="font-medium">TIR</span>: {h.inRangePct.toFixed(1)}% · <span className="font-medium text-red-700 dark:text-red-300">Low</span>: {h.lowPct.toFixed(1)}% · <span className="font-medium text-orange-700 dark:text-orange-300">High</span>: {h.highPct.toFixed(1)}%
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {h.avgSgvMgdl != null ? `avg ${formatGlucoseValue(h.avgSgvMgdl, 'mgdl', true)}` : 'avg —'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automated Dosing Setup Suggestions + Tiered Presets */}
      {openapsAnalysis && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{dosingModeLabel} Setup Suggestions (Data-Driven)</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">Confidence: {smbSetupSummary.confidence}</span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
            <p className="text-blue-900 dark:text-blue-100 font-medium">
              Suggested starting tier for {dosingModeLabel} behavior: <span className="font-bold">{smbSetupSummary.recommendedTier}</span>
            </p>
            {smbSetupSummary.reasons.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
                {smbSetupSummary.reasons.slice(0, 4).map((r, idx) => (
                  <li key={idx}>• {r}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
              These are conservative starting points based on your Nightscout data. Always apply changes cautiously and validate with your clinical team.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                <h4 className="font-medium text-red-900 dark:text-red-100">Emergency-Safe</h4>
              </div>
              <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                <div>{dosingModeLabel} max minutes: <span className="font-medium">{smbBehaviorPresets.emergency.smbMaxMinutes}</span></div>
                <div>{dosingModeLabel} delivery ratio: <span className="font-medium">{Math.round(smbBehaviorPresets.emergency.smbDeliveryRatio * 100)}%</span></div>
                <div>Carbs req threshold: <span className="font-medium">{smbBehaviorPresets.emergency.carbsReqThreshold} g</span></div>
                <div>{dosingModeLabel} with COB: <span className="font-medium">{smbBehaviorPresets.emergency.enableSMBWithCOB ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} with temp targets: <span className="font-medium">{smbBehaviorPresets.emergency.enableSMBWithTemptarget ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} always: <span className="font-medium">{smbBehaviorPresets.emergency.enableSMBAlways ? 'On' : 'Off'}</span></div>
              </div>
            </div>

            <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <h4 className="font-medium text-yellow-900 dark:text-yellow-100">Conservative</h4>
              </div>
              <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                <div>{dosingModeLabel} max minutes: <span className="font-medium">{smbBehaviorPresets.conservative.smbMaxMinutes}</span></div>
                <div>{dosingModeLabel} delivery ratio: <span className="font-medium">{Math.round(smbBehaviorPresets.conservative.smbDeliveryRatio * 100)}%</span></div>
                <div>Carbs req threshold: <span className="font-medium">{smbBehaviorPresets.conservative.carbsReqThreshold} g</span></div>
                <div>{dosingModeLabel} with COB: <span className="font-medium">{smbBehaviorPresets.conservative.enableSMBWithCOB ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} with temp targets: <span className="font-medium">{smbBehaviorPresets.conservative.enableSMBWithTemptarget ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} always: <span className="font-medium">{smbBehaviorPresets.conservative.enableSMBAlways ? 'On' : 'Off'}</span></div>
              </div>
            </div>

            <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
              <div className="flex items-center mb-2">
                <Target className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <h4 className="font-medium text-green-900 dark:text-green-100">Standard</h4>
              </div>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <div>{dosingModeLabel} max minutes: <span className="font-medium">{smbBehaviorPresets.standard.smbMaxMinutes}</span></div>
                <div>{dosingModeLabel} delivery ratio: <span className="font-medium">{Math.round(smbBehaviorPresets.standard.smbDeliveryRatio * 100)}%</span></div>
                <div>Carbs req threshold: <span className="font-medium">{smbBehaviorPresets.standard.carbsReqThreshold} g</span></div>
                <div>{dosingModeLabel} with COB: <span className="font-medium">{smbBehaviorPresets.standard.enableSMBWithCOB ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} with temp targets: <span className="font-medium">{smbBehaviorPresets.standard.enableSMBWithTemptarget ? 'On' : 'Off'}</span></div>
                <div>{dosingModeLabel} always: <span className="font-medium">{smbBehaviorPresets.standard.enableSMBAlways ? 'On' : 'Off'}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
            Guidance intent: reduce hypoglycemia risk first, then address persistent hyperglycemia. If you see significant lows in specific hours, keep {dosingModeLowerLabel} aggression limited in those windows.
          </div>
        </div>
      )}

      {/* SMB Effectiveness + Risk by Hour */}
      {filteredData?.entries?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{dosingModeLabel} Outcomes by Hour</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">Min {dosingModeLowerLabel} events/hour: {smbOutcomesByHour.minCount}</span>
          </div>

          {smbEvents.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No {dosingModeLowerLabel} events detected in the selected period.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {'"Effective" = average BG in ~2h after '} {dosingModeLowerLabel} {' drops by >=5 mg/dL. "Post-'}{dosingModeLabel}{' low" = any reading below target minimum within 3h.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {smbOutcomesByHour.outcomes.map((h) => {
                  const eligible = h.count >= smbOutcomesByHour.minCount;
                  const bg = !eligible
                    ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                    : h.postSmbLowPct >= 15
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : h.effectivePct >= 60
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';

                  return (
                    <div
                      key={h.hour}
                      className={`border rounded-lg p-3 transition-colors duration-200 ${bg}`}
                      title={eligible ? undefined : `Low ${dosingModeLowerLabel} sample count for this hour (n=${h.count}).`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {h.hour.toString().padStart(2, '0')}:00–{h.hour.toString().padStart(2, '0')}:59
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">n={h.count}</div>
                      </div>
                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <div>
                          <span className="font-medium">Effective</span>: {h.effectivePct.toFixed(1)}% · <span className="font-medium text-red-700 dark:text-red-300">Post-{dosingModeLabel}{' low'}</span>: {h.postSmbLowPct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {h.avgDrop2hMgdl != null ? `Avg drop ~2h: ${h.avgDrop2hMgdl.toFixed(0)} mg/dL` : 'Avg drop ~2h: —'}
                          {h.avgUnits != null ? ` · Avg ${dosingModeLabel}: ${h.avgUnits.toFixed(2)}U` : ''}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {h.avgStartBgMgdl != null ? `Avg start BG: ${formatGlucoseValue(h.avgStartBgMgdl, 'mgdl', true)}` : 'Avg start BG: —'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(smbOutcomesByHour.worstHypo[0] || smbOutcomesByHour.worstEffectiveness[0]) && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {smbOutcomesByHour.worstHypo[0] && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Highest post-{dosingModeLowerLabel}{' low risk:'}</strong> {smbOutcomesByHour.worstHypo[0].hour.toString().padStart(2, '0')}:00–{smbOutcomesByHour.worstHypo[0].hour.toString().padStart(2, '0')}:59 ({smbOutcomesByHour.worstHypo[0].postSmbLowPct.toFixed(1)}%).
                        Consider keeping SMB behavior more conservative around this time.
                      </p>
                    </div>
                  )}
                  {smbOutcomesByHour.worstEffectiveness[0] && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Lowest SMB effectiveness:</strong> {smbOutcomesByHour.worstEffectiveness[0].hour.toString().padStart(2, '0')}:00–{smbOutcomesByHour.worstEffectiveness[0].hour.toString().padStart(2, '0')}:59 ({smbOutcomesByHour.worstEffectiveness[0].effectivePct.toFixed(1)}%).
                        If highs persist here, consider focusing on basal/ISF/timing rather than simply increasing {dosingModeLowerLabel} aggression.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Critical Warnings */}
      {openapsAnalysis?.criticalWarnings?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Critical Safety Warnings</h3>
          </div>
          
          <div className="space-y-3">
            {openapsAnalysis.criticalWarnings.map((warning: string, index: number) => (
              <div key={index} className="bg-red-100 dark:bg-red-800/30 p-3 rounded border-l-4 border-red-500">
                <p className="text-red-800 dark:text-red-200 text-sm font-medium">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {openapsAnalysis?.aiAnalysis?.recommendations?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Recommendations</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Risk: {openapsAnalysis.aiAnalysis.riskAssessment} | Confidence: {openapsAnalysis.aiAnalysis.confidence}%
            </span>
          </div>
          
          <div className="space-y-3">
            {openapsAnalysis.aiAnalysis.recommendations.map((rec: string, index: number) => (
              <div key={index} className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded border-l-4 border-purple-500">
                <p className="text-purple-800 dark:text-purple-200 text-sm">{rec}</p>
              </div>
            ))}
          </div>
          
          {openapsAnalysis.aiAnalysis.reasoning?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">AI Reasoning:</h4>
              <ul className="space-y-1">
                {openapsAnalysis.aiAnalysis.reasoning.map((reason: string, index: number) => (
                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400">• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Carbohydrate Coverage Section */}
      {openapsAnalysis?.carbCoverage && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Carbohydrate Coverage Analysis</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This analysis is specifically for users who rely on SMBs to cover carbohydrate announcements instead of traditional boluses.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-3">SMB Coverage Recommendations</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-orange-800 dark:text-orange-200">Recommended SMB Coverage:</span>
                  <span className="font-bold text-orange-900 dark:text-orange-100">{openapsAnalysis.carbCoverage.recommendedSMBCoverage}U</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-orange-800 dark:text-orange-200">Carb Ratio Adjustment:</span>
                  <span className="font-bold text-orange-900 dark:text-orange-100">
                    {openapsAnalysis.carbCoverage.carbRatioAdjustment > 0 ? '+' : ''}
                    {(openapsAnalysis.carbCoverage.carbRatioAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                  {openapsAnalysis.carbCoverage.mealPatternAnalysis}
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Implementation Guidelines</h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Set <strong>enableSMB_with_COB</strong> to true in AAPS</li>
                <li>• Set <strong>enableSMB_with_temptarget</strong> to true</li>
                <li>• Use <strong>maxSMBBasalMinutes</strong> of 30-60 minutes</li>
                <li>• Start with <strong>maxUAMSMBBasalMinutes</strong> at 30 minutes</li>
                <li>• Consider using <strong>Eating Soon</strong> temp targets before meals</li>
                <li>• Announce carbs 10-15 minutes before eating when possible</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
              <h4 className="font-medium text-purple-900 dark:text-purple-100">Special Considerations for Carb Coverage with SMB</h4>
            </div>
            <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
              <li>• SMB for carb coverage requires higher Maximum IOB than correction-only usage</li>
              <li>• Start with ultra-conservative settings and gradually increase if needed</li>
              <li>• Monitor post-meal patterns closely for the first 2-3 hours</li>
              <li>• Consider using temporary targets to influence SMB aggressiveness</li>
              <li>• Adjust carb ratios if post-meal patterns show consistent highs or lows</li>
            </ul>
          </div>
        </div>
      )}

      {/* Three-Tier Safety Settings */}
      {openapsAnalysis && (
        <div className="space-y-6">
          {/* Emergency-Safe Settings */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Emergency-Safe Settings (ALWAYS START HERE)
                </h3>
              </div>
              {aiOptimization && (
                <div className="flex items-center text-sm text-purple-600 dark:text-purple-400">
                  <Brain className="h-4 w-4 mr-1" />
                  AI Enhanced
                </div>
              )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <strong>MANDATORY STARTING POINT:</strong> These emergency-safe settings prioritize preventing hypoglycemia 
              above all else. Use for at least 72+ hours while monitoring closely before considering any increases.
            </p>

            {/* AI Emergency-Safe Analysis */}
            {aiOptimization && (
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center mb-3">
                  <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">AI Emergency-Safe Analysis</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-purple-800 dark:text-purple-200 mb-2">
                      <strong>Safety Assessment:</strong> {aiOptimization.riskAssessment.overallRisk} risk level
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Hypo Risk:</strong> {aiOptimization.riskAssessment.hypoglycemiaRisk}%
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Recommended Duration:</strong> {aiOptimization.riskAssessment.overallRisk === 'high' ? '7+ days' : '3-5 days'} monitoring
                    </p>
                  </div>
                  <div>
                    <p className="text-purple-700 dark:text-purple-300 mb-2">
                      <strong>AI Adjustment:</strong> Emergency settings are {Math.round((aiOptimization.optimizedSettings.maxTempBasal / openapsAnalysis.ultraConservativeMaxTempBasal - 1) * 100)}% more conservative than standard
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Key Focus:</strong> {aiOptimization.recommendations.immediate.length > 0 ? aiOptimization.recommendations.immediate[0].split('.')[0] : 'Monitor for hypoglycemia patterns'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Zap className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <h4 className="font-medium text-red-900 dark:text-red-100">Max Temp Basal</h4>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {openapsAnalysis.ultraConservativeMaxTempBasal} U/h
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Emergency-safe baseline
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Activity className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <h4 className="font-medium text-red-900 dark:text-red-100">Maximum IOB</h4>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {openapsAnalysis.ultraConservativeMaximumIOB} U
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  50% of conservative (Emergency-safe)
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <h4 className="font-medium text-red-900 dark:text-red-100">DynamicISF Factor</h4>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {openapsAnalysis.ultraConservativeDynamicISFFactor}%
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Ultra-conservative (AAPS: 1%-300%)
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-red-100 dark:bg-red-800/30 rounded-lg border border-red-200 dark:border-red-700">
              <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                🚨 CRITICAL: Start with these settings ONLY. Monitor continuously for 72 hours. Any hypoglycemia episodes mean these settings are still too aggressive.
              </p>
            </div>
          </div>

          {/* Conservative Settings */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Conservative Settings (ONLY after 7+ days Emergency-Safe stability)
                </h3>
              </div>
              {aiOptimization && (
                <div className="flex items-center text-sm text-purple-600 dark:text-purple-400">
                  <Brain className="h-4 w-4 mr-1" />
                  AI Enhanced
                </div>
              )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <strong>ONLY after 72+ hours of stable control with Emergency-Safe settings:</strong> 
              Consider these conservative values if no hypoglycemia has occurred.
            </p>

            {/* AI Conservative Analysis */}
            {aiOptimization && (
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center mb-3">
                  <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">AI Conservative Analysis</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-purple-800 dark:text-purple-200 mb-2">
                      <strong>Glucose Control:</strong> {Math.round(aiOptimization.currentPerformance.timeInRange)}% Time in Range
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Stability Score:</strong> {aiOptimization.riskAssessment.overallRisk === 'low' ? 'Excellent' : aiOptimization.riskAssessment.overallRisk === 'medium' ? 'Good' : 'Needs Improvement'}
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Ready for Conservative:</strong> {aiOptimization.riskAssessment.overallRisk === 'low' ? 'Yes' : 'Continue Emergency-Safe'}
                    </p>
                  </div>
                  <div>
                    <p className="text-purple-700 dark:text-purple-300 mb-2">
                      <strong>Projected Improvement:</strong> +{Math.round((openapsAnalysis.maxTempBasal - openapsAnalysis.ultraConservativeMaxTempBasal) / openapsAnalysis.ultraConservativeMaxTempBasal * 100)}% more aggressive
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Monitoring Focus:</strong> IOB patterns and overnight stability
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">Max Temp Basal</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {openapsAnalysis.maxTempBasal} U/h
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Conservative baseline
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Activity className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">Maximum IOB</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {openapsAnalysis.maximumIOB} U
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Conservative baseline
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">DynamicISF Factor</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {openapsAnalysis.dynamicISFFactor}%
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Conservative (AAPS: 1%-300%)
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                ⚠️ WARNING: Only use these settings after proving Emergency-Safe settings work without hypoglycemia for 72+ hours.
              </p>
            </div>
          </div>

          {/* Standard Settings (NEW) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Standard Settings (For optimal glucose control)
                </h3>
              </div>
              {aiOptimization && (
                <div className="flex items-center text-sm text-purple-600 dark:text-purple-400">
                  <Brain className="h-4 w-4 mr-1" />
                  AI Enhanced
                </div>
              )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <strong>ONLY after 7+ days of stable control with Conservative settings:</strong> 
              These more aggressive settings help maintain glucose in range when high blood glucose is prevalent.
            </p>

            {/* AI Standard Analysis */}
            {aiOptimization && (
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center mb-3">
                  <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">AI Standard Settings Analysis</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-purple-800 dark:text-purple-200 mb-2">
                      <strong>Optimization Potential:</strong> {convertToCurrentUnit(aiOptimization.currentPerformance.avgGlucose, 'mgdl') > convertToCurrentUnit(140, 'mgdl') ? 'High - Many highs detected' : 'Moderate - Good control'}
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>High BG Episodes:</strong> {Math.round(aiOptimization.currentPerformance.timeAbove180)}% above {formatGlucoseValue(180, 'mgdl', true)}
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Ready for Standard:</strong> {aiOptimization.riskAssessment.overallRisk === 'low' && aiOptimization.currentPerformance.timeInRange > 70 ? 'Yes' : 'Continue Conservative'}
                    </p>
                  </div>
                  <div>
                    <p className="text-purple-700 dark:text-purple-300 mb-2">
                      <strong>AI Recommended IOB:</strong> {aiOptimization.optimizedSettings.maximumIOB}U vs Standard {openapsAnalysis.standardMaximumIOB}U
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Safety Margin:</strong> {aiOptimization.riskAssessment.hypoglycemiaRisk < 10 ? 'Sufficient' : 'Requires caution'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Zap className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <h4 className="font-medium text-green-900 dark:text-green-100">Max Temp Basal</h4>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {openapsAnalysis.standardMaxTempBasal} U/h
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  40% more aggressive than conservative
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Activity className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <h4 className="font-medium text-green-900 dark:text-green-100">Maximum IOB</h4>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {openapsAnalysis.standardMaximumIOB} U
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  30% more aggressive than conservative
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <h4 className="font-medium text-green-900 dark:text-green-100">DynamicISF Factor</h4>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {openapsAnalysis.standardDynamicISFFactor}%
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  More aggressive (AAPS: 1%-300%)
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-100 dark:bg-green-800/30 rounded-lg border border-green-200 dark:border-green-700">
              <p className="text-green-800 dark:text-green-200 text-sm">
                ⚠️ CAUTION: Only use these settings after confirming Conservative settings work well for at least 7 days. Monitor closely for the first 48 hours after switching to Standard settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Tier Recommendation */}
      {aiOptimization && openapsAnalysis && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-lg shadow-md border border-purple-200 dark:border-purple-700">
          <div className="flex items-center mb-4">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Safety Tier Recommendation</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Current Risk Assessment */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Current Status</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Risk Level:</strong> <span className={`px-2 py-1 rounded text-xs ${
                    aiOptimization.riskAssessment.overallRisk === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300' :
                    aiOptimization.riskAssessment.overallRisk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300' :
                    'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300'
                  }`}>
                    {aiOptimization.riskAssessment.overallRisk.toUpperCase()}
                  </span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Time in Range:</strong> {Math.round(aiOptimization.currentPerformance.timeInRange)}%
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Avg Glucose:</strong> {formatGlucoseValue(Math.round(aiOptimization.currentPerformance.avgGlucose), 'mgdl', true)}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Hypo Risk:</strong> {aiOptimization.riskAssessment.hypoglycemiaRisk}%
                </p>
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">AI Recommendation</h4>
              <div className="text-center">
                {(() => {
                  if (aiOptimization.riskAssessment.overallRisk === 'high' || aiOptimization.riskAssessment.hypoglycemiaRisk > 15) {
                    return (
                      <div>
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-red-700 dark:text-red-300 font-medium">Emergency-Safe Only</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Continue for 7+ days</p>
                      </div>
                    );
                  } else if (aiOptimization.currentPerformance.timeInRange < 70 || aiOptimization.riskAssessment.hypoglycemiaRisk > 10) {
                    return (
                      <div>
                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <p className="text-yellow-700 dark:text-yellow-300 font-medium">Conservative Settings</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Ready to advance cautiously</p>
                      </div>
                    );
                  } else {
                    return (
                      <div>
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-green-700 dark:text-green-300 font-medium">Standard Settings</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Excellent control achieved</p>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Next Steps</h4>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {aiOptimization.riskAssessment.overallRisk === 'high' ? (
                  <>
                    <p>• Continue Emergency-Safe settings</p>
                    <p>• Monitor for hypoglycemia patterns</p>
                    <p>• Review basal rates with endocrinologist</p>
                    <p>• Wait minimum 7 days before advancing</p>
                  </>
                ) : aiOptimization.currentPerformance.timeInRange < 70 ? (
                  <>
                    <p>• Advance to Conservative settings</p>
                    <p>• Monitor closely for 48 hours</p>
                    <p>• Check overnight stability</p>
                    <p>• Document glucose patterns</p>
                  </>
                ) : (
                  <>
                    <p>• Consider Standard settings</p>
                    <p>• Focus on meal bolus optimization</p>
                    <p>• Fine-tune DynamicISF factor</p>
                    <p>• Maintain excellent control</p>
                  </>
                )}
              </div>
            </div>
          </div>

            <div className="mt-6 p-4 bg-purple-100 dark:bg-purple-800/30 rounded-lg border border-purple-200 dark:border-purple-700">
              <p className="text-purple-800 dark:text-purple-200 text-sm">
                🤖 <strong>AI Analysis:</strong> Based on {aiOptimization.analysisPeriod.dataPoints} glucose readings over {aiOptimization.analysisPeriod.days} days. 
                <strong> Updated for aggressive optimization</strong> - settings now target real-world effectiveness while maintaining safety. 
                Always consult your healthcare provider before making significant changes.
              </p>
            </div>
        </div>
      )}

      {/* Implementation Protocol */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Safety Implementation Protocol</h3>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center mb-3">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg mr-2">
                  <span className="text-red-600 dark:text-red-400 font-bold">1</span>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Start (Days 1-3)</h4>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• Start ONLY with Emergency-Safe settings</li>
                <li>• Monitor glucose every 15 minutes</li>
                <li>• Keep rescue carbs always available</li>
                <li>• Any hypoglycemia = STOP immediately</li>
                <li>• Document all glucose patterns</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center mb-3">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg mr-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">2</span>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Conservative (Days 4-7)</h4>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• ONLY if no hypoglycemia in 72+ hours</li>
                <li>• Gradually increase to Conservative settings</li>
                <li>• Increase one parameter at a time</li>
                <li>• Wait 24h between each change</li>
                <li>• Continue intensive monitoring</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center mb-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mr-2">
                  <span className="text-green-600 dark:text-green-400 font-bold">3</span>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Standard (Days 8+)</h4>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• ONLY if stable with Conservative for 4+ days</li>
                <li>• Move to Standard settings if high BG persists</li>
                <li>• Increase one parameter at a time</li>
                <li>• Wait 24h between each change</li>
                <li>• Monitor closely for 48h after changes</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center mb-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Ongoing Safety</h4>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• Weekly safety reviews</li>
                <li>• Immediate rollback if any hypoglycemia</li>
                <li>• Regular data analysis and adjustment</li>
                <li>• Maintain detailed logs</li>
                <li>• Consult healthcare team regularly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Absolute Contraindications */}
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Absolute Contraindications</h3>
        </div>
        
        <div className="space-y-4 text-red-800 dark:text-red-200">
          <div>
            <h4 className="font-medium mb-2">🚫 DO NOT USE OpenAPS SMB if:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside ml-4">
              <li>More than 4% time below range in the last 2 weeks</li>
              <li>Any severe hypoglycemia episodes (below {formatGlucoseValue(54, 'mgdl', true)}) in the last month</li>
              <li>Glucose variability (CV) above 50%</li>
              <li>Frequent unexplained hypoglycemia</li>
              <li>Poor CGM accuracy or frequent sensor failures</li>
              <li>Inability to monitor continuously for the first week</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">⚠️ Immediate Stop Conditions:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside ml-4">
              <li>ANY hypoglycemia episode below {formatGlucoseValue(70, 'mgdl', true)}</li>
              <li>More than 2 glucose readings below {formatGlucoseValue(72, 'mgdl', true)} in 24 hours</li>
              <li>Unexplained glucose drops of more than {formatGlucoseValue(54, 'mgdl', true)} in 30 minutes</li>
              <li>Patient or caregiver discomfort with the system</li>
              <li>Technical issues with CGM or pump</li>
            </ul>
          </div>
        </div>
      </div>

      {/* SMB Events Table (if available) */}
      {smbEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent SMB Events</h3>
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
                    SMB Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    COB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    IOB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Safety Assessment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {smbEvents.slice(0, 10).map((event, index) => {
                  // Use mg/dL directly for safety check (5.0 mmol/L = 90 mg/dL)
                  const isSafe = event.glucose > 90 && event.smbDelivered < 0.3;
                  const isCarb = event.cob > 0;
                  
                  return (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(event.timestamp), 'dd.MM. HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatGlucoseValue(event.glucose, 'mgdl', true)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                        {event.smbDelivered.toFixed(3)}U
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {event.cob > 0 ? `${event.cob}g` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {event.iob.toFixed(2)}U
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isSafe 
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}>
                          {isSafe ? 'Safe' : 'Risky'}
                        </span>
                        {isCarb && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100">
                            Carb
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Final Safety Disclaimer */}
      <div className="bg-gray-900 dark:bg-gray-800 p-6 rounded-lg text-white">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-red-400 mr-2" />
          <h3 className="text-lg font-medium">Final Safety Disclaimer</h3>
        </div>
        
        <div className="space-y-4 text-gray-200">
          <p className="text-sm">
            <strong>These settings have been updated to be more aggressive based on your feedback about high blood glucose levels.</strong> 
            The new Standard settings tier provides more aggressive insulin delivery while still maintaining safety guardrails.
          </p>
          
          <p className="text-sm">
            Remember to follow the implementation protocol: start with Emergency-Safe settings, then move to Conservative, 
            and finally to Standard settings only after confirming safety at each level.
          </p>
          
          <p className="text-sm">
            <strong>NEVER implement any OpenAPS settings without:</strong>
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside ml-4">
            <li>Approval from your endocrinologist or diabetes specialist</li>
            <li>Continuous glucose monitoring capability</li>
            <li>24/7 supervision for the first week</li>
            <li>Immediate access to emergency medical care</li>
            <li>Complete understanding of how to disable the system immediately</li>
          </ul>
          
          <p className="text-sm font-bold text-red-300">
            Remember: While these settings are more aggressive to address high blood glucose, safety remains the priority.
            Always monitor closely and be prepared to revert to more conservative settings if needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OpenAPSSMB;