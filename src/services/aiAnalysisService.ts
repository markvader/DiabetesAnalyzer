// AI-Enhanced Analysis Service with TensorFlow as Primary and API Fallbacks
import { toMmol, GLUCOSE_RANGES } from '../utils/glucoseUtils';
import { roundToDecimal } from '../utils/mathUtils';
import TensorFlowAIService from './tensorFlowAIService';

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

class AIAnalysisService {
  private providers: AIProvider[] = [];
  private tensorFlowService: TensorFlowAIService;
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000  // 10 seconds
  };

  constructor() {
    this.tensorFlowService = new TensorFlowAIService();
    this.initializeProviders();
  }

  private initializeProviders() {
    // Get API keys from localStorage
    const openaiKey = localStorage.getItem('openai_api_key');
    const deepseekKey = localStorage.getItem('deepseek_api_key');
    const anthropicKey = localStorage.getItem('anthropic_api_key');

    // OpenAI - UPDATED TO USE GPT-4o MINI
    if (openaiKey) {
      this.providers.push({
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini', // Changed from gpt-4 to gpt-4o-mini
        apiKey: openaiKey
      });
    }

    // DeepSeek
    if (deepseekKey) {
      this.providers.push({
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat',
        apiKey: deepseekKey
      });
    }

    // Anthropic
    if (anthropicKey) {
      this.providers.push({
        name: 'Anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-sonnet-20240229',
        apiKey: anthropicKey
      });
    }

    console.log(`Initialized ${this.providers.length} AI providers`);
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
        
        console.log(`AI API request failed (status: ${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retryOptions.maxRetries + 1})`);
        
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
        
        console.log(`AI API request failed with error: ${lastError.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retryOptions.maxRetries + 1})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but just in case
    throw lastError!;
  }

  async analyzeGlucoseData(readings: any[], treatments: any[], currentProfile: any): Promise<AIAnalysisResult> {
    console.log('Starting AI analysis');
    
    // Reinitialize providers to get the latest API keys
    this.reinitializeProviders();
    
    // PRIORITY 1: API providers (when API keys are present)
    if (this.providers.length > 0) {
      console.log('API keys detected - using API providers as primary analysis method');
      
      // Try each provider in order until one succeeds
      for (const provider of this.providers) {
        try {
          console.log(`Attempting analysis with ${provider.name} API`);
          
          if (provider.name === 'OpenAI') {
            const result = await this.analyzeWithOpenAI(provider, readings, treatments, currentProfile);
            console.log('OpenAI analysis successful');
            return result;
          } else if (provider.name === 'DeepSeek') {
            const result = await this.analyzeWithDeepSeek(provider, readings, treatments, currentProfile);
            console.log('DeepSeek analysis successful');
            return result;
          } else if (provider.name === 'Anthropic') {
            const result = await this.analyzeWithAnthropic(provider, readings, treatments, currentProfile);
            console.log('Anthropic analysis successful');
            return result;
          }
        } catch (error) {
          console.error(`${provider.name} analysis failed:`, error);
        }
      }
      
      console.log('All API providers failed, falling back to TensorFlow');
    }
    
    // PRIORITY 2: TensorFlow AI Service (fallback when no API keys, or API keys failed)
    try {
      if (this.tensorFlowService.isReady()) {
        console.log('Using TensorFlow AI Service');
        const tensorFlowResult = await this.tensorFlowService.analyzeGlucoseData(readings, treatments);
        
        // Convert TensorFlow result to our expected format
        const result: AIAnalysisResult = {
          recommendations: tensorFlowResult.recommendations,
          riskAssessment: tensorFlowResult.riskAssessment,
          confidence: tensorFlowResult.confidence,
          reasoning: tensorFlowResult.reasoning,
          safetyWarnings: tensorFlowResult.safetyWarnings
        };
        
        console.log('TensorFlow AI analysis completed successfully');
        return result;
      } else {
        const tfStatus = this.tensorFlowService.isTensorFlowEnabledByUser() ? 
          'initializing...' : 'disabled by user';
        console.log(`TensorFlow not ready (${tfStatus})`);
      }
    } catch (error) {
      console.error('TensorFlow AI analysis failed:', error);
    }

    // PRIORITY 3: Basic fallback if all else fails
    console.log('Using basic fallback analysis');
    return this.getFallbackAnalysis(readings, treatments, currentProfile);
  }

  private async analyzeWithOpenAI(provider: AIProvider, readings: any[], treatments: any[], currentProfile: any): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
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
      5. safetyWarnings: any critical warnings
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
      
      // Try to parse JSON from the response
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        const result = JSON.parse(jsonString);
        
        return {
          recommendations: result.recommendations || [],
          riskAssessment: result.riskAssessment || 'medium',
          confidence: result.confidence || 70,
          reasoning: result.reasoning || [],
          safetyWarnings: result.safetyWarnings || []
        };
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('Invalid response format from OpenAI');
      }
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  private async analyzeWithDeepSeek(provider: AIProvider, readings: any[], treatments: any[], currentProfile: any): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
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
      5. safetyWarnings: any critical warnings
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
      
      // Try to parse JSON from the response
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        const result = JSON.parse(jsonString);
        
        return {
          recommendations: result.recommendations || [],
          riskAssessment: result.riskAssessment || 'medium',
          confidence: result.confidence || 70,
          reasoning: result.reasoning || [],
          safetyWarnings: result.safetyWarnings || []
        };
      } catch (parseError) {
        console.error('Failed to parse DeepSeek response:', parseError);
        throw new Error('Invalid response format from DeepSeek');
      }
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      throw error;
    }
  }

  private async analyzeWithAnthropic(provider: AIProvider, readings: any[], treatments: any[], currentProfile: any): Promise<AIAnalysisResult> {
    // Prepare data for analysis
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
    // Sample data to avoid token limits - INCREASED SAMPLING TO REDUCE TOKENS
    const sampledReadings = this.sampleData(readings, 50); // Reduced from 100 to 50
    const sampledTreatments = this.sampleData(treatments, 25); // Reduced from 50 to 25
    
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
      5. safetyWarnings: any critical warnings
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
      
      // Try to parse JSON from the response
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        const result = JSON.parse(jsonString);
        
        return {
          recommendations: result.recommendations || [],
          riskAssessment: result.riskAssessment || 'medium',
          confidence: result.confidence || 70,
          reasoning: result.reasoning || [],
          safetyWarnings: result.safetyWarnings || []
        };
      } catch (parseError) {
        console.error('Failed to parse Anthropic response:', parseError);
        throw new Error('Invalid response format from Anthropic');
      }
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  private getFallbackAnalysis(readings: any[], treatments: any[], currentProfile: any): AIAnalysisResult {
    const timeInRange = this.calculateTimeInRange(readings);
    const hypoglycemiaRisk = this.assessHypoglycemiaRisk(readings, treatments);
    
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

  private calculateTimeInRange(readings: any[]) {
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

  private assessHypoglycemiaRisk(readings: any[], treatments: any[]) {
    const lowReadings = readings.filter(r => toMmol(r.sgv) < 3.9);
    const severelyLowReadings = readings.filter(r => toMmol(r.sgv) < 3.0);
    
    return {
      episodes: lowReadings.length,
      severity: severelyLowReadings.length > 0 ? 'severe' : 
                lowReadings.length > readings.length * 0.04 ? 'high' : 
                lowReadings.length > 0 ? 'moderate' : 'low'
    };
  }

  private sampleData(data: any[], maxSamples: number) {
    if (!data || data.length <= maxSamples) return data;
    
    const step = Math.ceil(data.length / maxSamples);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    return sampled;
  }

  // Check if API keys are working AND TensorFlow status
  async testAPIKeys(): Promise<{openai: boolean, deepseek: boolean, anthropic: boolean, tensorflow: boolean}> {
    // Reinitialize providers to get the latest API keys
    this.reinitializeProviders();
    
    const results = {
      openai: false,
      deepseek: false,
      anthropic: false,
      tensorflow: this.tensorFlowService.isReady()
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
  getTensorFlowInfo(): any {
    return {
      isReady: this.tensorFlowService.isReady(),
      isEnabled: this.tensorFlowService.isTensorFlowEnabledByUser(),
      shouldUse: this.tensorFlowService.shouldUseTensorFlow(),
      modelInfo: this.tensorFlowService.getModelInfo()
    };
  }

  // Get TensorFlow service for settings access
  getTensorFlowService(): TensorFlowAIService {
    return this.tensorFlowService;
  }
}

export const aiAnalysisService = new AIAnalysisService();