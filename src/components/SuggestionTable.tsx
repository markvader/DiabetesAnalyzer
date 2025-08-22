import React from 'react';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { calculatePercentChange } from '../utils/mathUtils';
import { AlertTriangle } from 'lucide-react';

interface TimeSegment {
  time: string;
  rate: number;
}

interface SuggestionTableProps {
  title: string;
  currentValues: TimeSegment[];
  suggestedValues: TimeSegment[];
  unit: string;
}

const SuggestionTable: React.FC<SuggestionTableProps> = ({
  title,
  currentValues,
  suggestedValues,
  unit
}) => {
  const { formatTimeString } = useTimeFormat();
  // Ensure we have values to display
  if (!currentValues?.length || !suggestedValues?.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors duration-200">
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  // Format time for display using user's preferred format
  const formatTime = (timeStr: string) => {
    return formatTimeString(timeStr);
  };

  // Get change status class
  const getChangeClass = (percentChange: number) => {
    if (percentChange > 5) return 'text-red-600 dark:text-red-400';
    if (percentChange < -5) return 'text-blue-600 dark:text-blue-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Get change arrow
  const getChangeArrow = (percentChange: number) => {
    if (percentChange > 0) return '↑';
    if (percentChange < 0) return '↓';
    return '—';
  };

  // Calculate if any changes are significant (>5%)
  const hasSignificantChanges = suggestedValues.some(segment => {
    const currentValue = currentValues.find(c => c.time === segment.time)?.rate || 0;
    const percentChange = calculatePercentChange(currentValue, segment.rate);
    return Math.abs(percentChange) > 5;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 overflow-x-auto transition-colors duration-200">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
      
      {/* Safety Warning for Significant Changes */}
      {hasSignificantChanges && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-500">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Safety Warning: Significant Changes Detected</h4>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Some suggested changes are greater than 5%. For safety, consider implementing smaller incremental changes (1-2%) 
                and monitor closely before making further adjustments.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Current Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Suggested Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Change
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Safety Assessment
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {suggestedValues.map((segment, index) => {
            const currentValue = currentValues.find(c => c.time === segment.time)?.rate || 0;
            const percentChange = calculatePercentChange(currentValue, segment.rate);
            const changeClass = getChangeClass(percentChange);
            const changeArrow = getChangeArrow(percentChange);
            const isSafeChange = Math.abs(percentChange) <= 5;
            
            return (
              <tr key={segment.time} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatTime(segment.time)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {currentValue} {unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {segment.rate} {unit}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${changeClass}`}>
                  {changeArrow} {Math.abs(percentChange).toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    isSafeChange 
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                  }`}>
                    {isSafeChange ? 'Safe' : 'Use Caution'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Implementation Guidance */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Safe Implementation Guidance:</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Start with the smallest possible changes (1-2%) even if larger changes are suggested</li>
          <li>• Implement changes one at a time, waiting 2-3 days between each change</li>
          <li>• Monitor closely for any signs of hypoglycemia</li>
          <li>• Document all changes and their effects</li>
          <li>• Consult with your healthcare provider before implementing</li>
        </ul>
      </div>
    </div>
  );
};

export default SuggestionTable;