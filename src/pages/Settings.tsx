import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useInsulinPump } from '../contexts/InsulinPumpContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { useDashboardDisplay } from '../contexts/DashboardDisplayContext';
import { INSULIN_PUMPS, InsulinPumpProfile, getPumpsByCategory, getAAPSSupportedPumps } from '../constants/insulinPumps';
import { format } from 'date-fns';
import { testConnection } from '../services/nightscoutService';
import { AlertTriangle, CheckCircle, Key, Shield, ExternalLink, Info, RefreshCw, Gauge, Activity, Heart, Clock, Cpu } from 'lucide-react';
import { aiService } from '../services/aiService';

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
  const { selectedPumpId, selectedPump, setSelectedPumpId } = useInsulinPump();
  const { timeFormat, setTimeFormat, formatTime, formatDateTime } = useTimeFormat();
  const { 
    isReady: tensorFlowReady, 
    isEnabled: tensorFlowContextEnabled, 
    isInitializing: tensorFlowInitializing,
    error: tensorFlowError,
    toggleEnabled: toggleTensorFlow,
    reinitialize: reinitializeTensorFlow
  } = useTensorFlow();
  const { showDeviceStatus, setShowDeviceStatus } = useDashboardDisplay();
  const [newUrl, setNewUrl] = useState(url);
  const [newToken, setNewToken] = useState(token);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [testing, setTesting] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    openai: boolean | null;
    deepseek: boolean | null;
    anthropic: boolean | null;
    tensorflow: boolean | null;
  }>({
    openai: null,
    deepseek: null,
    anthropic: null,
    tensorflow: null
  });
  const [testingApiKeys, setTestingApiKeys] = useState(false);
  
  // API Key states
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [deepseekKey, setDeepseekKey] = useState(localStorage.getItem('deepseek_api_key') || '');
  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('anthropic_api_key') || '');
  
  // TensorFlow settings - removing old state since we use context now
  // const [tensorFlowEnabled, setTensorFlowEnabledState] = useState(() => {
  //   const stored = localStorage.getItem('tensorflow_enabled');
  //   return stored === null ? true : stored === 'true';
  // });
  
  // Auto-refresh settings
  const [newAutoRefreshEnabled, setNewAutoRefreshEnabled] = useState(autoRefreshEnabled);
  const [newAutoRefreshInterval, setNewAutoRefreshInterval] = useState(autoRefreshInterval);
  
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
      
    } catch (error) {
      setMessage({
        text: 'An error occurred while saving settings',
        type: 'error'
      });
    }
  };
  
  const handleFetchData = () => {
    fetchDataForDays(analysisPeriod);
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
        text: error instanceof Error ? error.message : 'Failed to connect to Nightscout',
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
      setApiKeyStatus({
        openai: results.openai,
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
    testApiKeys();
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
      (window as any).VITE_OPENAI_API_KEY = openaiKey;
    } else {
      localStorage.removeItem('openai_api_key');
    }
    
    if (deepseekKey) {
      localStorage.setItem('deepseek_api_key', deepseekKey);
      // Also update environment variable
      (window as any).VITE_DEEPSEEK_API_KEY = deepseekKey;
    } else {
      localStorage.removeItem('deepseek_api_key');
    }
    
    if (anthropicKey) {
      localStorage.setItem('anthropic_api_key', anthropicKey);
      // Also update environment variable
      (window as any).VITE_ANTHROPIC_API_KEY = anthropicKey;
    } else {
      localStorage.removeItem('anthropic_api_key');
    }
    
    setMessage({
      text: 'API keys saved successfully. Please refresh the page for changes to take effect.',
      type: 'success'
    });
    
    // Test the keys
    testApiKeys();
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
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
              onClick={testApiKeys}
              disabled={testingApiKeys}
              className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {testingApiKeys ? 'Testing...' : 'Test Connections'}
            </button>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Enter your API keys for AI providers to enable advanced analysis features. Your keys are stored securely in your browser's local storage and are never sent to our servers.
          </p>
          
          <div className="space-y-4">
            {/* OpenAI API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  OpenAI API Key (GPT-4o mini)
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
              <div className="flex">
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OpenAI dashboard</a>. Using GPT-4o mini for cost efficiency (~$0.003-0.01 per analysis).
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">DeepSeek platform</a>. Estimated cost: ~$0.005-0.02 per analysis.
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from the <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Anthropic console</a>. Estimated cost: ~$0.03-0.08 per analysis.
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
                    <strong>Estimated costs per analysis:</strong>
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
                    <li>OpenAI GPT-4o mini: $0.003-0.01 per analysis (recommended)</li>
                    <li>DeepSeek: $0.005-0.02 per analysis</li>
                    <li>Anthropic Claude: $0.03-0.08 per analysis</li>
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
              onClick={testApiKeys}
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
                      onChange={(e) => handleTensorFlowToggle(e.target.checked)}
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
              <span className="text-gray-700 dark:text-gray-300">OpenAI API (GPT-4o mini)</span>
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Insulin Pump Configuration</h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Select your insulin pump model to optimize analysis and recommendations. This affects basal rate calculations, 
            OpenAPS/AAPS settings, and safety recommendations throughout the application.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Insulin Pump
              </label>
              <select
                value={selectedPumpId}
                onChange={(e) => setSelectedPumpId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              >
                <optgroup label="🔄 Tubeless Pumps (Recommended for AAPS)">
                  {getPumpsByCategory('tubeless').map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer} {pump.aapsSupported ? '✅ AAPS' : '❌ No AAPS'}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label="🔗 Tubed Pumps">
                  {getPumpsByCategory('tubed').map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer} {pump.aapsSupported ? '✅ AAPS' : '❌ No AAPS'}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label="🔬 DIY/Research Pumps">
                  {getPumpsByCategory('diy').map(pump => (
                    <option key={pump.id} value={pump.id}>
                      {pump.name} - {pump.manufacturer} {pump.aapsSupported ? '✅ AAPS' : '❌ No AAPS'}
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
                      {selectedPump.aapsSupported ? (
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
                    selectedPump.aapsSupported 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {selectedPump.aapsSupported ? 'AAPS Compatible' : 'Limited AAPS Support'}
                  </span>
                </div>
                
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
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Impact on Analysis</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your pump selection affects:
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-blue-800 dark:text-blue-200 list-disc list-inside">
                    <li><strong>Basal Rate Calculations:</strong> Recommendations rounded to your pump's increments</li>
                    <li><strong>OpenAPS/AAPS Settings:</strong> Optimized max IOB, temp basal, and safety settings</li>
                    <li><strong>Safety Recommendations:</strong> Adjusted based on pump capabilities and limitations</li>
                    <li><strong>Insulin Delivery Analysis:</strong> Considers pump-specific delivery delays and characteristics</li>
                  </ul>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> AAPS-compatible pumps receive more advanced analysis and recommendations.
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
                Enter the URL of your Nightscout site without any paths or API endpoints
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
                    <li>Go to Admin Tools → Data Tools → Authentication</li>
                    <li>Click "Add new subject" or "Generate Token"</li>
                    <li>Set permissions: <strong>api:entries:read</strong>, <strong>api:treatments:read</strong>, <strong>api:profile:read</strong>, <strong>api:devicestatus:read</strong></li>
                    <li>Copy the generated Bearer token and paste it here</li>
                  </ol>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">⚠️ Important for API v3:</p>
                    <ul className="mt-1 text-blue-600 dark:text-blue-400 text-xs space-y-1">
                      <li>• Requires Nightscout version 15.0 or higher</li>
                      <li>• Bearer token must have all 4 permissions listed above</li>
                      <li>• If you get 401/403 errors, check token permissions</li>
                      <li>• If you get 404 errors, your Nightscout may not support v3 - try v1</li>
                    </ul>
                  </div>
                  <p className="mt-2 text-blue-600 dark:text-blue-400">
                    <strong>Note:</strong> Bearer tokens start with a long string of characters and are used with API v3.
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <p className="mb-2"><strong>For API v1 (Older Nightscout versions):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Log into your Nightscout site</li>
                    <li>Go to Admin Tools → Data Tools</li>
                    <li>Look for "Access Token" or "Token" section</li>
                    <li>Generate a new access token with read permissions</li>
                    <li>Copy the access token and paste it here</li>
                  </ol>
                  <p className="mt-2 text-blue-600 dark:text-blue-400">
                    <strong>Note:</strong> Access tokens are shorter than Bearer tokens and are used with API v1. Do NOT use your API_SECRET here.
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
                    <strong>Never use your API_SECRET here!</strong> API_SECRET provides full administrative access to your Nightscout site.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-200 list-disc list-inside">
                    <li><strong>API v1:</strong> Use Access Tokens (read-only permissions)</li>
                    <li><strong>API v3:</strong> Use Bearer Tokens (with specific permissions)</li>
                    <li><strong>Both:</strong> Never share your API_SECRET with third-party applications</li>
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
                onClick={handleTestConnection}
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
    </div>
  );
};

export default Settings;