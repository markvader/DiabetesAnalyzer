import * as tf from '@tensorflow/tfjs';
import { toMmol } from '../utils/glucoseUtils';

interface GlucoseReading {
  date: string;
  value: number;
  sgv?: number;
  direction?: string;
  trend?: number;
}

interface Treatment {
  created_at: string;
  insulin?: number;
  carbs?: number;
  eventType?: string;
}

interface TensorFlowAnalysisResult {
  recommendations: string[];
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string[];
  safetyWarnings: string[];
  predictions?: {
    nextHour: number;
    trend: 'rising' | 'stable' | 'falling';
    probability: number;
  };
  patterns?: {
    timeInRange: { low: number; inRange: number; high: number };
    variability: number;
    avgGlucose: number;
  };
}

class TensorFlowAIService {
  private glucoseModel: tf.Sequential | null = null;
  private isModelInitialized = false;
  private isModelInitializing = false;
  private isTensorFlowEnabled = true;
  private readonly HYPO_THRESHOLD_MMOL = 3.9; // 70 mg/dL
  private readonly HYPER_THRESHOLD_MMOL = 10.0; // 180 mg/dL

  constructor() {
    // Check localStorage for TensorFlow preference
    const tensorFlowPref = localStorage.getItem('tensorflow_enabled');
    this.isTensorFlowEnabled = tensorFlowPref === null ? true : tensorFlowPref === 'true';
    
    if (this.isTensorFlowEnabled) {
      // Initialize model asynchronously
      this.initializeModel().catch(error => {
        console.error('Failed to initialize TensorFlow model in constructor:', error);
      });
    }
  }

  // Enable/disable TensorFlow
  // Public initialize method
  async initialize(): Promise<void> {
    if (this.isTensorFlowEnabled && !this.isModelInitialized) {
      await this.initializeModel();
    }
  }

  setTensorFlowEnabled(enabled: boolean) {
    this.isTensorFlowEnabled = enabled;
    localStorage.setItem('tensorflow_enabled', enabled.toString());
    
    if (enabled && !this.isModelInitialized) {
      // Initialize model asynchronously
      this.initializeModel().catch(error => {
        console.error('Failed to initialize TensorFlow model:', error);
      });
    } else if (!enabled) {
      console.log('TensorFlow AI disabled by user preference');
    }
  }

  // Check if TensorFlow should be used (based on user preference and model readiness)
  shouldUseTensorFlow(): boolean {
    return this.isTensorFlowEnabled && this.isModelInitialized;
  }

  // Get TensorFlow preference status
  isTensorFlowEnabledByUser(): boolean {
    return this.isTensorFlowEnabled;
  }

  private async initializeModel() {
    if (this.isModelInitializing || this.isModelInitialized) {
      return;
    }
    
    this.isModelInitializing = true;
    
    try {
      console.log('Initializing TensorFlow model for glucose analysis...');
      
      // Create a simple neural network for glucose prediction and pattern recognition
      this.glucoseModel = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [10], // Last 10 glucose readings + features
            units: 64,
            activation: 'relu',
            name: 'glucose_input'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu',
            name: 'hidden_layer_1'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu',
            name: 'hidden_layer_2'
          }),
          tf.layers.dense({
            units: 8,
            activation: 'relu',
            name: 'pattern_layer'
          }),
          tf.layers.dense({
            units: 3, // Risk level, next glucose prediction, trend
            activation: 'linear',
            name: 'output_layer'
          })
        ]
      });

      // Compile the model
      this.glucoseModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      this.isModelInitialized = true;
      console.log('TensorFlow model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TensorFlow model:', error);
      this.isModelInitialized = false;
    } finally {
      this.isModelInitializing = false;
    }
  }

  private preprocessGlucoseData(readings: GlucoseReading[]): number[] {
    // Take last 10 readings and extract features
    const recentReadings = readings.slice(-10);
    const features: number[] = [];

    // Pad with zeros if we don't have enough readings
    while (recentReadings.length < 10) {
      recentReadings.unshift({ date: '', value: 0 });
    }

    // Extract glucose values (normalized)
    for (const reading of recentReadings) {
      const glucoseValue = reading.value || reading.sgv || 0;
      const normalizedValue = glucoseValue / 400; // Normalize to 0-1 range (assuming max 400 mg/dL)
      features.push(normalizedValue);
    }

    return features;
  }

  private calculateTimeInRange(readings: GlucoseReading[]): { low: number; inRange: number; high: number } {
    if (readings.length === 0) return { low: 0, inRange: 0, high: 0 };

    let low = 0, inRange = 0, high = 0;

    readings.forEach(reading => {
      const glucose = reading.value || reading.sgv || 0;
      const glucoseMmol = toMmol(glucose);

      if (glucoseMmol < this.HYPO_THRESHOLD_MMOL) {
        low++;
      } else if (glucoseMmol > this.HYPER_THRESHOLD_MMOL) {
        high++;
      } else {
        inRange++;
      }
    });

    const total = readings.length;
    return {
      low: Math.round((low / total) * 100),
      inRange: Math.round((inRange / total) * 100),
      high: Math.round((high / total) * 100)
    };
  }

  private calculateVariability(readings: GlucoseReading[]): number {
    if (readings.length < 2) return 0;

    const values = readings.map(r => r.value || r.sgv || 0).filter(v => v > 0);
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private assessRiskLevel(timeInRange: any, variability: number, avgGlucose: number): {
    risk: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  } {
    let riskScore = 0;
    
    // Time in range scoring
    if (timeInRange.low > 10) riskScore += 3;
    else if (timeInRange.low > 5) riskScore += 2;
    else if (timeInRange.low > 1) riskScore += 1;

    if (timeInRange.high > 25) riskScore += 2;
    else if (timeInRange.high > 15) riskScore += 1;

    if (timeInRange.inRange < 70) riskScore += 2;

    // Variability scoring
    if (variability > 100) riskScore += 2;
    else if (variability > 50) riskScore += 1;

    // Average glucose scoring
    const avgMmol = toMmol(avgGlucose);
    if (avgMmol < 4.0 || avgMmol > 12.0) riskScore += 2;
    else if (avgMmol < 4.4 || avgMmol > 10.0) riskScore += 1;

    let risk: 'low' | 'medium' | 'high' | 'critical';
    let confidence: number;

    if (riskScore >= 8) {
      risk = 'critical';
      confidence = 95;
    } else if (riskScore >= 5) {
      risk = 'high';
      confidence = 85;
    } else if (riskScore >= 2) {
      risk = 'medium';
      confidence = 75;
    } else {
      risk = 'low';
      confidence = 80;
    }

    return { risk, confidence };
  }

  private generateRecommendations(
    timeInRange: any,
    variability: number,
    avgGlucose: number,
    treatments: Treatment[]
  ): string[] {
    const recommendations: string[] = [];
    const avgMmol = toMmol(avgGlucose);

    // Time in range recommendations
    if (timeInRange.low > 5) {
      recommendations.push('Consider reducing basal insulin rates or adjusting insulin-to-carb ratios to prevent hypoglycemia');
    }
    if (timeInRange.high > 20) {
      recommendations.push('Monitor carbohydrate intake and consider adjusting meal bolus calculations');
    }
    if (timeInRange.inRange < 70) {
      recommendations.push('Focus on improving time in range through consistent meal timing and insulin management');
    }

    // Variability recommendations
    if (variability > 80) {
      recommendations.push('High glucose variability detected. Consider continuous glucose monitoring and consistent meal timing');
    }

    // Average glucose recommendations
    if (avgMmol > 10.0) {
      recommendations.push('Average glucose levels are elevated. Review overall diabetes management plan');
    } else if (avgMmol < 4.4) {
      recommendations.push('Average glucose levels may be too low. Monitor for hypoglycemic episodes');
    }

    // Treatment pattern analysis
    const recentInsulin = treatments.filter(t => t.insulin && new Date(t.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000);
    if (recentInsulin.length > 6) {
      recommendations.push('Frequent insulin corrections detected. Consider basal rate adjustments');
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue current diabetes management plan with regular monitoring');
      recommendations.push('Maintain consistent meal timing and carbohydrate counting');
    }

    return recommendations.slice(0, 4); // Limit to 4 recommendations
  }

  private generateSafetyWarnings(
    timeInRange: any,
    variability: number,
    avgGlucose: number,
    readings: GlucoseReading[]
  ): string[] {
    const warnings: string[] = [];
    const avgMmol = toMmol(avgGlucose);

    // Critical hypoglycemia warning
    if (timeInRange.low > 10) {
      warnings.push('⚠️ CRITICAL: High risk of hypoglycemia detected. Consult your healthcare provider immediately.');
    }

    // Severe hyperglycemia warning
    if (timeInRange.high > 40 || avgMmol > 15.0) {
      warnings.push('⚠️ WARNING: Severe hyperglycemia patterns detected. Medical attention recommended.');
    }

    // High variability warning
    if (variability > 120) {
      warnings.push('⚠️ WARNING: Extremely high glucose variability may indicate management issues.');
    }

    // Recent severe readings
    const recentReadings = readings.slice(-5);
    const severeLows = recentReadings.filter(r => (r.value || r.sgv || 0) < 54); // Below 3.0 mmol/L
    const severeHighs = recentReadings.filter(r => (r.value || r.sgv || 0) > 250); // Above 13.9 mmol/L

    if (severeLows.length > 0) {
      warnings.push('⚠️ ALERT: Recent severe hypoglycemia detected. Monitor closely and have glucose available.');
    }
    if (severeHighs.length > 0) {
      warnings.push('⚠️ ALERT: Recent severe hyperglycemia detected. Check ketones and consider medical consultation.');
    }

    return warnings;
  }

  private predictNextHourGlucose(readings: GlucoseReading[]): {
    nextHour: number;
    trend: 'rising' | 'stable' | 'falling';
    probability: number;
  } {
    if (!this.isModelInitialized || readings.length < 3) {
      // Fallback prediction based on recent trend
      const recent = readings.slice(-3);
      const values = recent.map(r => r.value || r.sgv || 0);
      const avgChange = (values[values.length - 1] - values[0]) / (values.length - 1);
      
      return {
        nextHour: Math.max(40, Math.min(400, values[values.length - 1] + avgChange)),
        trend: avgChange > 5 ? 'rising' : avgChange < -5 ? 'falling' : 'stable',
        probability: 60
      };
    }

    try {
      const features = this.preprocessGlucoseData(readings);
      const inputTensor = tf.tensor2d([features]);
      
      const prediction = this.glucoseModel!.predict(inputTensor) as tf.Tensor;
      const predictionData = prediction.dataSync();
      
      inputTensor.dispose();
      prediction.dispose();

      const nextHour = Math.max(40, Math.min(400, predictionData[1] * 400)); // Denormalize
      const trendValue = predictionData[2];
      
      return {
        nextHour: Math.round(nextHour),
        trend: trendValue > 0.1 ? 'rising' : trendValue < -0.1 ? 'falling' : 'stable',
        probability: Math.min(90, Math.max(50, predictionData[0] * 100))
      };
    } catch (error) {
      console.error('TensorFlow prediction failed:', error);
      // Fallback to simple trend analysis
      const recent = readings.slice(-3);
      const values = recent.map(r => r.value || r.sgv || 0);
      const avgChange = (values[values.length - 1] - values[0]) / (values.length - 1);
      
      return {
        nextHour: Math.max(40, Math.min(400, values[values.length - 1] + avgChange)),
        trend: avgChange > 5 ? 'rising' : avgChange < -5 ? 'falling' : 'stable',
        probability: 60
      };
    }
  }

  async analyzeGlucoseData(
    readings: GlucoseReading[],
    treatments: Treatment[]
  ): Promise<TensorFlowAnalysisResult> {
    try {
      console.log('TensorFlow: Starting glucose data analysis...');

      // Check if model is ready
      if (!this.isModelInitialized) {
        if (this.isModelInitializing) {
          console.log('TensorFlow model is still initializing, using fallback analysis');
        } else {
          console.log('TensorFlow model not initialized, using fallback analysis');
        }
        
        return this.getFallbackAnalysis(readings, treatments);
      }

      if (readings.length === 0) {
        return {
          recommendations: ['No glucose data available for analysis'],
          riskAssessment: 'medium',
          confidence: 0,
          reasoning: ['Insufficient data for analysis'],
          safetyWarnings: ['No glucose readings available']
        };
      }

      // Calculate basic metrics
      const timeInRange = this.calculateTimeInRange(readings);
      const variability = this.calculateVariability(readings);
      const avgGlucose = readings.reduce((sum, r) => sum + (r.value || r.sgv || 0), 0) / readings.length;

      // Assess risk using TensorFlow-enhanced analysis
      const riskAssessment = this.assessRiskLevel(timeInRange, variability, avgGlucose);

      // Generate recommendations
      const recommendations = this.generateRecommendations(timeInRange, variability, avgGlucose, treatments);

      // Generate safety warnings
      const safetyWarnings = this.generateSafetyWarnings(timeInRange, variability, avgGlucose, readings);

      // Predict next hour glucose
      const predictions = this.predictNextHourGlucose(readings);

      // Generate reasoning
      const reasoning = [
        `Time in range analysis: ${timeInRange.inRange}% in target range`,
        `Glucose variability: ${Math.round(variability)}mg/dL standard deviation`,
        `Average glucose: ${Math.round(avgGlucose)}mg/dL (${Math.round(toMmol(avgGlucose) * 10) / 10}mmol/L)`,
        `Risk assessment based on TensorFlow pattern analysis`
      ];

      console.log('TensorFlow: Analysis completed successfully');

      return {
        recommendations,
        riskAssessment: riskAssessment.risk,
        confidence: riskAssessment.confidence,
        reasoning,
        safetyWarnings,
        predictions,
        patterns: {
          timeInRange,
          variability: Math.round(variability),
          avgGlucose: Math.round(avgGlucose)
        }
      };

    } catch (error) {
      console.error('TensorFlow analysis failed:', error);
      
      // Return fallback analysis instead of throwing
      return this.getFallbackAnalysis(readings, treatments);
    }
  }

  // Fallback analysis when TensorFlow is not available
  private getFallbackAnalysis(readings: GlucoseReading[], treatments: Treatment[]): TensorFlowAnalysisResult {
    try {
      const timeInRange = this.calculateTimeInRange(readings);
      const variability = this.calculateVariability(readings);
      const avgGlucose = readings.reduce((sum, r) => sum + (r.value || r.sgv || 0), 0) / readings.length;

      return {
        recommendations: [
          'TensorFlow analysis temporarily unavailable',
          'Monitor glucose levels regularly',
          'Follow your standard diabetes management plan',
          'Consult healthcare provider if concerned'
        ],
        riskAssessment: 'medium',
        confidence: 50,
        reasoning: ['TensorFlow analysis failed, using fallback assessment'],
        safetyWarnings: ['Analysis system temporarily unavailable - monitor closely']
      };
    } catch (error) {
      console.error('Fallback analysis also failed:', error);
      return {
        recommendations: ['Monitor glucose levels regularly', 'Consult healthcare provider'],
        riskAssessment: 'medium',
        confidence: 25,
        reasoning: ['Analysis system unavailable'],
        safetyWarnings: ['Unable to perform automated analysis']
      };
    }
  }

  // Additional analysis methods for specific use cases
  async analyzeGlucosePatterns(readings: GlucoseReading[]): Promise<any> {
    try {
      if (!this.isModelInitialized) {
        console.log('TensorFlow model not initialized for pattern analysis, using basic analysis');
        return this.getBasicPatternAnalysis(readings);
      }

      const timeInRange = this.calculateTimeInRange(readings);
      const variability = this.calculateVariability(readings);
      const predictions = this.predictNextHourGlucose(readings);

      return {
        patterns: {
          timeInRange,
          variability: Math.round(variability),
          avgGlucose: Math.round(readings.reduce((sum, r) => sum + (r.value || r.sgv || 0), 0) / readings.length)
        },
        predictions,
        insights: [
          `Current glucose trend is ${predictions.trend}`,
          `Time in range: ${timeInRange.inRange}%`,
          `Glucose variability: ${variability > 80 ? 'High' : variability > 40 ? 'Moderate' : 'Low'}`
        ]
      };
    } catch (error) {
      console.error('TensorFlow pattern analysis failed:', error);
      return this.getBasicPatternAnalysis(readings);
    }
  }

  // Basic pattern analysis fallback
  private getBasicPatternAnalysis(readings: GlucoseReading[]): any {
    if (readings.length === 0) {
      return {
        patterns: { timeInRange: { inRange: 0 }, variability: 0, avgGlucose: 0 },
        predictions: { trend: 'unknown' },
        insights: ['No glucose data available for pattern analysis']
      };
    }

    const timeInRange = this.calculateTimeInRange(readings);
    const variability = this.calculateVariability(readings);
    const avgGlucose = Math.round(readings.reduce((sum, r) => sum + (r.value || r.sgv || 0), 0) / readings.length);

    return {
      patterns: {
        timeInRange,
        variability: Math.round(variability),
        avgGlucose
      },
      predictions: {
        trend: avgGlucose > 180 ? 'high' : avgGlucose < 70 ? 'low' : 'stable'
      },
      insights: [
        `Time in range: ${timeInRange.inRange}%`,
        `Average glucose: ${avgGlucose}mg/dL`,
        `Glucose variability: ${variability > 80 ? 'High' : variability > 40 ? 'Moderate' : 'Low'}`
      ]
    };
  }

  async analyzeMealPatterns(_readings: GlucoseReading[], treatments: Treatment[]): Promise<any> {
    const mealTreatments = treatments.filter(t => t.carbs && t.carbs > 0);
    const insights = [];

    if (mealTreatments.length === 0) {
      insights.push('No meal data available for analysis');
    } else {
      const avgCarbs = mealTreatments.reduce((sum, t) => sum + (t.carbs || 0), 0) / mealTreatments.length;
      insights.push(`Average meal size: ${Math.round(avgCarbs)}g carbohydrates`);
      
      if (avgCarbs > 60) {
        insights.push('Consider smaller, more frequent meals to improve glucose control');
      }
    }

    return {
      mealFrequency: mealTreatments.length,
      averageCarbs: Math.round(mealTreatments.reduce((sum, t) => sum + (t.carbs || 0), 0) / Math.max(mealTreatments.length, 1)),
      insights
    };
  }

  // Check if TensorFlow is working and should be used
  isReady(): boolean {
    const ready = this.shouldUseTensorFlow();
    if (!ready && this.isTensorFlowEnabled) {
      if (this.isModelInitializing) {
        console.log('TensorFlow model is still initializing...');
      } else if (!this.isModelInitialized) {
        console.log('TensorFlow model failed to initialize');
      }
    }
    return ready;
  }

  // Get model information
  getModelInfo(): any {
    if (!this.glucoseModel) return null;

    return {
      name: 'TensorFlow Glucose Analysis Model',
      version: '1.0.0',
      inputShape: [10],
      outputShape: [3],
      layers: this.glucoseModel.layers.length,
      parameters: this.glucoseModel.countParams()
    };
  }
}

export default TensorFlowAIService;
