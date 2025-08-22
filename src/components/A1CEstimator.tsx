import React from 'react';
import { roundToDecimal } from '../utils/mathUtils';
import { toMmol } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface A1CEstimatorProps {
  averageGlucose: number;
}

const A1CEstimator: React.FC<A1CEstimatorProps> = ({ averageGlucose }) => {
  const { formatGlucoseValue } = useGlucoseFormatting();
  
  // Convert averageGlucose (always in mg/dL from Nightscout) to mmol/L for A1C calculation
  const mmolAvg = toMmol(averageGlucose);
  // IFCC formula: (average glucose in mmol/L + 2.59) / 1.59
  const estimatedA1C = roundToDecimal((mmolAvg + 2.59) / 1.59, 1);
  
  const getA1CStatus = (a1c: number) => {
    if (a1c < 6.5) return { text: 'Target Range', color: 'text-green-600 dark:text-green-400' };
    if (a1c < 7.5) return { text: 'Elevated', color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: 'High', color: 'text-red-600 dark:text-red-400' };
  };
  
  const status = getA1CStatus(estimatedA1C);
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Estimated A1C</h3>
      <div className="flex items-baseline">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{estimatedA1C}%</span>
        <span className={`ml-2 ${status.color}`}>({status.text})</span>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Based on your average glucose of {formatGlucoseValue(averageGlucose, 'mgdl', true)}
      </p>
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Note: This is an estimate. Laboratory A1C tests are the most accurate measure.
      </div>
    </div>
  );
};

export default A1CEstimator;