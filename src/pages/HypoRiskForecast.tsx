import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNightscout } from '../contexts/NightscoutContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { computeHypoRiskForecast, type HypoRiskForecast } from '../services/hypoRiskForecastService';
import { runSafeAsync } from '../utils/safeAsync';

const percent = (p: number) => `${Math.round(p * 100)}%`;

const formatMinutes = (m: number | null) => {
  if (m === null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} h` : `${h} h ${mm} min`;
};

const formatPeakLabel = (peak: { minute: number; probability: number } | null) => {
  if (!peak) return '—';
  return `${percent(peak.probability)} at ${formatMinutes(peak.minute)}`;
};

const Sparkline: React.FC<{ series: number[]; className: string }> = ({ series, className }) => {
  const w = 520;
  const h = 90;
  const pad = 6;

  const points = series
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
      const y = pad + (1 - Math.max(0, Math.min(1, v))) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <polyline fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} className={className} />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
    </svg>
  );
};

const HypoRiskForecastPage = () => {
  const { data, loading, error } = useNightscout();
  const { unit, getCurrentGlucoseRanges, formatGlucoseValue, toMgdlValue } = useGlucoseFormatting();

  const formatWhyText = (text: string): string => {
    if (unit !== 'mmol') return text;

    const mgdlToMmol = (v: number) => v / 18;
    const fmt = (vMgdl: number, decimals: number) => {
      const v = mgdlToMmol(vMgdl);
      // Avoid printing -0.0
      const rounded = Number(v.toFixed(decimals));
      return (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
    };

    // Convert more specific patterns first to avoid double conversion.
    let out = text;

    out = out.replace(/(-?\d+(?:\.\d+)?)\s*mg\/dL\s*per\s*5\s*min/gi, (_m, n) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return _m;
      return `${fmt(v, 1)} mmol/L per 5 min`;
    });

    out = out.replace(/(-?\d+(?:\.\d+)?)\s*mg\/dL\s*[·\*]\s*min/gi, (_m, n) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return _m;
      return `${fmt(v, 1)} mmol/L·min`;
    });

    out = out.replace(/(-?\d+(?:\.\d+)?)\s*mg\/dL/gi, (_m, n) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return _m;
      return `${fmt(v, 1)} mmol/L`;
    });

    return out;
  };

  const ranges = getCurrentGlucoseRanges();

  const [forecast, setForecast] = useState<HypoRiskForecast | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Forecast math runs in mg/dL (Nightscout entries are mg/dL). Convert thresholds if UI is in mmol/L.
  const thresholdsMgdl = useMemo(() => {
    const lowMgdl = unit === 'mgdl' ? ranges.TARGET_MIN : toMgdlValue(ranges.TARGET_MIN);
    const severeMgdl = unit === 'mgdl' ? ranges.LOW_THRESHOLD : toMgdlValue(ranges.LOW_THRESHOLD);
    return { low: lowMgdl, severeLow: severeMgdl };
  }, [ranges.LOW_THRESHOLD, ranges.TARGET_MIN, toMgdlValue, unit]);

  useEffect(() => {
    if (!data?.entries?.length) {
      setForecast(null);
      return;
    }

    runSafeAsync(async () => {
      setCalcLoading(true);
      setCalcError(null);
      try {
        const res = await computeHypoRiskForecast({
          entries: data.entries,
          treatments: data.treatments ?? [],
          deviceStatus: data.deviceStatus ?? [],
          profile: data.profile ?? [],
          thresholds: thresholdsMgdl,
          horizonHours: 6,
          intervalMinutes: 5
        });
        setForecast(res);
      } catch (e) {
        setForecast(null);
        setCalcError(e instanceof Error ? e.message : 'Failed to compute hypo risk forecast');
      } finally {
        setCalcLoading(false);
      }
    });
  }, [data?.deviceStatus, data?.entries, data?.profile, data?.treatments, thresholdsMgdl, refreshNonce]);

  if (loading) return <LoadingSpinner message="Loading Nightscout data..." />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-700">
        <div className="flex items-center mb-2">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Unable to load data</h2>
        </div>
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <ShieldCheck className="h-7 w-7 mr-2 text-blue-600 dark:text-blue-400" />
            Hypo Risk Forecast
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Probabilistic low-risk forecast for the next 2–6 hours based on recent CGM trends and prediction uncertainty.
          </p>
        </div>

        <button
          onClick={() => setRefreshNonce((n) => n + 1)}
          className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          title="Recompute forecast"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${calcLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <p className="text-sm text-yellow-900 dark:text-yellow-100">
          This feature is informational and not medical advice. If you have symptoms of hypoglycemia or urgent concerns, follow your care plan.
        </p>
      </div>

      {calcError && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
          <p className="text-sm text-red-800 dark:text-red-200">{calcError}</p>
        </div>
      )}

      {!data?.entries?.length && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-700 dark:text-gray-300">No glucose entries were found for forecasting.</p>
        </div>
      )}

      {(data?.entries?.length ?? 0) > 0 && !forecast && !calcLoading && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-700 dark:text-gray-300">
            Insufficient recent CGM data to produce a reliable forecast. Try a larger time range or check data quality.
          </p>
        </div>
      )}

      {calcLoading && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <LoadingSpinner message="Computing forecast..." />
        </div>
      )}

      {forecast && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Low Risk (next 2h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxLow2h)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Below {formatGlucoseValue(thresholdsMgdl.low, 'mgdl', true)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Low Risk (next 6h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxLow6h)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Below {formatGlucoseValue(thresholdsMgdl.low, 'mgdl', true)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Severe Low Risk (next 2h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxSevereLow2h)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Below {formatGlucoseValue(thresholdsMgdl.severeLow, 'mgdl', true)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Earliest Elevated Risk</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatMinutes(forecast.summary.earliestLowMinute)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                First time $P(low) \\ge {Math.round(forecast.triggers.elevatedLowProbability * 100)}\\%$
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Probability Sparkline (next 6h)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Low risk (below {formatGlucoseValue(thresholdsMgdl.low, 'mgdl', true)})
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">max {percent(forecast.summary.maxLow6h)}</p>
                </div>
                <Sparkline series={forecast.probabilitySeries.low} className="stroke-blue-600 dark:stroke-blue-400" />
              </div>

              <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Severe low risk (below {formatGlucoseValue(thresholdsMgdl.severeLow, 'mgdl', true)})
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">max {percent(forecast.summary.maxSevereLow6h)}</p>
                </div>
                <Sparkline series={forecast.probabilitySeries.severeLow} className="stroke-red-600 dark:stroke-red-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Elevated risk triggers: low ≥ {Math.round(forecast.triggers.elevatedLowProbability * 100)}%, severe ≥ {Math.round(forecast.triggers.elevatedSevereLowProbability * 100)}%.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Why this risk?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Inputs: IOB {forecast.inputs.iobUnits !== null ? `${forecast.inputs.iobUnits.toFixed(1)}U (${forecast.inputs.inputSource.iob})` : '—'} • COB{' '}
              {forecast.inputs.cobGrams !== null ? `${forecast.inputs.cobGrams.toFixed(0)}g (${forecast.inputs.inputSource.cob})` : '—'} • SD{' '}
              {forecast.inputs.recentSdMgdl !== null ? `${formatGlucoseValue(forecast.inputs.recentSdMgdl, 'mgdl', true)} (~3h)` : '—'}
            </p>

            {forecast.whyDrivers?.top3.low?.length ? (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Top drivers at peak low risk ({formatPeakLabel(forecast.whyDrivers.peak.low)})
                </p>
                <ul className="mt-2 space-y-2">
                  {forecast.whyDrivers.top3.low.map((x) => (
                    <li key={x.id} className="text-sm text-gray-700 dark:text-gray-300">
                      • {x.detail ? `${formatWhyText(x.label)} — ${formatWhyText(x.detail)}` : formatWhyText(x.label)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {forecast.whyDrivers?.top3.severeLow?.length ? (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Top drivers at peak severe-low risk ({formatPeakLabel(forecast.whyDrivers.peak.severeLow)})
                </p>
                <ul className="mt-2 space-y-2">
                  {forecast.whyDrivers.top3.severeLow.map((x) => (
                    <li key={x.id} className="text-sm text-gray-700 dark:text-gray-300">
                      • {x.detail ? `${formatWhyText(x.label)} — ${formatWhyText(x.detail)}` : formatWhyText(x.label)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(forecast.whyFactors?.length ?? 0) === 0 && forecast.explainers.length === 0 ? (
              <p className="text-gray-700 dark:text-gray-300">No strong risk drivers detected from recent data.</p>
            ) : (
              <ul className="space-y-2">
                {(forecast.whyFactors?.length
                  ? forecast.whyFactors
                  : forecast.explainers.map((x) => ({ id: x, severity: 'info' as const, label: x, detail: undefined })))
                  .slice(0, 12)
                  .map((x) => (
                    <li key={x.id} className="text-sm text-gray-700 dark:text-gray-300">
                      • {x.detail ? `${formatWhyText(x.label)} — ${formatWhyText(x.detail)}` : formatWhyText(x.label)}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Probability Over Time</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Horizon
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Max $P(low)$
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Max $P(severe)$
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      First severe risk
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">2 hours</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxLow2h)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxSevereLow2h)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{formatMinutes(forecast.summary.earliestSevereLowMinute)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">6 hours</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxLow6h)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{percent(forecast.summary.maxSevereLow6h)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{formatMinutes(forecast.summary.earliestSevereLowMinute)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HypoRiskForecastPage;
