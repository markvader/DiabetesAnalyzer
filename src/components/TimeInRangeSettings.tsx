import React, { useState, useEffect } from 'react';
import { useGlucoseUnits } from '../contexts/GlucoseUnitsContext';
import { useTimeInRange } from '../contexts/TimeInRangeContext';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const TimeInRangeSettings: React.FC = () => {
  const { unit, getUnitLabel } = useGlucoseUnits();
  const { 
    settings,
    getSettingsInUnit,
    setSettingsFromUnit
  } = useTimeInRange();

  // Local state for form inputs (in current unit)
  const [formValues, setFormValues] = useState(getSettingsInUnit(unit));
  const [errors, setErrors] = useState<string[]>([]);

  // Update form values when unit changes
  useEffect(() => {
    setFormValues(getSettingsInUnit(unit));
  }, [unit, settings, getSettingsInUnit]);

  const validateSettings = (values: typeof formValues): string[] => {
    const errors: string[] = [];
    
    if (values.lowThreshold >= values.targetMin) {
      errors.push('Low threshold must be less than target minimum');
    }
    
    if (values.targetMin >= values.targetMax) {
      errors.push('Target minimum must be less than target maximum');
    }
    
    if (values.targetMax >= values.highThreshold) {
      errors.push('Target maximum must be less than high threshold');
    }
    
    if (values.lowThreshold <= 0) {
      errors.push('Low threshold must be greater than 0');
    }
    
    if (values.highThreshold <= values.lowThreshold) {
      errors.push('High threshold must be greater than low threshold');
    }
    
    return errors;
  };

  const handleInputChange = (field: keyof typeof formValues, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    const newValues = {
      ...formValues,
      [field]: numValue
    };
    
    setFormValues(newValues);
    
    // Validate and update if valid
    const validationErrors = validateSettings(newValues);
    setErrors(validationErrors);
    
    // Only save if no errors
    if (validationErrors.length === 0) {
      setSettingsFromUnit(newValues, unit);
    }
  };

  const getInputClassName = (hasError: boolean) => {
    const baseClasses = "w-20 px-2 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200";
    
    if (hasError) {
      return `${baseClasses} border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400`;
    }
    
    return `${baseClasses} border-gray-300 dark:border-gray-600 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400`;
  };

  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Low Alert Threshold
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={formValues.lowThreshold.toFixed(1)}
              onChange={(e) => handleInputChange('lowThreshold', e.target.value)}
              step={unit === 'mmol' ? '0.1' : '1'}
              min="0"
              className={getInputClassName(hasErrors && formValues.lowThreshold >= formValues.targetMin)}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{getUnitLabel()}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Values below this trigger low glucose alerts
          </p>
        </div>

        {/* High Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            High Alert Threshold
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={formValues.highThreshold.toFixed(1)}
              onChange={(e) => handleInputChange('highThreshold', e.target.value)}
              step={unit === 'mmol' ? '0.1' : '1'}
              min="0"
              className={getInputClassName(hasErrors && formValues.targetMax >= formValues.highThreshold)}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{getUnitLabel()}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Values above this trigger high glucose alerts
          </p>
        </div>

        {/* Target Min */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Range Minimum
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={formValues.targetMin.toFixed(1)}
              onChange={(e) => handleInputChange('targetMin', e.target.value)}
              step={unit === 'mmol' ? '0.1' : '1'}
              min="0"
              className={getInputClassName(hasErrors && (formValues.lowThreshold >= formValues.targetMin || formValues.targetMin >= formValues.targetMax))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{getUnitLabel()}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Lower bound of your target glucose range
          </p>
        </div>

        {/* Target Max */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Range Maximum
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={formValues.targetMax.toFixed(1)}
              onChange={(e) => handleInputChange('targetMax', e.target.value)}
              step={unit === 'mmol' ? '0.1' : '1'}
              min="0"
              className={getInputClassName(hasErrors && (formValues.targetMin >= formValues.targetMax || formValues.targetMax >= formValues.highThreshold))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{getUnitLabel()}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Upper bound of your target glucose range
          </p>
        </div>
      </div>

      {/* Status and Errors */}
      <div className="mt-4">
        {hasErrors ? (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Invalid Settings</p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-1 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Settings Valid</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your Time in Range settings have been saved and are being used throughout the application.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Common Presets */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Presets</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => {
              const preset = unit === 'mmol' 
                ? { lowThreshold: 3.9, highThreshold: 10.0, targetMin: 3.9, targetMax: 10.0 }
                : { lowThreshold: 70, highThreshold: 180, targetMin: 70, targetMax: 180 };
              setFormValues(preset);
              setSettingsFromUnit(preset, unit);
              setErrors([]);
            }}
            className="px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
          >
            Standard (3.9-10.0 / 70-180)
          </button>
          <button
            onClick={() => {
              const preset = unit === 'mmol' 
                ? { lowThreshold: 3.9, highThreshold: 7.8, targetMin: 4.0, targetMax: 7.0 }
                : { lowThreshold: 70, highThreshold: 140, targetMin: 72, targetMax: 126 };
              setFormValues(preset);
              setSettingsFromUnit(preset, unit);
              setErrors([]);
            }}
            className="px-3 py-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors duration-200"
          >
            Tight Control (4.0-7.0 / 72-126)
          </button>
          <button
            onClick={() => {
              const preset = unit === 'mmol' 
                ? { lowThreshold: 3.5, highThreshold: 13.9, targetMin: 3.9, targetMax: 10.0 }
                : { lowThreshold: 63, highThreshold: 250, targetMin: 70, targetMax: 180 };
              setFormValues(preset);
              setSettingsFromUnit(preset, unit);
              setErrors([]);
            }}
            className="px-3 py-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors duration-200"
          >
            Relaxed (3.9-10.0 / 70-180)
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeInRangeSettings;
