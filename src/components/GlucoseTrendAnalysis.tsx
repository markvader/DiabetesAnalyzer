import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight, AlertTriangle, Target, Activity } from 'lucide-react';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import type { NightscoutEntry } from '../types/nightscout';
import { getEntryMs } from '../utils/nightscoutTime';

interface GlucoseTrendAnalysisProps {
  readings: NightscoutEntry[];
  windowMinutes?: number;
}

const GlucoseTrendAnalysis: React.FC<GlucoseTrendAnalysisProps> = ({ 
  readings, 
  windowMinutes = 30 
}) => {
  const { formatGlucoseValue, getCurrentGlucoseRanges } = useGlucoseFormatting();
  const ranges = getCurrentGlucoseRanges();

  // Calculate trend metrics
  const getRecentReadings = () => {
    if (!readings || readings.length < 2) return [];
    const cutoffMs = Date.now() - windowMinutes * 60 * 1000;
    
    return readings
      .filter(reading => getEntryMs(reading) >= cutoffMs)
      .sort((a, b) => getEntryMs(a) - getEntryMs(b));
  };

  const recentReadings = getRecentReadings();
  const currentGlucose = readings?.[readings.length - 1]?.sgv || 0;
  
  // Calculate rate of change
  const calculateRateOfChange = () => {
    if (recentReadings.length < 2) return 0;
    
    const latest = recentReadings[recentReadings.length - 1];
    const previous = recentReadings[recentReadings.length - 2];
    
    const timeDiff = (getEntryMs(latest) - getEntryMs(previous)) / (1000 * 60); // minutes
    
    if (timeDiff === 0) return 0;
    
    return (latest.sgv - previous.sgv) / timeDiff; // units per minute
  };

  const rateOfChange = calculateRateOfChange();
  const ratePerHour = rateOfChange * 60;

  // Calculate velocity trend (acceleration/deceleration)
  const calculateVelocityTrend = () => {
    if (recentReadings.length < 3) return 0;
    
    const rates = [];
    for (let i = 1; i < recentReadings.length; i++) {
      const current = recentReadings[i];
      const previous = recentReadings[i - 1];
      const timeDiff = (getEntryMs(current) - getEntryMs(previous)) / (1000 * 60);
      
      if (timeDiff > 0) {
        rates.push((current.sgv - previous.sgv) / timeDiff);
      }
    }
    
    if (rates.length < 2) return 0;
    
    // Calculate acceleration (change in rate)
    const recentRate = rates[rates.length - 1];
    const previousRate = rates[rates.length - 2];
    
    return recentRate - previousRate;
  };

  const velocityTrend = calculateVelocityTrend();

  // Determine trend direction and severity
  const getTrendDirection = () => {
    const absRate = Math.abs(rateOfChange);
    
    if (absRate < 0.5 / 60) return 'stable'; // Less than 0.5 mg/dL per minute
    if (rateOfChange > 0) return 'rising';
    return 'falling';
  };

  const getTrendSeverity = () => {
    const absRatePerHour = Math.abs(ratePerHour);
    
    if (absRatePerHour < 15) return 'mild';
    if (absRatePerHour < 30) return 'moderate';
    if (absRatePerHour < 60) return 'significant';
    return 'rapid';
  };

  const trendDirection = getTrendDirection();
  const trendSeverity = getTrendSeverity();

  // Calculate predictions
  const predict30Min = currentGlucose + (rateOfChange * 30);
  const predict60Min = currentGlucose + (rateOfChange * 60);

  // Risk assessment
  const getRiskLevel = () => {
    const willBelow70 = predict30Min < 70 || predict60Min < 70;
    const willAbove250 = predict30Min > 250 || predict60Min > 250;
    const rapidChange = Math.abs(ratePerHour) > 60;
    
    if (willBelow70 || willAbove250 || rapidChange) return 'high';
    if (predict30Min < 80 || predict30Min > 200) return 'moderate';
    return 'low';
  };

  const riskLevel = getRiskLevel();

  // Get trend icon and color
  const getTrendIcon = () => {
    switch (trendDirection) {
      case 'rising':
        return <TrendingUp className="w-5 h-5" />;
      case 'falling':
        return <TrendingDown className="w-5 h-5" />;
      default:
        return <ArrowRight className="w-5 h-5" />;
    }
  };

  const getTrendColor = () => {
    switch (trendDirection) {
      case 'rising':
        return currentGlucose > ranges.TARGET_MAX 
          ? 'text-red-600 dark:text-red-400' 
          : 'text-orange-600 dark:text-orange-400';
      case 'falling':
        return currentGlucose < ranges.TARGET_MIN 
          ? 'text-red-600 dark:text-red-400' 
          : 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'moderate':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      default:
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Trend Analysis
        </h3>
        <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </div>

      {/* Current Trend */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Direction</span>
          <div className={`flex items-center space-x-2 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="font-medium capitalize">
              {trendDirection} ({trendSeverity})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Rate of Change</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {ratePerHour > 0 ? '+' : ''}{formatGlucoseValue(Math.round(ratePerHour))}/hr
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Acceleration</span>
          <span className={`font-medium ${
            Math.abs(velocityTrend) < 0.1 ? 'text-gray-600 dark:text-gray-400' :
            velocityTrend > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
          }`}>
            {Math.abs(velocityTrend) < 0.1 ? 'Steady' :
             velocityTrend > 0 ? 'Accelerating' : 'Decelerating'}
          </span>
        </div>
      </div>

      {/* Predictions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Predictions</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">30 min</div>
            <div className={`text-lg font-bold ${
              predict30Min >= ranges.TARGET_MIN && predict30Min <= ranges.TARGET_MAX
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatGlucoseValue(Math.round(predict30Min))}
            </div>
          </div>
          
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">60 min</div>
            <div className={`text-lg font-bold ${
              predict60Min >= ranges.TARGET_MIN && predict60Min <= ranges.TARGET_MAX
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatGlucoseValue(Math.round(predict60Min))}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className={`p-3 rounded-lg ${getRiskColor()}`}>
        <div className="flex items-center space-x-2 mb-1">
          {riskLevel === 'high' && <AlertTriangle className="w-4 h-4" />}
          {riskLevel === 'low' && <Target className="w-4 h-4" />}
          <span className="font-medium text-sm">
            {riskLevel === 'high' && 'High Risk Detected'}
            {riskLevel === 'moderate' && 'Moderate Risk'}
            {riskLevel === 'low' && 'Low Risk'}
          </span>
        </div>
        <p className="text-xs">
          {riskLevel === 'high' && 'Rapid change or extreme values predicted. Monitor closely.'}
          {riskLevel === 'moderate' && 'Values may move outside target range. Stay alert.'}
          {riskLevel === 'low' && 'Current trend appears stable and within acceptable range.'}
        </p>
      </div>

      {/* Data Quality Indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span>Based on {recentReadings.length} readings</span>
        <span>{windowMinutes}min window</span>
      </div>
    </div>
  );
};

export default GlucoseTrendAnalysis;
