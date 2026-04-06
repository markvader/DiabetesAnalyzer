import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Brain, Lightbulb, CheckCircle, AlertTriangle, Loader, Cpu, Activity } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useDesignMode } from '../contexts/DesignModeContext';
import { buildInsightsFingerprint } from '../utils/analysisFingerprint';
import type { NightscoutEntry } from '../types/nightscout';

interface EnhancedAIInsightsPanelProps {
  readings: NightscoutEntry[];
  timeInRange?: {
    timeInRange: number;
    highPercentage: number;
    lowPercentage: number;
  };
  manualRefresh?: boolean;
}

const EnhancedAIInsightsPanel: React.FC<EnhancedAIInsightsPanelProps> = ({ 
  readings, 
  timeInRange, 
  manualRefresh = false 
}) => {
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled, error: tensorFlowError } = useTensorFlow();
  const { isPremium } = useDesignMode();
  
  // Defensive check for timeInRange prop (memoized so effects don't fire every render)
  const safeTimeInRange = useMemo(() => {
    return timeInRange || {
      timeInRange: 0,
      highPercentage: 0,
      lowPercentage: 0
    };
  }, [timeInRange]);
  
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisProvider, setAnalysisProvider] = useState<string>('');
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string>('');
  const initialLoadDone = useRef<boolean>(false);

  const fetchInsights = useCallback(async (dataHash: string) => {
    if (!readings || readings.length === 0) return;

    setLoading(true);
    setError(null);
    setAnalysisProvider('');

    try {
      console.log('🎯 Enhanced AI Insights - Starting analysis...');

      const result = await aiService.analyzeGlucosePatterns(readings, safeTimeInRange, {
        unit,
        formatGlucoseValue,
        getUnitLabel
      });

      if (result) {
        setInsights(result.insights || []);
        setRecommendations(result.recommendations || []);
        setRiskAssessment(result.riskAssessment || 'medium');
        setConfidence(result.confidence || 70);
        setLastAnalyzedData(dataHash);
        initialLoadDone.current = true;

        // Determine which provider was used
        if (tensorFlowEnabled && tensorFlowReady) {
          setAnalysisProvider('TensorFlow');
        } else {
          // Check if any external API was used
          const apiKeys = {
            openai: !!localStorage.getItem('openai_api_key'),
            deepseek: !!localStorage.getItem('deepseek_api_key'),
            anthropic: !!localStorage.getItem('anthropic_api_key')
          };

          if (apiKeys.openai) setAnalysisProvider('OpenAI');
          else if (apiKeys.deepseek) setAnalysisProvider('DeepSeek');
          else if (apiKeys.anthropic) setAnalysisProvider('Anthropic');
          else setAnalysisProvider('Basic Analysis');
        }

        console.log('✅ Enhanced AI Insights - Analysis complete');
      } else {
        setError('Unable to generate AI insights at this time.');
        console.log('❌ Enhanced AI Insights - No result returned');
      }
    } catch (err) {
      console.error('❌ Enhanced AI Insights - Error:', err);
      setError('An error occurred while analyzing your data.');
    } finally {
      setLoading(false);
    }
  }, [formatGlucoseValue, getUnitLabel, readings, safeTimeInRange, tensorFlowEnabled, tensorFlowReady, unit]);

  useEffect(() => {
    const dataHash = buildInsightsFingerprint(readings, safeTimeInRange);
    
    // Debug logging to catch any objects
    if (typeof safeTimeInRange.timeInRange !== 'number' || typeof safeTimeInRange.highPercentage !== 'number' || typeof safeTimeInRange.lowPercentage !== 'number') {
      console.error('❌ EnhancedAIInsightsPanel received non-number timeInRange values:', {
        timeInRange: { value: safeTimeInRange.timeInRange, type: typeof safeTimeInRange.timeInRange },
        highPercentage: { value: safeTimeInRange.highPercentage, type: typeof safeTimeInRange.highPercentage },
        lowPercentage: { value: safeTimeInRange.lowPercentage, type: typeof safeTimeInRange.lowPercentage }
      });
    }
    
    // Only fetch insights if:
    // 1. We haven't loaded anything yet, OR
    // 2. Manual refresh was requested, OR
    // 3. The data has changed AND we don't have any insights yet
    const shouldFetch = 
      !initialLoadDone.current ||
      manualRefresh ||
      dataHash !== lastAnalyzedData;
    
    if (shouldFetch && readings && readings.length > 0) {
      fetchInsights(dataHash);
    }
  }, [fetchInsights, lastAnalyzedData, manualRefresh, readings, safeTimeInRange]);

  const getRiskColor = () => {
    switch (riskAssessment) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProviderIcon = () => {
    switch (analysisProvider) {
      case 'TensorFlow':
        return <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'OpenAI':
      case 'DeepSeek':
      case 'Anthropic':
        return <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Brain className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div
        className={
          isPremium
            ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
            : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200'
        }
      >
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
          {tensorFlowEnabled && tensorFlowReady && (
            <div className="ml-2 flex items-center bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
              <Cpu className="h-3 w-3 text-blue-600 dark:text-blue-400 mr-1" />
              <span className="text-xs text-blue-700 dark:text-blue-300">TensorFlow</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your glucose patterns...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {tensorFlowEnabled && tensorFlowReady 
              ? 'Using TensorFlow AI for fast, private analysis' 
              : 'Processing your data with advanced AI algorithms'
            }
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={
          isPremium
            ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
            : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200'
        }
      >
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
                Please try again later or check your configuration in Settings.
              </p>
              {tensorFlowError && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  TensorFlow Error: {tensorFlowError}
                </p>
              )}
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
    <div
      className={
        isPremium
          ? 'bg-white/60 dark:bg-dark-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 dark:border-white/10'
          : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200'
      }
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
          {analysisProvider && (
            <div
              className={
                isPremium
                  ? 'ml-3 flex items-center bg-white/40 dark:bg-white/5 backdrop-blur px-2 py-1 rounded-full border border-white/20 dark:border-white/10'
                  : 'ml-3 flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full'
              }
            >
              {getProviderIcon()}
              <span className="text-xs text-gray-700 dark:text-gray-300 ml-1">
                {analysisProvider}
              </span>
            </div>
          )}
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
          <div
            className={
              isPremium
                ? 'bg-gradient-to-br from-white/70 to-purple-50/40 dark:from-purple-900/25 dark:to-dark-900/10 p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm'
                : 'bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg'
            }
          >
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
          <div
            className={
              isPremium
                ? 'bg-gradient-to-br from-white/70 to-blue-50/40 dark:from-blue-900/25 dark:to-dark-900/10 p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm'
                : 'bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg'
            }
          >
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
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <p>
            These insights are generated by AI based on your glucose data. Always consult with your healthcare provider before making changes to your diabetes management.
          </p>
          {tensorFlowEnabled && tensorFlowReady && (
            <div className="ml-4 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span className="text-green-700 dark:text-green-300">Private & Fast</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedAIInsightsPanel;
