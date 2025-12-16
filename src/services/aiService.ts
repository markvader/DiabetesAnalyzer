import { toMmol, GLUCOSE_RANGES, getGlucoseRanges } from '../utils/glucoseUtils';
import type TensorFlowAIService from './tensorFlowAIService';
import GeminiService from './geminiService';
import { safeJsonParseFromText } from '../utils/safeJson';
import { asNumber, asRiskAssessment, asStringArray, normalizeDetails } from './aiValidation';
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
  private tensorFlowService: TensorFlowAIService | null = null;
  private tensorFlowServicePromise: Promise<TensorFlowAIService> | null = null;
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
    this.geminiService = new GeminiService();
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

    const tfService = await this.getTensorFlowServiceAsync();
    
    const results = {
      openai: false,
      gemini: false,
      deepseek: false,
      anthropic: false,
      tensorflow: tfService?.isReady?.() ?? false
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
  getTensorFlowService(): TensorFlowAIService | null {
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
    const svc = this.tensorFlowService;
    return {
      isReady: svc?.isReady?.() ?? false,
      isEnabled: svc?.isTensorFlowEnabledByUser?.() ?? this.isTensorFlowEnabledByUserPref(),
      shouldUse: svc?.shouldUseTensorFlow?.() ?? false,
      modelInfo: svc?.getModelInfo?.() ?? null
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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for glucose pattern analysis');
        try {
          const result = await tfService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            const stats = this.calculateBasicStats(readings);
            const tir = this.coerceTimeInRangePercent(timeInRange, result?.patterns?.timeInRange);
            const { riskAssessment, confidence } = this.assessLocalGlucoseRisk(tir, stats, readings.length);

            const formatValue = glucoseContext
              ? (value: number) => glucoseContext.formatGlucoseValue(value, 'mgdl', true)
              : (value: number) => `${toMmol(value)} mmol/L`;

            const recommendations = this.buildLocalGlucoseRecommendations(tir, stats);
            const details = this.buildLocalGlucoseDetails(tir, stats, readings, formatValue);

            const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            const costUSD = 0;
            this.storeLastAICost({
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
            });

            // Adapt TensorFlow result for glucose analysis format
            return {
              insights: result.insights || [
                "TensorFlow glucose pattern analysis completed",
                "Local AI processing provides privacy and speed",
                "Advanced machine learning pattern detection"
              ],
              recommendations,
              riskAssessment,
              confidence,
              details,
              patterns: result.patterns || {
                timeInRange: timeInRange,
                variability: result.patterns?.variability || 0,
                avgGlucose: result.patterns?.avgGlucose || 0
              },
              predictions: result.predictions,
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
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
        
            // Create a concise but more informative prompt
            const prompt = `
              You are a diabetes management AI assistant specializing in glucose pattern analysis.

              Analyze this diabetes data summary and return ONLY valid JSON.

              Time in Range (%):
              - Below Range: ${timeInRange.lowPercentage.toFixed(1)}
              - In Range: ${timeInRange.timeInRange.toFixed(1)}
              - Above Range: ${timeInRange.highPercentage.toFixed(1)}

              Variability (CV %): ${stats.cv.toFixed(1)}
              Mean Glucose: ${formatValue(stats.mean)}

              Return JSON with these keys:
              1. insights: 3-5 short key observations about glucose patterns
              2. recommendations: 4-6 actionable suggestions (non-prescriptive; avoid dosage changes)
              3. riskAssessment: "low" | "medium" | "high" | "critical"
              4. confidence: integer 0-100
              5. details: an object with:
                 - executiveSummary: 2-4 sentences
                 - likelyDrivers: 3-6 bullets (possible causes of patterns)
                 - safetyFlags: 0-5 bullets (urgent red flags; include when to contact clinician)
                 - actionPlan7Days: 4-7 bullets (practical steps for the next week)
                 - experiments: 2-4 bullets (safe self-experiments; e.g., meal timing, pre-bolus timing discussions, activity timing; no medication dosing)
                 - questionsForClinician: 3-6 bullets
                 - dataQualityNotes: 0-5 bullets (limitations / missing context)

              Keep it concise. If uncertain, say so in dataQualityNotes.
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
                    insights: (geminiResult as any).insights ?? geminiResult.reasoning,
                recommendations: geminiResult.recommendations,
                riskAssessment: geminiResult.riskAssessment,
                confidence: Math.round(geminiResult.confidence * 100),
                    details: (geminiResult as any).details ?? null,
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
                      max_tokens: 900
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
                      max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} glucose analysis: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

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
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              riskAssessment: asRiskAssessment(result.riskAssessment, 'medium'),
              confidence: asNumber(result.confidence, 70, 0, 100),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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
    // Priority 1: TensorFlow (offline) when available
    const tfService = await this.getTensorFlowServiceAsync();
    if (tfService?.shouldUseTensorFlow()) {
      try {
        const stats = this.calculateBasicStats(readings);
        const timeInRange = this.calculateTimeInRange(readings, customGlucoseRanges);

        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        const ranges = glucoseContext?.getCurrentGlucoseRanges?.() || { TARGET_MIN: 70, TARGET_MAX: 180, LOW_THRESHOLD: 54 };

  const tf = await tfService.analyzeGlucoseData(readings, _treatments);

        const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        const costUSD = 0;
        this.storeLastAICost({
          provider: 'TensorFlow',
          model: 'local',
          tokenUsage,
          costUSD
        });

        const plan = `# Personalized Diabetes Management Plan (Offline)

## Current Status
- Time in range: ${timeInRange.inRange.toFixed(1)}% (target >70%)
- Below range: ${timeInRange.low.toFixed(1)}% (target <4%)
- Above range: ${timeInRange.high.toFixed(1)}% (target <25%)
- Average glucose: ${formatValue(stats.mean)}
- Variability (CV): ${stats.cv.toFixed(1)}%
- Risk assessment: ${tf.riskAssessment} (confidence ${tf.confidence}%)

## Executive Summary
${tf.reasoning?.slice(0, 4).map((r: string) => `- ${r}`).join('\n') || '- Local analysis generated from your CGM data'}

## Priority Safety Checks
${(tf.safetyWarnings && tf.safetyWarnings.length > 0)
  ? tf.safetyWarnings.map((w: string) => `- ${w}`).join('\n')
  : '- No urgent safety flags detected in the analyzed window.'}

## Goals (Next 7–14 Days)
- Increase time in range toward >70% while keeping time below range <4%.
- Reduce large swings by improving routine consistency (meals, activity, sleep).
- Identify 1–2 repeatable problem windows (e.g., mornings, after dinner) and focus there first.

## Action Plan (Practical Steps)
${(tf.recommendations && tf.recommendations.length > 0)
  ? tf.recommendations.map((rec: string) => `- ${rec}`).join('\n')
  : '- Keep a consistent routine and review patterns weekly.'}
- Review post-meal peaks: note what you ate, timing, and whether spikes cluster after specific meals.
- Review low events: confirm symptoms, check for compression lows, and keep rapid carbs available.

## Monitoring Strategy
- Review your CGM trends daily for recurring highs/lows and weekly for patterns.
- Use CGM alerts appropriate to your targets (discuss thresholds with your clinician).
- If you use a pump, monitor infusion site/supply issues if unexpected highs occur.

## Questions to Discuss With Your Clinician
- Do my patterns suggest basal/background insulin mismatch in specific time blocks?
- Are my glucose targets appropriate given my hypoglycemia risk?
- What strategies should I use for corrections to avoid rebound cycles?

## Data & Limitations
- This plan was generated locally (TensorFlow) using CGM data and logged treatments.
- It does not replace medical advice. If you have repeated lows (<${ranges.TARGET_MIN} mg/dL), severe lows (<${ranges.LOW_THRESHOLD} mg/dL), persistent highs, ketones, or feel unwell, seek medical guidance promptly.
`;

        return plan;
      } catch (error) {
        console.error('TensorFlow management plan generation failed:', error);
        // Fall through to API / fallback
      }
    }

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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for meal analysis');
        try {
          const carbTreatments = treatments.filter(t => t.carbs && t.carbs > 0);
          const mealStats = carbTreatments.length > 0 ? this.calculateMealStats(carbTreatments, readings) : { avgCarbs: 0, avgGlucoseRise: 0, hypoRate: 0 };

          const formatValue = glucoseContext
            ? glucoseContext.formatGlucoseValue
            : (value: number) => `${toMmol(value)} mmol/L`;

          const insights: string[] = [];
          if (carbTreatments.length === 0) {
            insights.push('No carbohydrate meal entries were found in the selected time window.');
          } else {
            insights.push(`Average carbs per meal: ${mealStats.avgCarbs.toFixed(1)}g.`);
            insights.push(`Typical glucose rise after meals: ${formatValue(mealStats.avgGlucoseRise)}.`);
            if (mealStats.hypoRate > 0) insights.push(`Post-meal hypoglycemia signals were detected after ${mealStats.hypoRate.toFixed(1)}% of meals.`);
          }

          const recommendations: string[] = [
            'Track meal timing and carbs consistently for a few days to identify repeatable triggers.',
            'If you see frequent post-meal spikes, review meal composition (fat/protein can delay rises) and discuss timing strategies with your clinician.',
            'If you see post-meal lows, focus on safety: avoid stacking corrections and consider discussing adjustments with your clinician.'
          ];

          const mealTiming = [
            { timeOfDay: 'Breakfast', startHour: 7, endHour: 9, recommendation: 'Aim for consistent timing and similar carb/protein balance to compare responses.' },
            { timeOfDay: 'Lunch', startHour: 12, endHour: 14, recommendation: 'Watch for afternoon activity effects that can change insulin sensitivity.' },
            { timeOfDay: 'Dinner', startHour: 18, endHour: 20, recommendation: 'Earlier dinners may reduce overnight variability for some people.' }
          ];

          const details = {
            executiveSummary: carbTreatments.length === 0
              ? 'No meal carb entries were available for analysis in this window. Add meal/carb logging to unlock meal response insights.'
              : `Your average meal is ${mealStats.avgCarbs.toFixed(1)}g carbs with an average post-meal rise of ${formatValue(mealStats.avgGlucoseRise)}.`,
            likelyDrivers: [
              'Carb counting variability and hidden carbs',
              'Meal composition (fat/protein) delaying absorption',
              'Timing mismatches (meals vs insulin action vs activity)',
              'Late-night meals impacting overnight stability'
            ].slice(0, 6),
            safetyFlags: mealStats.hypoRate > 2
              ? ['Post-meal hypoglycemia signals appear elevated. If you have repeated lows, discuss your strategy with your clinician.']
              : [],
            actionPlan7Days: [
              'Pick one meal (e.g., breakfast) and keep it consistent for 3 days to compare responses.',
              'Log meal time + carbs + any exercise within 3 hours to spot common patterns.',
              'If you have frequent spikes, review whether they cluster after specific foods or timing.',
              'If you have post-meal lows, prioritize safety and avoid over-correcting.'
            ],
            experiments: [
              'Try swapping a high-GI carb for a lower-GI option at one meal and compare the post-meal peak.',
              'If dinner spikes late, try earlier dinner timing and compare overnight stability.'
            ],
            questionsForClinician: [
              'Do my post-meal patterns suggest timing or ratio adjustments?',
              'How should I safely handle high-fat meals that spike later?'
            ],
            dataQualityNotes: carbTreatments.length === 0 ? ['No carb meal entries found in treatments.'] : []
          };

          const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
          const costUSD = 0;
          this.storeLastAICost({ provider: 'TensorFlow', model: 'local', tokenUsage, costUSD });

          return {
            insights,
            recommendations: recommendations.slice(0, 6),
            mealTiming,
            details,
            provider: 'TensorFlow',
            model: 'local',
            tokenUsage,
            costUSD
          };
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
        
        // Create a more informative prompt
        const prompt = `
          You are a diabetes nutrition assistant. Return ONLY valid JSON.

          Analyze meal patterns based on this summary:

          Average carbs per meal: ${mealStats.avgCarbs.toFixed(1)}g
          Average glucose rise: ${formatValue(mealStats.avgGlucoseRise)}
          Post-meal hypoglycemia rate: ${mealStats.hypoRate.toFixed(1)}%

          Return JSON with:
          1. insights: 3-5 short observations
          2. recommendations: 4-6 actionable suggestions (no medication dosing)
          3. mealTiming: array of { timeOfDay, startHour, endHour, recommendation }
          4. details: {
             executiveSummary: string,
             likelyDrivers: string[],
             safetyFlags: string[],
             actionPlan7Days: string[],
             experiments: string[],
             questionsForClinician: string[],
             dataQualityNotes: string[]
          }
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting meal analysis with ${provider.name}...`);
            
            let response;
            let tokenUsage: TokenUsage | null = null;

            if (provider.name === 'Gemini') {
              const gemini = await this.geminiService.generateJson(provider.model, prompt);
              const result = gemini.json;

              tokenUsage = {
                inputTokens: gemini.tokenUsage.prompt,
                outputTokens: gemini.tokenUsage.completion,
                totalTokens: gemini.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });

              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                mealTiming: result.mealTiming || [],
                details: result.details || null,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            }
            
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
                  max_tokens: 900
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
                  max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} meal analysis: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

            console.log(`✅ ${provider.name} meal analysis successful`);
            const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
            if (tokenUsage) {
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
            }
            return {
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              mealTiming: asStringArray(result.mealTiming, 12),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for exercise analysis');
        try {
          const result = await tfService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            const stats = this.calculateBasicStats(readings);
            const rapidRises = this.countRapidGlucoseRises(readings);
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

            const details = {
              executiveSummary: `Detected ${exerciseTreatments.length} exercise-related events. Mean glucose ${glucoseContext?.formatGlucoseValue ? glucoseContext.formatGlucoseValue(stats.mean, 'mgdl', true) : stats.mean.toFixed(0)} with CV ${stats.cv.toFixed(1)}%.`,
              likelyDrivers: [
                'Exercise intensity/type (aerobic often lowers glucose; anaerobic can raise it temporarily)',
                'Timing relative to insulin action and meals',
                'Delayed activity effects causing later lows',
                'Stress/adrenaline response during intense sessions'
              ].slice(0, 6),
              safetyFlags: [],
              actionPlan7Days: [
                'Log exercise type, duration, and timing (relative to meals/boluses) for a week.',
                'Watch for delayed lows after activity; consider safer alerts and carry fast carbs.',
                'If you repeatedly go low during/after exercise, discuss prevention strategies with your clinician.'
              ],
              experiments: [
                'Try similar-intensity activity at the same time-of-day on 2 different days and compare glucose response.',
                'If you tend to spike during intense workouts, compare warm-up/cool-down inclusion and timing.'
              ],
              questionsForClinician: [
                'What is the safest approach to prevent exercise-related lows for me?',
                'Do my patterns suggest adjusting timing or meal strategy around activity?'
              ],
              dataQualityNotes: exerciseTreatments.length === 0 ? ['No explicit exercise events were logged; analysis is limited without exercise notes.'] : []
            };

            const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            const costUSD = 0;
            this.storeLastAICost({ provider: 'TensorFlow', model: 'local', tokenUsage, costUSD });

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
              rapidRises,
              variability: stats.cv,
              details,
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
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
        
        // Create a more informative prompt
        const prompt = `
          You are an exercise physiology assistant for diabetes management. Return ONLY valid JSON.

          Mean Glucose: ${formatValue(stats.mean)}
          Variability (CV %): ${stats.cv.toFixed(1)}
          Exercise events logged: ${exerciseTreatments.length}

          Return JSON with:
          1. insights: 3-5 observations about exercise impact
          2. recommendations: 4-6 actionable suggestions (no medication dosing)
          3. exerciseTypes: array of { type, glucoseImpact, recommendation }
          4. rapidRises: number
          5. variability: number
          6. details: {
             executiveSummary: string,
             likelyDrivers: string[],
             safetyFlags: string[],
             actionPlan7Days: string[],
             experiments: string[],
             questionsForClinician: string[],
             dataQualityNotes: string[]
          }
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting exercise analysis with ${provider.name}...`);
            
            let response;
            let tokenUsage: TokenUsage | null = null;

            if (provider.name === 'Gemini') {
              const gemini = await this.geminiService.generateJson(provider.model, prompt);
              const result = gemini.json;

              tokenUsage = {
                inputTokens: gemini.tokenUsage.prompt,
                outputTokens: gemini.tokenUsage.completion,
                totalTokens: gemini.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                exerciseTypes: result.exerciseTypes || [],
                rapidRises: result.rapidRises || 0,
                variability: result.variability || stats.cv,
                details: result.details || null,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            }
            
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
                  max_tokens: 900
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
                  max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} exercise analysis: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

            console.log(`✅ ${provider.name} exercise analysis successful`);
            const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
            if (tokenUsage) {
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
            }
            return {
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              exerciseTypes: asStringArray(result.exerciseTypes, 12),
              rapidRises: asNumber(result.rapidRises, 0, 0),
              variability: asNumber(result.variability, stats.cv, 0),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for sleep analysis');
        try {
          const result = await tfService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            const nightReadings = readings.filter(r => {
              const hour = new Date(r.date).getHours();
              return hour >= 22 || hour < 6;
            });

            const nightStats = this.calculateBasicStats(nightReadings.length ? nightReadings : readings);
            const dawnPhenomenon = this.calculateDawnEffect(readings, glucoseContext);

            const sleepQualityScore = (() => {
              // Heuristic: higher night TIR and lower CV => better score
              const nightTir = this.calculateTimeInRange(nightReadings.length ? nightReadings : readings);
              const cvPenalty = Math.min(30, Math.max(0, (nightStats.cv - 25)));
              const tirBonus = Math.min(40, Math.max(0, (nightTir.inRange - 50)));
              return Math.max(0, Math.min(100, Math.round(60 + tirBonus - cvPenalty)));
            })();

            const sleepDisruptions = (() => {
              if (nightReadings.length < 2) return 0;
              // Count threshold crossings during night as a proxy for disruptions
              const values = nightReadings.map(r => r.sgv).filter((v: any) => typeof v === 'number');
              let crossings = 0;
              for (let i = 1; i < values.length; i++) {
                const prev = values[i - 1];
                const curr = values[i];
                if ((prev < 70 && curr >= 70) || (prev >= 70 && curr < 70)) crossings++;
                if ((prev > 180 && curr <= 180) || (prev <= 180 && curr > 180)) crossings++;
              }
              return Math.min(6, Math.round(crossings / 2));
            })();

            const details = {
              executiveSummary: `Night-time glucose variability CV ${nightStats.cv.toFixed(1)}%. Dawn effect ${dawnPhenomenon >= 0 ? '+' : ''}${glucoseContext?.formatGlucoseValue ? glucoseContext.formatGlucoseValue(dawnPhenomenon, glucoseContext.unit === 'mgdl' ? 'mgdl' : 'mmol', true) : dawnPhenomenon}.`,
              likelyDrivers: [
                'Dinner timing/size impacting overnight glucose',
                'Basal/background insulin mismatch overnight (discuss with clinician)',
                'Dawn phenomenon or hormonal effects near wake-up',
                'Compression lows or sensor artifacts during sleep'
              ].slice(0, 6),
              safetyFlags: [],
              actionPlan7Days: [
                'Review overnight trends (22:00–06:00) for recurring highs/lows.',
                'If you wake up high, compare dinner timing and composition across days.',
                'If you see night lows, prioritize safety and discuss prevention strategies with your clinician.'
              ],
              experiments: [
                'Try an earlier dinner on 2–3 days and compare overnight stability.',
                'If dawn rises occur, track wake time and pre-wake trend to see consistency.'
              ],
              questionsForClinician: [
                'Do these overnight patterns suggest basal/background therapy adjustments?',
                'How should I manage suspected dawn phenomenon safely?'
              ],
              dataQualityNotes: nightReadings.length === 0 ? ['No readings were detected in typical sleep hours; analysis used overall data.'] : []
            };

            const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            const costUSD = 0;
            this.storeLastAICost({ provider: 'TensorFlow', model: 'local', tokenUsage, costUSD });

            // Adapt TensorFlow result for sleep analysis format
            return {
              insights: result.insights || ["TensorFlow sleep pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor overnight glucose stability"],
              sleepQualityScore,
              dawnPhenomenon,
              sleepDisruptions,
              details,
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
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
        
        // Create a more informative prompt
        const prompt = `
          You are a sleep-focused diabetes assistant. Return ONLY valid JSON.

          Night Glucose (mean): ${formatValue(nightStats.mean)}
          Night-time Variability (CV %): ${nightStats.cv.toFixed(1)}
          Dawn phenomenon effect: ${dawnEffect > 0 ? '+' : ''}${formatValue(dawnEffect)}

          Return JSON with:
          1. insights: 3-5 observations about sleep patterns
          2. recommendations: 4-6 actionable suggestions (no medication dosing)
          3. sleepQualityScore: 0-100
          4. dawnPhenomenon: numeric
          5. sleepDisruptions: number
          6. details: {
             executiveSummary: string,
             likelyDrivers: string[],
             safetyFlags: string[],
             actionPlan7Days: string[],
             experiments: string[],
             questionsForClinician: string[],
             dataQualityNotes: string[]
          }
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting sleep analysis with ${provider.name}...`);
            
            let response;
            let tokenUsage: TokenUsage | null = null;

            if (provider.name === 'Gemini') {
              const gemini = await this.geminiService.generateJson(provider.model, prompt);
              const result = gemini.json;

              tokenUsage = {
                inputTokens: gemini.tokenUsage.prompt,
                outputTokens: gemini.tokenUsage.completion,
                totalTokens: gemini.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                sleepQualityScore: result.sleepQualityScore || 75,
                dawnPhenomenon: result.dawnPhenomenon || dawnEffect,
                sleepDisruptions: result.sleepDisruptions || 1,
                details: result.details || null,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            }
            
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
                  max_tokens: 900
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
                  max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} sleep analysis: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

            console.log(`✅ ${provider.name} sleep analysis successful`);
            const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
            if (tokenUsage) {
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
            }
            return {
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              sleepQualityScore: asNumber(result.sleepQualityScore, 75, 0, 100),
              dawnPhenomenon: asNumber(result.dawnPhenomenon, dawnEffect),
              sleepDisruptions: asNumber(result.sleepDisruptions, 1, 0),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for stress analysis');
        try {
          const result = await tfService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            const stats = this.calculateBasicStats(readings);
            const rapidRises = this.countRapidGlucoseRises(readings);

            const stressImpactScore = (() => {
              // Heuristic score (0-100): higher variability + more rapid rises + more highs
              const cvScore = Math.min(60, Math.max(0, (stats.cv - 20) * 2));
              const riseScore = Math.min(25, rapidRises * 3);
              const highScore = Math.min(20, Math.max(0, stats.high - 10));
              return Math.max(0, Math.min(100, Math.round(cvScore + riseScore + highScore)));
            })();

            const potentialStressTimes = this.estimateStressPeriods(readings, stats.cv);

            const details = {
              executiveSummary: `Glucose variability (CV ${stats.cv.toFixed(1)}%) and ${rapidRises} rapid rises suggest potential stress-related impacts in this window.`,
              likelyDrivers: [
                'Acute stress hormones raising glucose (adrenaline/cortisol)',
                'Disrupted sleep increasing insulin resistance',
                'Illness/pain/inflammation (can mimic stress effects)',
                'Caffeine/nicotine and other stimulants',
                'Work/commute or routine changes coinciding with meals/insulin'
              ].slice(0, 6),
              safetyFlags: [],
              actionPlan7Days: [
                'Tag stressful events in notes (work, conflict, deadlines) to correlate with glucose trends.',
                'Use short stress resets (2–5 minutes breathing/walk) when you notice rising trends.',
                'If you see repeated highs during stress windows, discuss safe strategies with your clinician.',
                'Protect sleep: consistent schedule and wind-down routines can reduce next-day variability.'
              ],
              experiments: [
                'Try a brief walk or relaxation routine at the start of a typical stress window and compare the next 1–2 hours trend.',
                'Reduce stimulant intake (if applicable) for 3 days and compare variability.'
              ],
              questionsForClinician: [
                'Do my patterns suggest stress-related insulin resistance at certain times?',
                'What is the safest approach if I frequently run high during stress?'
              ],
              dataQualityNotes: readings?.length < 24 ? ['Limited data volume; results may be less reliable.'] : []
            };

            const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            const costUSD = 0;
            this.storeLastAICost({ provider: 'TensorFlow', model: 'local', tokenUsage, costUSD });

            // Adapt TensorFlow result for stress analysis format expected by UI
            return {
              insights: result.insights || ["TensorFlow stress pattern analysis completed"],
              recommendations: result.recommendations || ["Monitor glucose patterns during stressful periods"],
              stressImpactScore,
              rapidRises,
              variability: stats.cv,
              potentialStressTimes,
              details,
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
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
        
        const rapidRises = this.countRapidGlucoseRises(readings);

        // Create a more informative prompt aligned to UI expectations
        const prompt = `
          You are a diabetes assistant focused on stress-related glucose patterns. Return ONLY valid JSON.

          Summary:
          Mean glucose: ${formatValue(stats.mean)}
          Variability (CV %): ${stats.cv.toFixed(1)}
          High readings (%): ${stats.high}
          Rapid rises detected: ${rapidRises}

          Return JSON with:
          1. insights: 3-5 observations about stress patterns
          2. recommendations: 4-6 actionable suggestions (no medication dosing)
          3. stressImpactScore: number 0-100
          4. rapidRises: number
          5. variability: number (CV %)
          6. potentialStressTimes: array of { timeOfDay, startHour, endHour, variability }
          7. details: {
             executiveSummary: string,
             likelyDrivers: string[],
             safetyFlags: string[],
             actionPlan7Days: string[],
             experiments: string[],
             questionsForClinician: string[],
             dataQualityNotes: string[]
          }
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting stress analysis with ${provider.name}...`);
            
            let response;
            let tokenUsage: TokenUsage | null = null;

            if (provider.name === 'Gemini') {
              const gemini = await this.geminiService.generateJson(provider.model, prompt);
              const result = gemini.json;

              tokenUsage = {
                inputTokens: gemini.tokenUsage.prompt,
                outputTokens: gemini.tokenUsage.completion,
                totalTokens: gemini.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });

              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                stressImpactScore: result.stressImpactScore ?? 50,
                rapidRises: result.rapidRises ?? rapidRises,
                variability: result.variability ?? stats.cv,
                potentialStressTimes: result.potentialStressTimes || this.estimateStressPeriods(readings, stats.cv),
                details: result.details || null,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            }
            
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
                  max_tokens: 900
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
                  max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} stress analysis: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

            console.log(`✅ ${provider.name} stress analysis successful`);
            const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
            if (tokenUsage) {
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
            }
            return {
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              stressImpactScore: asNumber(result.stressImpactScore, 50, 0, 100),
              rapidRises: asNumber(result.rapidRises, rapidRises, 0),
              variability: asNumber(result.variability, stats.cv, 0),
              potentialStressTimes: asStringArray(
                result.potentialStressTimes,
                12
              ).length
                ? asStringArray(result.potentialStressTimes, 12)
                : this.estimateStressPeriods(readings, stats.cv),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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
      const tfService = await this.getTensorFlowServiceAsync();
      if (tfService?.shouldUseTensorFlow()) {
        console.log('🤖 Using TensorFlow for ISF optimization');
        try {
          const result = await tfService.analyzeGlucosePatterns(readings);
          if (result && result.insights && result.insights.length > 0) {
            const currentISFSchedule = currentProfile?.sens || [];
            const stats = this.calculateBasicStats(readings);
            const tir = this.calculateTimeInRange(readings);
            const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;

            // Heuristic adjustment: more lows => increase ISF; more highs => decrease ISF (for discussion only)
            const factor = (() => {
              const low = tir.low;
              const high = tir.high;
              const raw = 1 + ((low - high) / 100) * 0.25;
              return Math.max(0.9, Math.min(1.1, raw));
            })();

            const isfSuggestions = currentISFSchedule.map((entry: any) => ({
              time: entry.time,
              rate: typeof entry.value === 'number' ? Number((entry.value * factor).toFixed(2)) : entry.value
            }));

            const calculatedISFs = this.estimateISFFromCorrections(readings, treatments, glucoseContext);

            const confidenceLevel = (() => {
              const base = readings.length >= 288 ? 88 : readings.length >= 144 ? 82 : readings.length >= 72 ? 76 : 68;
              const bonus = calculatedISFs.length >= 8 ? 6 : calculatedISFs.length >= 3 ? 3 : 0;
              return Math.max(55, Math.min(95, Math.round(base + bonus - Math.max(0, (stats.cv - 40) * 0.2))));
            })();

            const details = {
              executiveSummary: `Based on your data, variability is CV ${stats.cv.toFixed(1)}% with mean glucose ${formatValue(stats.mean)}. Suggested ISF changes are conservative (±10%) and should be reviewed with your clinician before applying.`,
              likelyDrivers: [
                'Insulin sensitivity varies by time-of-day (circadian rhythm)',
                'Exercise and delayed activity effects',
                'Illness/stress/sleep changes shifting insulin needs',
                'High-fat meals and absorption delays affecting corrections',
                'Pump/site issues or sensor artifacts impacting apparent response'
              ].slice(0, 6),
              safetyFlags: [],
              actionPlan7Days: [
                'If testing ISF, do so under stable conditions and avoid stacking corrections.',
                'Focus on one time block at a time with small, conservative adjustments (5–10%).',
                'Track correction outcomes (start glucose, insulin amount, glucose after 3–4 hours).',
                'If you have repeated lows, prioritize safety and discuss adjustments with your clinician.'
              ],
              experiments: [
                'Choose a single time window and collect a few “clean” correction events (no food/exercise) to estimate ISF response.',
                'Compare correction outcomes on high-stress vs low-stress days to see sensitivity shifts.'
              ],
              questionsForClinician: [
                'Do my correction outcomes support adjusting ISF in specific time blocks?',
                'How should I safely test ISF changes given my hypoglycemia risk?'
              ],
              dataQualityNotes: [
                calculatedISFs.length === 0 ? 'No clean correction events were detected; suggestions are based on glucose patterns and profile schedule only.' : ''
              ].filter(Boolean)
            };

            const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            const costUSD = 0;
            this.storeLastAICost({ provider: 'TensorFlow', model: 'local', tokenUsage, costUSD });

            return {
              insights: result.insights || ["TensorFlow ISF pattern analysis completed"],
              recommendations: (result.recommendations || ["Review ISF patterns with your clinician"])
                .map((r: string) => r.replace(/dose|bolus|units?/gi, 'strategy'))
                .slice(0, 6),
              isfSuggestions,
              calculatedISFs,
              confidenceLevel,
              details,
              provider: 'TensorFlow',
              model: 'local',
              tokenUsage,
              costUSD
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
        
        // Format values based on context
        const formatValue = glucoseContext ? glucoseContext.formatGlucoseValue : (value: number) => `${toMmol(value)} mmol/L`;
        
        const currentSchedule = currentProfile?.sens || [];
        const correctionCandidates = this.estimateISFFromCorrections(readings, treatments, glucoseContext);

        // Create a more informative prompt aligned to UI expectations
        const prompt = `
          You are a diabetes insulin-therapy assistant. Return ONLY valid JSON.
          Important: Do not provide dosing instructions. This is for discussion and should be reviewed by a clinician.

          Data summary:
          Mean glucose: ${formatValue(stats.mean)}
          Variability (CV %): ${stats.cv.toFixed(1)}
          Treatments recorded: ${treatments.length}
          Current ISF schedule entries: ${currentSchedule.length}
          Clean correction examples detected: ${correctionCandidates.length}

          Current ISF schedule (time/value):
          ${currentSchedule.slice(0, 12).map((s: any) => `- ${s.time}: ${s.value}`).join('\n')}

          Return JSON with:
          1. insights: 3-5 observations
          2. recommendations: 4-6 safe suggestions (no dosing)
          3. isfSuggestions: array of { time: string, rate: number } (same times as schedule, updated rates)
          4. calculatedISFs: array of { time: string, insulin: number, preGlucose: number, postGlucose: number, drop: number, calculatedISF: number }
          5. confidenceLevel: 0-100
          6. details: {
             executiveSummary: string,
             likelyDrivers: string[],
             safetyFlags: string[],
             actionPlan7Days: string[],
             experiments: string[],
             questionsForClinician: string[],
             dataQualityNotes: string[]
          }
        `;
        
        // Try each provider in order
        for (const provider of this.providers) {
          try {
            console.log(`🔄 Attempting ISF optimization with ${provider.name}...`);
            
            let response;
            let tokenUsage: TokenUsage | null = null;

            if (provider.name === 'Gemini') {
              const gemini = await this.geminiService.generateJson(provider.model, prompt);
              const result = gemini.json;
              tokenUsage = {
                inputTokens: gemini.tokenUsage.prompt,
                outputTokens: gemini.tokenUsage.completion,
                totalTokens: gemini.tokenUsage.total
              };
              const costUSD = calculateCostFromTokenUsage(provider.model, tokenUsage);
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });

              return {
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                isfSuggestions: result.isfSuggestions || currentSchedule.map((s: any) => ({ time: s.time, rate: s.value })),
                calculatedISFs: result.calculatedISFs || correctionCandidates,
                confidenceLevel: result.confidenceLevel || 75,
                details: result.details || null,
                provider: provider.name,
                model: provider.model,
                tokenUsage,
                costUSD
              };
            }
            
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
                  max_tokens: 900
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
                  max_tokens: 900
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
            
            const parsed = safeJsonParseFromText(String(content ?? ''));
            if (!parsed.ok) {
              console.warn(`⚠️ ${provider.name} ISF optimization: non-JSON response; using safe fallback`);
            }

            const rawResult: unknown = parsed.ok
              ? parsed.value
              : {
                  insights: String(content ?? '').trim().slice(0, 800),
                  recommendations: []
                };

            const result = (typeof rawResult === 'object' && rawResult !== null) ? (rawResult as any) : {};

            console.log(`✅ ${provider.name} ISF optimization successful`);
            const costUSD = tokenUsage ? calculateCostFromTokenUsage(provider.model, tokenUsage) : null;
            if (tokenUsage) {
              this.storeLastAICost({ provider: provider.name, model: provider.model, tokenUsage, costUSD });
            }

            const isfSuggestions = Array.isArray(result.isfSuggestions)
              ? result.isfSuggestions
                  .map((s: any) => ({
                    time: typeof s?.time === 'string' ? s.time : undefined,
                    rate: typeof s?.rate === 'number' ? s.rate : Number(s?.rate)
                  }))
                  .filter((s: any) => typeof s.time === 'string' && Number.isFinite(s.rate))
              : [];

            const calculatedISFs = Array.isArray(result.calculatedISFs) ? result.calculatedISFs : null;
            return {
              insights: asStringArray(result.insights, 12),
              recommendations: asStringArray(result.recommendations, 12),
              isfSuggestions: isfSuggestions.length
                ? isfSuggestions
                : currentSchedule.map((s: any) => ({ time: s.time, rate: s.value })),
              calculatedISFs: calculatedISFs ?? correctionCandidates,
              confidenceLevel: asNumber(result.confidenceLevel, 75, 0, 100),
              details: normalizeDetails(result.details),
              provider: provider.name,
              model: provider.model,
              tokenUsage,
              costUSD
            };
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

  private estimateStressPeriods(readings: any[], overallCv: number) {
    if (!readings || readings.length < 12) return [];

    // Split day into coarse blocks and pick the most variable ones.
    const blocks = [
      { label: 'Morning', start: 6, end: 12 },
      { label: 'Afternoon', start: 12, end: 18 },
      { label: 'Evening', start: 18, end: 24 },
      { label: 'Overnight', start: 0, end: 6 }
    ];

    const perBlock = blocks
      .map((b) => {
        const inBlock = readings.filter((r: any) => {
          const d = new Date(r.dateString || r.date);
          const h = d.getHours();
          if (b.start < b.end) return h >= b.start && h < b.end;
          return h >= b.start || h < b.end;
        });
        const stats = this.calculateBasicStats(inBlock);
        return {
          timeOfDay: b.label,
          startHour: b.start,
          endHour: b.end,
          variability: Number.isFinite(stats.cv) ? stats.cv : overallCv,
          points: inBlock.length
        };
      })
      .filter((x) => x.points >= 6)
      .sort((a, b) => b.variability - a.variability)
      .slice(0, 3)
      .map(({ points: _points, ...rest }) => rest);

    return perBlock;
  }

  private estimateISFFromCorrections(readings: any[], treatments: any[], glucoseContext?: any) {
    if (!readings || readings.length < 12 || !treatments || treatments.length === 0) return [];

    const unit: 'mgdl' | 'mmol' = glucoseContext?.unit === 'mgdl' ? 'mgdl' : 'mmol';
    const convertGlucose = (mgdlValue: number) => (unit === 'mmol' ? toMmol(mgdlValue) : mgdlValue);

    // Very conservative heuristic: look for correction boluses and estimate drop over 3 hours.
    const boluses = treatments
      .filter((t: any) => (t.eventType === 'Correction Bolus' || t.eventType === 'Bolus') && typeof t.insulin === 'number')
      .slice(0, 25);

    const byTime = (a: any, b: any) => new Date(a.dateString || a.date).getTime() - new Date(b.dateString || b.date).getTime();
    const sortedReadings = [...readings].sort(byTime);

    const findNearestReading = (timeMs: number) => {
      // Linear scan is ok for small lists; keep it simple.
      let best: any = null;
      let bestDelta = Infinity;
      for (const r of sortedReadings) {
        const t = new Date(r.dateString || r.date).getTime();
        const d = Math.abs(t - timeMs);
        if (d < bestDelta) {
          best = r;
          bestDelta = d;
        }
      }
      return { reading: best, deltaMs: bestDelta };
    };

    const results: Array<any> = [];

    for (const b of boluses) {
      const bolusTime = new Date(b.dateString || b.created_at || b.timestamp || b.date).getTime();
      if (!Number.isFinite(bolusTime)) continue;

      const pre = findNearestReading(bolusTime);
      const post = findNearestReading(bolusTime + 3 * 60 * 60 * 1000);

      // Require readings within ~20 minutes.
      if (!pre.reading || !post.reading) continue;
      if (pre.deltaMs > 20 * 60 * 1000 || post.deltaMs > 20 * 60 * 1000) continue;

      const preGlucoseMgdl = Number(pre.reading.sgv ?? pre.reading.glucose ?? pre.reading.value);
      const postGlucoseMgdl = Number(post.reading.sgv ?? post.reading.glucose ?? post.reading.value);
      if (!Number.isFinite(preGlucoseMgdl) || !Number.isFinite(postGlucoseMgdl)) continue;

      const dropMgdl = preGlucoseMgdl - postGlucoseMgdl;
      if (dropMgdl <= 10) continue;

      const insulin = Number(b.insulin);
      if (!Number.isFinite(insulin) || insulin <= 0) continue;

      // ISF in mmol/L per U (or mg/dL per U if unit=mgdl)
      const calculatedISF = unit === 'mmol' ? toMmol(dropMgdl) / insulin : dropMgdl / insulin;

      const d = new Date(bolusTime);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');

      results.push({
        time: `${hh}:${mm}`,
        insulin: Number(insulin.toFixed(2)),
        preGlucose: Number(convertGlucose(preGlucoseMgdl).toFixed(unit === 'mmol' ? 1 : 0)),
        postGlucose: Number(convertGlucose(postGlucoseMgdl).toFixed(unit === 'mmol' ? 1 : 0)),
        drop: Number((unit === 'mmol' ? toMmol(dropMgdl) : dropMgdl).toFixed(unit === 'mmol' ? 1 : 0)),
        calculatedISF: Number(calculatedISF.toFixed(2))
      });

      if (results.length >= 12) break;
    }

    return results;
  }

  private coerceTimeInRangePercent(timeInRange: any, fallbackFromTensorFlow?: any): { low: number; inRange: number; high: number } {
    const fromUI = timeInRange && typeof timeInRange === 'object'
      ? {
          low: typeof timeInRange.lowPercentage === 'number' ? timeInRange.lowPercentage : undefined,
          inRange: typeof timeInRange.timeInRange === 'number' ? timeInRange.timeInRange : undefined,
          high: typeof timeInRange.highPercentage === 'number' ? timeInRange.highPercentage : undefined
        }
      : {};

    const fromTF = fallbackFromTensorFlow && typeof fallbackFromTensorFlow === 'object'
      ? {
          low: typeof fallbackFromTensorFlow.low === 'number' ? fallbackFromTensorFlow.low : undefined,
          inRange: typeof fallbackFromTensorFlow.inRange === 'number' ? fallbackFromTensorFlow.inRange : undefined,
          high: typeof fallbackFromTensorFlow.high === 'number' ? fallbackFromTensorFlow.high : undefined
        }
      : {};

    const low = (fromUI.low ?? fromTF.low ?? 0);
    const inRange = (fromUI.inRange ?? fromTF.inRange ?? 0);
    const high = (fromUI.high ?? fromTF.high ?? 0);

    return {
      low: Math.max(0, Math.min(100, low)),
      inRange: Math.max(0, Math.min(100, inRange)),
      high: Math.max(0, Math.min(100, high))
    };
  }

  private assessLocalGlucoseRisk(
    tir: { low: number; inRange: number; high: number },
    stats: { mean: number; stdDev: number; cv: number; high: number },
    readingCount: number
  ): { riskAssessment: 'low' | 'medium' | 'high' | 'critical'; confidence: number } {
    let score = 0;

    if (tir.low >= 10) score += 4;
    else if (tir.low >= 5) score += 3;
    else if (tir.low >= 4) score += 2;
    else if (tir.low >= 1) score += 1;

    if (tir.high >= 50) score += 3;
    else if (tir.high >= 35) score += 2;
    else if (tir.high >= 25) score += 1;

    if (tir.inRange < 50) score += 3;
    else if (tir.inRange < 60) score += 2;
    else if (tir.inRange < 70) score += 1;

    if (stats.cv >= 45) score += 2;
    else if (stats.cv >= 36) score += 1;

    if (stats.mean >= 300 || stats.mean <= 55) score += 3;
    else if (stats.mean >= 250 || stats.mean <= 70) score += 2;
    else if (stats.mean >= 180) score += 1;

    let riskAssessment: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (score >= 9) riskAssessment = 'critical';
    else if (score >= 6) riskAssessment = 'high';
    else if (score <= 2) riskAssessment = 'low';

    const dataConfidence = readingCount >= 144 ? 90 : readingCount >= 72 ? 85 : readingCount >= 24 ? 78 : 65;
    const confidence = Math.max(55, Math.min(95, dataConfidence - (riskAssessment === 'critical' ? 0 : 0)));

    return { riskAssessment, confidence };
  }

  private buildLocalGlucoseRecommendations(
    tir: { low: number; inRange: number; high: number },
    stats: { mean: number; stdDev: number; cv: number; high: number }
  ): string[] {
    const recs: string[] = [];

    if (tir.low >= 4) {
      recs.push('Prioritize hypoglycemia prevention: review low patterns, keep fast-acting carbs available, and consider safer alert thresholds.');
    }
    if (tir.high >= 25) {
      recs.push('Focus on reducing high glucose exposure: look for post-meal spikes and persistent highs, and discuss potential strategy adjustments with your clinician.');
    }
    if (stats.cv >= 36) {
      recs.push('Aim to reduce variability: keep meal timing/carbs more consistent and review factors like stress, sleep, and activity that can shift insulin needs.');
    }
    if (tir.inRange < 70) {
      recs.push('Set a weekly review routine: identify 1–2 recurring time windows (e.g., mornings, after dinner) and target those first.');
    }

    recs.push('Check for data/tech drivers: verify sensor reliability, review compression lows, and ensure infusion sites (if used) are functioning well.');
    recs.push('If you have repeated lows, severe highs, or feel unwell, contact your healthcare team promptly.');

    return recs.slice(0, 6);
  }

  private buildLocalGlucoseDetails(
    tir: { low: number; inRange: number; high: number },
    stats: { mean: number; stdDev: number; cv: number; high: number },
    readings: any[],
    formatValue: (value: number) => string
  ) {
    const values = readings.map(r => r?.sgv).filter((v: any) => typeof v === 'number' && Number.isFinite(v));
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;

    const executiveSummaryParts: string[] = [];
    executiveSummaryParts.push(`Time in range is ${tir.inRange.toFixed(1)}% with ${tir.low.toFixed(1)}% below range and ${tir.high.toFixed(1)}% above range.`);
    executiveSummaryParts.push(`Average glucose is ${formatValue(stats.mean)} with variability CV ${stats.cv.toFixed(1)}%.`);
    if (tir.low >= 4) executiveSummaryParts.push('Below-range exposure is above common safety targets and deserves priority.');
    else if (tir.high >= 35) executiveSummaryParts.push('Above-range exposure is elevated and may be driven by post-meal spikes or persistent highs.');

    const likelyDrivers: string[] = [];
    if (tir.high >= 25) likelyDrivers.push('Post-meal spikes (carb timing/amount, absorption mismatch, or delayed bolus effect)');
    if (tir.low >= 4) likelyDrivers.push('Over-correction, insulin stacking, delayed activity effects, or missed snacks');
    if (stats.cv >= 36) likelyDrivers.push('Day-to-day variability from stress, sleep changes, illness, hormones, or inconsistent routines');
    likelyDrivers.push('Basal/background insulin mismatch in a specific time window (discuss with clinician)');
    likelyDrivers.push('Device/data effects (sensor lag, compression lows, infusion set issues if applicable)');

    const safetyFlags: string[] = [];
    if (min != null && min <= 54) safetyFlags.push('Severe low values detected in this dataset range; treat lows promptly and review prevention strategies with your clinician.');
    else if (tir.low >= 10) safetyFlags.push('High time-below-range suggests meaningful hypoglycemia risk; consider urgent review with your healthcare team.');
    if (max != null && max >= 300) safetyFlags.push('Very high glucose values detected; if persistent or with symptoms/ketones, seek medical advice promptly.');

    const actionPlan7Days: string[] = [
      'Pick one recurring problem window (e.g., mornings or after dinner) and review it across several days.',
      'Use CGM alerts and keep rapid carbs accessible; confirm low readings if symptoms don’t match.',
      'Track meal timing, carbs, and activity for a few days to identify repeatable triggers.',
      'Review correction patterns to avoid “over-correct then rebound” cycles (discuss approach with clinician).',
      'If using pump/CGM, verify site/sensor performance and consider replacing supplies if patterns look device-related.'
    ];

    const experiments: string[] = [
      'Try a consistent breakfast (similar carbs/protein) for 3 days and compare post-meal peaks.',
      'If you often spike after dinner, try a brief 10–20 minute walk after the meal (if safe for you) and observe the trend.',
      'If you see overnight drift, log bedtime snack/alcohol/exercise timing to see what correlates.'
    ];

    const questionsForClinician: string[] = [
      'Are my glucose targets appropriate for my situation (including hypoglycemia risk)?',
      'Do my patterns suggest a basal/background insulin mismatch in specific time blocks?',
      'What safe strategies should I use for corrections to reduce rebounds?',
      'Are there settings/alerts I should adjust to reduce time below range?'
    ];

    const dataQualityNotes: string[] = [];
    if (values.length < 24) dataQualityNotes.push('Limited data volume; conclusions may be less reliable.');
    const times = readings.map(r => (typeof r?.date === 'number' ? r.date : (r?.date ? new Date(r.date).getTime() : null))).filter((t: any) => typeof t === 'number' && Number.isFinite(t));
    if (times.length >= 2) {
      const spanHours = (Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60);
      if (spanHours < 12) dataQualityNotes.push('Data window appears short; a 3–14 day view is usually more informative for patterns.');
    }
    if (readings.some(r => r?.sgv == null)) dataQualityNotes.push('Some readings are missing glucose values.');

    return {
      executiveSummary: executiveSummaryParts.slice(0, 4).join(' '),
      likelyDrivers: likelyDrivers.slice(0, 6),
      safetyFlags: safetyFlags.slice(0, 5),
      actionPlan7Days: actionPlan7Days.slice(0, 7),
      experiments: experiments.slice(0, 4),
      questionsForClinician: questionsForClinician.slice(0, 6),
      dataQualityNotes: dataQualityNotes.slice(0, 5)
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