import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { computeIsfCrTuning } from '../services/isfCrTuningService';

const ISFCRTuning = () => {
  const { data, loading, error, fetchDataForDays, analysisPeriod } = useNightscout();
  const { unit, getUnitLabel } = useGlucoseFormatting();

  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof computeIsfCrTuning> | null>(null);
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
    runSafeAsync(() => fetchDataForDays(Math.max(analysisPeriod, 7)), { label: 'ISF/CR Tuning initial fetch' });
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
      if (!filteredEntries.length || !filteredTreatments.length) return;

      if (!hasInitialLoad || manualRefresh) {
        setAnalyzing(true);
        setAnalysisError(null);

        try {
          const r = computeIsfCrTuning({
            entries: filteredEntries,
            treatments: filteredTreatments,
            profiles: data.profile || []
          });
          setResult(r);

          if (!hasInitialLoad) setHasInitialLoad(true);
          if (manualRefresh) setManualRefresh(false);
        } catch (e) {
          console.error('ISF/CR tuning failed:', e);
          setAnalysisError('An error occurred while computing ISF/CR tuning.');
        } finally {
          setAnalyzing(false);
        }
      }
    };

    perform();
  }, [data, filteredEntries, filteredTreatments, hasInitialLoad, manualRefresh]);

  const isfUnitLabel = unit === 'mmol' ? `${getUnitLabel()}/U` : 'mg/dL/U';

  const renderNumber = (v?: number, decimals: number = 0) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return v.toFixed(decimals);
  };

  const renderISF = (mgdlPerU?: number) => {
    if (typeof mgdlPerU !== 'number' || !Number.isFinite(mgdlPerU)) return '—';
    if (unit === 'mmol') return (mgdlPerU / 18).toFixed(1);
    return mgdlPerU.toFixed(0);
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
            <SlidersHorizontal className="h-6 w-6 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ISF/CR Tuning</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Evidence-based estimates from clean corrections and meal outcomes (informational only).
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
            This page does not provide dosing advice. Any profile changes should be confirmed with your care team and made gradually (e.g. 5–10%).
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
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">“Clean correction” rules (for ISF)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Include boluses with insulin ≥ 0.2U and no carbs on the treatment.</li>
                <li>Exclude temp basal/rate changes (duration &gt; 0, rate/absolute set).</li>
                <li>Require a pre-reading within 10 minutes of the bolus time.</li>
                <li>Require a post-reading around +3h (within ±35 minutes).</li>
                <li>Exclude if any carbs ≥ 5g occur from −30m to +3h (meal interference).</li>
                <li>Exclude if another insulin bolus ≥ 0.2U occurs from +15m to +3h (stacking).</li>
                <li>Require glucose drop ≥ 10 mg/dL; discard extreme ISF outliers (5–300 mg/dL/U).</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">“Clean meal” rules (for CR)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Include meal boluses with carbs ≥ 5g and insulin ≥ 0.2U.</li>
                <li>Exclude temp basal/rate changes (duration &gt; 0, rate/absolute set).</li>
                <li>Require a pre-reading within 15 minutes of the meal time.</li>
                <li>Require a +2h reading (within ±35 minutes) to estimate the 2-hour rise.</li>
                <li>Exclude if additional carbs ≥ 5g occur from +15m to +2h (snacks/second meals).</li>
                <li>Exclude if another insulin bolus ≥ 0.2U occurs from +30m to +2h (corrections/stacking).</li>
                <li>Discard extreme ratio outliers (1–80 g/U). Mark “hypo within 4h” if any reading &lt; 70 mg/dL in the next 4h.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">When suggestions appear</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>ISF suggestions require enough clean corrections and reasonably tight uncertainty; suggested ISF is capped to ±10% vs current.</li>
                <li>CR suggestions require enough clean meals and a consistent pattern (large rise without hypos → slightly more insulin; lows → slightly less insulin), capped to ±10% vs current.</li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Note: all calculations use mg/dL internally. If you use mmol/L, the table converts ISF values for display.
              </p>
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

      {result?.warnings?.length ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <ul className="list-disc pl-5 text-sm text-blue-900 dark:text-blue-100 space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Coverage</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clean corrections: {result?.totals.cleanCorrections ?? 0} / {result?.totals.correctionCandidates ?? 0}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clean meals: {result?.totals.cleanMeals ?? 0} / {result?.totals.mealCandidates ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Units</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">ISF: {isfUnitLabel}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">CR: g/U</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">ISF (from clean corrections)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Current</th>
                <th className="py-2 pr-4">Observed median</th>
                <th className="py-2 pr-4">95% CI</th>
                <th className="py-2 pr-4">N</th>
                <th className="py-2 pr-4">Suggested</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(result?.segments.isf || []).map((row) => (
                <tr key={row.time} className="text-sm text-gray-900 dark:text-gray-100">
                  <td className="py-2 pr-4 font-medium">{row.time}</td>
                  <td className="py-2 pr-4">{renderISF(row.currentISF)}</td>
                  <td className="py-2 pr-4">{renderISF(row.medianISF)}</td>
                  <td className="py-2 pr-4">
                    {typeof row.ciLow === 'number' && typeof row.ciHigh === 'number'
                      ? `${renderISF(row.ciLow)}–${renderISF(row.ciHigh)}`
                      : '—'}
                  </td>
                  <td className="py-2 pr-4">{row.n}</td>
                  <td className="py-2 pr-4">{renderISF(row.suggestedISF)}</td>
                  <td className="py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {row.notes.length ? row.notes.join(' ') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Carb Ratio (from meal outcomes)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Current (g/U)</th>
                <th className="py-2 pr-4">Median used (g/U)</th>
                <th className="py-2 pr-4">Median 2h rise</th>
                <th className="py-2 pr-4">Hypo rate (≤4h)</th>
                <th className="py-2 pr-4">Suggested (g/U)</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(result?.segments.cr || []).map((row) => (
                <tr key={row.time} className="text-sm text-gray-900 dark:text-gray-100">
                  <td className="py-2 pr-4 font-medium">{row.time}</td>
                  <td className="py-2 pr-4">{renderNumber(row.currentCR, 1)}</td>
                  <td className="py-2 pr-4">{renderNumber(row.medianRatioUsed, 1)}</td>
                  <td className="py-2 pr-4">{renderNumber(row.medianRise2h, 0)} mg/dL</td>
                  <td className="py-2 pr-4">
                    {typeof row.hypoRate === 'number' ? `${Math.round(row.hypoRate * 100)}%` : '—'}
                  </td>
                  <td className="py-2 pr-4">{renderNumber(row.suggestedCR, 1)}</td>
                  <td className="py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {row.notes.length ? row.notes.join(' ') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Meal heuristic uses 2-hour rise and 4-hour hypo detection; suggestions are capped and only shown when patterns are consistent.
        </p>
      </div>
    </div>
  );
};

export default ISFCRTuning;
