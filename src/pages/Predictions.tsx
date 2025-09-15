import { useState, useEffect, useCallback } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import AdvancedPredictionChart from '../components/AdvancedPredictionChart';
import NightscoutDataDisplay from '../components/NightscoutDataDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import { Brain, Info, Cpu } from 'lucide-react';
import { 
  nightscoutTreatmentParser, 
  type ParsedNightscoutData 
} from '../services/nightscoutTreatmentParser';

const Predictions = () => {
  const { data, loading, error } = useNightscout();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled } = useTensorFlow();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [parsedNightscoutData, setParsedNightscoutData] = useState<ParsedNightscoutData | null>(null);

  // Check if any API key is available
  useEffect(() => {
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    
    setHasApiKey(!!(openaiKey || deepseekKey || anthropicKey || geminiKey));
  }, []);

  const handleNightscoutDataParsed = useCallback((parsedData: ParsedNightscoutData) => {
    setParsedNightscoutData(parsedData);
    setRefreshKey(prev => prev + 1);
  }, []);

  // Generate prediction context from Nightscout data
  const getDefaultTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const predictionContext = parsedNightscoutData ? {
    recentMeals: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentMeals || [] : [],
    recentInsulin: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentInsulin || [] : [],
    recentExercise: parsedNightscoutData ? nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).recentExercise || [] : [],
    timeOfDay: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).timeOfDay || getDefaultTimeOfDay(),
    dayOfWeek: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    isWeekend: nightscoutTreatmentParser.generatePredictionContext(parsedNightscoutData).isWeekend ?? [0, 6].includes(new Date().getDay()),
  } : undefined;

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Advanced Glucose Predictions</h2>
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
          {hasApiKey && (
            <div className="flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              <Brain className="w-3 h-3 mr-1" />
              AI Enhanced
            </div>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered glucose predictions using your Nightscout treatment data for maximum accuracy
        </p>
      </div>

      {data?.entries && (
        <div className="space-y-6">
          {/* Nightscout Data Display */}
          <NightscoutDataDisplay 
            onDataParsed={handleNightscoutDataParsed}
            hoursBack={12}
          />
          
          {/* Advanced Prediction Chart */}
          <AdvancedPredictionChart 
            key={refreshKey}
            readings={data.entries} 
            useAI={hasApiKey || (tensorFlowEnabled && tensorFlowReady)}
            context={predictionContext}
          />
          
          {!hasApiKey && !(tensorFlowEnabled && tensorFlowReady) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">Enhanced AI Predictions Available</h3>
                  <p className="text-blue-800 dark:text-blue-200 mb-3">
                    You're currently using advanced prediction algorithms with your Nightscout data. For even more accurate and personalized predictions with comprehensive AI analysis, 
                    {tensorFlowEnabled 
                      ? " enable TensorFlow or configure an AI provider API key in Settings." 
                      : " enable TensorFlow or configure an AI provider API key (OpenAI, Gemini, DeepSeek, or Anthropic) in the Settings page."
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">About Nightscout-Enhanced Predictions</h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p>
                This advanced prediction system automatically analyzes your Nightscout treatment data to provide highly personalized glucose forecasts for up to 6 hours ahead.
                {hasApiKey || (tensorFlowEnabled && tensorFlowReady)
                  ? " AI-powered predictions use your complete treatment history including meals, insulin doses, SMBs, temp basals, and exercise data."
                  : " Advanced mathematical models incorporate all your treatment data for improved accuracy."}
              </p>
              <p>
                <strong>Automatically Detected from Nightscout:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Meal Boluses:</strong> Combined insulin + carb treatments</li>
                <li><strong>Correction Boluses:</strong> Insulin-only treatments</li>
                <li><strong>Carb Corrections:</strong> Carb-only treatments and announcements</li>
                <li><strong>SMBs (Super Micro Boluses):</strong> Automated micro-dosing</li>
                <li><strong>Temporary Basals:</strong> Rate changes and durations</li>
                <li><strong>Exercise Sessions:</strong> Activity logs with intensity and duration</li>
                <li><strong>Treatment Notes:</strong> Additional context from your entries</li>
              </ul>
              <p>
                <strong>Enhanced Prediction Features:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Meal absorption modeling based on carb content and timing</li>
                <li>Insulin action curves for bolus and basal insulin</li>
                <li>Exercise impact analysis with delayed hypoglycemia detection</li>
                <li>SMB and temp basal effects on glucose trends</li>
                <li>Risk assessment with severity-based alerting</li>
                <li>Time-in-range predictions for better glucose management</li>
                <li>Contextual recommendations based on your treatment patterns</li>
              </ul>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700 mt-4">
                <p className="text-sm">
                  <strong>Automated Integration:</strong> No manual data entry required! All treatment data is automatically 
                  synchronized from your Nightscout instance, ensuring predictions are based on your complete diabetes management history.
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700 mt-4">
                <p className="text-sm">
                  <strong>Important:</strong> These are advanced predictions for informational and educational purposes only. 
                  Always monitor your glucose levels regularly and follow your healthcare provider's advice. 
                  Actual glucose values may vary significantly from predictions based on many unpredictable factors.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Predictions;