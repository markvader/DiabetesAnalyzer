import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import type { GlucoseEventInsights } from '../services/glucoseEventInsightsService';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface GlucoseEventInsightsPanelProps {
  insights: GlucoseEventInsights;
  focus: 'openaps' | 'carb' | 'isf' | 'basal';
  title?: string;
}

const GlucoseEventInsightsPanel: React.FC<GlucoseEventInsightsPanelProps> = ({ insights, focus, title }) => {
  const { formatGlucoseValue } = useGlucoseFormatting();

  const focusRecommendations =
    focus === 'openaps'
      ? insights.recommendations.smb
      : focus === 'carb'
        ? insights.recommendations.carbRatio
        : focus === 'isf'
          ? insights.recommendations.isf
          : insights.recommendations.basal;

  const primaryHypoHour = insights.topHypoHours[0];
  const primaryHyperHour = insights.topHyperHours[0];

  const sectionTitle = title ?? 'Advanced Event Intelligence';

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{sectionTitle}</h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">Confidence {insights.aiSummary.confidence}%</span>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300">{insights.aiSummary.headline}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3">
          <div className="text-xs text-red-700 dark:text-red-300">Hypo events</div>
          <div className="text-xl font-semibold text-red-800 dark:text-red-200">{insights.eventCounts.hypo}</div>
        </div>
        <div className="rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-900/20 p-3">
          <div className="text-xs text-orange-700 dark:text-orange-300">Hyper events</div>
          <div className="text-xl font-semibold text-orange-800 dark:text-orange-200">{insights.eventCounts.hyper}</div>
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-3">
          <div className="text-xs text-blue-700 dark:text-blue-300">Avg glucose</div>
          <div className="text-xl font-semibold text-blue-800 dark:text-blue-200">
            {formatGlucoseValue(insights.metrics.avgGlucoseMgdl, 'mgdl', false)}
          </div>
        </div>
        <div className="rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20 p-3">
          <div className="text-xs text-green-700 dark:text-green-300">TIR</div>
          <div className="text-xl font-semibold text-green-800 dark:text-green-200">{insights.metrics.timeInRangePct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Low-risk hotspot
          </div>
          <p className="mt-1 text-gray-700 dark:text-gray-300">
            {primaryHypoHour
              ? `${primaryHypoHour.hour.toString().padStart(2, '0')}:00-${primaryHypoHour.hour
                  .toString()
                  .padStart(2, '0')}:59 · low ${primaryHypoHour.lowPct.toFixed(1)}% · ${primaryHypoHour.hypoEvents} events`
              : 'No dominant low-event hour detected.'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            High-risk hotspot
          </div>
          <p className="mt-1 text-gray-700 dark:text-gray-300">
            {primaryHyperHour
              ? `${primaryHyperHour.hour.toString().padStart(2, '0')}:00-${primaryHyperHour.hour
                  .toString()
                  .padStart(2, '0')}:59 · high ${primaryHyperHour.highPct.toFixed(1)}% · ${primaryHyperHour.hyperEvents} events`
              : 'No dominant high-event hour detected.'}
          </p>
        </div>
      </div>

      {(insights.safetyAlerts.length > 0 || focusRecommendations.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.safetyAlerts.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-center gap-2 font-medium text-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                Safety alerts
              </div>
              <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
                {insights.safetyAlerts.slice(0, 3).map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {focusRecommendations.length > 0 && (
            <div className="rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/20 p-3">
              <div className="font-medium text-purple-900 dark:text-purple-100">Targeted recommendations</div>
              <ul className="mt-2 space-y-1 text-sm text-purple-800 dark:text-purple-200">
                {focusRecommendations.slice(0, 3).map((recommendation, index) => (
                  <li key={index}>• {recommendation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlucoseEventInsightsPanel;
