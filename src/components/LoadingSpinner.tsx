import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading data..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 border border-blue-400 dark:border-blue-300 opacity-20"></div>
      </div>
      <div className="text-center">
        <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">{message}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Processing large datasets may take a moment...
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;