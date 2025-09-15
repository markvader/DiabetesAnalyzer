import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Brain, Target, Clock, Activity } from 'lucide-react';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface PredictionInsightsPanelProps {
  readings: any[];
  predictionData?: any;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  confidence?: number;
  timeInRange?: number;
  recentTrends?: {
    direction: 'rising' | 'falling' | 'stable';
    rate: number;
    prediction1h: number;
    prediction3h: number;
  };
}

const PredictionInsightsPanel: React.FC<PredictionInsightsPanelProps> = ({
  readings,
  predictionData,
  riskLevel = 'low',
  confidence = 85,
  timeInRange = 70,
  recentTrends
}) => {
  const { formatGlucoseValue, getCurrentGlucoseRanges } = useGlucoseFormatting();
  const ranges = getCurrentGlucoseRanges();

  // Calculate current glucose and trend
  const currentGlucose = readings?.[readings.length - 1]?.sgv || 0;
  const previousGlucose = readings?.[readings.length - 2]?.sgv || currentGlucose;
  const glucoseDelta = currentGlucose - previousGlucose;
  const deltaRate = glucoseDelta > 0 ? '+' : '';

  // Determine trend direction
  const getTrendIcon = () => {
    if (Math.abs(glucoseDelta) < 5) return <Activity className="w-4 h-4" />;
    return glucoseDelta > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (Math.abs(glucoseDelta) < 5) return 'text-blue-600 dark:text-blue-400';
    return glucoseDelta > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  };

  // Risk level styling
  const getRiskStyling = () => {
    switch (riskLevel) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
          icon: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />,
          text: 'text-red-700 dark:text-red-300'
        };
      case 'high':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
          icon: <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
          text: 'text-orange-700 dark:text-orange-300'
        };
      case 'moderate':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
          text: 'text-yellow-700 dark:text-yellow-300'
        };
      default:
        return {
          bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
          icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
          text: 'text-green-700 dark:text-green-300'
        };
    }
  };

  const riskStyling = getRiskStyling();
  const isInRange = currentGlucose >= ranges.TARGET_MIN && currentGlucose <= ranges.TARGET_MAX;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Prediction Insights
        </h3>
        <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>

      {/* Current Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current</span>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatGlucoseValue(currentGlucose)}
            </span>
            <div className={`flex items-center ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-sm ml-1">
                {deltaRate}{formatGlucoseValue(Math.abs(glucoseDelta))}
              </span>
            </div>
          </div>
        </div>

        {/* Range Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Range Status</span>
          <div className="flex items-center space-x-2">
            <Target className={`w-4 h-4 ${isInRange ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            <span className={`text-sm font-medium ${isInRange ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {isInRange ? 'In Range' : 'Out of Range'}
            </span>
          </div>
        </div>

        {/* Time in Range */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Time in Range</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {timeInRange}%
          </span>
        </div>

        {/* Prediction Confidence */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Confidence</span>
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full" 
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className={`p-3 rounded-lg border ${riskStyling.bg}`}>
        <div className="flex items-center space-x-2 mb-2">
          {riskStyling.icon}
          <span className={`font-medium ${riskStyling.text}`}>
            Risk Level: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
          </span>
        </div>
        <p className={`text-sm ${riskStyling.text}`}>
          {riskLevel === 'critical' && 'Immediate attention required. Monitor closely and consider intervention.'}
          {riskLevel === 'high' && 'Elevated risk detected. Consider preventive measures.'}
          {riskLevel === 'moderate' && 'Moderate risk. Continue monitoring and follow care plan.'}
          {riskLevel === 'low' && 'Low risk detected. Current management appears effective.'}
        </p>
      </div>

      {/* Predictions */}
      {recentTrends && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Forecasts</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">1 hour:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatGlucoseValue(recentTrends.prediction1h)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">3 hours:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatGlucoseValue(recentTrends.prediction3h)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {readings?.length || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Readings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Math.round((readings?.filter(r => r.sgv >= ranges.TARGET_MIN && r.sgv <= ranges.TARGET_MAX).length || 0) / (readings?.length || 1) * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">In Range</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionInsightsPanel;
