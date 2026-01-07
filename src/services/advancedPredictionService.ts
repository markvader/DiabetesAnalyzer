import { aiService } from './aiService';
import { safeJsonParseFromText } from '../utils/safeJson';
import { asNumber, asStringArray } from './aiValidation';

export interface GlucoseReading {
  sgv: number;
  date: number;
  direction?: string;
  trend?: number;
}

export interface MealEvent {
  carbs: number;
  time: number;
  insulinBolus?: number;
}

export interface InsulinEvent {
  units: number;
  time: number;
  type: 'bolus' | 'basal';
}

export interface ExerciseEvent {
  intensity: 'low' | 'moderate' | 'high';
  duration: number; // minutes
  time: number;
}

export interface PredictionContext {
  recentMeals: MealEvent[];
  recentInsulin: InsulinEvent[];
  recentExercise: ExerciseEvent[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  isWeekend: boolean;
  stressLevel?: 'low' | 'moderate' | 'high';
  sleepQuality?: 'poor' | 'fair' | 'good';
}

export interface PredictionResult {
  predictions: number[];
  highScenario: number[];
  lowScenario: number[];
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  trendAnalysis: {
    shortTerm: 'rising' | 'falling' | 'stable';
    mediumTerm: 'rising' | 'falling' | 'stable';
    longTerm: 'rising' | 'falling' | 'stable';
  };
  timeInRangePrediction: {
    next1Hour: number;
    next2Hours: number;
    next3Hours: number;
  };
  alertPredictions: {
    lowAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[];
    highAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[];
  };
}

class AdvancedPredictionService {

  private getFirstJsonCapableProvider(): any | null {
    const providers = (aiService as any)?.providers;
    if (!Array.isArray(providers) || providers.length === 0) return null;

    // Gemini uses a dedicated SDK/service in `aiService` and isn't directly callable from here.
    // For advanced predictions we only use providers we can call with fetch.
    const provider = providers.find((p: any) => {
      const endpoint = p?.endpoint;
      const apiKey = p?.apiKey;
      return typeof endpoint === 'string' && endpoint !== 'gemini' && typeof apiKey === 'string' && apiKey.length > 0;
    });

    return provider ?? null;
  }
  
  async generateAdvancedPredictions(
    readings: GlucoseReading[],
    context?: PredictionContext,
    predictionHours: number = 3,
    intervalMinutes: number = 5
  ): Promise<PredictionResult> {
    
    const predictionPoints = (predictionHours * 60) / intervalMinutes;
    
    // Try AI-powered prediction first
    try {
      const aiResult = await this.getAIPoweredPredictions(readings, context, predictionPoints);
      if (aiResult) {
        return aiResult;
      }
    } catch (error) {
      console.warn('AI prediction failed, falling back to advanced mathematical model:', error);
    }
    
    // Fallback to advanced mathematical prediction
    return this.getAdvancedMathematicalPredictions(readings, context, predictionPoints);
  }

  private async getAIPoweredPredictions(
    readings: GlucoseReading[],
    context?: PredictionContext,
    predictionPoints: number = 36
  ): Promise<PredictionResult | null> {
    
    const provider = this.getFirstJsonCapableProvider();
    if (!provider) {
      // No remote AI configured; fall back to deterministic model without logging errors.
      return null;
    }

    const recentReadings = readings.slice(-48); // Last 4 hours of data
    
    // Prepare comprehensive context for AI
    const prompt = this.buildAIPredictionPrompt(recentReadings, context, predictionPoints);
    
    try {
      const response = await this.callAIService(prompt, provider);
      return this.parseAIResponse(response, recentReadings);
    } catch (error) {
      return null;
    }
  }

  private buildAIPredictionPrompt(
    readings: GlucoseReading[],
    context?: PredictionContext,
    predictionPoints: number = 36
  ): string {
    const currentGlucose = readings[readings.length - 1]?.sgv || 100;
    const trend = this.calculateTrend(readings.slice(-6));
    
    let prompt = `You are an advanced diabetes AI specialized in glucose prediction. Analyze the following data and provide comprehensive glucose predictions.

CURRENT DATA:
- Current glucose: ${currentGlucose} mg/dL
- Recent trend: ${trend > 0 ? 'Rising' : trend < 0 ? 'Falling' : 'Stable'} (${Math.abs(trend).toFixed(1)} mg/dL per 5 min)
- Recent readings (last 4 hours, mg/dL): ${readings.map(r => r.sgv).join(', ')}`;

    if (context) {
      prompt += `

CONTEXT:
- Time of day: ${context.timeOfDay}
- Day: ${context.dayOfWeek} (${context.isWeekend ? 'Weekend' : 'Weekday'})`;

      if (context.recentMeals.length > 0) {
        prompt += `
- Recent meals: ${context.recentMeals.map(m => `${m.carbs}g carbs ${Math.round((Date.now() - m.time) / 60000)} min ago`).join(', ')}`;
      }

      if (context.recentInsulin.length > 0) {
        prompt += `
- Recent insulin: ${context.recentInsulin.map(i => `${i.units}u ${i.type} ${Math.round((Date.now() - i.time) / 60000)} min ago`).join(', ')}`;
      }

      if (context.recentExercise.length > 0) {
        prompt += `
- Recent exercise: ${context.recentExercise.map(e => `${e.intensity} intensity for ${e.duration} min, ${Math.round((Date.now() - e.time) / 60000)} min ago`).join(', ')}`;
      }

      if (context.stressLevel) {
        prompt += `
- Stress level: ${context.stressLevel}`;
      }

      if (context.sleepQuality) {
        prompt += `
- Sleep quality: ${context.sleepQuality}`;
      }
    }

    prompt += `

PREDICTION REQUIREMENTS:
Generate predictions for the next ${predictionPoints} time points (5-minute intervals = ${(predictionPoints * 5) / 60} hours).

Return a JSON object with the following structure:
{
  "predictions": [array of ${predictionPoints} glucose values in mg/dL],
  "highScenario": [array of ${predictionPoints} upper bound values],
  "lowScenario": [array of ${predictionPoints} lower bound values],
  "confidence": number between 0-100,
  "riskFactors": [array of identified risk factors],
  "recommendations": [array of actionable recommendations],
  "trendAnalysis": {
    "shortTerm": "rising|falling|stable",
    "mediumTerm": "rising|falling|stable", 
    "longTerm": "rising|falling|stable"
  },
  "timeInRangePrediction": {
    "next1Hour": percentage in range 70-180 mg/dL,
    "next2Hours": percentage in range 70-180 mg/dL,
    "next3Hours": percentage in range 70-180 mg/dL
  },
  "alertPredictions": {
    "lowAlerts": [{"time": minutes_from_now, "severity": "mild|moderate|severe"}],
    "highAlerts": [{"time": minutes_from_now, "severity": "mild|moderate|severe"}]
  }
}

Consider:
- Dawn phenomenon (early morning glucose rise)
- Post-meal glucose patterns
- Insulin action curves
- Exercise effects on glucose
- Stress and sleep impact
- Individual glucose patterns from historical data
- Risk of hypoglycemia and hyperglycemia

Provide realistic, medically sound predictions based on diabetes physiology.`;

    return prompt;
  }

  private async callAIService(prompt: string, provider: any): Promise<string> {
    try {
      if (!provider?.endpoint || !provider?.name || !provider?.model || !provider?.apiKey) {
        return '';
      }

      let response: Response;

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
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1200
          })
        });
      } else {
        // OpenAI / DeepSeek compatible APIs
        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: 'You are an advanced diabetes AI specialized in glucose prediction.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1200
          })
        });
      }

      if (!response.ok) {
        return '';
      }

      const data = await response.json();

      if (provider.name === 'Anthropic') {
        const text = data?.content?.[0]?.text;
        return typeof text === 'string' ? text : '';
      }

      const content = data?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } catch (error) {
      return '';
    }
  }

  private parseAIResponse(response: string, readings: GlucoseReading[]): PredictionResult | null {
    const text = String(response ?? '').trim();
    if (!text) return null;

    const parsedJson = safeJsonParseFromText(text);
    if (!parsedJson.ok) {
      return null;
    }

    const parsed = (typeof parsedJson.value === 'object' && parsedJson.value !== null) ? (parsedJson.value as any) : {};
      
    const result: PredictionResult = {
        predictions: this.validatePredictionArray(parsed.predictions, readings),
        highScenario: this.validatePredictionArray(parsed.highScenario, readings),
        lowScenario: this.validatePredictionArray(parsed.lowScenario, readings),
        confidence: asNumber(parsed.confidence, 75, 0, 100),
        riskFactors: asStringArray(parsed.riskFactors, 12),
        recommendations: asStringArray(parsed.recommendations, 12),
        trendAnalysis: {
          shortTerm: this.validateTrend(parsed.trendAnalysis?.shortTerm),
          mediumTerm: this.validateTrend(parsed.trendAnalysis?.mediumTerm),
          longTerm: this.validateTrend(parsed.trendAnalysis?.longTerm)
        },
        timeInRangePrediction: {
          next1Hour: asNumber(parsed.timeInRangePrediction?.next1Hour, 80, 0, 100),
          next2Hours: asNumber(parsed.timeInRangePrediction?.next2Hours, 75, 0, 100),
          next3Hours: asNumber(parsed.timeInRangePrediction?.next3Hours, 70, 0, 100)
        },
        alertPredictions: {
          lowAlerts: this.validateAlerts(parsed.alertPredictions?.lowAlerts),
          highAlerts: this.validateAlerts(parsed.alertPredictions?.highAlerts)
        }
      };

    // Require at least some prediction points, otherwise treat as invalid and fall back.
    if (!Array.isArray(result.predictions) || result.predictions.length === 0) {
      return null;
    }

    return result;
  }

  private validatePredictionArray(arr: any, readings: GlucoseReading[]): number[] {
    if (!Array.isArray(arr)) return [];
    
    const lastGlucose = readings[readings.length - 1]?.sgv || 100;
    return arr.map((val) => {
      const numVal = Number(val);
      if (isNaN(numVal)) return lastGlucose;
      
      // Ensure values are within reasonable glucose ranges
      return Math.min(600, Math.max(20, numVal));
    }).slice(0, 36); // Ensure max 36 predictions
  }

  private validateTrend(trend: any): 'rising' | 'falling' | 'stable' {
    if (['rising', 'falling', 'stable'].includes(trend)) {
      return trend;
    }
    return 'stable';
  }

  private validateAlerts(alerts: any): { time: number; severity: 'mild' | 'moderate' | 'severe' }[] {
    if (!Array.isArray(alerts)) return [];
    
    return alerts.filter(alert => 
      typeof alert.time === 'number' && 
      ['mild', 'moderate', 'severe'].includes(alert.severity)
    ).slice(0, 10); // Max 10 alerts
  }

  private getAdvancedMathematicalPredictions(
    readings: GlucoseReading[],
    context?: PredictionContext,
    predictionPoints: number = 36
  ): PredictionResult {
    
    const recentReadings = readings.slice(-24);
    
    // Calculate various trends
    const shortTermTrend = this.calculateTrend(recentReadings.slice(-3));
    const mediumTermTrend = this.calculateTrend(recentReadings.slice(-6));
    const longTermTrend = this.calculateTrend(recentReadings.slice(-12));
    
    // Generate base predictions using exponential smoothing
    const predictions = this.generateExponentialSmoothingPredictions(
      recentReadings, 
      predictionPoints,
      context
    );
    
    // Calculate confidence based on data consistency
    const confidence = this.calculateConfidence(recentReadings, predictions);
    
    // Generate scenarios
    const standardDeviation = this.calculateStandardDeviation(recentReadings);
    const highScenario = predictions.map((p, i) => 
      Math.round(p + standardDeviation * (1 + i * 0.1))
    );
    const lowScenario = predictions.map((p, i) => 
      Math.round(p - standardDeviation * (1 + i * 0.1))
    );
    
    // Analyze risks and generate recommendations
    const riskFactors = this.identifyRiskFactors(predictions, lowScenario, highScenario, context);
    const recommendations = this.generateRecommendations(predictions, riskFactors, context);
    
    // Calculate time in range predictions
    const timeInRangePrediction = this.calculateTimeInRange(predictions);
    
    // Generate alert predictions
    const alertPredictions = this.generateAlertPredictions(predictions, lowScenario, highScenario);
    
    return {
      predictions,
      highScenario,
      lowScenario,
      confidence,
      riskFactors,
      recommendations,
      trendAnalysis: {
        shortTerm: this.getTrendDirection(shortTermTrend),
        mediumTerm: this.getTrendDirection(mediumTermTrend),
        longTerm: this.getTrendDirection(longTermTrend)
      },
      timeInRangePrediction,
      alertPredictions
    };
  }

  private calculateTrend(readings: GlucoseReading[]): number {
    if (readings.length < 2) return 0;
    
    const first = readings[0].sgv;
    const last = readings[readings.length - 1].sgv;
    const timeSpan = readings.length - 1;
    
    return (last - first) / timeSpan;
  }

  private generateExponentialSmoothingPredictions(
    readings: GlucoseReading[],
    points: number,
    context?: PredictionContext
  ): number[] {
    const alpha = 0.3; // Smoothing factor
    const beta = 0.1;  // Trend factor
    
    const values = readings.map(r => r.sgv);
    let level = values[0];
    let trend = 0;
    
    // Calculate initial level and trend
    for (let i = 1; i < values.length; i++) {
      const newLevel = alpha * values[i] + (1 - alpha) * (level + trend);
      trend = beta * (newLevel - level) + (1 - beta) * trend;
      level = newLevel;
    }
    
    const predictions: number[] = [];
    
    for (let i = 0; i < points; i++) {
      let prediction = level + trend * (i + 1);
      
      // Apply context-based adjustments
      if (context) {
        prediction = this.applyContextualAdjustments(prediction, i, context);
      }
      
      // Ensure realistic bounds
      prediction = Math.min(600, Math.max(20, Math.round(prediction)));
      predictions.push(prediction);
    }
    
    return predictions;
  }

  private applyContextualAdjustments(
    prediction: number,
    timeIndex: number,
    context: PredictionContext
  ): number {
    let adjusted = prediction;
    const timeMinutes = timeIndex * 5;
    
    // Meal effects
    context.recentMeals.forEach(meal => {
      const timeSinceMeal = (Date.now() - meal.time) / 60000 + timeMinutes;
      if (timeSinceMeal >= 0 && timeSinceMeal <= 180) { // 3 hours post-meal
        const mealEffect = this.calculateMealEffect(meal.carbs, timeSinceMeal);
        adjusted += mealEffect;
      }
    });
    
    // Insulin effects
    context.recentInsulin.forEach(insulin => {
      const timeSinceInsulin = (Date.now() - insulin.time) / 60000 + timeMinutes;
      if (insulin.type === 'bolus' && timeSinceInsulin >= 0 && timeSinceInsulin <= 240) {
        const insulinEffect = this.calculateInsulinEffect(insulin.units, timeSinceInsulin);
        adjusted -= insulinEffect;
      }
    });
    
    // Exercise effects
    context.recentExercise.forEach(exercise => {
      const timeSinceExercise = (Date.now() - exercise.time) / 60000 + timeMinutes;
      if (timeSinceExercise >= 0 && timeSinceExercise <= 360) { // 6 hours post-exercise
        const exerciseEffect = this.calculateExerciseEffect(exercise, timeSinceExercise);
        adjusted -= exerciseEffect;
      }
    });
    
    return adjusted;
  }

  private calculateMealEffect(carbs: number, timeSinceMeal: number): number {
    // Simplified meal absorption curve
    if (timeSinceMeal < 0 || timeSinceMeal > 180) return 0;
    
    const peakTime = 60; // Peak at 1 hour
    const maxEffect = carbs * 2; // Rough approximation
    
    if (timeSinceMeal <= peakTime) {
      return maxEffect * (timeSinceMeal / peakTime);
    } else {
      return maxEffect * Math.exp(-(timeSinceMeal - peakTime) / 60);
    }
  }

  private calculateInsulinEffect(units: number, timeSinceInsulin: number): number {
    // Simplified insulin action curve
    if (timeSinceInsulin < 0 || timeSinceInsulin > 240) return 0;
    
    const peakTime = 75; // Peak at 75 minutes
    const maxEffect = units * 30; // Rough approximation
    
    if (timeSinceInsulin <= peakTime) {
      return maxEffect * (timeSinceInsulin / peakTime);
    } else {
      return maxEffect * Math.exp(-(timeSinceInsulin - peakTime) / 80);
    }
  }

  private calculateExerciseEffect(exercise: ExerciseEvent, timeSinceExercise: number): number {
    const intensityMultiplier = exercise.intensity === 'high' ? 2 : exercise.intensity === 'moderate' ? 1.5 : 1;
    const durationFactor = Math.min(exercise.duration / 60, 2); // Max 2x for very long exercise
    const maxEffect = 20 * intensityMultiplier * durationFactor;
    
    // Exercise effect decreases exponentially
    return maxEffect * Math.exp(-timeSinceExercise / 120);
  }

  private calculateConfidence(readings: GlucoseReading[], _predictions: number[]): number {
    const recentVariability = this.calculateStandardDeviation(readings.slice(-12));
    const dataQuality = Math.min(readings.length / 24, 1); // Better with more data
    const trendConsistency = this.calculateTrendConsistency(readings);
    
    const baseConfidence = 60;
    const variabilityPenalty = Math.min(recentVariability / 2, 20);
    const dataQualityBonus = dataQuality * 15;
    const consistencyBonus = trendConsistency * 10;
    
    return Math.round(Math.min(95, Math.max(30, 
      baseConfidence - variabilityPenalty + dataQualityBonus + consistencyBonus
    )));
  }

  private calculateStandardDeviation(readings: GlucoseReading[]): number {
    const values = readings.map(r => r.sgv);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateTrendConsistency(readings: GlucoseReading[]): number {
    if (readings.length < 6) return 0;
    
    const trends = [];
    for (let i = 3; i < readings.length; i += 3) {
      const trend = this.calculateTrend(readings.slice(i - 3, i + 1));
      trends.push(trend);
    }
    
    const trendVariability = this.calculateArrayStandardDeviation(trends);
    return Math.max(0, 1 - trendVariability / 10);
  }

  private calculateArrayStandardDeviation(arr: number[]): number {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  private identifyRiskFactors(
    predictions: number[],
    lowScenario: number[],
    highScenario: number[],
    context?: PredictionContext
  ): string[] {
    const riskFactors: string[] = [];
    
    // Check for hypoglycemia risk
    const minLow = Math.min(...lowScenario);
    const minPredicted = Math.min(...predictions);
    
    if (minLow < 54) {
      riskFactors.push('Severe hypoglycemia risk detected in worst-case scenario');
    } else if (minLow < 70) {
      riskFactors.push('Mild hypoglycemia risk in worst-case scenario');
    }
    
    if (minPredicted < 70) {
      riskFactors.push('Predicted glucose below target range');
    }
    
    // Check for hyperglycemia risk
    const maxHigh = Math.max(...highScenario);
    const maxPredicted = Math.max(...predictions);
    
    if (maxHigh > 300) {
      riskFactors.push('Severe hyperglycemia risk in worst-case scenario');
    } else if (maxHigh > 250) {
      riskFactors.push('Moderate hyperglycemia risk in worst-case scenario');
    }
    
    if (maxPredicted > 180) {
      riskFactors.push('Predicted glucose above target range');
    }
    
    // Context-based risk factors
    if (context) {
      if (context.recentMeals.some(meal => meal.carbs > 60)) {
        riskFactors.push('Large meal may cause glucose spike');
      }
      
      if (context.recentExercise.some(ex => ex.intensity === 'high')) {
        riskFactors.push('Recent intense exercise may cause delayed hypoglycemia');
      }
      
      if (context.stressLevel === 'high') {
        riskFactors.push('High stress levels may affect glucose control');
      }
      
      if (context.sleepQuality === 'poor') {
        riskFactors.push('Poor sleep quality may impact glucose regulation');
      }
    }
    
    return riskFactors;
  }

  private generateRecommendations(
    predictions: number[],
    _riskFactors: string[],
    context?: PredictionContext
  ): string[] {
    const recommendations: string[] = [];
    
    const avgPredicted = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
    const minPredicted = Math.min(...predictions);
    const maxPredicted = Math.max(...predictions);
    
    // Glucose level recommendations
    if (minPredicted < 70) {
      recommendations.push('Consider consuming 15g fast-acting carbs to prevent hypoglycemia');
    }
    
    if (maxPredicted > 200) {
      recommendations.push('Consider checking ketones and consulting your healthcare provider');
    }
    
    if (avgPredicted > 180) {
      recommendations.push('Monitor closely and consider insulin adjustment per your care plan');
    }
    
    // Context-based recommendations
    if (context) {
      if (context.recentMeals.length === 0 && context.timeOfDay === 'morning') {
        recommendations.push('Consider eating breakfast to maintain stable glucose levels');
      }
      
      if (context.recentExercise.some(ex => ex.intensity === 'high')) {
        recommendations.push('Monitor for delayed hypoglycemia up to 24 hours post-exercise');
      }
      
      if (context.stressLevel === 'high') {
        recommendations.push('Practice stress management techniques as stress can elevate glucose');
      }
    }
    
    // General recommendations
    recommendations.push('Continue regular glucose monitoring as per your care plan');
    recommendations.push('These are predictions - actual values may vary based on many factors');
    
    return recommendations;
  }

  private calculateTimeInRange(predictions: number[]): {
    next1Hour: number;
    next2Hours: number;
    next3Hours: number;
  } {
    const hour1 = predictions.slice(0, 12); // First hour (12 * 5min = 60min)
    const hour2 = predictions.slice(0, 24); // First 2 hours
    const hour3 = predictions.slice(0, 36); // First 3 hours
    
    const inRange = (values: number[]) => {
      const inRangeCount = values.filter(v => v >= 70 && v <= 180).length;
      return Math.round((inRangeCount / values.length) * 100);
    };
    
    return {
      next1Hour: inRange(hour1),
      next2Hours: inRange(hour2),
      next3Hours: inRange(hour3)
    };
  }

  private generateAlertPredictions(
    predictions: number[],
    lowScenario: number[],
    highScenario: number[]
  ): {
    lowAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[];
    highAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[];
  } {
    const lowAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[] = [];
    const highAlerts: { time: number; severity: 'mild' | 'moderate' | 'severe' }[] = [];
    
    for (let i = 0; i < predictions.length; i++) {
      const timeMinutes = i * 5;
      const predicted = predictions[i];
      const low = lowScenario[i];
      const high = highScenario[i];
      
      // Low alerts
      if (low < 54) {
        lowAlerts.push({ time: timeMinutes, severity: 'severe' });
      } else if (low < 60) {
        lowAlerts.push({ time: timeMinutes, severity: 'moderate' });
      } else if (predicted < 70) {
        lowAlerts.push({ time: timeMinutes, severity: 'mild' });
      }
      
      // High alerts
      if (high > 300) {
        highAlerts.push({ time: timeMinutes, severity: 'severe' });
      } else if (high > 250) {
        highAlerts.push({ time: timeMinutes, severity: 'moderate' });
      } else if (predicted > 200) {
        highAlerts.push({ time: timeMinutes, severity: 'mild' });
      }
    }
    
    return { lowAlerts, highAlerts };
  }

  private getTrendDirection(trend: number): 'rising' | 'falling' | 'stable' {
    if (trend > 1) return 'rising';
    if (trend < -1) return 'falling';
    return 'stable';
  }
}

export const advancedPredictionService = new AdvancedPredictionService();
