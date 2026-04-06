import React, { useState, useEffect, useMemo } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { useDashboardDisplay } from '../contexts/DashboardDisplayContext';
import { useTimeInRange } from '../contexts/TimeInRangeContext';
import {
  getPumpsByCategory,
  getPumpPlatformCompatibility,
  getPumpsByTherapyAlgorithm,
  isPumpCompatibleWithTherapyAlgorithm,
  type CompatibilityLevel,
  type TherapyAlgorithm,
  type InsulinPumpProfile
} from '../constants/insulinPumps';
import { 
  getModelsByCategory, 
  getModelsByProvider,
  getModelById, 
  getCheapestEstimatedModel,
  getCheapestEstimatedModelByProvider,
  getLatestPricingAsOf,
  getPricingAgeDays,
  calculateEstimatedCost, 
  formatCostEstimate, 
  DEFAULT_OPENAI_MODEL,
  DEFAULT_MODEL,
  DIABETES_ANALYSIS_TOKENS,
} from '../constants/openaiModels';
import { testConnection } from '../services/nightscoutService';
import { AlertTriangle, CheckCircle, Key, Shield, ExternalLink, Info, RefreshCw, Gauge, Activity, Clock, Target, DollarSign, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { aiService } from '../services/aiService';
import TimeInRangeSettings from '../components/TimeInRangeSettings';
import { runSafeAsync } from '../utils/safeAsync';
import { formatNightscoutErrorForUser } from '../utils/nightscoutErrors';

const Settings = () => {
  const { 
    url, 
    token, 
    setUrl, 
    setToken, 
    lastFetchTime, 
    fetchDataForDays, 
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshInterval,
    setAutoRefreshInterval,
    detectedApiVersion,
    setDetectedApiVersion,
    analysisPeriod,
    setAnalysisPeriod
  } = useNightscout();
  
  const { unit, setUnit, getUnitLabel } = useGlucoseUnits();
  const {
    selectedTherapyAlgorithm,
    setSelectedTherapyAlgorithm,
    selectedPumpId,
    selectedPump,
    setSelectedPumpId
  } = useInsulinPump();
  const { timeFormat, setTimeFormat, formatTime, formatDateTime } = useTimeFormat();
  const { 
    isReady: tensorFlowReady, 
    isEnabled: tensorFlowContextEnabled, 
    isInitializing: _tensorFlowInitializing,
    error: _tensorFlowError,
    toggleEnabled: toggleTensorFlow,
    reinitialize: _reinitializeTensorFlow
  } = useTensorFlow();
  const { showDeviceStatus, setShowDeviceStatus } = useDashboardDisplay();
  const { 
    settings: _timeInRangeSettings, 
    updateSettings: _updateTimeInRangeSettings, 
    resetToDefaults: resetTimeInRangeToDefaults,
    getSettingsInUnit,
    setSettingsFromUnit: _setSettingsFromUnit
  } = useTimeInRange();
  const [newUrl, setNewUrl] = useState(url);
  const [newToken, setNewToken] = useState(token);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [openaiTestError, setOpenaiTestError] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    openai: boolean | null;
    gemini: boolean | null;
    deepseek: boolean | null;
    anthropic: boolean | null;
    tensorflow: boolean | null;
  }>({
    openai: null,
    gemini: null,
    deepseek: null,
    anthropic: null,
    tensorflow: null
  });
  const [testingApiKeys, setTestingApiKeys] = useState(false);
  
  // API Key states
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState(localStorage.getItem('openai_selected_model') || DEFAULT_OPENAI_MODEL);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('selected_model') || DEFAULT_MODEL);
  const [deepseekKey, setDeepseekKey] = useState(localStorage.getItem('deepseek_api_key') || '');
  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('anthropic_api_key') || '');

  const [lastActualCost, setLastActualCost] = useState<null | {
    provider: string;
    model: string;
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens?: number };
    costUSD: number | null;
    at: number;
  }>(null);
  
  // TensorFlow settings - removing old state since we use context now
  // const [tensorFlowEnabled, setTensorFlowEnabledState] = useState(() => {
  //   const stored = localStorage.getItem('tensorflow_enabled');
  //   return stored === null ? true : stored === 'true';
  // });
  
  // Auto-refresh settings
  const [newAutoRefreshEnabled, setNewAutoRefreshEnabled] = useState(autoRefreshEnabled);
  const [newAutoRefreshInterval, setNewAutoRefreshInterval] = useState(autoRefreshInterval);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('last_ai_cost');
      if (!raw) {
        setLastActualCost(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        setLastActualCost(null);
        return;
      }
      setLastActualCost(parsed);
    } catch {
      setLastActualCost(null);
    }
  }, [selectedModel]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!newUrl) {
      setMessage({
        text: 'Please enter a valid Nightscout URL',
        type: 'error'
      });
      return;
    }
    
    try {
      setUrl(newUrl);
      setToken(newToken);
      setAutoRefreshEnabled(newAutoRefreshEnabled);
      setAutoRefreshInterval(newAutoRefreshInterval);
      
      setMessage({
        text: 'Settings saved successfully',
        type: 'success'
      });
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
      
    } catch (_error) {
      setMessage({
        text: 'An error occurred while saving settings',
        type: 'error'
      });
    }
  };
  
  const handleFetchData = () => {
    runSafeAsync(() => fetchDataForDays(analysisPeriod), { label: 'Settings fetch data' });
    setMessage({
      text: 'Fetching data...',
      type: 'success'
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    
    try {
      const result = await testConnection(newUrl, newToken, detectedApiVersion || 'v1');
      
      // Store the detected API version
      if (result.apiVersion) {
        setDetectedApiVersion(result.apiVersion as 'v1' | 'v3');
      }
      
      setMessage({
        text: `Successfully connected to Nightscout using API ${result.apiVersion}! Your URL and token are valid.`,
        type: 'success'
      });
    } catch (error) {
      setMessage({
        text: formatNightscoutErrorForUser(error, {
          url: newUrl,
          apiVersion: detectedApiVersion || 'v1'
        }),
        type: 'error'
      });
    } finally {
      setTesting(false);
    }
  };

  const testApiKeys = async () => {
    setTestingApiKeys(true);
    try {
      const results = await aiService.testAPIKeys();

      try {
        setOpenaiTestError(localStorage.getItem('openai_test_error') || '');
      } catch {
        setOpenaiTestError('');
      }

      setApiKeyStatus({
        openai: results.openai,
        gemini: results.gemini,
        deepseek: results.deepseek,
        anthropic: results.anthropic,
        tensorflow: results.tensorflow || false
      });
    } catch (error) {
      console.error('Error testing API keys:', error);
    } finally {
      setTestingApiKeys(false);
    }
  };

  const handleTensorFlowToggle = async (enabled: boolean) => {
    try {
      await toggleTensorFlow(enabled);
      
      // Update status immediately
      setApiKeyStatus(prev => ({
        ...prev,
        tensorflow: enabled && tensorFlowReady
      }));
      
      setMessage({ 
        text: enabled ? 'TensorFlow AI enabled' : 'TensorFlow AI disabled', 
        type: 'success' 
      });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling TensorFlow:', error);
      setMessage({ 
        text: 'Error updating TensorFlow settings', 
        type: 'error' 
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  useEffect(() => {
    // Test API keys on component mount
    runSafeAsync(() => testApiKeys(), { label: 'Settings: testApiKeys (mount)' });
  }, []);

  // Sync form state with context values
  useEffect(() => {
    setNewUrl(url);
    setNewToken(token);
  }, [url, token]);

  // Sync auto-refresh settings with context values
  useEffect(() => {
    setNewAutoRefreshEnabled(autoRefreshEnabled);
    setNewAutoRefreshInterval(autoRefreshInterval);
  }, [autoRefreshEnabled, autoRefreshInterval]);
  
  const saveApiKeys = () => {
    // Save API keys to localStorage
    if (openaiKey) {
      localStorage.setItem('openai_api_key', openaiKey);
      // Also update environment variable
      window.VITE_OPENAI_API_KEY = openaiKey;
    } else {
      localStorage.removeItem('openai_api_key');
    }
    
    // Save selected OpenAI model
    localStorage.setItem('openai_selected_model', selectedOpenAIModel);
    
    // Save Gemini API key
    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
      // Also update environment variable
      window.VITE_GEMINI_API_KEY = geminiKey;
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    
    // Save selected model (general)
    localStorage.setItem('selected_model', selectedModel);
    
    if (deepseekKey) {
      localStorage.setItem('deepseek_api_key', deepseekKey);
      // Also update environment variable
      window.VITE_DEEPSEEK_API_KEY = deepseekKey;
    } else {
      localStorage.removeItem('deepseek_api_key');
    }
    
    if (anthropicKey) {
      localStorage.setItem('anthropic_api_key', anthropicKey);
      // Also update environment variable
      window.VITE_ANTHROPIC_API_KEY = anthropicKey;
    } else {
      localStorage.removeItem('anthropic_api_key');
    }
    
    // Refresh AI service providers to use new settings
    aiService.refreshProviders();
    
    setMessage({
      text: 'API keys and model selection saved successfully. Changes applied immediately.',
      type: 'success'
    });
    
    // Test the keys
    testApiKeys();
  };

  const selectedModelInfo = getModelById(selectedModel);
  const selectedModelEstimatedCost = selectedModelInfo
    ? calculateEstimatedCost(selectedModelInfo, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output)
    : null;

  const connectedProviders: Array<'openai' | 'google' | 'anthropic' | 'deepseek'> = [
    ...(openaiKey ? ['openai' as const] : []),
    ...(geminiKey ? ['google' as const] : []),
    ...(anthropicKey ? ['anthropic' as const] : []),
    ...(deepseekKey ? ['deepseek' as const] : [])
  ];

  const providerDisplayName: Record<'openai' | 'google' | 'anthropic' | 'deepseek', string> = {
    openai: 'OpenAI',
    google: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    deepseek: 'DeepSeek'
  };

  const cheapestByConnectedProviders = connectedProviders
    .map(provider => {
      const model = getCheapestEstimatedModelByProvider(
        provider,
        DIABETES_ANALYSIS_TOKENS.input,
        DIABETES_ANALYSIS_TOKENS.output
      );
      return {
        provider,
        model,
        cost: model
          ? calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output)
          : null
      };
    })
    .filter(item => item.model && item.cost != null);

  const bestConnectedProviderOption = cheapestByConnectedProviders.reduce<null | {
    provider: 'openai' | 'google' | 'anthropic' | 'deepseek';
    modelId: string;
    modelName: string;
    cost: number;
  }>((best, current) => {
    if (!current.model || current.cost == null) return best;
    if (!best || current.cost < best.cost) {
      return {
        provider: current.provider,
        modelId: current.model.id,
        modelName: current.model.name,
        cost: current.cost
      };
    }
    return best;
  }, null);

  const cheapestOverallModel = getCheapestEstimatedModel(
    DIABETES_ANALYSIS_TOKENS.input,
    DIABETES_ANALYSIS_TOKENS.output
  );
  const cheapestOverallCost = cheapestOverallModel
    ? calculateEstimatedCost(cheapestOverallModel, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output)
    : null;

  const latestPricingAsOf = getLatestPricingAsOf();
  const pricingAgeDays = getPricingAgeDays(latestPricingAsOf);
  const pricingFreshnessLabel =
    pricingAgeDays == null
      ? 'Unknown'
      : pricingAgeDays <= 14
        ? 'Fresh'
        : pricingAgeDays <= 45
          ? 'Aging'
          : 'Stale';
  const pricingFreshnessClasses =
    pricingFreshnessLabel === 'Fresh'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      : pricingFreshnessLabel === 'Aging'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';

  const platformLabel: Record<TherapyAlgorithm, string> = {
    aaps: 'AndroidAPS (AAPS)',
    loop: 'Loop for iOS'
  };

  const compatibilityBadgeClasses: Record<CompatibilityLevel, string> = {
    supported: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    experimental: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'not-supported': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  };

  const compatibilityLabel: Record<CompatibilityLevel, string> = {
    supported: 'Supported',
    experimental: 'Experimental',
    'not-supported': 'Not Supported'
  };

  const platformCompatiblePumps = useMemo(
    () => getPumpsByTherapyAlgorithm(selectedTherapyAlgorithm),
    [selectedTherapyAlgorithm]
  );

  const groupedPlatformPumps = useMemo(() => {
    const allPumps = getPumpsByCategory('tubeless')
      .concat(getPumpsByCategory('tubed'))
      .concat(getPumpsByCategory('diy'));

    const buckets: Record<CompatibilityLevel, InsulinPumpProfile[]> = {
      supported: [],
      experimental: [],
      'not-supported': []
    };

    allPumps.forEach((pump) => {
      const compatibility = getPumpPlatformCompatibility(pump.id);
      buckets[compatibility[selectedTherapyAlgorithm]].push(pump);
    });

    return buckets;
  }, [selectedTherapyAlgorithm]);

  const selectedPumpCompatibility = selectedPump ? getPumpPlatformCompatibility(selectedPump.id) : null;

  const handleTherapyAlgorithmChange = (algorithm: TherapyAlgorithm) => {
    setSelectedTherapyAlgorithm(algorithm);

    if (!isPumpCompatibleWithTherapyAlgorithm(selectedPumpId, algorithm)) {
      const nextPump = getPumpsByTherapyAlgorithm(algorithm)[0];
      if (nextPump) {
        setSelectedPumpId(nextPump.id);
      }
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 border border-gray-200 dark:border-gray-600 shadow-lg mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
          Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Configure your Nightscout connection and AI providers
        </p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20' 
            : 'bg-red-50 dark:bg-red-900/20'
        } flex items-start`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-500 mt-0.5 mr-3 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-400 dark:text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          )}
          <div className={message.type === 'success' 
            ? 'text-green-800 dark:text-green-200' 
            : 'text-red-800 dark:text-red-200'
          }>
            {message.text}
          </div>
        </div>
      )}
      
      {/* AI Provider Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Key className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Provider Settings</h3>
            </div>
            <button
              onClick={() => runSafeAsync(() => testApiKeys(), { label: 'Settings: testApiKeys (button)' })}
              disabled={testingApiKeys}
              className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {testingApiKeys ? 'Testing...' : 'Test Connections'}
            </button>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Enter your API keys for AI providers to enable advanced analysis features. Your keys are stored securely in your browser's local storage and are never sent to our servers.
          </p>

          <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Pricing Sync Status</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${pricingFreshnessClasses}`}>
                {pricingFreshnessLabel}
              </span>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-200 mt-1">
              Last synced pricing date: {latestPricingAsOf ?? 'unknown'}
              {pricingAgeDays == null ? '' : ` (${pricingAgeDays} day${pricingAgeDays === 1 ? '' : 's'} ago)`}.
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
              Run <span className="font-semibold">npm run sync:ai-pricing</span> to refresh model prices from official provider pages.
            </p>
          </div>
          
          <div className="space-y-4">
            {/* OpenAI API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  OpenAI API Key
                </label>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Status:</span>
                  {apiKeyStatus.openai === null ? (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Not tested</span>
                  ) : apiKeyStatus.openai ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Working
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Not working
                    </span>
                  )}
                </div>
              </div>
              {apiKeyStatus.openai === false && openaiTestError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 break-words">
                  {openaiTestError}
                </p>
              )}
              <div className="flex mb-3">
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                />
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 border-l-0 rounded-r-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>

              {/* Model Selection */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model Selection
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    // Also update selectedOpenAIModel for backward compatibility
                    if (getModelById(e.target.value)?.provider === 'openai') {
                      setSelectedOpenAIModel(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                >
                  <optgroup label="🚀 OpenAI (Latest)">
                    {getModelsByCategory('latest').filter(m => m.provider === 'openai').map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📜 OpenAI (Legacy IDs)">
                    {getModelsByCategory('legacy').filter(m => m.provider === 'openai').map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🔷 Google Gemini">
                    {getModelsByProvider('google').map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🟣 Anthropic Claude">
                    {getModelsByProvider('anthropic').map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="⚫ DeepSeek">
                    {getModelsByProvider('deepseek').map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Selected Model Info */}
              {(() => {
                if (!selectedModelInfo) return null;
                
                const estimatedCost = selectedModelEstimatedCost;

                const providerLabel =
                  selectedModelInfo.provider === 'openai'
                    ? 'OpenAI'
                    : selectedModelInfo.provider === 'google'
                      ? 'Google'
                      : selectedModelInfo.provider === 'anthropic'
                        ? 'Anthropic'
                        : 'DeepSeek';
                
                return (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center">
                          <Zap className="h-4 w-4 mr-1" />
                          {selectedModelInfo.name}
                          {selectedModelInfo.isRecommended && <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">Recommended</span>}
                          <span className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full">{providerLabel}</span>
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{selectedModelInfo.description}</p>
                        <div className="flex items-center mt-2 space-x-4">
                          <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                            <DollarSign className="h-3 w-3 mr-1" />
                            <span className="font-medium">{formatCostEstimate(estimatedCost)}</span>
                            <span className="ml-1">est. / analysis</span>
                          </div>
                          {lastActualCost && lastActualCost.model === selectedModelInfo.id && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              Actual last run:{' '}
                              <span className="font-medium">{formatCostEstimate(lastActualCost.costUSD)}</span>
                              {lastActualCost.tokenUsage && (
                                <span className="ml-1">({lastActualCost.tokenUsage.inputTokens} in / {lastActualCost.tokenUsage.outputTokens} out)</span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Input: {selectedModelInfo.inputCostPer1M == null ? '—' : `$${selectedModelInfo.inputCostPer1M}`}/1M tokens
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Output: {selectedModelInfo.outputCostPer1M == null ? '—' : `$${selectedModelInfo.outputCostPer1M}`}/1M tokens
                          </div>
                        </div>
                        {(selectedModelInfo.pricingUrl || selectedModelInfo.pricingAsOf) && (
                          <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                            Pricing source:{' '}
                            {selectedModelInfo.pricingUrl ? (
                              <a
                                href={selectedModelInfo.pricingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 dark:text-blue-300 underline hover:text-blue-800 dark:hover:text-blue-200"
                              >
                                official provider pricing
                              </a>
                            ) : (
                              <span>official provider pricing</span>
                            )}
                            {selectedModelInfo.pricingAsOf ? ` (as of ${selectedModelInfo.pricingAsOf})` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">Analysis Cost Calculator</h4>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  Uses approximately {DIABETES_ANALYSIS_TOKENS.input} input + {DIABETES_ANALYSIS_TOKENS.output} output tokens per analysis.
                </p>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <div className="bg-white/60 dark:bg-gray-800/40 rounded p-2">
                    Selected model / analysis:{' '}
                    <span className="font-semibold">{formatCostEstimate(selectedModelEstimatedCost)}</span>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-800/40 rounded p-2">
                    Selected model / 100 analyses:{' '}
                    <span className="font-semibold">
                      {selectedModelEstimatedCost == null ? '—' : formatCostEstimate(selectedModelEstimatedCost * 100)}
                    </span>
                  </div>
                </div>

                {bestConnectedProviderOption ? (
                  <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">
                    Best on your configured API keys: <span className="font-semibold">{bestConnectedProviderOption.modelName}</span>
                    {' '}({providerDisplayName[bestConnectedProviderOption.provider]}) at approximately{' '}
                    <span className="font-semibold">{formatCostEstimate(bestConnectedProviderOption.cost)}</span> per analysis.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">
                    Add at least one API key to compare best-cost models among your active providers.
                  </p>
                )}

                {cheapestOverallModel && (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    Lowest model in full catalog: {cheapestOverallModel.name} ({providerDisplayName[cheapestOverallModel.provider]}) at {formatCostEstimate(cheapestOverallCost)} per analysis.
                  </p>
                )}
              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OpenAI dashboard</a>. Costs are estimated based on ~{DIABETES_ANALYSIS_TOKENS.input} input and ~{DIABETES_ANALYSIS_TOKENS.output} output tokens per analysis.
              </p>
            </div>

            {/* Google Gemini API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Google Gemini API Key
                </label>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Status:</span>
                  {apiKeyStatus.gemini === null ? (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Not tested</span>
                  ) : apiKeyStatus.gemini ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Working
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Not working
                    </span>
                  )}
                </div>
              </div>
              <div className="flex mb-3">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                />
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 border-l-0 rounded-r-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>

              {/* Gemini Models */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gemini Models
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {getModelsByCategory('gemini').map(model => {
                    const cost = calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output);
                    return (
                      <div 
                        key={model.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedModel === model.id 
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        onClick={() => setSelectedModel(model.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                checked={selectedModel === model.id}
                                onChange={() => setSelectedModel(model.id)}
                                className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                              />
                              <h4 className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {model.name}
                                {model.isRecommended && <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">Recommended</span>}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">{model.description}</p>
                            <div className="flex items-center mt-2 ml-6 space-x-4">
                              <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                <DollarSign className="h-3 w-3 mr-1" />
                                <span className="font-medium">{formatCostEstimate(cost)}</span>
                                <span className="ml-1">est. / analysis</span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Input: {model.inputCostPer1M == null ? '—' : `$${model.inputCostPer1M}`}/1M tokens
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Output: {model.outputCostPer1M == null ? '—' : `$${model.outputCostPer1M}`}/1M tokens
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google AI Studio</a>. Costs are estimated based on ~{DIABETES_ANALYSIS_TOKENS.input} input and ~{DIABETES_ANALYSIS_TOKENS.output} output tokens per analysis.
              </p>
            </div>
            
            {/* DeepSeek API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  DeepSeek API Key
                </label>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Status:</span>
                  {apiKeyStatus.deepseek === null ? (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Not tested</span>
                  ) : apiKeyStatus.deepseek ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Working
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Not working
                    </span>
                  )}
                </div>
              </div>
              <div className="flex">
                <input
                  type="password"
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                />
                <a 
                  href="https://platform.deepseek.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 border-l-0 rounded-r-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  DeepSeek Models
                </label>
                <select
                  value={getModelById(selectedModel)?.provider === 'deepseek' ? selectedModel : 'deepseek-chat'}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                >
                  {getModelsByProvider('deepseek').map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">DeepSeek platform</a>. Token pricing source: <a href="https://api-docs.deepseek.com/quick_start/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">DeepSeek API Docs</a>.
              </p>
            </div>
            
            {/* Anthropic API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Anthropic API Key (Claude)
                </label>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Status:</span>
                  {apiKeyStatus.anthropic === null ? (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Not tested</span>
                  ) : apiKeyStatus.anthropic ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Working
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Not working
                    </span>
                  )}
                </div>
              </div>
              <div className="flex">
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                />
                <a 
                  href="https://console.anthropic.com/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 border-l-0 rounded-r-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Claude Models
                </label>
                <select
                  value={getModelById(selectedModel)?.provider === 'anthropic' ? selectedModel : 'claude-sonnet-4-5'}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                >
                  {getModelsByProvider('anthropic').map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - est. {formatCostEstimate(calculateEstimatedCost(model, DIABETES_ANALYSIS_TOKENS.input, DIABETES_ANALYSIS_TOKENS.output))} / analysis
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Anthropic console</a>. Costs are estimated using the pricing table from <a href="https://platform.claude.com/docs/en/about-claude/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Claude model docs</a>.
              </p>
            </div>
            
            <button
              onClick={saveApiKeys}
              className="w-full px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 transition duration-150"
            >
              Save API Keys
            </button>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mt-4 border border-green-200 dark:border-green-800">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">🚀 TensorFlow AI - Primary Analysis (FREE)</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Your app now uses TensorFlow as the primary AI analysis method. This provides instant, private, and completely free diabetes analysis using advanced machine learning.
                  </p>
                  <p className="mt-2 text-sm text-green-800 dark:text-green-200">
                    <strong>Benefits of TensorFlow AI:</strong>
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-green-800 dark:text-green-200 list-disc list-inside">
                    <li>⚡ Instant analysis - no waiting for API responses</li>
                    <li>💰 Completely FREE - zero per-analysis costs</li>
                    <li>🔒 Complete privacy - all processing happens on your device</li>
                    <li>📱 Works offline - no internet required for analysis</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">API Providers (Highest Priority When Available)</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    When API keys are configured, they take priority over TensorFlow for highest accuracy analysis.
                  </p>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Costs:</strong>
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
                    <li>Model selector shows an estimated $/analysis using ~{DIABETES_ANALYSIS_TOKENS.input} input and ~{DIABETES_ANALYSIS_TOKENS.output} output tokens.</li>
                    <li>AI Insights shows the actual token usage + actual USD cost after each run (based on the provider’s token counts and the model pricing table).</li>
                  </ul>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Privacy:</strong> Your API keys are stored only in your browser's local storage and are never sent to our servers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Provider Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Provider Status</h3>
            </div>
            <button
              onClick={() => runSafeAsync(() => testApiKeys(), { label: 'Settings: testApiKeys (button 2)' })}
              disabled={testingApiKeys}
              className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {testingApiKeys ? 'Testing...' : 'Test Connections'}
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 dark:text-gray-300 font-medium">🚀 TensorFlow AI</span>
                <div className="flex items-center space-x-3">
                  {apiKeyStatus.tensorflow === null ? (
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Checking...</span>
                  ) : apiKeyStatus.tensorflow ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-1" /> Ready & Active
                    </span>
                  ) : tensorFlowContextEnabled ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center text-sm">
                      <AlertTriangle className="h-4 w-4 mr-1" /> Initializing...
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400 flex items-center text-sm">
                      Disabled
                    </span>
                  )}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tensorFlowContextEnabled}
                      onChange={(e) =>
                        runSafeAsync(() => handleTensorFlowToggle(e.target.checked), {
                          label: 'Settings: handleTensorFlowToggle'
                        })
                      }
                      className="sr-only"
                    />
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      tensorFlowContextEnabled 
                        ? 'bg-green-600 dark:bg-green-500' 
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tensorFlowContextEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </div>
                  </label>
                </div>
              </div>
              <div className="text-xs text-green-800 dark:text-green-200">
                {tensorFlowContextEnabled 
                  ? localStorage.getItem('openai_api_key') || localStorage.getItem('deepseek_api_key') || localStorage.getItem('anthropic_api_key')
                    ? 'Enabled but API keys take priority'
                    : 'Primary AI analysis method - Free & Private'
                  : 'Disabled - API providers will be used when available'
                }
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">OpenAI API ({selectedOpenAIModel || DEFAULT_OPENAI_MODEL})</span>
              {apiKeyStatus.openai === null ? (
                <span className="text-gray-500 dark:text-gray-400">Not tested</span>
              ) : apiKeyStatus.openai ? (
                <span className="text-green-600 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" /> Working
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Not working
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">DeepSeek API</span>
              {apiKeyStatus.deepseek === null ? (
                <span className="text-gray-500 dark:text-gray-400">Not tested</span>
              ) : apiKeyStatus.deepseek ? (
                <span className="text-green-600 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" /> Working
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Not working
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Anthropic API</span>
              {apiKeyStatus.anthropic === null ? (
                <span className="text-gray-500 dark:text-gray-400">Not tested</span>
              ) : apiKeyStatus.anthropic ? (
                <span className="text-green-600 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" /> Working
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Not working
                </span>
              )}
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">🎯 Analysis Priority System</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    The app uses a smart priority system for AI analysis:
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200 list-decimal list-inside">
                    <li><strong>Priority 1:</strong> API providers (when API keys are present) - Highest accuracy</li>
                    <li><strong>Priority 2:</strong> TensorFlow AI (when enabled) - Free, fast, and private</li>
                    <li><strong>Priority 3:</strong> Basic rule-based analysis - Always available as fallback</li>
                  </ol>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Tip:</strong> Remove API keys to use TensorFlow as primary, or disable TensorFlow to force API usage.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">🚀 TensorFlow AI Benefits</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    When TensorFlow is used for analysis:
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-green-800 dark:text-green-200 list-disc list-inside">
                    <li>⚡ Instant analysis - no waiting for API responses</li>
                    <li>💰 Completely FREE - zero per-analysis costs</li>
                    <li>🔒 Complete privacy - all processing happens on your device</li>
                    <li>📱 Works offline - no internet required for analysis</li>
                    <li>🧠 Advanced neural network trained for diabetes patterns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auto-Refresh Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <RefreshCw className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Auto-Refresh Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Enable Auto-Refresh</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={newAutoRefreshEnabled} 
                  onChange={(e) => setNewAutoRefreshEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Refresh Interval
              </label>
              <select
                value={newAutoRefreshInterval}
                onChange={(e) => setNewAutoRefreshInterval(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                disabled={!newAutoRefreshEnabled}
              >
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
                <option value={120000}>2 minutes</option>
                <option value={300000}>5 minutes</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                How often to automatically refresh glucose data. More frequent refreshes will keep your data current but may use more data and battery.
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">About Auto-Refresh</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Auto-refresh periodically fetches the latest data from your Nightscout server to keep your dashboard up-to-date. For real-time monitoring, use a shorter interval (10-30 seconds). For occasional checking, a longer interval (1-5 minutes) is recommended.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Insulin Pump Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Automated Therapy & Pump Configuration</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Choose your therapy platform first (AAPS is default), then select a pump to optimize recommendations,
            safety limits, and setup guidance throughout the application.
          </p>
          
          <div className="space-y-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-3">Automated Therapy Platform</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 p-3 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="therapy-platform"
                    value="aaps"
                    checked={selectedTherapyAlgorithm === 'aaps'}
                    onChange={() => handleTherapyAlgorithmChange('aaps')}
                    className="mt-1 h-4 w-4 text-indigo-600"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">AndroidAPS (AAPS)</div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Default mode. Best for Android-based open-source looping with broad pump support.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="therapy-platform"
                    value="loop"
                    checked={selectedTherapyAlgorithm === 'loop'}
                    onChange={() => handleTherapyAlgorithmChange('loop')}
                    className="mt-1 h-4 w-4 text-indigo-600"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loop for iOS (Tidepool Pathway)</div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      iOS Loop ecosystem with compatibility guidance aligned to LoopDocs and Tidepool commercialization path.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-3 text-xs text-indigo-800 dark:text-indigo-200">
                <strong>Current mode:</strong> {platformLabel[selectedTherapyAlgorithm]} • {platformCompatiblePumps.length} compatible or experimental pumps detected.
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Insulin Pump
              </label>
              <select
                value={selectedPumpId}
                onChange={(e) => setSelectedPumpId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              >
                <optgroup label={`✅ ${platformLabel[selectedTherapyAlgorithm]} - Supported`}>
                  {groupedPlatformPumps.supported.map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label={`⚠️ ${platformLabel[selectedTherapyAlgorithm]} - Experimental`}>
                  {groupedPlatformPumps.experimental.map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label={`❌ ${platformLabel[selectedTherapyAlgorithm]} - Not Supported`}>
                  {groupedPlatformPumps['not-supported'].map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            
            {/* Selected Pump Details */}
            {selectedPump && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 flex items-center">
                      {selectedPumpCompatibility?.[selectedTherapyAlgorithm] === 'supported' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
                      )}
                      {selectedPump.name}
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {selectedPump.manufacturer} • {selectedPump.category} • {selectedPump.availability}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    compatibilityBadgeClasses[selectedPumpCompatibility?.[selectedTherapyAlgorithm] || 'not-supported']
                  }`}>
                    {platformLabel[selectedTherapyAlgorithm]}: {compatibilityLabel[selectedPumpCompatibility?.[selectedTherapyAlgorithm] || 'not-supported']}
                  </span>
                </div>

                {selectedPumpCompatibility && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">AAPS</div>
                      <span className={`px-2 py-1 text-xs rounded-full ${compatibilityBadgeClasses[selectedPumpCompatibility.aaps]}`}>
                        {compatibilityLabel[selectedPumpCompatibility.aaps]}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loop (iOS)</div>
                      <span className={`px-2 py-1 text-xs rounded-full ${compatibilityBadgeClasses[selectedPumpCompatibility.loop]}`}>
                        {compatibilityLabel[selectedPumpCompatibility.loop]}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tidepool Loop Path</div>
                      <span className={`px-2 py-1 text-xs rounded-full ${compatibilityBadgeClasses[selectedPumpCompatibility.tidepoolLoop]}`}>
                        {compatibilityLabel[selectedPumpCompatibility.tidepoolLoop]}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Basal Increment</div>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{selectedPump.basalIncrements}U</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Max Basal</div>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{selectedPump.maxBasalRate}U/h</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Max Bolus</div>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{selectedPump.maxBolus}U</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reservoir</div>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{selectedPump.reservoirCapacity}U</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selectedPumpCompatibility && selectedPumpCompatibility.notes.length > 0 && (
                    <div className="bg-white dark:bg-gray-700 p-2 rounded">
                      <h5 className="text-sm font-medium text-purple-900 dark:text-purple-100">Compatibility Notes:</h5>
                      <ul className="mt-1 list-disc list-inside text-xs text-purple-800 dark:text-purple-200 space-y-1">
                        {selectedPumpCompatibility.notes.slice(0, 3).map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h5 className="text-sm font-medium text-purple-900 dark:text-purple-100">Key Features:</h5>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPump.features.slice(0, 4).map((feature, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          {feature}
                        </span>
                      ))}
                      {selectedPump.features.length > 4 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          +{selectedPump.features.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-purple-700 dark:text-purple-300">
                    <span>Communication: {selectedPump.communicationType}</span>
                    <span>Cost: {selectedPump.approximateCost}</span>
                  </div>

                  {selectedPumpCompatibility && selectedPumpCompatibility.sources.length > 0 && (
                    <div className="text-xs text-purple-700 dark:text-purple-300">
                      Sources:{' '}
                      {selectedPumpCompatibility.sources.map((source, index) => (
                        <React.Fragment key={source}>
                          {index > 0 ? ' • ' : ''}
                          <a href={source} target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-900 dark:hover:text-purple-100">
                            Reference {index + 1}
                          </a>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Impact on Analysis</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your platform + pump selection affects:
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
                    <li><strong>Basal Rate Calculations:</strong> Recommendations rounded to your pump's increments</li>
                    <li><strong>AAPS/Loop Tuning:</strong> Platform-aware max IOB, temp basal, and safety guidance</li>
                    <li><strong>Safety Recommendations:</strong> Adjusted based on pump capabilities and limitations</li>
                    <li><strong>Insulin Delivery Analysis:</strong> Considers pump-specific delivery delays and characteristics</li>
                  </ul>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> AAPS remains default. Loop mode is available for users running iOS Loop/Tidepool-aligned workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Glucose Units Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Gauge className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Glucose Units</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Choose your preferred glucose unit for display throughout the application.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="mmol-unit"
                name="glucose-unit"
                type="radio"
                value="mmol"
                checked={unit === 'mmol'}
                onChange={(e) => setUnit(e.target.value as 'mmol' | 'mgdl')}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="mmol-unit" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                mmol/L (International standard)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="mgdl-unit"
                name="glucose-unit"
                type="radio"
                value="mgdl"
                checked={unit === 'mgdl'}
                onChange={(e) => setUnit(e.target.value as 'mmol' | 'mgdl')}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="mgdl-unit" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                mg/dL (US standard)
              </label>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <Info className="h-4 w-4 inline mr-2" />
              Currently using: <strong>{getUnitLabel()}</strong>. 
              Changes will be applied immediately throughout the application.
            </p>
          </div>
        </div>
      </div>
      
      {/* Time in Range Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Time in Range Settings</h3>
            </div>
            <button
              onClick={resetTimeInRangeToDefaults}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Reset to Defaults
            </button>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Customize your target glucose ranges. These settings affect Time in Range calculations, glucose color coding, and analysis throughout the application.
          </p>
          
          <TimeInRangeSettings />
          
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <Info className="h-4 w-4 inline mr-2" />
              <strong>Current targets:</strong> {getSettingsInUnit(unit).targetMin.toFixed(1)} - {getSettingsInUnit(unit).targetMax.toFixed(1)} {getUnitLabel()}
              <br />
              <strong>Alert thresholds:</strong> Low &lt; {getSettingsInUnit(unit).lowThreshold.toFixed(1)} {getUnitLabel()}, High &gt; {getSettingsInUnit(unit).highThreshold.toFixed(1)} {getUnitLabel()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Time Format Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Time Format</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Choose your preferred time format for display throughout the application.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="24h-format"
                name="time-format"
                type="radio"
                value="24h"
                checked={timeFormat === '24h'}
                onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="24h-format" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                24-hour (Military time) - 14:30
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="12h-format"
                name="time-format"
                type="radio"
                value="12h"
                checked={timeFormat === '12h'}
                onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="12h-format" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                12-hour (AM/PM) - 2:30 PM
              </label>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <Info className="h-4 w-4 inline mr-2" />
              Currently using: <strong>{timeFormat === '24h' ? '24-hour format' : '12-hour format with AM/PM'}</strong>. 
              Example: <strong>{formatTime(new Date())}</strong>
            </p>
          </div>
        </div>
      </div>
      
      {/* Dashboard Display Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Gauge className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Dashboard Display</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Customize which sections are displayed on your dashboard.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Device Status</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Show IOB, COB, CAGE, SAGE, basal rate, and pump status information
                </p>
              </div>
              <div className="flex items-center">
                <input
                  id="show-device-status"
                  type="checkbox"
                  checked={showDeviceStatus}
                  onChange={(e) => setShowDeviceStatus(e.target.checked)}
                  className="h-4 w-4 text-purple-600 dark:text-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="show-device-status" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {showDeviceStatus ? 'Shown' : 'Hidden'}
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <Info className="h-4 w-4 inline mr-2" />
              Device Status section is currently <strong>{showDeviceStatus ? 'visible' : 'hidden'}</strong> on your dashboard.
              {!showDeviceStatus && ' You can still access device information through other analysis pages.'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200 mb-6">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Nightscout Connection</h3>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="nightscoutUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nightscout URL
              </label>
              <input
                type="text"
                id="nightscoutUrl"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="e.g., https://yournightscout.herokuapp.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Enter the base URL of your Nightscout site (do not include /api/v1 or /api/v3).
                If your Nightscout is hosted under a subpath, include it (e.g., https://example.com/nightscout).
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="apiVersion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nightscout API Version
              </label>
              <select
                id="apiVersion"
                value={detectedApiVersion || 'v1'}
                onChange={(e) => setDetectedApiVersion(e.target.value as 'v1' | 'v3')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              >
                <option value="v1">API v1 (Older Nightscout versions)</option>
                <option value="v3">API v3 (Nightscout 15+)</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select your Nightscout API version. If unsure, try v1 first as it's more widely supported.
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {detectedApiVersion === 'v3' ? 'Bearer Token' : 'Access Token'}
              </label>
              <input
                type="password"
                id="apiToken"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder={detectedApiVersion === 'v3' ? 'Enter your Bearer token' : 'Enter your Access token'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
              {detectedApiVersion === 'v3' ? (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <p className="mb-2"><strong>For API v3 (Nightscout 15+):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Log into your Nightscout site</li>
                    <li>Go to <strong>Admin Tools</strong> (or <strong>Settings</strong>)</li>
                    <li>Open the page for <strong>Authentication</strong> / <strong>API Access</strong> / <strong>Tokens</strong> (names vary by host)</li>
                    <li>Create a new <strong>subject</strong> (or user) and generate a <strong>Bearer token</strong></li>
                    <li>Grant these permissions (read-only): <strong>api:entries:read</strong>, <strong>api:treatments:read</strong>, <strong>api:profile:read</strong>, <strong>api:devicestatus:read</strong></li>
                    <li>Copy the generated token value and paste it here</li>
                  </ol>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">⚠️ Important for API v3:</p>
                    <ul className="mt-1 text-blue-600 dark:text-blue-400 text-xs space-y-1">
                      <li>• Requires Nightscout version 15.0 or higher</li>
                      <li>• Bearer token must have all 4 permissions listed above</li>
                      <li>• If you get 401/403 errors, check token permissions</li>
                      <li>• If you get 404 errors, your Nightscout may not support v3 - try v1</li>
                      <li>• If your Nightscout runs under a subpath, make sure the URL includes it (e.g., /nightscout)</li>
                    </ul>
                  </div>
                  <p className="mt-2 text-blue-600 dark:text-blue-400">
                    <strong>Note:</strong> Paste only the token value. This app adds the Authorization header automatically.
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <p className="mb-2"><strong>For API v1 (Older Nightscout versions):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Log into your Nightscout site</li>
                    <li>Open the admin/security section (wording differs by host)</li>
                    <li>Prefer generating an <strong>Access Token</strong> with read permissions (if your UI supports it)</li>
                    <li>Paste the token value here (no prefix)</li>
                  </ol>
                  <p className="mt-2 text-blue-600 dark:text-blue-400">
                    <strong>Note:</strong> Some older Nightscout setups only have a classic API secret. If you don't have access-token support, API v1 may still require that secret.
                    Treat it as highly sensitive and only use read-only sharing when possible.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Important Security Notice</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Security:</strong> Use the least-privileged token available (read-only).
                    If your instance only provides a classic API secret, treat it as highly sensitive.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-200 list-disc list-inside">
                    <li><strong>API v1:</strong> Use Access Tokens (read-only permissions)</li>
                    <li><strong>API v3:</strong> Use Bearer Tokens (with specific permissions)</li>
                    <li><strong>Both:</strong> Paste only the token value</li>
                  </ul>
                  <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-200">
                    This application only needs read access to your glucose data and treatments.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <button
                type="button"
                onClick={() => runSafeAsync(() => handleTestConnection(), { label: 'Settings: handleTestConnection' })}
                disabled={testing || !newUrl}
                className="w-full px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition duration-150 disabled:bg-indigo-400 dark:disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing Connection...' : 'Test Connection'}
              </button>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click to verify your Nightscout URL and token work with the selected API version
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="dataFetchDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Analysis Period (days)
              </label>
              <select
                id="dataFetchDays"
                value={analysisPeriod}
                onChange={(e) => setAnalysisPeriod(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days (recommended)</option>
                <option value={30}>30 days</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select how many days of data to analyze. 14 days is recommended for reliable patterns.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="mb-4 sm:mb-0">
                {lastFetchTime && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last data fetch: {formatDateTime(lastFetchTime)}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={handleFetchData}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition duration-150"
                >
                  Fetch Data Now
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition duration-150"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">About Nightscout</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Nightscout (also known as CGM in the Cloud) is an open-source project that allows real-time access to 
            Continuous Glucose Monitor (CGM) data via a personal website, smartwatch viewers, or apps.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            If you don't have a Nightscout site yet, you can set one up following the instructions 
            at the <a href="http://www.nightscout.info/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Nightscout Info</a> website.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>Note:</strong> This analyzer app only requires read access to your Nightscout data and does not 
              make any changes to your Nightscout site or your insulin delivery settings.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Settings;