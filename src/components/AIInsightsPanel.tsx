import React, { useState, useEffect, useRef } from 'react';
import { Brain, Lightbulb, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface AIInsightsPanelProps {
  readings: any[];
  timeInRange: {
    timeInRange: number;
    highPercentage: number;
    lowPercentage: number;
  };
  manualRefresh?: boolean;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ readings, timeInRange, manualRefresh = false }) => {
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string>('');
  const initialLoadDone = useRef<boolean>(false);

  useEffect(() => {
    // Create a hash of the current data to compare - with safe number handling
    const safeTimeInRange = typeof timeInRange.timeInRange === 'number' ? timeInRange.timeInRange.toFixed(1) : '0.0';
    const safeHighPercentage = typeof timeInRange.highPercentage === 'number' ? timeInRange.highPercentage.toFixed(1) : '0.0';
    const safeLowPercentage = typeof timeInRange.lowPercentage === 'number' ? timeInRange.lowPercentage.toFixed(1) : '0.0';
    const dataHash = `${readings.length}-${safeTimeInRange}-${safeHighPercentage}-${safeLowPercentage}`;
    
    // Debug logging to catch any objects
    if (typeof timeInRange.timeInRange !== 'number' || typeof timeInRange.highPercentage !== 'number' || typeof timeInRange.lowPercentage !== 'number') {
      console.error('❌ AIInsightsPanel received non-number timeInRange values:', {
        timeInRange: { value: timeInRange.timeInRange, type: typeof timeInRange.timeInRange },
        highPercentage: { value: timeInRange.highPercentage, type: typeof timeInRange.highPercentage },
        lowPercentage: { value: timeInRange.lowPercentage, type: typeof timeInRange.lowPercentage }
      });
    }
    
    // Only fetch insights if:
    // 1. We haven't loaded anything yet, OR
    // 2. Manual refresh was requested, OR
    // 3. The data has changed AND we don't have any insights yet
    const shouldFetch = 
      !initialLoadDone.current || 
      manualRefresh || 
      (dataHash !== lastAnalyzedData && insights.length === 0);
    
    if (shouldFetch && readings && readings.length > 0) {
      fetchInsights(dataHash);
    }
  }, [readings, timeInRange, manualRefresh]);

  const fetchInsights = async (dataHash: string) => {
    if (!readings || readings.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiService.analyzeGlucosePatterns(readings, timeInRange, { unit, formatGlucoseValue, getUnitLabel });
      
      if (result) {
        setInsights(result.insights);
        setRecommendations(result.recommendations);
        setRiskAssessment(result.riskAssessment);
        setConfidence(result.confidence);
        setLastAnalyzedData(dataHash);
        initialLoadDone.current = true;
      } else {
        setError('Unable to generate AI insights at this time.');
      }
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setError('An error occurred while analyzing your data.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = () => {
    switch (riskAssessment) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your glucose patterns...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Our AI is processing your data to provide personalized insights</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Please try again later or check your API configuration.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0 && recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="flex items-center">
          <span className={`text-sm font-medium ${getRiskColor()}`}>
            {riskAssessment ? riskAssessment.charAt(0).toUpperCase() + riskAssessment.slice(1) : 'Unknown'} Risk
          </span>
          <span className="mx-2 text-gray-400">|</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {confidence}% Confidence
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
              <h4 className="font-medium text-purple-900 dark:text-purple-100">Pattern Insights</h4>
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {recommendations.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          These insights are generated by AI based on your glucose data. Always consult with your healthcare provider before making changes to your diabetes management.
        </p>
      </div>
    </div>
  );
};

export default AIInsightsPanel;