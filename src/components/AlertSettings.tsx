import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toMgdl, toMmol, formatGlucose } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface AlertSettings {
  highThreshold: number;
  lowThreshold: number;
  enabled: boolean;
}

interface AlertSettingsProps {
  initialSettings?: AlertSettings;
  onSave: (settings: AlertSettings) => void;
}

const AlertSettings: React.FC<AlertSettingsProps> = ({ 
  initialSettings,
  onSave 
}) => {
  const { getUnitLabel, formatGlucoseValue, convertToCurrentUnit, unit } = useGlucoseFormatting();
  
  // Set default values based on current unit
  const getDefaultSettings = (): AlertSettings => {
    if (initialSettings) return initialSettings;
    return {
      highThreshold: 180, // Always store as mg/dL internally
      lowThreshold: 70,   // Always store as mg/dL internally
      enabled: true
    };
  };
  
  const [settings, setSettings] = useState<AlertSettings>(getDefaultSettings());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Alert Settings</h3>
        <button
          onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
          className={`p-2 rounded-full transition-colors duration-200 ${
            settings.enabled 
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {settings.enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            High Glucose Alert ({getUnitLabel()})
          </label>
          <input
            type="number"
            step={unit === 'mmol' ? "0.1" : "1"}
            value={unit === 'mmol' ? toMmol(settings.highThreshold).toFixed(1) : settings.highThreshold.toString()}
            onChange={(e) => {
              const inputValue = parseFloat(e.target.value);
              const mgdlValue = unit === 'mmol' ? toMgdl(inputValue) : inputValue;
              setSettings(s => ({ 
                ...s, 
                highThreshold: Math.max(0, mgdlValue)
              }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Low Glucose Alert ({getUnitLabel()})
          </label>
          <input
            type="number"
            step={unit === 'mmol' ? "0.1" : "1"}
            value={unit === 'mmol' ? toMmol(settings.lowThreshold).toFixed(1) : settings.lowThreshold.toString()}
            onChange={(e) => {
              const inputValue = parseFloat(e.target.value);
              const mgdlValue = unit === 'mmol' ? toMgdl(inputValue) : inputValue;
              setSettings(s => ({ 
                ...s, 
                lowThreshold: Math.max(0, mgdlValue)
              }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
          />
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-white dark:focus:ring-offset-gray-800 transition-colors duration-200"
        >
          Save Alert Settings
        </button>
      </form>
    </div>
  );
};

export default AlertSettings;