import React, { useCallback, useEffect, useState } from 'react';
import {
  ExerciseEvent,
  InsulinEvent,
  MealEvent
} from '../services/advancedPredictionService';
import { PredictionContextContext, type PredictionContextState } from './PredictionContext';

interface PredictionContextProviderProps {
  children: React.ReactNode;
}

export const PredictionContextProvider: React.FC<PredictionContextProviderProps> = ({ children }) => {
  const [recentMeals, setRecentMeals] = useState<MealEvent[]>([]);
  const [recentInsulin, setRecentInsulin] = useState<InsulinEvent[]>([]);
  const [recentExercise, setRecentExercise] = useState<ExerciseEvent[]>([]);
  const [stressLevel, setStressLevelState] = useState<'low' | 'moderate' | 'high'>('low');
  const [sleepQuality, setSleepQualityState] = useState<'poor' | 'fair' | 'good'>('good');
  const [carbAbsorptionTauMin, setCarbAbsorptionTauMin] = useState<number | undefined>(() => {
    try {
      const raw = localStorage.getItem('mealAbsorptionTauMin');
      const v = raw ? Number(raw) : undefined;
      return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const onUpdate = () => {
      try {
        const raw = localStorage.getItem('mealAbsorptionTauMin');
        const v = raw ? Number(raw) : undefined;
        setCarbAbsorptionTauMin(typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      } catch {
        // ignore
      }
    };

    window.addEventListener('mealAbsorptionProfileUpdated', onUpdate);
    return () => window.removeEventListener('mealAbsorptionProfileUpdated', onUpdate);
  }, []);

  const getTimeContext = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = [0, 6].includes(now.getDay());

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return { timeOfDay, dayOfWeek, isWeekend };
  }, []);

  const addMeal = useCallback((meal: MealEvent) => {
    setRecentMeals((prev) => {
      const newMeals = [...prev, meal];
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      return newMeals.filter((m) => m.time > cutoff);
    });
  }, []);

  const addInsulin = useCallback((insulin: InsulinEvent) => {
    setRecentInsulin((prev) => {
      const newInsulin = [...prev, insulin];
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      return newInsulin.filter((i) => i.time > cutoff);
    });
  }, []);

  const addExercise = useCallback((exercise: ExerciseEvent) => {
    setRecentExercise((prev) => {
      const newExercise = [...prev, exercise];
      const cutoff = Date.now() - 12 * 60 * 60 * 1000;
      return newExercise.filter((e) => e.time > cutoff);
    });
  }, []);

  const setStressLevel = useCallback((level: 'low' | 'moderate' | 'high') => {
    setStressLevelState(level);
  }, []);

  const setSleepQuality = useCallback((quality: 'poor' | 'fair' | 'good') => {
    setSleepQualityState(quality);
  }, []);

  const clearOldEvents = useCallback(() => {
    const now = Date.now();
    const mealCutoff = now - 6 * 60 * 60 * 1000;
    const insulinCutoff = now - 6 * 60 * 60 * 1000;
    const exerciseCutoff = now - 12 * 60 * 60 * 1000;

    setRecentMeals((prev) => prev.filter((m) => m.time > mealCutoff));
    setRecentInsulin((prev) => prev.filter((i) => i.time > insulinCutoff));
    setRecentExercise((prev) => prev.filter((e) => e.time > exerciseCutoff));
  }, []);

  const updateContext = useCallback(() => {
    clearOldEvents();
  }, [clearOldEvents]);

  const contextValue: PredictionContextState = {
    ...getTimeContext(),
    recentMeals,
    recentInsulin,
    recentExercise,
    stressLevel,
    sleepQuality,
    carbAbsorptionTauMin,
    addMeal,
    addInsulin,
    addExercise,
    setStressLevel,
    setSleepQuality,
    clearOldEvents,
    updateContext
  };

  return <PredictionContextContext.Provider value={contextValue}>{children}</PredictionContextContext.Provider>;
};
