import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import PredictionChart from '../components/PredictionChart';
import LoadingSpinner from '../components/LoadingSpinner';
import { Brain, Info, Cpu, Activity } from 'lucide-react';

const Predictions = () => {
  const { data, loading, error } = useNightscout();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled } = useTensorFlow();
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check if any API key is available
  useEffect(() => {
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');
    
    setHasApiKey(!!(openaiKey || deepseekKey || anthropicKey));
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Glucose Predictions</h2>
          {tensorFlowEnabled && (
            <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              tensorFlowReady 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
            }`}>
              <Cpu className="w-3 h-3 mr-1" />
              {tensorFlowReady ? 'TensorFlow Ready' : 'TensorFlow Loading...'}
            </div>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {hasApiKey || (tensorFlowEnabled && tensorFlowReady)
            ? "AI-powered glucose predictions with advanced algorithms" 
            : "Machine learning based glucose predictions"}
        </p>
      </div>

      {data?.entries && (
        <div className="space-y-6">
          <PredictionChart 
            readings={data.entries} 
            useAI={hasApiKey || (tensorFlowEnabled && tensorFlowReady)}
          />
          
          {!hasApiKey && !(tensorFlowEnabled && tensorFlowReady) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">Enhanced Predictions Available</h3>
                  <p className="text-blue-800 dark:text-blue-200 mb-3">
                    You're currently using basic prediction algorithms. For more accurate and personalized predictions, 
                    {tensorFlowEnabled 
                      ? " TensorFlow is loading or enable an AI provider API key in Settings." 
                      : " enable TensorFlow or configure an AI provider API key in the Settings page."
                    }
                  </p>
                  <a 
                    href="/settings" 
                    className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Configure AI Settings
                  </a>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">About Predictions</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              This chart shows predicted glucose values for the next 3 hours based on your historical data patterns.
              {hasApiKey || (tensorFlowEnabled && tensorFlowReady)
                ? " Predictions are generated using advanced AI algorithms that analyze your unique glucose patterns."
                : " Predictions are generated using machine learning analysis of your glucose trends."}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Note:</strong> These predictions are estimates and should be used as a guide only. 
              Always monitor your glucose levels regularly and follow your healthcare provider's advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Predictions;