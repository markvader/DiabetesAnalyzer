import { 
  MealEvent, 
  InsulinEvent, 
  ExerciseEvent, 
  PredictionContext 
} from './advancedPredictionService';

export interface NightscoutTreatment {
  _id?: string;
  created_at?: string;
  date?: number;
  timestamp?: string;
  eventType?: string;
  enteredBy?: string;
  
  // Insulin related
  insulin?: number;
  units?: number;
  type?: string;
  
  // Carbs related
  carbs?: number;
  
  // Exercise related
  duration?: number;
  
  // Notes and other info
  notes?: string;
  reason?: string;
  
  // OpenAPS/Loop related
  absolute?: number;
  rate?: number;
  temp?: string;
  
  // Meal related
  protein?: number;
  fat?: number;
  
  // Additional fields
  glucose?: number;
  glucoseType?: string;
  bg?: number;
}

export interface ParsedNightscoutData {
  meals: MealEvent[];
  insulin: InsulinEvent[];
  exercise: ExerciseEvent[];
  tempBasals: Array<{
    rate: number;
    duration: number;
    time: number;
    reason?: string;
  }>;
  smbs: Array<{
    units: number;
    time: number;
    reason?: string;
  }>;
  carbAnnouncements: Array<{
    carbs: number;
    time: number;
    notes?: string;
  }>;
}

class NightscoutTreatmentParser {
  
  /**
   * Parse Nightscout treatments data into structured events for predictions
   */
  parseTreatments(treatments: NightscoutTreatment[], hoursBack: number = 12): ParsedNightscoutData {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    const meals: MealEvent[] = [];
    const insulin: InsulinEvent[] = [];
    const exercise: ExerciseEvent[] = [];
    const tempBasals: Array<{ rate: number; duration: number; time: number; reason?: string }> = [];
    const smbs: Array<{ units: number; time: number; reason?: string }> = [];
    const carbAnnouncements: Array<{ carbs: number; time: number; notes?: string }> = [];
    
    treatments.forEach(treatment => {
      const timestamp = this.extractTimestamp(treatment);
      
      // Skip if too old
      if (timestamp < cutoffTime) return;
      
      try {
        // Parse different treatment types
        if (this.isMealBolus(treatment)) {
          this.parseMealBolus(treatment, timestamp, meals, insulin);
        } else if (this.isInsulinOnly(treatment)) {
          this.parseInsulinOnly(treatment, timestamp, insulin);
        } else if (this.isCarbsOnly(treatment)) {
          this.parseCarbsOnly(treatment, timestamp, meals, carbAnnouncements);
        } else if (this.isTempBasal(treatment)) {
          this.parseTempBasal(treatment, timestamp, tempBasals);
        } else if (this.isSMB(treatment)) {
          this.parseSMB(treatment, timestamp, smbs);
        } else if (this.isExercise(treatment)) {
          this.parseExercise(treatment, timestamp, exercise);
        }
      } catch (error) {
        console.warn('Error parsing treatment:', treatment, error);
      }
    });
    
    // Sort all arrays by time (most recent first)
    meals.sort((a, b) => b.time - a.time);
    insulin.sort((a, b) => b.time - a.time);
    exercise.sort((a, b) => b.time - a.time);
    tempBasals.sort((a, b) => b.time - a.time);
    smbs.sort((a, b) => b.time - a.time);
    carbAnnouncements.sort((a, b) => b.time - a.time);
    
    return {
      meals,
      insulin,
      exercise,
      tempBasals,
      smbs,
      carbAnnouncements
    };
  }
  
  /**
   * Generate prediction context from parsed Nightscout data
   */
  generatePredictionContext(parsedData: ParsedNightscoutData): Partial<PredictionContext> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = [0, 6].includes(now.getDay());

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Merge carb announcements into meals if they don't have corresponding meal entries
    const enhancedMeals = [...parsedData.meals];
    
    parsedData.carbAnnouncements.forEach(carbAnnouncement => {
      // Check if there's already a meal within 15 minutes of this carb announcement
      const existingMeal = enhancedMeals.find(meal => 
        Math.abs(meal.time - carbAnnouncement.time) < 15 * 60 * 1000
      );
      
      if (!existingMeal) {
        enhancedMeals.push({
          carbs: carbAnnouncement.carbs,
          time: carbAnnouncement.time
        });
      }
    });

    // Merge SMBs into insulin array
    const enhancedInsulin = [
      ...parsedData.insulin,
      ...parsedData.smbs.map(smb => ({
        units: smb.units,
        time: smb.time,
        type: 'bolus' as const
      }))
    ];

    return {
      recentMeals: enhancedMeals,
      recentInsulin: enhancedInsulin,
      recentExercise: parsedData.exercise,
      timeOfDay,
      dayOfWeek,
      isWeekend
    };
  }
  
  private extractTimestamp(treatment: NightscoutTreatment): number {
    // Try multiple timestamp formats from Nightscout
    if (treatment.date) {
      return treatment.date;
    }
    
    if (treatment.created_at) {
      return new Date(treatment.created_at).getTime();
    }
    
    if (treatment.timestamp) {
      return new Date(treatment.timestamp).getTime();
    }
    
    return Date.now();
  }
  
  private isMealBolus(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    return (
      eventType === 'meal bolus' ||
      eventType === 'combo bolus' ||
      (treatment.carbs && treatment.carbs > 0 && (treatment.insulin || treatment.units))
    );
  }
  
  private isInsulinOnly(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    return (
      eventType === 'correction bolus' ||
      eventType === 'bolus' ||
      eventType === 'correction' ||
      ((treatment.insulin || treatment.units) && (!treatment.carbs || treatment.carbs === 0))
    );
  }
  
  private isCarbsOnly(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    return (
      eventType === 'carbs correction' ||
      eventType === 'carb correction' ||
      eventType === 'carbs' ||
      eventType === 'meal' ||
      (Boolean(treatment.carbs) && (treatment.carbs || 0) > 0 && !treatment.insulin && !treatment.units)
    );
  }
  
  private isTempBasal(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    return (
      eventType === 'temp basal' ||
      eventType === 'temporary basal' ||
      eventType === 'temp basal start' ||
      eventType === 'temp basal end' ||
      treatment.temp === 'absolute' ||
      (treatment.absolute !== undefined && treatment.duration !== undefined)
    );
  }
  
  private isSMB(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    const notes = treatment.notes?.toLowerCase() || '';
    const reason = treatment.reason?.toLowerCase() || '';
    
    return (
      eventType === 'smb' ||
      eventType === 'micro bolus' ||
      eventType === 'super micro bolus' ||
      notes.includes('smb') ||
      reason.includes('smb') ||
      notes.includes('micro bolus') ||
      reason.includes('micro bolus')
    );
  }
  
  private isExercise(treatment: NightscoutTreatment): boolean {
    const eventType = treatment.eventType?.toLowerCase() || '';
    const notes = treatment.notes?.toLowerCase() || '';
    
    return (
      eventType === 'exercise' ||
      eventType === 'physical activity' ||
      eventType === 'activity' ||
      notes.includes('exercise') ||
      notes.includes('workout') ||
      notes.includes('gym') ||
      notes.includes('run') ||
      notes.includes('walk') ||
      notes.includes('bike') ||
      notes.includes('sport')
    );
  }
  
  private parseMealBolus(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    meals: MealEvent[], 
    insulin: InsulinEvent[]
  ): void {
    if (treatment.carbs && treatment.carbs > 0) {
      meals.push({
        carbs: treatment.carbs,
        time: timestamp,
        insulinBolus: treatment.insulin || treatment.units
      });
    }
    
    if (treatment.insulin || treatment.units) {
      insulin.push({
        units: treatment.insulin || treatment.units || 0,
        time: timestamp,
        type: 'bolus'
      });
    }
  }
  
  private parseInsulinOnly(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    insulin: InsulinEvent[]
  ): void {
    const units = treatment.insulin || treatment.units;
    if (units && units > 0) {
      insulin.push({
        units,
        time: timestamp,
        type: 'bolus'
      });
    }
  }
  
  private parseCarbsOnly(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    meals: MealEvent[], 
    carbAnnouncements: Array<{ carbs: number; time: number; notes?: string }>
  ): void {
    if (treatment.carbs && treatment.carbs > 0) {
      const eventType = treatment.eventType?.toLowerCase() || '';
      
      // If it's a carb correction or announcement, add to carbAnnouncements
      if (eventType.includes('correction') || treatment.notes?.toLowerCase().includes('announcement')) {
        carbAnnouncements.push({
          carbs: treatment.carbs,
          time: timestamp,
          notes: treatment.notes
        });
      } else {
        // Regular meal without insulin
        meals.push({
          carbs: treatment.carbs,
          time: timestamp
        });
      }
    }
  }
  
  private parseTempBasal(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    tempBasals: Array<{ rate: number; duration: number; time: number; reason?: string }>
  ): void {
    const rate = treatment.absolute || treatment.rate;
    const duration = treatment.duration;
    
    if (rate !== undefined && duration !== undefined) {
      tempBasals.push({
        rate,
        duration,
        time: timestamp,
        reason: treatment.reason || treatment.notes
      });
    }
  }
  
  private parseSMB(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    smbs: Array<{ units: number; time: number; reason?: string }>
  ): void {
    const units = treatment.insulin || treatment.units;
    if (units && units > 0) {
      smbs.push({
        units,
        time: timestamp,
        reason: treatment.reason || treatment.notes
      });
    }
  }
  
  private parseExercise(
    treatment: NightscoutTreatment, 
    timestamp: number, 
    exercise: ExerciseEvent[]
  ): void {
    const notes = treatment.notes?.toLowerCase() || '';
    const duration = treatment.duration || this.extractDurationFromNotes(notes);
    
    // Try to determine intensity from notes
    let intensity: 'low' | 'moderate' | 'high' = 'moderate';
    
    if (notes.includes('light') || notes.includes('easy') || notes.includes('walk')) {
      intensity = 'low';
    } else if (notes.includes('intense') || notes.includes('hard') || notes.includes('vigorous') || 
               notes.includes('high') || notes.includes('sprint')) {
      intensity = 'high';
    }
    
    exercise.push({
      intensity,
      duration: duration || 30, // Default to 30 minutes if not specified
      time: timestamp
    });
  }
  
  private extractDurationFromNotes(notes: string): number | undefined {
    // Try to extract duration from notes like "30 min", "1 hour", "45 minutes"
    const durationMatch = notes.match(/(\d+)\s*(min|minute|minutes|h|hour|hours)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      
      if (unit.startsWith('h')) {
        return value * 60; // Convert hours to minutes
      } else {
        return value; // Already in minutes
      }
    }
    
    return undefined;
  }
  
  /**
   * Get a summary of parsed data for display
   */
  getSummary(parsedData: ParsedNightscoutData): string {
    const summary = [];
    
    if (parsedData.meals.length > 0) {
      summary.push(`${parsedData.meals.length} meals`);
    }
    
    if (parsedData.insulin.length > 0) {
      summary.push(`${parsedData.insulin.length} insulin doses`);
    }
    
    if (parsedData.smbs.length > 0) {
      summary.push(`${parsedData.smbs.length} SMBs`);
    }
    
    if (parsedData.tempBasals.length > 0) {
      summary.push(`${parsedData.tempBasals.length} temp basals`);
    }
    
    if (parsedData.exercise.length > 0) {
      summary.push(`${parsedData.exercise.length} exercise sessions`);
    }
    
    if (parsedData.carbAnnouncements.length > 0) {
      summary.push(`${parsedData.carbAnnouncements.length} carb announcements`);
    }
    
    return summary.length > 0 ? summary.join(', ') : 'No events found';
  }
}

export const nightscoutTreatmentParser = new NightscoutTreatmentParser();
