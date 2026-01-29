import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cookie, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getEntryMs, getTreatmentMs } from '../utils/nightscoutTime';
import { computeMealAbsorption } from '../services/mealAbsorptionService';

const MealAbsorption = () => {
  const { data, loading, error, fetchDataForDays, analysisPeriod } = useNightscout();
  const { unit, formatGlucoseValue } = useGlucoseFormatting();

  const [manualRefresh, setManualRefresh] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof computeMealAbsorption> | null>(null);
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
    runSafeAsync(() => fetchDataForDays(Math.max(analysisPeriod, 7)), { label: 'MealAbsorption initial fetch' });
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
          const r = computeMealAbsorption({
            entries: filteredEntries,
            treatments: filteredTreatments,
            rangeStartMs: selectedRange.startMs,
            rangeEndMs: selectedRange.endMs
          });
          setResult(r);

          if (!hasInitialLoad) setHasInitialLoad(true);
          if (manualRefresh) setManualRefresh(false);
        } catch (e) {
          console.error('Meal absorption failed:', e);
          setAnalysisError('An error occurred while computing meal absorption.');
        } finally {
          setAnalyzing(false);
        }
      }
    };

    perform();
  }, [data, filteredEntries, filteredTreatments, hasInitialLoad, manualRefresh, selectedRange.endMs, selectedRange.startMs]);

  const fmtMinutes = (v?: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return `${Math.round(v)} min`;
  };

  const fmtMaybe = (v?: number, decimals: number = 0) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return v.toFixed(decimals);
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

  const overall = result?.summary.overall;
  const speed = result?.profile?.bySpeed;
  const recommendedTau = result?.profile?.recommendedTauMin;

  const applyRecommendedProfile = () => {
    if (typeof recommendedTau !== 'number' || !Number.isFinite(recommendedTau)) return;
    try {
      localStorage.setItem('mealAbsorptionTauMin', String(Math.round(recommendedTau)));
      window.dispatchEvent(new Event('mealAbsorptionProfileUpdated'));
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <Cookie className="h-6 w-6 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meal Absorption</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Estimates time-to-peak and settling time from “clean” meals (informational only).
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
            This page does not provide dosing advice. Meal absorption varies by food, fat/protein, activity, insulin timing, and site.
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Details</h3>
          <button onClick={() => setShowDetails((v) => !v)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {showDetails ? 'Hide' : 'Show'}
          </button>
        </div>

        {showDetails && (
          <div className="mt-3 space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Clean meal filtering rules</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Include treatments with carbs ≥ 10g.</li>
                <li>Baseline = median CGM in the 15 minutes before the meal time.</li>
                <li>Require enough CGM coverage: at least 12 readings in the next 6 hours.</li>
                <li>Exclude if additional carbs ≥ 10g occur from +15m to +3h (snacks/second meals).</li>
                <li>Exclude if another bolus ≥ 0.2U occurs from +30m to +3h (corrections/stacking).</li>
                <li>Exclude if any temp basal occurs from −30m to +4h (to reduce confounding).</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Metrics</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Peak = max CGM value in the first 4 hours after the meal.</li>
                <li>Time-to-peak = minutes from meal time to the peak.</li>
                <li>Settling time = first time ≥60 minutes after the meal where CGM is ≤ baseline + 20 mg/dL and trending down/flat.</li>
                <li>AUC above baseline = approximate area under the curve above baseline over 6 hours (mg/dL·min).</li>
                <li>“Hypo in 6h” flags any CGM reading &lt;70 mg/dL in the 6-hour window.</li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Note: glucose is displayed in your selected unit ({unit === 'mmol' ? 'mmol/L' : 'mg/dL'}).
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Time Range</h3>
          <button onClick={() => setShowCalendar((v) => !v)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {showCalendar ? 'Hide' : 'Custom range'}
          </button>
        </div>

        {!showCalendar && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Using last {analysisPeriod} days (from Settings).</p>
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
              <button onClick={() => setIsCustomRange(true)} className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Clean meals</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {result ? `${result.totals.cleanMeals}/${result.totals.mealCandidates}` : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Median time-to-peak</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtMinutes(overall?.medianTimeToPeakMin)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Median settling time</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtMinutes(overall?.medianSettleTimeMin)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Hypo rate (6h)</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {typeof overall?.hypoRate === 'number' ? `${Math.round(overall.hypoRate * 100)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Absorption speed (estimated)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Uses “clean” meals; τ is fitted from post-peak decay (when possible).</p>
          </div>
          <button
            onClick={applyRecommendedProfile}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg disabled:opacity-50"
            disabled={typeof recommendedTau !== 'number' || !Number.isFinite(recommendedTau)}
          >
            Use for predictions
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Recommended τ</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{typeof recommendedTau === 'number' ? `${Math.round(recommendedTau)} min` : '—'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Fast</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{speed ? speed.fast.n : '—'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Medium</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{speed ? speed.medium.n : '—'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Slow</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{speed ? speed.slow.n : '—'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent qualifying meals</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Carbs</th>
                <th className="py-2 pr-4">Speed</th>
                <th className="py-2 pr-4">Pre</th>
                <th className="py-2 pr-4">Peak</th>
                <th className="py-2 pr-4">ΔPeak</th>
                <th className="py-2 pr-4">TTP</th>
                <th className="py-2 pr-4">τ</th>
                <th className="py-2 pr-4">Settle</th>
                <th className="py-2 pr-4">AUC</th>
                <th className="py-2">Hypo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(result?.samples || []).map((s) => (
                <tr key={s.tMs} className="text-sm text-gray-900 dark:text-gray-100">
                  <td className="py-2 pr-4 font-medium">{new Date(s.tMs).toLocaleString()}</td>
                  <td className="py-2 pr-4">{Math.round(s.carbs)} g</td>
                  <td className="py-2 pr-4">{s.speedClass ? s.speedClass : '—'}</td>
                  <td className="py-2 pr-4">{typeof s.pre === 'number' ? formatGlucoseValue(unit === 'mmol' ? s.pre / 18 : s.pre, unit) : '—'}</td>
                  <td className="py-2 pr-4">{typeof s.peak === 'number' ? formatGlucoseValue(unit === 'mmol' ? s.peak / 18 : s.peak, unit) : '—'}</td>
                  <td className="py-2 pr-4">
                    {typeof s.deltaPeak === 'number'
                      ? formatGlucoseValue(unit === 'mmol' ? s.deltaPeak / 18 : s.deltaPeak, unit)
                      : '—'}
                  </td>
                  <td className="py-2 pr-4">{fmtMinutes(s.timeToPeakMin)}</td>
                  <td className="py-2 pr-4">{typeof s.tauFitMin === 'number' ? `${Math.round(s.tauFitMin)} min` : '—'}</td>
                  <td className="py-2 pr-4">{fmtMinutes(s.settleTimeMin)}</td>
                  <td className="py-2 pr-4">{fmtMaybe(s.aucAbovePreMgdlMin, 0)}</td>
                  <td className="py-2">{s.hadHypo6h ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Tip: If you often snack or correct within 3 hours, few meals will qualify (by design).
        </p>
      </div>
    </div>
  );
};

export default MealAbsorption;
