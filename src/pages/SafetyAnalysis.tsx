import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { Shield, AlertTriangle, CheckCircle, Brain, Activity, TrendingUp, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { aiService } from '../services/aiService';

const SafetyAnalysis = () => {
  const { data, loading, error } = useNightscout();
  const { formatGlucoseValue, getCurrentGlucoseRanges } = useGlucoseFormatting();
  const [safetyAnalysis, setSafetyAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  // Move calculation functions here to access hook
  const calculateTimeInRange = (readings: any[]) => {
    if (!readings.length) return { inRange: 0, high: 0, low: 0 };
    
    const ranges = getCurrentGlucoseRanges();
    let inRange = 0, high = 0, low = 0;
    
    readings.forEach(reading => {
      // reading.sgv is always in mg/dL from Nightscout
      if (reading.sgv >= ranges.TARGET_MIN && reading.sgv <= ranges.TARGET_MAX) {
        inRange++;
      } else if (reading.sgv > ranges.TARGET_MAX) {
        high++;
      } else {
        low++;
      }
    });
    
    const total = readings.length;
    return {
      inRange: (inRange / total) * 100,
      high: (high / total) * 100,
      low: (low / total) * 100
    };
  };

  const calculateVariability = (readings: any[]) => {
    if (!readings.length) return { cv: 0, stdDev: 0 };
    
    const values = readings.map(r => r.sgv);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      cv: (stdDev / mean) * 100,
      stdDev: stdDev // Keep in mg/dL, format on display
    };
  };

  const calculateHypoglycemiaRisk = (readings: any[]) => {
    const ranges = getCurrentGlucoseRanges();
    const lowReadings = readings.filter(r => r.sgv < ranges.TARGET_MIN).length;
    const severelyLowReadings = readings.filter(r => r.sgv < ranges.LOW_THRESHOLD).length; // Use LOW_THRESHOLD for severe hypo
    const total = readings.length;
    
    const lowPercentage = (lowReadings / total) * 100;
    const severePercentage = (severelyLowReadings / total) * 100;
    
    return {
      lowPercentage,
      severePercentage,
      riskScore: lowPercentage + (severePercentage * 3)
    };
  };

  useEffect(() => {
    const analyzeSafety = async () => {
      if (!data?.entries?.length || !data?.treatments?.length) return;
      
      // Only analyze if manual refresh is triggered or we don't have analysis yet
      if (!safetyAnalysis || manualRefresh) {
        setAiLoading(true);
        setAiError(null);
        
        try {
          // Calculate basic safety metrics
          const timeInRange = calculateTimeInRange(data.entries);
          const variability = calculateVariability(data.entries);
          const hypoglycemiaRisk = calculateHypoglycemiaRisk(data.entries);
          
          // Get AI insights if available
          let aiInsights = null;
          try {
            aiInsights = await aiService.analyzeGlucosePatterns(data.entries, {
              timeInRange: timeInRange.inRange,
              highPercentage: timeInRange.high,
              lowPercentage: timeInRange.low
            });
          } catch (err) {
            console.error('AI insights error:', err);
          }
          
          setSafetyAnalysis({
            timeInRange,
            variability,
            hypoglycemiaRisk,
            aiInsights,
            safetyScore: calculateSafetyScore(timeInRange, variability, hypoglycemiaRisk),
            criticalWarnings: generateCriticalWarnings(timeInRange, variability, hypoglycemiaRisk)
          });
          
          // Reset manual refresh flag
          if (manualRefresh) setManualRefresh(false);
        } catch (err) {
          console.error('Safety analysis error:', err);
          setAiError('An error occurred while performing safety analysis.');
        } finally {
          setAiLoading(false);
        }
      }
    };
    
    analyzeSafety();
  }, [data, manualRefresh]);

  const calculateSafetyScore = (timeInRange: any, variability: any, hypoglycemiaRisk: any) => {
    let score = 100;
    
    // Penalize for time below range
    score -= timeInRange.low * 3;
    
    // Penalize for high variability
    if (variability.cv > 40) score -= 20;
    else if (variability.cv > 30) score -= 10;
    
    // Penalize for severe hypoglycemia
    score -= hypoglycemiaRisk.severePercentage * 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const generateCriticalWarnings = (timeInRange: any, variability: any, hypoglycemiaRisk: any) => {
    const warnings = [];
    
    if (timeInRange.low > 4) {
      warnings.push('CRITICAL: Excessive hypoglycemia detected (>4% time below range). Immediate medical consultation required.');
    } else if (timeInRange.low > 2) {
      warnings.push('WARNING: Elevated hypoglycemia risk detected. Consider reducing insulin doses.');
    }
    
    if (variability.cv > 40) {
      warnings.push('HIGH VARIABILITY: Glucose control is unstable. Consider reviewing insulin timing and doses.');
    }
    
    if (hypoglycemiaRisk.severePercentage > 1) {
      warnings.push('SEVERE HYPOGLYCEMIA: Episodes below severe threshold detected. Urgent medical attention required.');
    }
    
    return warnings;
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSafetyScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  // Handle manual refresh
  const handleRefreshAI = () => {
    setManualRefresh(true);
  };

  if (loading || aiLoading) return <LoadingSpinner message={aiLoading ? "Running AI safety analysis..." : "Loading data..."} />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data?.entries?.length) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">No data available for safety analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Safety Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive safety assessment of your diabetes management
          </p>
        </div>
        
        <button 
          onClick={handleRefreshAI}
          className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200 mt-4 sm:mt-0"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh AI Analysis
        </button>
      </div>

      {safetyAnalysis && (
        <>
          {/* Safety Score */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-6">
              <Shield className="h-7 w-7 text-blue-600 dark:text-blue-400 mr-3" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Safety Score</h3>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`text-5xl font-bold ${getSafetyScoreColor(safetyAnalysis.safetyScore)}`}>
                    {safetyAnalysis.safetyScore}
                  </div>
                </div>
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    fill="none" 
                    stroke="#e5e7eb" 
                    strokeWidth="10" 
                    className="dark:opacity-20"
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    fill="none" 
                    stroke={
                      safetyAnalysis.safetyScore >= 80 ? "#10b981" : 
                      safetyAnalysis.safetyScore >= 60 ? "#f59e0b" : 
                      safetyAnalysis.safetyScore >= 40 ? "#f97316" : "#ef4444"
                    }
                    strokeWidth="10" 
                    strokeDasharray="283" 
                    strokeDashoffset={283 - (283 * safetyAnalysis.safetyScore / 100)}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-xl font-medium ${getSafetyScoreColor(safetyAnalysis.safetyScore)}`}>
                  {getSafetyScoreLabel(safetyAnalysis.safetyScore)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Safety Score
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Time in Range</h4>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-800 dark:text-blue-200">In Range:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {safetyAnalysis.timeInRange.inRange.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-800 dark:text-blue-200">Below Range:</span>
                  <span className={`font-medium ${safetyAnalysis.timeInRange.low > 4 ? 'text-red-600 dark:text-red-400' : 'text-blue-900 dark:text-blue-100'}`}>
                    {safetyAnalysis.timeInRange.low.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">Variability</h4>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-800 dark:text-purple-200">CV:</span>
                  <span className={`font-medium ${safetyAnalysis.variability.cv > 36 ? 'text-yellow-600 dark:text-yellow-400' : 'text-purple-900 dark:text-purple-100'}`}>
                    {safetyAnalysis.variability.cv.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-800 dark:text-purple-200">Standard Deviation:</span>
                  <span className="font-medium text-purple-900 dark:text-purple-100">
                    ±{formatGlucoseValue(safetyAnalysis.variability.stdDev)}
                  </span>
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <h4 className="font-medium text-red-900 dark:text-red-100">Hypoglycemia Risk</h4>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-800 dark:text-red-200">Risk Score:</span>
                  <span className={`font-medium ${safetyAnalysis.hypoglycemiaRisk.riskScore > 10 ? 'text-red-600 dark:text-red-400' : 'text-red-900 dark:text-red-100'}`}>
                    {safetyAnalysis.hypoglycemiaRisk.riskScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-800 dark:text-red-200">Severe Episodes:</span>
                  <span className={`font-medium ${safetyAnalysis.hypoglycemiaRisk.severePercentage > 0 ? 'text-red-600 dark:text-red-400' : 'text-red-900 dark:text-red-100'}`}>
                    {(safetyAnalysis.hypoglycemiaRisk.severePercentage * data.entries.length / 100).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Warnings */}
          {safetyAnalysis.criticalWarnings.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
                <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Critical Safety Warnings</h3>
              </div>
              
              <div className="space-y-3">
                {safetyAnalysis.criticalWarnings.map((warning: string, index: number) => (
                  <div key={index} className="bg-red-100 dark:bg-red-800/30 p-3 rounded border-l-4 border-red-500">
                    <p className="text-red-800 dark:text-red-200 text-sm font-medium">{warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {safetyAnalysis.aiInsights && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Safety Insights</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {safetyAnalysis.aiInsights.insights.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">Safety Insights</h4>
                    <ul className="space-y-2">
                      {safetyAnalysis.aiInsights.insights.map((insight: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {safetyAnalysis.aiInsights.recommendations.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Safety Recommendations</h4>
                    <ul className="space-y-2">
                      {safetyAnalysis.aiInsights.recommendations.map((recommendation: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Risk Assessment: 
                    <span className={`ml-1 font-medium ${
                      safetyAnalysis.aiInsights.riskAssessment === 'low' ? 'text-green-600 dark:text-green-400' :
                      safetyAnalysis.aiInsights.riskAssessment === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {safetyAnalysis.aiInsights.riskAssessment.charAt(0).toUpperCase() + safetyAnalysis.aiInsights.riskAssessment.slice(1)}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    AI Confidence: {safetyAnalysis.aiInsights.confidence}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Safety Recommendations */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Safety Recommendations</h3>
            
            <div className="space-y-4">
              {safetyAnalysis.timeInRange.low > 4 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
                  <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Hypoglycemia Prevention</h4>
                  <p className="text-red-800 dark:text-red-200 text-sm">
                    Your time below range is concerning at {safetyAnalysis.timeInRange.low.toFixed(1)}%. Consider:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-800 dark:text-red-200">
                    <li>• Reducing basal insulin by 10-20%</li>
                    <li>• Increasing carb ratios (less insulin per carb)</li>
                    <li>• Reviewing insulin timing, especially for exercise</li>
                    <li>• Consulting with your healthcare provider immediately</li>
                  </ul>
                </div>
              )}
              
              {safetyAnalysis.variability.cv > 36 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-500">
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Reduce Variability</h4>
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    Your glucose variability (CV: {safetyAnalysis.variability.cv.toFixed(1)}%) is above the target of 36%. Consider:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                    <li>• More consistent meal timing and composition</li>
                    <li>• Pre-bolusing 15-20 minutes before meals</li>
                    <li>• Reviewing insulin sensitivity factors</li>
                    <li>• Addressing stress and sleep factors</li>
                  </ul>
                </div>
              )}
              
              {safetyAnalysis.timeInRange.inRange < 70 && safetyAnalysis.timeInRange.high > 25 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                  <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">Reduce Hyperglycemia</h4>
                  <p className="text-orange-800 dark:text-orange-200 text-sm">
                    Your time above range is {safetyAnalysis.timeInRange.high.toFixed(1)}%. Consider:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-orange-800 dark:text-orange-200">
                    <li>• Reviewing insulin-to-carb ratios</li>
                    <li>• Checking for insulin degradation or site issues</li>
                    <li>• Ensuring accurate carb counting</li>
                    <li>• Discussing basal rate adjustments with your provider</li>
                  </ul>
                </div>
              )}
              
              {safetyAnalysis.safetyScore >= 80 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Excellent Safety Profile</h4>
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    Your diabetes management shows a strong safety profile. Continue your current approach and:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
                    <li>• Maintain your current management strategies</li>
                    <li>• Continue regular monitoring and data review</li>
                    <li>• Share your success with your healthcare team</li>
                    <li>• Consider fine-tuning to further optimize if desired</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Safety Disclaimer */}
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-gray-600 dark:text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Safety Disclaimer</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              This safety analysis is provided for informational purposes only and does not constitute medical advice. 
              Always consult with your healthcare provider before making changes to your diabetes management. 
              The analysis is based on the data available in your Nightscout site and may not reflect your complete 
              medical history or current health status.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default SafetyAnalysis;