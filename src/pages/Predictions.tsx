import { useState, useEffect, useCallback } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import AdvancedPredictionChart from '../components/AdvancedPredictionChart';
import NightscoutDataDisplay from '../components/NightscoutDataDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import { Brain, Info, Cpu, Sparkles, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  nightscoutTreatmentParser, 
  type ParsedNightscoutData 
} from '../services/nightscoutTreatmentParser';

const Predictions = () => {
  const { data, loading, error } = useNightscout();
  const { isReady: tensorFlowReady, isEnabled: tensorFlowEnabled } = useTensorFlow();
  const { isPremium } = useDesignMode();
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Premium Enhanced Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={`border-b pb-4 ${
          isPremium 
            ? 'border-gradient-to-r from-purple-200 via-pink-200 to-blue-200 dark:from-purple-800 dark:via-pink-800 dark:to-blue-800'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`${isPremium ? 'animate-pulse' : ''}`}>
            <Sparkles className={`w-8 h-8 ${isPremium ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${
            isPremium 
              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            Advanced Glucose Predictions
          </h2>
          {tensorFlowEnabled && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                tensorFlowReady 
                  ? isPremium
                    ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-700 dark:text-blue-300 shadow-lg'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : isPremium
                    ? 'bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 text-yellow-700 dark:text-yellow-300 shadow-lg'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              }`}
            >
              <Cpu className="w-3 h-3 mr-1" />
              {tensorFlowReady ? 'TensorFlow Ready' : 'TensorFlow Loading...'}
            </motion.div>
          )}
          {hasApiKey && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isPremium
                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 shadow-lg'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              <Brain className="w-3 h-3 mr-1" />
              AI Enhanced
            </motion.div>
          )}
        </div>
        <p className={`${
          isPremium 
            ? 'text-gray-700 dark:text-gray-300 font-medium'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {isPremium ? '✨ ' : ''}AI-powered glucose predictions using your Nightscout treatment data for maximum accuracy
        </p>
      </motion.div>

      {data?.entries && (
        <div className="space-y-6">
          {/* Nightscout Data Display with Premium animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <NightscoutDataDisplay 
              onDataParsed={handleNightscoutDataParsed}
              hoursBack={12}
            />
          </motion.div>
          
          {/* Advanced Prediction Chart with Premium animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <AdvancedPredictionChart 
              key={refreshKey}
              readings={data.entries} 
              useAI={hasApiKey || (tensorFlowEnabled && tensorFlowReady)}
              context={predictionContext}
            />
          </motion.div>
          
          {!hasApiKey && !(tensorFlowEnabled && tensorFlowReady) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className={`p-6 rounded-lg border ${
                isPremium
                  ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border-blue-300 dark:border-blue-600 shadow-lg'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              }`}
            >
              <div className="flex items-start">
                <Info className={`h-5 w-5 mt-0.5 mr-3 flex-shrink-0 ${
                  isPremium 
                    ? 'text-blue-700 dark:text-blue-300 animate-pulse' 
                    : 'text-blue-600 dark:text-blue-400'
                }`} />
                <div>
                  <h3 className={`text-lg font-medium mb-2 ${
                    isPremium
                      ? 'bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent'
                      : 'text-blue-900 dark:text-blue-100'
                  }`}>
                    Enhanced AI Predictions Available
                  </h3>
                  <p className={`mb-3 ${
                    isPremium
                      ? 'text-blue-900 dark:text-blue-100 font-medium'
                      : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    You're currently using advanced prediction algorithms with your Nightscout data. For even more accurate and personalized predictions with comprehensive AI analysis, 
                    {tensorFlowEnabled 
                      ? " enable TensorFlow or configure an AI provider API key in Settings." 
                      : " enable TensorFlow or configure an AI provider API key (OpenAI, Gemini, DeepSeek, or Anthropic) in the Settings page."
                    }
                  </p>
                  <a 
                    href="/settings" 
                    className={`inline-flex items-center px-4 py-2 rounded transition-all duration-200 ${
                      isPremium
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                    }`}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Configure AI Settings
                  </a>
                </div>
              </div>
            </motion.div>
          )}
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className={`p-6 rounded-lg shadow-md ${
              isPremium
                ? 'bg-gradient-to-br from-white via-purple-50 to-pink-50 dark:from-gray-800 dark:via-purple-900/10 dark:to-pink-900/10 border border-purple-200 dark:border-purple-800'
                : 'bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {isPremium && <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
              <h3 className={`text-lg font-medium ${
                isPremium
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                About Nightscout-Enhanced Predictions
              </h3>
            </div>
            <div className={`space-y-3 ${
              isPremium
                ? 'text-gray-800 dark:text-gray-200'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
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
              <div className={`p-4 rounded-lg border mt-4 ${
                isPremium
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-600'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
              }`}>
                <p className="text-sm">
                  <strong>Important:</strong> These are advanced predictions for informational and educational purposes only. 
                  Always monitor your glucose levels regularly and follow your healthcare provider's advice. 
                  Actual glucose values may vary significantly from predictions based on many unpredictable factors.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Predictions;