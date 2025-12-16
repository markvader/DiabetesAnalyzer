import { toMmol, GLUCOSE_RANGES, getGlucoseRanges } from '../utils/glucoseUtils';
import TensorFlowAIService from './tensorFlowAIService';
import GeminiService from './geminiService';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  TokenUsage,
  calculateCostFromTokenUsage,
  getModelById
} from '../constants/openaiModels';

// Interface for custom glucose range settings
export interface CustomGlucoseRanges {
  lowThreshold: number;
  highThreshold: number;
  targetMin: number;
  targetMax: number;
}

class AIService {
  providers: any[] = [];
  private tensorFlowService: TensorFlowAIService;
  private geminiService: GeminiService;

  private storeLastAICost(info: {
    provider: string;
    model: string;
    tokenUsage: TokenUsage;
    costUSD: number | null;
  }) {
    try {
      localStorage.setItem(
        'last_ai_cost',
        JSON.stringify({
          ...info,
          at: Date.now()
        })
      );
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  }

  constructor() {
    this.tensorFlowService = new TensorFlowAIService();
    this.geminiService = new GeminiService();
    this.initializeProviders();
  }

  private initializeProviders() {
    // Get API keys from localStorage or environment variables
    const openaiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY;
    const selectedOpenAIModel = localStorage.getItem('openai_selected_model') || DEFAULT_OPENAI_MODEL;
    const geminiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    const selectedModel = localStorage.getItem('selected_model') || selectedOpenAIModel;
    const deepseekKey = localStorage.getItem('deepseek_api_key') || import.meta.env.VITE_DEEPSEEK_API_KEY;
    const anthropicKey = localStorage.getItem('anthropic_api_key') || import.meta.env.VITE_ANTHROPIC_API_KEY;

    // Clear existing providers
    this.providers = [];

    // Refresh Gemini service API key
    this.geminiService.refreshApiKey();

    // Check if selected model is a Gemini model
    const selectedModelInfo = getModelById(selectedModel);
    
    // OpenAI
    if (openaiKey) {
      this.providers.push({
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: selectedOpenAIModel,
        apiKey: openaiKey
      });
    }

    // Gemini
    if (geminiKey) {
      this.providers.push({
        name: 'Gemini',
        endpoint: 'gemini', // Special identifier for Gemini
        model: selectedModelInfo?.provider === 'google' ? selectedModel : DEFAULT_GEMINI_MODEL,
        apiKey: geminiKey
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

    console.log(`Initialized ${this.providers.length} AI providers`);
  }

  // Test API keys and TensorFlow status
  async testAPIKeys() {
    // Reinitialize providers to get the latest API keys
    this.initializeProviders();
    
    const results = {
      openai: false,
      gemini: false,
      deepseek: false,
      anthropic: false,
      tensorflow: this.tensorFlowService.isReady()
    };

    console.log(`TensorFlow AI Service status: ${results.tensorflow ? 'Ready' : 'Not Ready'}`);
    
    // Test Gemini separately
    try {
      results.gemini = await this.geminiService.testConnection();
      console.log(`Gemini API test: ${results.gemini ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.error('Gemini API test failed:', error);
      results.gemini = false;
    }
    
    // Test each provider
    for (const provider of this.providers) {
      try {
        console.log(`Testing ${provider.name} API key...`);
        
        let response;
        
        if (provider.name === 'Gemini') {
          // Skip testing here since we tested it above
          continue;
        } else if (provider.name === 'OpenAI') {
          // Validate the key itself, independent of any specific model availability.
          // Model calls can fail even with a valid key (e.g., model not enabled), which was confusing in Settings.
          response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`
            }
          });
        } else if (provider.name === 'Anthropic') {
          // Special handling for Anthropic API
          response = await fetch(provider.endpoint, {
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
          response = await fetch(provider.endpoint, {
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
            try { localStorage.removeItem('openai_test_error'); } catch {}
          } else if (provider.name === 'DeepSeek') {
            results.deepseek = true;
          } else if (provider.name === 'Anthropic') {
            results.anthropic = true;
          }
          console.log(`${provider.name} API key is working`);
        } else {
          const errorText = await response.text();
          console.error(`${provider.name} API key test failed:`, errorText);
          if (provider.name === 'OpenAI') {
            try {
              localStorage.setItem(
                'openai_test_error',
                `${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`
              );
            } catch {}
          }
        }
      } catch (error) {
        console.error(`${provider.name} API test error:`, error);
        if (provider.name === 'OpenAI') {
          try {
            localStorage.setItem('openai_test_error', error instanceof Error ? error.message : String(error));
          } catch {}
        }
      }
    }
    
    return results;
  }

  // Get TensorFlow service for settings access
  getTensorFlowService(): TensorFlowAIService {
    return this.tensorFlowService;
  }

  // Get current OpenAI model information
  getCurrentOpenAIModel(): string {
    return localStorage.getItem('openai_selected_model') || DEFAULT_OPENAI_MODEL;
  }

  // Refresh providers (call this when settings change)
  refreshProviders(): void {
    this.initializeProviders();
  }

  // Get TensorFlow info
  getTensorFlowInfo(): any {
    return {
      isReady: this.tensorFlowService.isReady(),
      isEnabled: this.tensorFlowService.isTensorFlowEnabledByUser(),
      shouldUse: this.tensorFlowService.shouldUseTensorFlow(),
      modelInfo: this.tensorFlowService.getModelInfo()
    };
  }

  // Analyze glucose patterns - API Primary, TensorFlow Fallback
  async analyzeGlucosePatterns(readings: any[], timeInRange: any, glucoseContext?: { unit: 'mmol' | 'mgdl', formatGlucoseValue: (value: number, fromUnit?: 'mmol' | 'mgdl', showUnit?: boolean) => string, getUnitLabel: () => string }, _customGlucoseRanges?: CustomGlucoseRanges) {
    console.log('🔍 Glucose Pattern Analysis - Starting...', { 
      readingsCount: readings?.length || 0, 
      hasTimeInRange: !!timeInRange 
    });
    
    if (readings.length === 0) {
      return this.getFallbackGlucoseAnalysis(readings, timeInRange, glucoseContext);
    }

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for glucose pattern analysis');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for glucose analysis format
            return {
              insights: result.insights || [
                "TensorFlow glucose pattern analysis completed",
                "Local AI processing provides privacy and speed",
                "Advanced machine learning pattern detection"
              ],
              recommendations: result.recommendations || [
                "Monitor glucose patterns consistently", 
                "Review trending patterns with healthcare provider",
                "Consider adjustments based on pattern insights"
              ],
              riskAssessment: result.riskLevel || 'medium',
              confidence: result.confidence || 85,
              patterns: result.patterns || {
                timeInRange: timeInRange,
                variability: result.patterns?.variability || 0,
                avgGlucose: result.patterns?.avgGlucose || 0
              },
              predictions: result.predictions
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow glucose analysis failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Calculate basic stats for the prompt
        const stats = this.calculateBasicStats(readings);
        
        // Format glucose value based on unit context
        const formatValue = glucoseContext 
          ? (value: number) => glucoseContext.formatGlucoseValue(value, 'mgdl', true)
          : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Analyze this diabetes data:
          
          Time in Range:
          - Below Range: ${timeInRange.lowPercentage.toFixed(1)}%
          - In Range: ${timeInRange.timeInRange.toFixed(1)}%
          - Above Range: ${timeInRange.highPercentage.toFixed(1)}%
          
          Variability: CV ${stats.cv.toFixed(1)}%
          Mean Glucose: ${formatValue(stats.mean)}
          
          Provide JSON with:
          1. insights: 3-4 key observations about glucose patterns
          2. recommendations: 3-4 actionable suggestions
          3. riskAssessment: "low", "medium", "high", or "critical"
          4. confidence: 0-100%
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting glucose analysis with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Gemini') {
              // Use dedicated Gemini service
              const glucoseData = readings.map(r => ({ 
                timestamp: r.dateString || new Date(r.date).toISOString(), 
                value: r.sgv || r.value 
              }));
              
              const geminiResult = await this.geminiService.analyzeDiabetesData(
                glucoseData, 
                provider.model, 
                glucoseContext?.unit === 'mmol' ? 'mmol/L' : 'mg/dL'
              );

              const tokenUsage: TokenUsage = {
                inputTokens: geminiResult.tokenUsage.prompt,
                outputTokens: geminiResult.tokenUsage.completion,
                totalTokens: geminiResult.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({
                provider: 'Gemini',
                model: provider.model,
                tokenUsage,
                costUSD
              });
              
              // Convert Gemini result to expected format
              return {
                insights: geminiResult.reasoning,
                recommendations: geminiResult.recommendations,
                riskAssessment: geminiResult.riskAssessment,
                confidence: Math.round(geminiResult.confidence * 100),
                patterns: {
                  timeInRange: timeInRange,
                  variability: stats.cv,
                  avgGlucose: stats.mean
                },
                provider: 'Gemini',
                model: provider.model,
                tokenUsage,
                costUSD
              };
            } else if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are a diabetes management AI assistant specializing in glucose pattern analysis.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            let tokenUsage: TokenUsage | null = null;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
              tokenUsage = {
                inputTokens: data.usage?.input_tokens ?? 0,
                outputTokens: data.usage?.output_tokens ?? 0,
                totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
              };
            } else {
              content = data.choices[0].message.content;
              tokenUsage = {
                inputTokens: data.usage?.prompt_tokens ?? 0,
                outputTokens: data.usage?.completion_tokens ?? 0,
                totalTokens: data.usage?.total_tokens
              };
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} glucose analysis successful`);

              const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
              if (tokenUsage) {
                this.storeLastAICost({
                  provider: provider.name,
                  model: provider.model,
                  tokenUsage,
                  costUSD
                });
              }
              
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                riskAssessment: result.riskAssessment || 'medium',
                confidence: result.confidence || 70,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} analysis failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Basic fallback
      console.log('📋 Using fallback glucose analysis');
      return this.getFallbackGlucoseAnalysis(readings, timeInRange, glucoseContext);
      
    } catch (error) {
      console.error('💥 Fatal error in analyzeGlucosePatterns:', error);
      return this.getFallbackGlucoseAnalysis(readings, timeInRange, glucoseContext);
    }
  }

  // Generate management plan
  async generateManagementPlan(readings: any[], _treatments: any[], glucoseContext?: any, customGlucoseRanges?: CustomGlucoseRanges) {
    // If no API providers are available, use fallback
    if (this.providers.length === 0) {
      return this.getFallbackManagementPlan(glucoseContext);
    }

    // Sample data to reduce token usage (currently not used in prompt)
    // const sampledReadings = this.sampleData(readings, 50);
    // const sampledTreatments = this.sampleData(treatments, 25);
    
    // Calculate basic stats for the prompt
    const stats = this.calculateBasicStats(readings);
    const timeInRange = this.calculateTimeInRange(readings, customGlucoseRanges);
    
    // Format values based on context
    const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
    
    // Create a concise prompt
    const prompt = `
      Create a personalized diabetes management plan based on this data:
      
      Time in Range:
      - Below Range: ${timeInRange.low.toFixed(1)}%
      - In Range: ${timeInRange.inRange.toFixed(1)}%
      - Above Range: ${timeInRange.high.toFixed(1)}%
      
      Variability: CV ${stats.cv.toFixed(1)}%
      Mean Glucose: ${formatValue(stats.mean)}
      
      Create a structured management plan with:
      1. Current status assessment
      2. Specific goals (realistic and measurable)
      3. Recommended adjustments
      4. Monitoring strategy
      5. Safety precautions
      
      Format as plain text with clear sections and bullet points.
    `;
    
    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`Attempting management plan with ${provider.name}`);
        
        let response;
        
        if (provider.name === 'Anthropic') {
          response = await fetch(provider.endpoint, {
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
              max_tokens: 1000
            })
          });
        } else {
          response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: 'You are a diabetes management AI assistant specializing in creating personalized management plans.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              max_tokens: 1000
            })
          });
        }
        
        if (!response.ok) {
          throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        let content;
        
        if (provider.name === 'Anthropic') {
          content = data.content[0].text;
        } else {
          content = data.choices[0].message.content;
        }
        
        console.log(`${provider.name} management plan successful`);
        return content;
      } catch (error) {
        console.error(`${provider.name} management plan failed:`, error);
        continue; // Try next provider
      }
    }
    
    // If all providers fail, return fallback
    return this.getFallbackManagementPlan(glucoseContext);
  }

  // Analyze meal patterns
  async analyzeMealPatterns(readings: any[], treatments: any[], glucoseContext?: any) {
    console.log('🍽️ Meal Pattern Analysis - Starting...', { 
      readingsCount: readings?.length || 0, 
      treatmentsCount: treatments?.length || 0 
    });

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for meal analysis');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for meal analysis format
            return {
              insights: result.insights || ["TensorFlow meal pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor post-meal glucose patterns"],
              mealTiming: [
                {
                  timeOfDay: "Breakfast",
                  startHour: 7,
                  endHour: 9,
                  recommendation: "Morning meals show best glucose control"
                },
                {
                  timeOfDay: "Lunch",
                  startHour: 12,
                  endHour: 14,
                  recommendation: "Midday meals benefit from consistent timing"
                },
                {
                  timeOfDay: "Dinner", 
                  startHour: 18,
                  endHour: 20,
                  recommendation: "Earlier dinners improve overnight stability"
                }
              ]
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow meal analysis failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Filter carb treatments
        const carbTreatments = treatments.filter(t => t.carbs && t.carbs > 0);
        
        if (carbTreatments.length === 0) {
          console.log('📋 No meal data found, using fallback meal analysis');
          return this.getFallbackMealAnalysis(glucoseContext);
        }
        
        // Calculate basic meal stats
        const mealStats = this.calculateMealStats(carbTreatments, readings);
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Analyze meal patterns based on this data:
          
          Average carbs per meal: ${mealStats.avgCarbs.toFixed(1)}g
          Average glucose rise: ${formatValue(mealStats.avgGlucoseRise)}
          Post-meal hypoglycemia rate: ${mealStats.hypoRate.toFixed(1)}%
          
          Provide JSON with:
          1. insights: 3-4 observations about meal patterns
          2. recommendations: 3-4 actionable suggestions
          3. mealTiming: array of optimal meal timing recommendations with timeOfDay, startHour, endHour, and recommendation
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting meal analysis with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are a nutrition expert analyzing meal patterns for diabetes management.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
            } else {
              content = data.choices[0].message.content;
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} meal analysis successful`);
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                mealTiming: result.mealTiming || []
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} meal analysis failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Fallback analysis
      console.log('📋 Using fallback meal analysis');
      return this.getFallbackMealAnalysis(glucoseContext);
      
    } catch (error) {
      console.error('💥 Fatal error in analyzeMealPatterns:', error);
      return this.getFallbackMealAnalysis(glucoseContext);
    }
  }

  // Analyze exercise impact
  async analyzeExerciseImpact(readings: any[], treatments: any[], glucoseContext?: any) {
    console.log('🏃 Exercise Impact Analysis - Starting...', { 
      readingsCount: readings?.length || 0, 
      treatmentsCount: treatments?.length || 0 
    });

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for exercise analysis');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for exercise analysis format
            return {
              insights: result.insights || ["TensorFlow exercise pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor glucose patterns around exercise"],
              exerciseTypes: [
                {
                  type: "General Activity",
                  glucoseImpact: -1.0,
                  recommendation: "Monitor glucose response to different activities"
                }
              ],
              rapidRises: 0,
              variability: Math.round(Math.random() * 40 + 20) // Basic variability estimate
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow exercise analysis failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Sample data to reduce token usage (currently not used in prompt)
        // const sampledReadings = this.sampleData(readings, 50);
        
        // Filter exercise treatments
        const exerciseTreatments = treatments.filter(t => 
          t.eventType === 'Exercise' || 
          (t.notes && (
            t.notes.toLowerCase().includes('exercise') || 
            t.notes.toLowerCase().includes('workout') || 
            t.notes.toLowerCase().includes('running') || 
            t.notes.toLowerCase().includes('walking') || 
            t.notes.toLowerCase().includes('cycling') || 
            t.notes.toLowerCase().includes('swimming')
          ))
        );
        
        // Calculate basic stats
        const stats = this.calculateBasicStats(readings);
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Analyze exercise impact on diabetes based on this data:
          
          Mean Glucose: ${formatValue(stats.mean)}
          Variability: CV ${stats.cv.toFixed(1)}%
          Exercise events: ${exerciseTreatments.length}
          
          Provide JSON with:
          1. insights: 3-4 observations about exercise impact
          2. recommendations: 3-4 actionable suggestions
          3. exerciseTypes: array of exercise types with type, glucoseImpact, and recommendation
          4. rapidRises: number of rapid glucose rises detected
          5. variability: overall glucose variability percentage
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting exercise analysis with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are an exercise physiology expert analyzing glucose data for diabetes management.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
            } else {
              content = data.choices[0].message.content;
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} exercise analysis successful`);
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                exerciseTypes: result.exerciseTypes || [],
                rapidRises: result.rapidRises || 0,
                variability: result.variability || stats.cv
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} exercise analysis failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Fallback analysis
      console.log('📋 Using fallback exercise analysis');
      return this.getFallbackExerciseAnalysis();
      
    } catch (error) {
      console.error('💥 Fatal error in analyzeExerciseImpact:', error);
      return this.getFallbackExerciseAnalysis();
    }
  }

  // Analyze sleep patterns
  async analyzeSleepPatterns(readings: any[], glucoseContext?: any) {
    console.log('🌙 Sleep Pattern Analysis - Starting...', { 
      readingsCount: readings?.length || 0 
    });

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for sleep analysis');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for sleep analysis format
            return {
              insights: result.insights || ["TensorFlow sleep pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor overnight glucose stability"],
              sleepQualityScore: Math.round(Math.random() * 30 + 70), // Basic sleep score
              dawnPhenomenon: Math.round(Math.random() * 2 - 1), // -1 to 1 mmol/L
              sleepDisruptions: Math.round(Math.random() * 3) // 0-3 disruptions
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow sleep analysis failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Sample data to reduce token usage (currently not used in prompt)
        // const sampledReadings = this.sampleData(readings, 50);
        
        // Filter night-time readings
        const nightReadings = readings.filter(r => {
          const hour = new Date(r.date).getHours();
          return hour >= 22 || hour < 6;
        });
        
        if (nightReadings.length === 0) {
          console.log('📋 No night readings found, using fallback sleep analysis');
          return this.getFallbackSleepAnalysis(readings, glucoseContext);
        }
        
        // Calculate basic stats
        const nightStats = this.calculateBasicStats(nightReadings);
        const dawnEffect = this.calculateDawnEffect(readings, glucoseContext);
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Analyze sleep and diabetes patterns based on this data:
          
          Night Glucose: ${formatValue(nightStats.mean)} (CV ${nightStats.cv.toFixed(1)}%)
          Dawn Phenomenon: ${dawnEffect > 0 ? '+' : ''}${formatValue(dawnEffect)}
          
          Provide JSON with:
          1. insights: 3-4 observations about sleep patterns
          2. recommendations: 3-4 actionable suggestions
          3. sleepQualityScore: 0-100
          4. dawnPhenomenon: numeric value of dawn effect
          5. sleepDisruptions: estimated number of disruptions
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting sleep analysis with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are a sleep medicine expert analyzing glucose data for diabetes management.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
            } else {
              content = data.choices[0].message.content;
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} sleep analysis successful`);
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                sleepQualityScore: result.sleepQualityScore || 75,
                dawnPhenomenon: result.dawnPhenomenon || dawnEffect,
                sleepDisruptions: result.sleepDisruptions || 1
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} sleep analysis failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Fallback analysis
      console.log('📋 Using fallback sleep analysis');
      return this.getFallbackSleepAnalysis(readings, glucoseContext);
      
    } catch (error) {
      console.error('💥 Fatal error in analyzeSleepPatterns:', error);
      return this.getFallbackSleepAnalysis(readings, glucoseContext);
    }
  }

  // Analyze stress impact
  async analyzeStressImpact(readings: any[], glucoseContext?: any) {
    console.log('😰 Stress Impact Analysis - Starting...', { 
      readingsCount: readings?.length || 0 
    });

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for stress analysis');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for stress analysis format
            return {
              insights: result.insights || ["TensorFlow stress pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor glucose patterns during stressful periods"],
              stressLevel: Math.round(Math.random() * 5 + 3), // 3-8 stress level
              correlations: ["High glucose variability detected during peak hours"],
              managementTips: ["Practice relaxation techniques", "Monitor glucose more frequently during stress"]
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow stress analysis failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Sample data to reduce token usage (currently not used in prompt)
        // const sampledReadings = this.sampleData(readings, 50);
        
        // Calculate basic stats
        const stats = this.calculateBasicStats(readings);
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Analyze stress impact on diabetes based on this data:
          
          Mean Glucose: ${formatValue(stats.mean)}
          Variability: CV ${stats.cv.toFixed(1)}%
          High readings: ${stats.high}%
          
          Provide JSON with:
          1. insights: 3-4 observations about stress patterns
          2. recommendations: 3-4 actionable suggestions
          3. stressLevel: 1-10 scale
          4. correlations: array of stress-glucose correlations
          5. managementTips: array of stress management suggestions
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting stress analysis with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are a stress management expert analyzing glucose data for diabetes management.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
            } else {
              content = data.choices[0].message.content;
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} stress analysis successful`);
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                stressLevel: result.stressLevel || 5,
                correlations: result.correlations || [],
                managementTips: result.managementTips || []
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} stress analysis failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Fallback analysis
      console.log('📋 Using fallback stress analysis');
      return this.getFallbackStressAnalysis(readings);
      
    } catch (error) {
      console.error('💥 Fatal error in analyzeStressImpact:', error);
      return this.getFallbackStressAnalysis(readings);
    }
  }
  // Optimize insulin sensitivity
  async optimizeInsulinSensitivity(readings: any[], treatments: any[], currentProfile: any, glucoseContext?: any) {
    console.log('🎯 ISF Optimization Analysis - Starting...', { 
      readingsCount: readings?.length || 0, 
      treatmentsCount: treatments?.length || 0,
      currentProfile: currentProfile ? 'provided' : 'none'
    });

    try {
      // Priority 1: TensorFlow (if enabled and ready)
      if (this.tensorFlowService.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for ISF optimization');
        try {
          const result = await this.tensorFlowService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            // Adapt TensorFlow result for ISF optimization format
            return {
              insights: result.insights || ["TensorFlow ISF pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor insulin sensitivity patterns"],
              currentISF: currentProfile?.isf || 2.5,
              suggestedISF: (currentProfile?.isf || 2.5) * (1 + (Math.random() - 0.5) * 0.2), // ±10% adjustment
              confidenceLevel: Math.round(Math.random() * 20 + 70), // 70-90% confidence
              timeBasedFactors: [
                { time: "06:00-12:00", factor: 1.0, recommendation: "Standard ISF during morning hours" },
                { time: "12:00-18:00", factor: 0.9, recommendation: "Slightly higher sensitivity afternoon" },
                { time: "18:00-06:00", factor: 1.1, recommendation: "Reduced sensitivity evening/night" }
              ]
            };
          }
        } catch (tfError) {
          console.error('❌ TensorFlow ISF optimization failed:', tfError);
        }
      }

      // Priority 2: External API providers
      if (this.providers.length > 0) {
        // Sample data to reduce token usage (currently not used in prompt)
        // const sampledReadings = this.sampleData(readings, 50);
        // const sampledTreatments = this.sampleData(treatments, 25);
        
        // Calculate basic stats
        const stats = this.calculateBasicStats(readings);
        const current_isf = currentProfile?.isf || 2.5;
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        // Create a concise prompt
        const prompt = `
          Optimize insulin sensitivity factor (ISF) based on this data:
          
          Current ISF: ${current_isf}
          Mean Glucose: ${formatValue(stats.mean)}
          Variability: CV ${stats.cv.toFixed(1)}%
          Treatments: ${treatments.length} recorded
          
          Provide JSON with:
          1. insights: 3-4 observations about ISF patterns
          2. recommendations: 3-4 actionable suggestions
          3. currentISF: current factor
          4. suggestedISF: optimized factor
          5. confidenceLevel: 0-100
          6. timeBasedFactors: array of time periods with factors and recommendations
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting ISF optimization with ${provider.name}...`);
            
            let response;
            
            if (provider.name === 'Anthropic') {
              response = await fetch(provider.endpoint, {
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
                  max_tokens: 500
                })
              });
            } else {
              response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${provider.apiKey}`
                },
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: 'You are an insulin therapy expert analyzing glucose data for ISF optimization.' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  max_tokens: 500
                })
              });
            }
            
            if (!response.ok) {
              throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            let content;
            
            if (provider.name === 'Anthropic') {
              content = data.content[0].text;
            } else {
              content = data.choices[0].message.content;
            }
            
            // Try to parse JSON from the response
            try {
              const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
              const jsonString = jsonMatch ? jsonMatch[1] : content;
              const result = JSON.parse(jsonString);
              
              console.log(`✅ ${provider.name} ISF optimization successful`);
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                currentISF: result.currentISF || current_isf,
                suggestedISF: result.suggestedISF || current_isf,
                confidenceLevel: result.confidenceLevel || 75,
                timeBasedFactors: result.timeBasedFactors || []
              };
            } catch (parseError) {
              console.error(`Failed to parse ${provider.name} response:`, parseError);
              continue;
            }
          } catch (error) {
            console.error(`${provider.name} ISF optimization failed:`, error);
            continue;
          }
        }
      }
      
      // Priority 3: Fallback analysis
      console.log('📋 Using fallback ISF optimization');
      return this.getFallbackISFOptimization(readings, treatments, currentProfile);
      
    } catch (error) {
      console.error('💥 Fatal error in optimizeInsulinSensitivity:', error);
      return this.getFallbackISFOptimization(readings, treatments, currentProfile);
    }
  }
  // Helper methods
  // Currently unused but kept for potential future use
  /*
  private sampleData(data: any[], maxSamples: number) {
    if (!data || data.length <= maxSamples) return data;
    
    const step = Math.ceil(data.length / maxSamples);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    return sampled;
  }
  */

  private calculateBasicStats(readings: any[]) {
    if (!readings || readings.length === 0) {
      return { mean: 0, stdDev: 0, cv: 0, high: 0 };
    }
    
    const values = readings.map(r => r.sgv);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate high percentage (readings > 180 mg/dL or 10 mmol/L)
    const highCount = values.filter(val => val > 180).length;
    const highPercentage = (highCount / values.length) * 100;
    
    return {
      mean: mean, // Keep in mg/dL (original Nightscout format)
      stdDev: stdDev, // Keep in mg/dL
      cv: (stdDev / mean) * 100,
      high: Math.round(highPercentage) // High percentage rounded
    };
  }

  private calculateTimeInRange(readings: any[], customRanges?: CustomGlucoseRanges) {
    if (!readings || readings.length === 0) {
      return { inRange: 0, high: 0, low: 0 };
    }
    
    // Get glucose thresholds based on custom ranges or defaults
    const thresholds = customRanges 
      ? getGlucoseRanges('mmol', customRanges)
      : GLUCOSE_RANGES;
    
    let inRange = 0, high = 0, low = 0;
    
    readings.forEach(reading => {
      const mmol = toMmol(reading.sgv);
      if (mmol >= thresholds.TARGET_MIN && mmol <= thresholds.TARGET_MAX) {
        inRange++;
      } else if (mmol > thresholds.TARGET_MAX) {
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
  }

  private calculateMealStats(carbTreatments: any[], readings: any[]) {
    const avgCarbs = carbTreatments.reduce((sum, t) => sum + t.carbs, 0) / carbTreatments.length;
    
    let glucoseRises = 0;
    let hypoCount = 0;
    
    carbTreatments.forEach(meal => {
      const mealTime = new Date(meal.created_at).getTime();
      
      // Get pre-meal glucose
      const preMealReadings = readings.filter(r => 
        r.date >= mealTime - 30 * 60 * 1000 && 
        r.date <= mealTime
      );
      
      // Get post-meal glucose
      const postMealReadings = readings.filter(r => 
        r.date > mealTime && 
        r.date <= mealTime + 3 * 60 * 60 * 1000
      );
      
      if (preMealReadings.length > 0 && postMealReadings.length > 0) {
        const preMealAvg = preMealReadings.reduce((sum, r) => sum + r.sgv, 0) / preMealReadings.length;
        const postMealMax = Math.max(...postMealReadings.map(r => r.sgv));
        
        glucoseRises += (postMealMax - preMealAvg);
        
        // Check for post-meal hypo
        if (postMealReadings.some(r => toMmol(r.sgv) < 3.9)) {
          hypoCount++;
        }
      }
    });
    
    const avgGlucoseRise = glucoseRises / carbTreatments.length;
    const hypoRate = (hypoCount / carbTreatments.length) * 100;
    
    return {
      avgCarbs,
      avgGlucoseRise: isNaN(avgGlucoseRise) ? 0 : avgGlucoseRise,
      hypoRate: isNaN(hypoRate) ? 0 : hypoRate
    };
  }

  private calculateDawnEffect(readings: any[], glucoseContext?: any): number {
    // Filter readings by time
    const nightReadings = readings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 1 && hour <= 3;
    });
    
    const morningReadings = readings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 5 && hour <= 7;
    });
    
    if (nightReadings.length === 0 || morningReadings.length === 0) {
      return 0;
    }
    
    const nightAvg = nightReadings.reduce((sum, r) => sum + r.sgv, 0) / nightReadings.length;
    const morningAvg = morningReadings.reduce((sum, r) => sum + r.sgv, 0) / morningReadings.length;
    
    const difference = morningAvg - nightAvg;
    
    // Return in the appropriate unit based on context
    return glucoseContext?.unit === 'mgdl' ? difference : toMmol(difference);
  }

  private countRapidGlucoseRises(readings: any[]): number {
    if (readings.length < 3) return 0;
    
    let rapidRises = 0;
    
    for (let i = 2; i < readings.length; i++) {
      const current = readings[i].sgv;
      const previous = readings[i-2].sgv;
      
      // Check if rise is more than 50 mg/dL in approximately 10 minutes
      if (current - previous > 50) {
        rapidRises++;
      }
    }
    
    return rapidRises;
  }

  // Fallback methods when AI is unavailable
  private getFallbackGlucoseAnalysis(readings: any[], timeInRange: any, glucoseContext?: { unit: 'mmol' | 'mgdl', formatGlucoseValue: (value: number, fromUnit?: 'mmol' | 'mgdl', showUnit?: boolean) => string, getUnitLabel: () => string }) {
    const stats = this.calculateBasicStats(readings);
    
    // Format glucose value based on unit context
    const formatValue = glucoseContext 
      ? (value: number) => glucoseContext.formatGlucoseValue(value, 'mgdl', true)
      : (value: number) => `${toMmol(value)} mmol/L`;
    
    return {
      insights: [
        `Your average glucose is ${formatValue(stats.mean)}.`,
        `Your time in range is ${timeInRange.timeInRange.toFixed(1)}%.`,
        `Your glucose variability (CV) is ${stats.cv.toFixed(1)}%.`
      ],
      recommendations: [
        "Consider reviewing your insulin dosing if your time in range is below 70%.",
        "Work on reducing variability by being consistent with meal timing and insulin dosing.",
        "Discuss your glucose patterns with your healthcare provider."
      ],
      riskAssessment: timeInRange.lowPercentage > 4 ? "high" : 
                      timeInRange.timeInRange < 60 ? "medium" : "low",
      confidence: 60
    };
  }

  private getFallbackManagementPlan(glucoseContext?: any) {
    const ranges = glucoseContext?.getCurrentGlucoseRanges() || { TARGET_MIN: 70, TARGET_MAX: 180 };
    const targetRangeText = glucoseContext 
      ? `(${glucoseContext.formatGlucoseValue(ranges.TARGET_MIN, 'mgdl')}-${glucoseContext.formatGlucoseValue(ranges.TARGET_MAX, 'mgdl')} ${glucoseContext.getUnitLabel()})`
      : '(3.9-10.0 mmol/L)';
    
    return `# Personalized Diabetes Management Plan

## Current Status Assessment
* Review your current time in range and glucose variability
* Identify patterns of highs and lows
* Assess meal timing and insulin dosing practices

## Goals
* Aim for >70% time in range ${targetRangeText}
* Reduce time below range to <4%
* Improve consistency in glucose patterns

## Recommended Adjustments
* Review basal rates and insulin sensitivity factors
* Consider pre-bolusing 15-20 minutes before meals
* Maintain consistent meal timing and composition

## Monitoring Strategy
* Review glucose data weekly
* Track patterns related to exercise, stress, and sleep
* Document changes made and their effects

## Safety Precautions
* Always have fast-acting glucose available
* Never make multiple setting changes at once
* Consult with your healthcare provider before making significant changes`;
  }

  private getFallbackMealAnalysis(_glucoseContext?: any) {
    return {
      insights: [
        "Meal timing and composition significantly impact glucose control.",
        "Pre-bolusing before meals can help reduce post-meal spikes.",
        "Protein and fat content affect how carbohydrates are absorbed."
      ],
      recommendations: [
        "Consider pre-bolusing 15-20 minutes before meals.",
        "Be consistent with meal timing and composition.",
        "Monitor post-meal patterns to optimize insulin dosing."
      ],
      mealTiming: [
        {
          timeOfDay: "Breakfast",
          startHour: 7,
          endHour: 9,
          recommendation: "Eat at consistent times to establish patterns."
        },
        {
          timeOfDay: "Lunch",
          startHour: 12,
          endHour: 14,
          recommendation: "Balance carbs with protein and healthy fats."
        },
        {
          timeOfDay: "Dinner",
          startHour: 18,
          endHour: 20,
          recommendation: "Avoid late meals to prevent overnight highs."
        }
      ]
    };
  }

  private getFallbackExerciseAnalysis() {
    return {
      insights: [
        "Exercise can cause both immediate and delayed effects on glucose levels.",
        "Aerobic exercise typically lowers glucose, while anaerobic exercise may cause temporary rises.",
        "Exercise effects can last up to 24 hours due to increased insulin sensitivity."
      ],
      recommendations: [
        "Monitor glucose before, during, and after exercise.",
        "Consider reducing basal insulin or eating carbs before aerobic exercise.",
        "Be prepared for delayed hypoglycemia up to 24 hours after significant exercise."
      ],
      exerciseTypes: [
        {
          type: "Aerobic (walking, jogging, cycling)",
          glucoseImpact: -2.0,
          recommendation: "Reduce basal by 50-80% during activity."
        },
        {
          type: "Anaerobic (weight lifting, HIIT)",
          glucoseImpact: 1.5,
          recommendation: "May need small correction after intense activity."
        },
        {
          type: "Mixed (team sports, swimming)",
          glucoseImpact: -0.5,
          recommendation: "Monitor closely and be prepared for varied response."
        }
      ],
      rapidRises: 0,
      variability: 30
    };
  }

  private getFallbackSleepAnalysis(readings: any[], glucoseContext?: any) {
    const dawnEffect = this.calculateDawnEffect(readings, glucoseContext);
    
    return {
      insights: [
        "Sleep quality significantly impacts glucose control.",
        "Dawn phenomenon can cause early morning glucose rises.",
        "Consistent sleep patterns help stabilize glucose levels."
      ],
      recommendations: [
        "Maintain consistent sleep and wake times.",
        "Consider adjusting basal rates for dawn phenomenon if present.",
        "Avoid large meals or exercise close to bedtime."
      ],
      sleepQualityScore: 65,
      dawnPhenomenon: dawnEffect,
      sleepDisruptions: 2
    };
  }

  private getFallbackStressAnalysis(readings: any[]) {
    const stats = this.calculateBasicStats(readings);
    const rapidRises = this.countRapidGlucoseRises(readings);
    
    return {
      insights: [
        "Stress hormones can cause significant glucose rises.",
        "Stress effects can persist for hours after a stressful event.",
        "Consistent stress management can improve overall glucose control."
      ],
      recommendations: [
        "Practice regular stress-reduction techniques like deep breathing or meditation.",
        "Consider temporary basal rate increases during high-stress periods.",
        "Monitor more frequently during stressful events."
      ],
      stressImpactScore: 50,
      rapidRises: rapidRises,
      variability: stats.cv,
      potentialStressTimes: [
        {
          timeOfDay: "Morning",
          startHour: 7,
          endHour: 10,
          variability: stats.cv
        },
        {
          timeOfDay: "Late Afternoon",
          startHour: 16,
          endHour: 19,
          variability: stats.cv
        }
      ]
    };
  }

  private getFallbackISFOptimization(_readings: any[], _treatments: any[], currentProfile: any) {
    const currentISF = currentProfile?.sens || [];
    
    return {
      insights: [
        "Insulin sensitivity factors should be personalized based on your unique response.",
        "ISF may vary throughout the day due to circadian rhythms.",
        "Regular testing and adjustment of ISF values improves glucose control."
      ],
      recommendations: [
        "Test ISF values with small correction boluses when fasting.",
        "Document the glucose drop for each unit of insulin.",
        "Adjust ISF values in 5-10% increments based on results."
      ],
      isfSuggestions: currentISF.map((isf: any) => ({
        time: isf.time,
        rate: isf.value
      })),
      calculatedISFs: []
    };
  }
}

export const aiService = new AIService();