// Google Gemini AI Service
import { getModelById } from '../constants/openaiModels';

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
    finishReason: string;
    index: number;
    safetyRatings: any[];
  }[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiAnalysisResult {
  recommendations: string[];
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string[];
  safetyWarnings: string[];
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

class GeminiService {
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.updateApiKey();
  }

  private updateApiKey() {
    this.apiKey = localStorage.getItem('gemini_api_key');
  }

  public refreshApiKey() {
    this.updateApiKey();
  }

  public hasApiKey(): boolean {
    return !!this.apiKey;
  }

  public async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with the latest recommended model
      const response = await this.generateContent('gemini-2.0-flash-exp', 'Hello, this is a test. Please respond with "Test successful".');
      return response.includes('Test successful') || response.includes('test') || response.length > 0;
    } catch (error) {
      // Fallback to older model if newer one fails
      try {
        const response = await this.generateContent('gemini-1.5-flash-002', 'Hello, this is a test. Please respond with "Test successful".');
        return response.includes('Test successful') || response.includes('test') || response.length > 0;
      } catch (fallbackError) {
        console.error('Gemini connection test failed:', error, fallbackError);
        return false;
      }
    }
  }

  private async generateContent(modelId: string, prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = getModelById(modelId);
    if (!model || model.provider !== 'google') {
      throw new Error(`Invalid Gemini model: ${modelId}`);
    }

    const url = `${this.baseUrl}/${modelId}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048, // Increased for newer models
        candidateCount: 1,
        stopSequences: []
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  public async analyzeDiabetesData(
    glucoseData: { timestamp: string; value: number; }[],
    modelId: string,
    unit: 'mg/dL' | 'mmol/L' = 'mg/dL'
  ): Promise<GeminiAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Prepare glucose data summary
    const recentData = glucoseData.slice(-24); // Last 24 readings
    const values = recentData.map(d => d.value);
    const avgGlucose = values.reduce((sum, val) => sum + val, 0) / values.length;
    const minGlucose = Math.min(...values);
    const maxGlucose = Math.max(...values);
    
    // Calculate time in ranges (assuming mg/dL for now)
    const lowCount = values.filter(v => v < 70).length;
    const normalCount = values.filter(v => v >= 70 && v <= 180).length;
    const highCount = values.filter(v => v > 180).length;
    
    const timeInRange = {
      low: (lowCount / values.length) * 100,
      normal: (normalCount / values.length) * 100,
      high: (highCount / values.length) * 100
    };

    const prompt = `As an advanced diabetes management AI assistant using the latest Gemini technology, analyze the following glucose data and provide comprehensive, evidence-based recommendations:

GLUCOSE DATA SUMMARY:
- Unit: ${unit}
- Time period: Last ${recentData.length} readings
- Average glucose: ${avgGlucose.toFixed(1)} ${unit}
- Range: ${minGlucose} - ${maxGlucose} ${unit}
- Glucose variability: ${((Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avgGlucose, 2), 0) / values.length) / avgGlucose) * 100).toFixed(1)}% CV
- Time in range analysis:
  * Low (<70 ${unit}): ${timeInRange.low.toFixed(1)}% (Target: <4%)
  * Normal (70-180 ${unit}): ${timeInRange.normal.toFixed(1)}% (Target: >70%)
  * High (>180 ${unit}): ${timeInRange.high.toFixed(1)}% (Target: <25%)

Recent glucose pattern: ${recentData.map(d => `${d.value}${unit}`).join(', ')}

Please provide your analysis in the following JSON format:
{
  "recommendations": [
    "Specific, actionable recommendation 1 with clear rationale",
    "Specific, actionable recommendation 2 with clear rationale",
    "Specific, actionable recommendation 3 with clear rationale"
  ],
  "riskAssessment": "low|medium|high|critical",
  "confidence": 0.85,
  "reasoning": [
    "Detailed clinical reasoning point 1",
    "Detailed clinical reasoning point 2",
    "Pattern analysis and trend identification"
  ],
  "safetyWarnings": [
    "Any urgent safety concerns if applicable"
  ]
}

FOCUS AREAS:
1. Time in range optimization strategies
2. Glucose variability reduction techniques
3. Pattern-based insulin adjustment suggestions
4. Lifestyle modification recommendations
5. Risk stratification based on current trends
6. When to contact healthcare provider
7. Hypoglycemia and hyperglycemia prevention

IMPORTANT: Provide evidence-based, personalized recommendations. Consider glucose trends, variability patterns, and time-in-range metrics. Always prioritize patient safety.

Respond only with the JSON object, no additional text.`;

    try {
      const response = await this.generateContent(modelId, prompt);
      
      // Try to parse JSON response
      let analysisResult;
      try {
        // Extract JSON from response if it's wrapped in other text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;
        analysisResult = JSON.parse(jsonStr);
      } catch (parseError) {
        // If JSON parsing fails, create a structured response from the text
        analysisResult = {
          recommendations: [response],
          riskAssessment: avgGlucose > 250 ? 'critical' : avgGlucose > 180 ? 'high' : avgGlucose < 70 ? 'high' : 'medium',
          confidence: 0.7,
          reasoning: ['Generated from unstructured response'],
          safetyWarnings: avgGlucose > 300 || avgGlucose < 50 ? ['Extreme glucose values detected - contact healthcare provider immediately'] : []
        };
      }

      // Validate and ensure required fields
      const result: GeminiAnalysisResult = {
        recommendations: Array.isArray(analysisResult.recommendations) ? analysisResult.recommendations : [analysisResult.recommendations || 'Monitor glucose levels closely'],
        riskAssessment: ['low', 'medium', 'high', 'critical'].includes(analysisResult.riskAssessment) ? analysisResult.riskAssessment : 'medium',
        confidence: typeof analysisResult.confidence === 'number' ? Math.max(0, Math.min(1, analysisResult.confidence)) : 0.7,
        reasoning: Array.isArray(analysisResult.reasoning) ? analysisResult.reasoning : [analysisResult.reasoning || 'Based on glucose data analysis'],
        safetyWarnings: Array.isArray(analysisResult.safetyWarnings) ? analysisResult.safetyWarnings : [],
        tokenUsage: {
          prompt: prompt.length / 4, // Rough estimation
          completion: response.length / 4, // Rough estimation
          total: (prompt.length + response.length) / 4
        }
      };

      return result;
    } catch (error) {
      console.error('Gemini diabetes analysis error:', error);
      throw new Error(`Gemini analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default GeminiService;
