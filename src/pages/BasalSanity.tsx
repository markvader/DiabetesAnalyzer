import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNightscout } from '../contexts/NightscoutContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { computeBasalSanity } from '../services/basalSanityService';

const BasalSanity = () => {
  const { data, loading, error, fetchDataForDays, analysisPeriod } = useNightscout();
  const { selectedPump } = useInsulinPump();

  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof computeBasalSanity> | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [timeWindowHours, setTimeWindowHours] = useState(() => analysisPeriod * 24);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ startDate: string; endDate: string }>(() => ({
    startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  }));
  const [isCustomRange, setIsCustomRange] = useState(false);

  useEffect(() => {
    if (!isCustomRange) {
      setTimeWindowHours(analysisPeriod * 24);
      setCustomDateRange({
        startDate: format(subDays(new Date(), analysisPeriod), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [analysisPeriod, isCustomRange]);

  useEffect(() => {
    runSafeAsync(() => fetchDataForDays(Math.max(analysisPeriod, 7)), { label: 'BasalSanity initial fetch' });
  }, [analysisPeriod, fetchDataForDays]);

  const entriesSortedAsc = useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => getEntryMs(a) - getEntryMs(b));
  }, [data?.entries]);

  const treatmentsSortedAsc = useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

  const selectedRange = useMemo(() => {
    if (isCustomRange) {
      return {
        startMs: startOfDay(new Date(customDateRange.startDate)).getTime(),
        endMs: endOfDay(new Date(customDateRange.endDate)).getTime()
      };
    }

    const endMs = Date.now();
    const startMs = endMs - timeWindowHours * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [customDateRange.endDate, customDateRange.startDate, isCustomRange, timeWindowHours]);

  const filteredEntries = useMemo(() => {
    if (!entriesSortedAsc.length) return [];
    return sliceSortedByTimeRange(entriesSortedAsc, getEntryMs, selectedRange.startMs, selectedRange.endMs);
  }, [entriesSortedAsc, selectedRange.endMs, selectedRange.startMs]);

  const filteredTreatments = useMemo(() => {
    if (!treatmentsSortedAsc.length) return [];
    return sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, selectedRange.startMs, selectedRange.endMs);
  }, [selectedRange.endMs, selectedRange.startMs, treatmentsSortedAsc]);

  useEffect(() => {
    const perform = () => {
      if (!data) return;
      if (!filteredEntries.length) return;

      if (!hasInitialLoad || manualRefresh) {
        setAnalyzing(true);
        setAnalysisError(null);

        try {
          const r = computeBasalSanity({
            entries: filteredEntries,
            treatments: filteredTreatments,
            profiles: data.profile || [],
            rangeStartMs: selectedRange.startMs,
            rangeEndMs: selectedRange.endMs,
            pump: selectedPump
              ? {
                  name: selectedPump.name,
                  maxBasalRate: selectedPump.maxBasalRate,
                  basalIncrements: selectedPump.basalIncrements
                }
              : null
          });
          setResult(r);

          if (!hasInitialLoad) setHasInitialLoad(true);
          if (manualRefresh) setManualRefresh(false);
        } catch (e) {
          console.error('Basal sanity failed:', e);
          setAnalysisError('An error occurred while computing basal sanity checks.');
        } finally {
          setAnalyzing(false);
        }
      }
    };

    perform();
  }, [data, filteredEntries, filteredTreatments, hasInitialLoad, manualRefresh, selectedPump, selectedRange.endMs, selectedRange.startMs]);

  const formatDrift = (v?: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return `${v.toFixed(0)} mg/dL/hr`;
  };

  const formatPct = (v?: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return `${Math.round(v * 100)}%`;
  };

  const formatDateShort = (ms: number) => {
    return format(new Date(ms), 'dd.MM.yyyy');
  };

  const formatTimeShort = (ms: number) => {
    return format(new Date(ms), 'HH:mm');
  };

  const formatMaybe = (v?: number, suffix: string = '') => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return `${v.toFixed(1)}${suffix}`;
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <Shield className="h-6 w-6 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Basal Sanity</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lightweight checks for basal schedule integrity, temp basal frequency, and fasting drift (informational only).
            </p>
          </div>
        </div>

        <button
          onClick={() => setManualRefresh(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          disabled={analyzing}
        >
          <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-300 mt-0.5" />
          <div className="text-sm text-yellow-900 dark:text-yellow-100">
            This page does not provide dosing advice. If you see warning patterns, review with your care team and change settings gradually.
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Details</h3>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showDetails ? 'Hide' : 'Show'}
          </button>
        </div>

        {showDetails && (
          <div className="mt-3 space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Fasting drift windows</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Overnight: 00:00–06:00 local time</li>
                <li>Afternoon: 13:00–16:00 local time</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Qualifying-window rules (used for drift)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>The full window must be inside the selected time range (no partial windows).</li>
                <li>Require sufficient CGM coverage: at least 24 readings in the window.</li>
                <li>Exclude if any carbs ≥ 5g occur from −4h before the window start through the window end.</li>
                <li>Exclude if any non-temp insulin bolus ≥ 0.2U occurs from −4h before the window start through the window end.</li>
                <li>
                  Temp basal handling: by default we exclude windows with temp basals, but if you run frequent temp basals (automation), the “quiet” rules
                  relax to allow temp basals so you can still get enough qualifying nights.
                </li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                “Temp basal” includes treatments with eventType containing “temp basal”, or those with duration &gt; 0 and rate/absolute set.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">How drift is calculated</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Start glucose = median of readings in the first 30 minutes of the window.</li>
                <li>End glucose = median of readings in the last 30 minutes of the window.</li>
                <li>Drift = (end − start) / hours, in mg/dL/hr.</li>
                <li>“Any &lt;70 mg/dL” flags windows that include at least one low reading.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Interpreting results</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>These are sanity signals meant to reduce confounders; they are not diagnostic.</li>
                <li>Qualifying day counts can be low if you frequently eat, bolus, or run temp basals.</li>
                <li>Overnight pattern and dawn signals require multiple “quiet” nights and are evidence-focused (not dosing advice).</li>
                <li>Correction stacking signals are flagged as safety insights only.</li>
                <li>
                  Correction stacking uses an insulin action time heuristic: if your Nightscout profile has DIA set, it is used; otherwise defaults to 4h.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Time Range</h3>
          <button
            onClick={() => setShowCalendar((v) => !v)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showCalendar ? 'Hide' : 'Custom range'}
          </button>
        </div>

        {!showCalendar && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Using last {analysisPeriod} days (from Settings).
          </p>
        )}

        {showCalendar && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Start</label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">End</label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCustomRange(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setIsCustomRange(false);
                  setShowCalendar(false);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                Use default
              </button>
            </div>
          </div>
        )}
      </div>

      {analysisError && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-800 dark:text-red-200">{analysisError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Total Daily Basal</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {typeof result?.schedule.totalDailyBasalU === 'number' ? `${result.schedule.totalDailyBasalU.toFixed(1)} U/day` : '—'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">From profile schedule (integrated over 24h)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Temp Basals</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result?.tempBasal.count ?? 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {typeof result?.tempBasal.perDay === 'number' ? `${result.tempBasal.perDay.toFixed(1)}/day` : '—'}
            {typeof result?.tempBasal.medianDurationMin === 'number' ? ` • median ${result.tempBasal.medianDurationMin.toFixed(0)} min` : ''}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Selected Pump</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPump?.name ?? 'Not set'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedPump ? `Max basal ${selectedPump.maxBasalRate} U/h • increment ${selectedPump.basalIncrements} U/h` : 'Pump constraints not applied'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Checks</h3>
        <div className="space-y-2">
          {(result?.checks || []).map((c, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                c.severity === 'warn'
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.title}</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{c.details}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Fasting Drift (sanity)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(result?.drift || []).map((d) => (
            <div key={d.window.label} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{d.window.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {d.qualifyingDays}/{d.totalDaysConsidered} days
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Drift (median): <span className="font-medium">{formatDrift(d.medianDriftMgdlPerHr)}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Start→End (median): {formatMaybe(d.medianStartMgdl)} → {formatMaybe(d.medianEndMgdl)} mg/dL
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Any &lt;70 mg/dL: {typeof d.lowEventRate === 'number' ? `${Math.round(d.lowEventRate * 100)}%` : '—'}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Interpretation: {d.interpretation}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Only “qualifying” windows are used: no carbs/boluses/temp basals around the window and enough CGM data. This is a sanity signal, not a diagnosis.
        </p>
      </div>

      {!result?.patterns ? null : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Overnight Drift Pattern (evidence)</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Qualifying nights</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.patterns.overnight.qualifyingNights}/{result.patterns.overnight.totalNightsConsidered}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Window: {result.patterns.overnight.windowLabel}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Median slope</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDrift(result.patterns.overnight.medianSlopeMgdlPerHr)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Robust (pairwise-median) slope per night</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Consistency</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPct(result.patterns.overnight.consistency)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Fraction of nights matching median direction</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            Interpretation: <span className="font-medium">{result.patterns.overnight.direction}</span>
          </div>

          {!result.patterns.overnight.examples.length ? null : (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Example qualifying nights</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Slope</th>
                      <th className="py-2 pr-4">Start→End</th>
                      <th className="py-2 pr-4">Readings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {result.patterns.overnight.examples.map((s) => (
                      <tr key={`${s.windowStartMs}`} className="text-sm text-gray-900 dark:text-gray-100">
                        <td className="py-2 pr-4 font-medium">{formatDateShort(s.windowStartMs)}</td>
                        <td className="py-2 pr-4">{formatDrift(s.slopeMgdlPerHr)}</td>
                        <td className="py-2 pr-4">
                          {s.startMedianMgdl.toFixed(0)} → {s.endMedianMgdl.toFixed(0)} mg/dL
                        </td>
                        <td className="py-2 pr-4">{s.readings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Uses strict “quiet” criteria (no carbs/bolus/temp basal from −4h through the window end). If you use automation or eat late, qualifying nights may be rare.
          </p>
        </div>
      )}

      {!result?.patterns ? null : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Dawn Phenomenon Signal (evidence)</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Qualifying days</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.patterns.dawn.qualifyingDays}/{result.patterns.dawn.totalDaysConsidered}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">00:00–04:00 slope</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDrift(result.patterns.dawn.medianBaselineSlopeMgdlPerHr)}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">04:00–08:00 slope</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDrift(result.patterns.dawn.medianDawnSlopeMgdlPerHr)}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Δ slope</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDrift(result.patterns.dawn.medianDeltaSlopeMgdlPerHr)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Consistency: {formatPct(result.patterns.dawn.consistency)}</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            Interpretation: <span className="font-medium">{result.patterns.dawn.interpretation}</span>
          </div>

          {!result.patterns.dawn.examples.length ? null : (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Example days (largest Δ)</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">00–04</th>
                      <th className="py-2 pr-4">04–08</th>
                      <th className="py-2 pr-4">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {result.patterns.dawn.examples.map((e) => (
                      <tr key={`${e.baselineStartMs}`} className="text-sm text-gray-900 dark:text-gray-100">
                        <td className="py-2 pr-4 font-medium">{formatDateShort(e.baselineStartMs)}</td>
                        <td className="py-2 pr-4">{formatDrift(e.baselineSlopeMgdlPerHr)}</td>
                        <td className="py-2 pr-4">{formatDrift(e.dawnSlopeMgdlPerHr)}</td>
                        <td className="py-2 pr-4">{formatDrift(e.deltaSlopeMgdlPerHr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            This compares quiet 00:00–04:00 vs 04:00–08:00. Breakfast boluses/carbs often disqualify days; use a longer range to get enough qualifying mornings.
          </p>
        </div>
      )}

      {!result?.patterns ? null : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Correction Stacking (safety signal)</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Correction boluses</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.patterns.correctionStacking.correctionBoluses}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Heuristic: bolus ≥0.2U with carbs &lt;5g</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Insulin action time</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.patterns.correctionStacking.insulinActionHours}h</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Used for proximity checks</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">Flagged pairs</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.patterns.correctionStacking.stackingEvents.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Short wait (&lt;{result.patterns.correctionStacking.minWaitMin}m) or falling/flat glucose</div>
            </div>
          </div>

          {!result.patterns.correctionStacking.stackingEvents.length ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">No stacking signals detected in the selected range.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="py-2 pr-4">Second bolus</th>
                    <th className="py-2 pr-4">Δ time</th>
                    <th className="py-2 pr-4">Units (1st→2nd)</th>
                    <th className="py-2 pr-4">Trend before 2nd</th>
                    <th className="py-2 pr-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {result.patterns.correctionStacking.stackingEvents.map((e) => (
                    <tr key={`${e.firstBolusMs}-${e.secondBolusMs}`} className="text-sm text-gray-900 dark:text-gray-100">
                      <td className="py-2 pr-4 font-medium">
                        {formatDateShort(e.secondBolusMs)} {formatTimeShort(e.secondBolusMs)}
                      </td>
                      <td className="py-2 pr-4">{Math.round(e.deltaMin)} min</td>
                      <td className="py-2 pr-4">
                        {e.firstUnits.toFixed(1)}U → {e.secondUnits.toFixed(1)}U
                      </td>
                      <td className="py-2 pr-4">
                        {typeof e.slopeBeforeSecondMgdlPerHr === 'number' ? `${e.slopeBeforeSecondMgdlPerHr.toFixed(0)} mg/dL/hr` : '—'}
                        {typeof e.glucoseBeforeSecondMgdl === 'number' ? ` • ${e.glucoseBeforeSecondMgdl.toFixed(0)} mg/dL` : ''}
                      </td>
                      <td className="py-2 pr-4">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            This is an informational safety signal to help spot “double corrections” while insulin may still be active, especially when glucose is not rising.
          </p>
        </div>
      )}

      {!result?.schedule.entries?.length ? null : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Basal Schedule (from profile)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Rate (U/h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {result.schedule.entries.map((row) => (
                  <tr key={row.time} className="text-sm text-gray-900 dark:text-gray-100">
                    <td className="py-2 pr-4 font-medium">{row.time}</td>
                    <td className="py-2 pr-4">{row.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasalSanity;
