import React from 'react';
import { useDesignMode } from '../contexts/DesignModeContext';
import { Palette } from '@mui/icons-material';

// Classic version using Tailwind - Only version needed now
const DesignModeSelector: React.FC = () => {
  const { setDesignMode, isClassic, isPremium } = useDesignMode();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              UI Style
            </span>
          </div>
          <div className="flex space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isClassic
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
              onClick={() => setDesignMode('classic')}
            >
              Classic
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isPremium
                  ? 'bg-gradient-to-r from-pink-100 to-purple-100 text-purple-800 dark:from-pink-900 dark:to-purple-900 dark:text-purple-200 shadow-md'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-pink-900/20 dark:hover:to-purple-900/20'
              }`}
              onClick={() => setDesignMode('premium')}
            >
              ✨ Premium
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        {isPremium 
          ? 'Using premium design with advanced animations and gradient styling'
          : 'Using classic Tailwind CSS design with traditional styling'
        }
      </p>
    </div>
  );
};

export default DesignModeSelector;
