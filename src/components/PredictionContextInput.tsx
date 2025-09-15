import React, { useState } from 'react';
import { Plus, Utensils, Syringe, Activity, Brain } from 'lucide-react';
import { usePredictionContext } from '../contexts/PredictionContext';

interface PredictionContextInputProps {
  onContextUpdate?: () => void;
}

const PredictionContextInput: React.FC<PredictionContextInputProps> = ({ onContextUpdate }) => {
  const {
    addMeal,
    addInsulin,
    addExercise,
    setStressLevel,
    setSleepQuality,
    recentMeals,
    recentInsulin,
    recentExercise,
    stressLevel,
    sleepQuality
  } = usePredictionContext();

  const [showInputs, setShowInputs] = useState(false);
  const [activeInput, setActiveInput] = useState<'meal' | 'insulin' | 'exercise' | null>(null);

  // Meal input state
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealInsulin, setMealInsulin] = useState('');

  // Insulin input state
  const [insulinUnits, setInsulinUnits] = useState('');
  const [insulinType, setInsulinType] = useState<'bolus' | 'basal'>('bolus');
  const [insulinTime, setInsulinTime] = useState('');

  // Exercise input state
  const [exerciseIntensity, setExerciseIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [exerciseDuration, setExerciseDuration] = useState('');
  const [exerciseTime, setExerciseTime] = useState('');

  const handleAddMeal = () => {
    if (!mealCarbs || !mealTime) return;
    
    const timeMs = new Date(`${new Date().toDateString()} ${mealTime}`).getTime();
    addMeal({
      carbs: Number(mealCarbs),
      time: timeMs,
      insulinBolus: mealInsulin ? Number(mealInsulin) : undefined
    });

    // Clear inputs
    setMealCarbs('');
    setMealTime('');
    setMealInsulin('');
    setActiveInput(null);
    onContextUpdate?.();
  };

  const handleAddInsulin = () => {
    if (!insulinUnits || !insulinTime) return;
    
    const timeMs = new Date(`${new Date().toDateString()} ${insulinTime}`).getTime();
    addInsulin({
      units: Number(insulinUnits),
      type: insulinType,
      time: timeMs
    });

    // Clear inputs
    setInsulinUnits('');
    setInsulinTime('');
    setActiveInput(null);
    onContextUpdate?.();
  };

  const handleAddExercise = () => {
    if (!exerciseDuration || !exerciseTime) return;
    
    const timeMs = new Date(`${new Date().toDateString()} ${exerciseTime}`).getTime();
    addExercise({
      intensity: exerciseIntensity,
      duration: Number(exerciseDuration),
      time: timeMs
    });

    // Clear inputs
    setExerciseDuration('');
    setExerciseTime('');
    setActiveInput(null);
    onContextUpdate?.();
  };

  const formatRecentTime = (timestamp: number) => {
    const now = Date.now();
    const diffMinutes = Math.round((now - timestamp) / 60000);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <Brain className="w-5 h-5 mr-2" />
          Prediction Context
        </h3>
        <button
          onClick={() => setShowInputs(!showInputs)}
          className="flex items-center px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Data
        </button>
      </div>

      {/* Recent Events Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Utensils className="w-6 h-6 mx-auto mb-1 text-orange-500" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Meals</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{recentMeals.length} in last 6h</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Syringe className="w-6 h-6 mx-auto mb-1 text-blue-500" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Insulin Doses</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{recentInsulin.length} in last 6h</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Activity className="w-6 h-6 mx-auto mb-1 text-green-500" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Exercise</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{recentExercise.length} in last 12h</div>
        </div>
      </div>

      {/* Current Context */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Stress Level
          </label>
          <select
            value={stressLevel}
            onChange={(e) => {
              setStressLevel(e.target.value as 'low' | 'moderate' | 'high');
              onContextUpdate?.();
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sleep Quality
          </label>
          <select
            value={sleepQuality}
            onChange={(e) => {
              setSleepQuality(e.target.value as 'poor' | 'fair' | 'good');
              onContextUpdate?.();
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="good">Good</option>
          </select>
        </div>
      </div>

      {/* Input Forms */}
      {showInputs && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveInput(activeInput === 'meal' ? null : 'meal')}
              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                activeInput === 'meal'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Utensils className="w-4 h-4 mr-1" />
              Add Meal
            </button>
            <button
              onClick={() => setActiveInput(activeInput === 'insulin' ? null : 'insulin')}
              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                activeInput === 'insulin'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Syringe className="w-4 h-4 mr-1" />
              Add Insulin
            </button>
            <button
              onClick={() => setActiveInput(activeInput === 'exercise' ? null : 'exercise')}
              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                activeInput === 'exercise'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Activity className="w-4 h-4 mr-1" />
              Add Exercise
            </button>
          </div>

          {/* Meal Input */}
          {activeInput === 'meal' && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-3">Add Meal</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="45"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={mealTime}
                    onChange={(e) => setMealTime(e.target.value)}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Bolus (u) - Optional
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={mealInsulin}
                    onChange={(e) => setMealInsulin(e.target.value)}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="6.5"
                  />
                </div>
              </div>
              <button
                onClick={handleAddMeal}
                className="mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm transition-colors"
              >
                Add Meal
              </button>
            </div>
          )}

          {/* Insulin Input */}
          {activeInput === 'insulin' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Add Insulin</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Units
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={insulinUnits}
                    onChange={(e) => setInsulinUnits(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="8.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Type
                  </label>
                  <select
                    value={insulinType}
                    onChange={(e) => setInsulinType(e.target.value as 'bolus' | 'basal')}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="bolus">Bolus</option>
                    <option value="basal">Basal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={insulinTime}
                    onChange={(e) => setInsulinTime(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleAddInsulin}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
              >
                Add Insulin
              </button>
            </div>
          )}

          {/* Exercise Input */}
          {activeInput === 'exercise' && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">Add Exercise</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    Intensity
                  </label>
                  <select
                    value={exerciseIntensity}
                    onChange={(e) => setExerciseIntensity(e.target.value as 'low' | 'moderate' | 'high')}
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={exerciseDuration}
                    onChange={(e) => setExerciseDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={exerciseTime}
                    onChange={(e) => setExerciseTime(e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleAddExercise}
                className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
              >
                Add Exercise
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Events List */}
      {(recentMeals.length > 0 || recentInsulin.length > 0 || recentExercise.length > 0) && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Recent Events</h4>
          <div className="space-y-1 text-xs">
            {recentMeals.map((meal, index) => (
              <div key={`meal-${index}`} className="flex items-center text-orange-600 dark:text-orange-400">
                <Utensils className="w-3 h-3 mr-1" />
                {meal.carbs}g carbs {formatRecentTime(meal.time)}
                {meal.insulinBolus && ` (${meal.insulinBolus}u bolus)`}
              </div>
            ))}
            {recentInsulin.map((insulin, index) => (
              <div key={`insulin-${index}`} className="flex items-center text-blue-600 dark:text-blue-400">
                <Syringe className="w-3 h-3 mr-1" />
                {insulin.units}u {insulin.type} {formatRecentTime(insulin.time)}
              </div>
            ))}
            {recentExercise.map((exercise, index) => (
              <div key={`exercise-${index}`} className="flex items-center text-green-600 dark:text-green-400">
                <Activity className="w-3 h-3 mr-1" />
                {exercise.intensity} intensity for {exercise.duration}min {formatRecentTime(exercise.time)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionContextInput;
