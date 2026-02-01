// AI-Enhanced Analysis Service with TensorFlow as Primary and API Fallbacks
import { toMmol, GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { roundToDecimal } from '../utils/mathUtils';
import type TensorFlowAIService from './tensorFlowAIService';
import { DEFAULT_OPENAI_MODEL, getModelById } from '../constants/openaiModels';
import { safeJsonParseFromText } from '../utils/safeJson';
import { asNumber, asRiskAssessment, asStringArray } from './aiValidation';
import { debugLog, debugWarn } from '../utils/logger';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface AIProvider {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
}

interface AIAnalysisResult {
  recommendations: string[];
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string[];
  safetyWarnings: string[];
}

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface TensorFlowInfo {
  isReady: boolean;
  isEnabled: boolean;
  shouldUse: boolean;
  modelInfo: unknown | null;
}

class AIAnalysisService {
  private providers: AIProvider[] = [];
  private tensorFlowService: TensorFlowAIService | null = null;
  private tensorFlowServicePromise: Promise<TensorFlowAIService> | null = null;
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000  // 10 seconds
  };

  constructor() {
    this.initializeProviders();
  }

  private isTensorFlowEnabledByUserPref(): boolean {
    const stored = localStorage.getItem('tensorflow_enabled');
    return stored === null ? true : stored === 'true';
  }

  private async getTensorFlowServiceAsync(): Promise<TensorFlowAIService | null> {
    if (!this.isTensorFlowEnabledByUserPref()) return null;
    if (this.tensorFlowService) return this.tensorFlowService;

    if (!this.tensorFlowServicePromise) {
      this.tensorFlowServicePromise = import('./tensorFlowAIService').then(mod => {
        const svc = new mod.default();
        this.tensorFlowService = svc;
        return svc;
      });
    }

    return this.tensorFlowServicePromise;
  }

  private initializeProviders() {
    // Get API keys from localStorage
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');

    const selectedOpenAIModel = localStorage.getItem('openai_selected_model') || DEFAULT_OPENAI_MODEL;
    const selectedModel = localStorage.getItem('selected_model') || selectedOpenAIModel;
    const selectedModelInfo = getModelById(selectedModel);

    // OpenAI
    if (openaiKey) {
      this.providers.push({
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: selectedModelInfo?.provider === 'openai' ? selectedModel : selectedOpenAIModel,
        apiKey: openaiKey
      });
    }

    // DeepSeek
    if (deepseekKey) {
      this.providers.push({
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: selectedModelInfo?.provider === 'deepseek' ? selectedModel : 'deepseek-chat',
        apiKey: deepseekKey
      });
    }

    // Anthropic
    if (anthropicKey) {
      this.providers.push({
        name: 'Anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: selectedModelInfo?.provider === 'anthropic' ? selectedModel : 'claude-sonnet-4-5',
        apiKey: anthropicKey
      });
    }

    debugLog(`Initialized ${this.providers.length} AI providers`);
  }

  // Reinitialize providers (called after API keys are updated)
  public reinitializeProviders() {
    this.providers = [];
    this.initializeProviders();
  }

  /**
   * Make an AI request with retry mechanism and exponential backoff
   */
  private async makeAIRequestWithRetry(
    url: string, 
    options: RequestInit, 
    retryOptions: RetryOptions = this.defaultRetryOptions
  ): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // If successful or non-retryable error, return immediately
        if (response.ok || (response.status !== 429 && response.status !== 500 && response.status !== 502 && response.status !== 503 && response.status !== 504)) {
          return response;
        }
        
        // If this is the last attempt, return the response (will be handled as error by caller)
        if (attempt === retryOptions.maxRetries) {
          return response;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryOptions.baseDelay * Math.pow(2, attempt),
          retryOptions.maxDelay
        );
        
        debugLog(`AI API request failed (status: ${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retryOptions.maxRetries + 1})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        lastError = error as Error;
        
        // If this is the last attempt, throw the error
        if (attempt === retryOptions.maxRetries) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryOptions.baseDelay * Math.pow(2, attempt),
          retryOptions.maxDelay
        );
        
        debugLog(`AI API request failed with error: ${lastError.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retryOptions.maxRetries + 1})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but just in case
    throw lastError!;
  }

  async analyzeGlucoseData(readings: NightscoutEntry[], treatments: NightscoutTreatment[], currentProfile: unknown): Promise<AIAnalysisResult> {
    debugLog('Starting AI analysis');
    
    // Reinitialize providers to get the latest API keys
    this.reinitializeProviders();
    
    // PRIORITY 1: API providers (when API keys are present)
    if (this.providers.length > 0) {
      debugLog('API keys detected - using API providers as primary analysis method');
      
      // Try each provider in order until one succeeds
      for (const provider of this.providers) {
        try {
          debugLog(`Attempting analysis with ${provider.name} API`);
          
          if (provider.name === 'OpenAI') {
            const result = await this.analyzeWithOpenAI(provider, readings, treatments, currentProfile);
            debugLog('OpenAI analysis successful');
            return result;
          } else if (provider.name === 'DeepSeek') {
            const result = await this.analyzeWithDeepSeek(provider, readings, treatments, currentProfile);
            debugLog('DeepSeek analysis successful');
            return result;
          } else if (provider.name === 'Anthropic') {
            const result = await this.analyzeWithAnthropic(provider, readings, treatments, currentProfile);
            debugLog('Anthropic analysis successful');
            return result;
          }
        } catch (error) {
          debugWarn(`${provider.name} analysis failed:`, error);
        }
      }
      
      debugLog('All API providers failed, falling back to TensorFlow');
    }
    
    // PRIORITY 2: TensorFlow AI Service (fallback when no API keys, or API keys failed)
    try {
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.isReady?.()) {
        debugLog('Using TensorFlow AI Service');
        const tensorFlowResult = await tfService.analyzeGlucoseData(readings, treatments);
        
        // Convert TensorFlow result to our expected format
        const result: AIAnalysisResult = {
          recommendations: tensorFlowResult.recommendations,
          riskAssessment: tensorFlowResult.riskAssessment,
          confidence: tensorFlowResult.confidence,
          reasoning: tensorFlowResult.reasoning,
          safetyWarnings: tensorFlowResult.safetyWarnings
        };
        
        debugLog('TensorFlow AI analysis completed successfully');
        return result;
      } else {
        const tfStatus = this.isTensorFlowEnabledByUserPref() ? 'initializing...' : 'disabled by user';
        debugLog(`TensorFlow not ready (${tfStatus})`);
      }
    } catch (error) {
      debugWarn('TensorFlow AI analysis failed:', error);
    }

    // PRIORITY 3: Basic fallback if all else fails
    debugLog('Using basic fallback analysis');
    return this.getFallbackAnalysis(readings, treatments, currentProfile);
  }

  private async analyzeWithOpenAI(provider: AIProvider, readings: NightscoutEntry[], treatments: NightscoutTreatment[], _currentProfile: unknown): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const _sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const _sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
    // OPTIMIZED PROMPT TO REDUCE TOKEN USAGE
    const prompt = `
      Analyze this diabetes data concisely:
      
      Time in Range:
      - Below Range: ${timeInRange.low}%
      - In Range: ${timeInRange.inRange}%
      - Above Range: ${timeInRange.high}%
      
      Hypoglycemia Risk:
      - Episodes: ${hypoglycemiaRisk.episodes}
      - Severity: ${hypoglycemiaRisk.severity}
      
      Provide JSON with:
      1. recommendations: 3-4 safety recommendations
      2. riskAssessment: low/medium/high/critical
      3. confidence: 0-100%
      4. reasoning: 2-3 key points
      5. safetyWarnings: include critical warnings (if present)
    `;
    
    try {
      const response = await this.makeAIRequestWithRetry(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: 'You are a diabetes management AI assistant. Be concise.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500 // Reduced from 1000 to 500
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;

      const parsed = safeJsonParseFromText(String(content ?? ''));
      if (!parsed.ok) {
        console.error('Failed to parse OpenAI response:', parsed.error);
        throw new Error('Invalid response format from OpenAI');
      }

      const result = isRecord(parsed.value) ? parsed.value : {};

      return {
        recommendations: asStringArray(result.recommendations, 8),
        riskAssessment: asRiskAssessment(result.riskAssessment, 'medium'),
        confidence: asNumber(result.confidence, 70, 0, 100),
        reasoning: asStringArray(result.reasoning, 8),
        safetyWarnings: asStringArray(result.safetyWarnings, 8)
      };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  private async analyzeWithDeepSeek(provider: AIProvider, readings: NightscoutEntry[], treatments: NightscoutTreatment[], _currentProfile: unknown): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const _sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const _sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
    // OPTIMIZED PROMPT TO REDUCE TOKEN USAGE
    const prompt = `
      Analyze this diabetes data concisely:
      
      Time in Range:
      - Below Range: ${timeInRange.low}%
      - In Range: ${timeInRange.inRange}%
      - Above Range: ${timeInRange.high}%
      
      Hypoglycemia Risk:
      - Episodes: ${hypoglycemiaRisk.episodes}
      - Severity: ${hypoglycemiaRisk.severity}
      
      Provide JSON with:
      1. recommendations: 3-4 safety recommendations
      2. riskAssessment: low/medium/high/critical
      3. confidence: 0-100%
      4. reasoning: 2-3 key points
      5. safetyWarnings: include critical warnings (if present)
    `;
    
    try {
      const response = await this.makeAIRequestWithRetry(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: 'You are a diabetes management AI assistant. Be concise.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500 // Reduced from 1000 to 500
        })
      });
      
      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;

      const parsed = safeJsonParseFromText(String(content ?? ''));
      if (!parsed.ok) {
        console.error('Failed to parse DeepSeek response:', parsed.error);
        throw new Error('Invalid response format from DeepSeek');
      }

      const result = isRecord(parsed.value) ? parsed.value : {};

      return {
        recommendations: asStringArray(result.recommendations, 8),
        riskAssessment: asRiskAssessment(result.riskAssessment, 'medium'),
        confidence: asNumber(result.confidence, 70, 0, 100),
        reasoning: asStringArray(result.reasoning, 8),
        safetyWarnings: asStringArray(result.safetyWarnings, 8)
      };
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      throw error;
    }
  }

  private async analyzeWithAnthropic(provider: AIProvider, readings: NightscoutEntry[], treatments: NightscoutTreatment[], _currentProfile: unknown): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const _sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const _sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
    // OPTIMIZED PROMPT TO REDUCE TOKEN USAGE
    const prompt = `
      Analyze this diabetes data concisely:
      
      Time in Range:
      - Below Range: ${timeInRange.low}%
      - In Range: ${timeInRange.inRange}%
      - Above Range: ${timeInRange.high}%
      
      Hypoglycemia Risk:
      - Episodes: ${hypoglycemiaRisk.episodes}
      - Severity: ${hypoglycemiaRisk.severity}
      
      Provide JSON with:
      1. recommendations: 3-4 safety recommendations
      2. riskAssessment: low/medium/high/critical
      3. confidence: 0-100%
      4. reasoning: 2-3 key points
      5. safetyWarnings: include critical warnings (if present)
    `;
    
    try {
      const response = await this.makeAIRequestWithRetry(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 500 // Reduced from 1000 to 500
        })
      });
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.content[0].text;

      const parsed = safeJsonParseFromText(String(content ?? ''));
      if (!parsed.ok) {
        console.error('Failed to parse Anthropic response:', parsed.error);
        throw new Error('Invalid response format from Anthropic');
      }

      const result = isRecord(parsed.value) ? parsed.value : {};

      return {
        recommendations: asStringArray(result.recommendations, 8),
        riskAssessment: asRiskAssessment(result.riskAssessment, 'medium'),
        confidence: asNumber(result.confidence, 70, 0, 100),
        reasoning: asStringArray(result.reasoning, 8),
        safetyWarnings: asStringArray(result.safetyWarnings, 8)
      };
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  private getFallbackAnalysis(readings: NightscoutEntry[], treatments: NightscoutTreatment[], _currentProfile: unknown): AIAnalysisResult {
    const timeInRange = this.calculateTimeInRange(readings);
    const _hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    const recommendations = [];
    const safetyWarnings = [];
    let riskAssessment: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Ultra-conservative fallback logic
    if (timeInRange.low > 4) {
      riskAssessment = 'critical';
      recommendations.push('URGENT: Reduce all insulin doses by 10-15% due to excessive hypoglycemia');
      safetyWarnings.push('Critical hypoglycemia risk detected - immediate medical consultation required');
    } else if (timeInRange.low > 2) {
      riskAssessment = 'high';
      recommendations.push('Reduce insulin doses by 5-10% to prevent hypoglycemia');
      safetyWarnings.push('Elevated hypoglycemia risk - monitor closely');
    } else if (timeInRange.inRange < 50) {
      riskAssessment = 'high';
      recommendations.push('Consider very gradual adjustments (2-5%) with close monitoring');
    } else {
      recommendations.push('Current settings appear stable - no changes recommended');
    }

    return {
      recommendations,
      riskAssessment,
      confidence: 60,
      reasoning: ['Analysis using conservative safety rules'],
      safetyWarnings
    };
  }

  private calculateTimeInRange(readings: NightscoutEntry[]) {
    if (!readings.length) return { inRange: 0, high: 0, low: 0 };
    
    let inRange = 0, high = 0, low = 0;
    
    readings.forEach(reading => {
      const mmol = toMmol(reading.sgv);
      if (mmol >= GLUCOSE_RANGES.TARGET_MIN && mmol <= GLUCOSE_RANGES.TARGET_MAX) {
        inRange++;
      } else if (mmol > GLUCOSE_RANGES.TARGET_MAX) {
        high++;
      } else {
        low++;
      }
    });
    
    const total = readings.length;
    return {
      inRange: roundToDecimal((inRange / total) * 100, 1),
      high: roundToDecimal((high / total) * 100, 1),
      low: roundToDecimal((low / total) * 100, 1)
    };
  }

  private assessHypoglycemiaRisk(readings: NightscoutEntry[], _treatments: NightscoutTreatment[]) {
    const lowReadings = readings.filter(r => toMmol(r.sgv) < 3.9);
    const severelyLowReadings = readings.filter(r => toMmol(r.sgv) < 3.0);
    
    return {
      episodes: lowReadings.length,
      severity: severelyLowReadings.length > 0 ? 'severe' : 
                lowReadings.length > readings.length * 0.04 ? 'high' : 
                lowReadings.length > 0 ? 'moderate' : 'low'
    };
  }

  private sampleData<T>(data: T[], maxSamples: number): T[] {
    if (!data || data.length <= maxSamples) return data;

    const step = Math.ceil(data.length / maxSamples);
    const sampled: T[] = [];

    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }

    return sampled;
  }

  // Check if API keys are working AND TensorFlow status
  async testAPIKeys(): Promise<{openai: boolean, deepseek: boolean, anthropic: boolean, tensorflow: boolean}> {
    // Reinitialize providers to get the latest API keys
    this.reinitializeProviders();

    const tfService = await this.getTensorFlowServiceAsync();
    
    const results = {
      openai: false,
      deepseek: false,
      anthropic: false,
      tensorflow: tfService?.isReady?.() ?? false
    };

    console.log(`TensorFlow AI Service status: ${results.tensorflow ? 'Ready' : 'Not Ready'}`);
    
    // Test each API provider
    for (const provider of this.providers) {
      try {
        console.log(`Testing ${provider.name} API key...`);
        
        let response;
        
        if (provider.name === 'Anthropic') {
          // Special handling for Anthropic API
          response = await this.makeAIRequestWithRetry(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'user', content: 'Hello, this is a test message. Please respond with "API is working".' }
              ],
              max_tokens: 20
            })
          });
        } else {
          // OpenAI and DeepSeek compatible APIs
          response = await this.makeAIRequestWithRetry(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'user', content: 'Hello, this is a test message. Please respond with "API is working".' }
              ],
              max_tokens: 20
            })
          });
        }
        
        if (response.ok) {
          if (provider.name === 'OpenAI') {
            results.openai = true;
          } else if (provider.name === 'DeepSeek') {
            results.deepseek = true;
          } else if (provider.name === 'Anthropic') {
            results.anthropic = true;
          }
          console.log(`${provider.name} API key is working`);
        } else {
          console.error(`${provider.name} API key test failed:`, await response.text());
        }
      } catch (error) {
        console.error(`${provider.name} API test error:`, error);
      }
    }
    
    return results;
  }

  // Get TensorFlow model info
  getTensorFlowInfo(): TensorFlowInfo {
    const svc = this.tensorFlowService;
    return {
      isReady: svc?.isReady?.() ?? false,
      isEnabled: svc?.isTensorFlowEnabledByUser?.() ?? this.isTensorFlowEnabledByUserPref(),
      shouldUse: svc?.shouldUseTensorFlow?.() ?? false,
      modelInfo: svc?.getModelInfo?.() ?? null
    };
  }

  // Get TensorFlow service for settings access
  getTensorFlowService(): TensorFlowAIService | null {
    return this.tensorFlowService;
  }
}

export const aiAnalysisService = new AIAnalysisService();