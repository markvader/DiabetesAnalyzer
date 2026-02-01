import { createContext, useContext } from 'react';
import type {
  ExerciseEvent,
  InsulinEvent,
  MealEvent,
  PredictionContext
} from '../services/advancedPredictionService';

export interface PredictionContextState extends PredictionContext {
  addMeal: (meal: MealEvent) => void;
  addInsulin: (insulin: InsulinEvent) => void;
  addExercise: (exercise: ExerciseEvent) => void;
  setStressLevel: (level: 'low' | 'moderate' | 'high') => void;
  setSleepQuality: (quality: 'poor' | 'fair' | 'good') => void;
  clearOldEvents: () => void;
  updateContext: () => void;
}

export const PredictionContextContext = createContext<PredictionContextState | undefined>(undefined);

export const usePredictionContext = () => {
  const context = useContext(PredictionContextContext);
  if (!context) {
    throw new Error('usePredictionContext must be used within a PredictionContextProvider');
  }
  return context;
};

export default PredictionContextContext;
