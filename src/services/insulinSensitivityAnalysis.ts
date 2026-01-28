import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import type { NightscoutTreatment } from '../types/nightscout';
import { getTreatmentMs } from '../utils/nightscoutTime';

type GlucoseReadingForSensitivity = {
  date: number;
  sgv: number;
};

interface TimeSegment {
  start: number;
  end: number;
  sensitivity: number;
  confidence: number;
}

export const analyzeInsulinSensitivity = (
  readings: GlucoseReadingForSensitivity[],
  treatments: NightscoutTreatment[]
): TimeSegment[] => {
  const segments: TimeSegment[] = [];
  const hoursInDay = 24;
  const segmentLength = 3; // 3-hour segments
  
  for (let hour = 0; hour < hoursInDay; hour += segmentLength) {
    const segment = analyzeTimeSegment(readings, treatments, hour, hour + segmentLength);
    segments.push(segment);
  }
  
  return segments;
};

const analyzeTimeSegment = (
  readings: GlucoseReadingForSensitivity[], 
  treatments: NightscoutTreatment[], 
  startHour: number, 
  endHour: number
): TimeSegment => {
  const relevantTreatments = treatments.filter(t => {
    const hour = new Date(getTreatmentMs(t)).getHours();
    return hour >= startHour && hour < endHour && t.insulin && !t.carbs;
  });
  
  const sensitivities: number[] = [];
  
  relevantTreatments.forEach(treatment => {
    const sensitivity = calculateSensitivityForTreatment(readings, treatment);
    if (sensitivity) {
      sensitivities.push(sensitivity);
    }
  });
  
  const avgSensitivity = sensitivities.length > 0
    ? sensitivities.reduce((a, b) => a + b, 0) / sensitivities.length
    : 0;
    
  const variance = sensitivities.length > 0
    ? sensitivities.reduce((a, b) => a + Math.pow(b - avgSensitivity, 2), 0) / sensitivities.length
    : 0;
    
  const confidence = calculateConfidence(sensitivities.length, variance);
  
  return {
    start: startHour,
    end: endHour,
    sensitivity: roundToDecimal(toMmol(avgSensitivity), 1), // Convert to mmol/L
    confidence: roundToDecimal(confidence, 2)
  };
};

const calculateSensitivityForTreatment = (
  readings: GlucoseReadingForSensitivity[],
  treatment: NightscoutTreatment
): number | null => {
  const treatmentTime = getTreatmentMs(treatment);
  
  const beforeReadings = readings.filter(r => 
    r.date >= treatmentTime - 30 * 60 * 1000 && 
    r.date <= treatmentTime
  );
  
  const afterReadings = readings.filter(r =>
    r.date >= treatmentTime + 2 * 60 * 60 * 1000 &&
    r.date <= treatmentTime + 4 * 60 * 60 * 1000
  );
  
  if (beforeReadings.length === 0 || afterReadings.length === 0) return null;
  
  const beforeAvg = beforeReadings.reduce((a, b) => a + b.sgv, 0) / beforeReadings.length;
  const afterAvg = afterReadings.reduce((a, b) => a + b.sgv, 0) / afterReadings.length;
  
  return (beforeAvg - afterAvg) / (treatment.insulin ?? 0);
};

const calculateConfidence = (sampleSize: number, variance: number): number => {
  if (sampleSize === 0) return 0;
  
  // Confidence calculation based on sample size and variance
  const baseConfidence = Math.min(sampleSize / 10, 1); // Max confidence at 10+ samples
  const varianceImpact = Math.exp(-variance / 1000); // Reduce confidence with high variance
  
  return baseConfidence * varianceImpact;
};