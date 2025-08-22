import React from 'react';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { Cpu, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

const TensorFlowStatus: React.FC = () => {
  const { 
    isReady, 
    isEnabled, 
    isInitializing, 
    error, 
    modelInfo,
    reinitialize 
  } = useTensorFlow();

  const getStatusIcon = () => {
    if (isInitializing) return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    if (!isEnabled) return <XCircle className="h-4 w-4 text-gray-500" />;
    if (error) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (isReady) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-orange-500" />;
  };

  const getStatusText = () => {
    if (!isEnabled) return 'Disabled';
    if (isInitializing) return 'Initializing...';
    if (error) return `Error: ${error}`;
    if (isReady) return 'Ready';
    return 'Not Ready';
  };

  const getStatusColor = () => {
    if (!isEnabled) return 'text-gray-500 dark:text-gray-400';
    if (isInitializing) return 'text-yellow-600 dark:text-yellow-400';
    if (error) return 'text-red-600 dark:text-red-400';
    if (isReady) return 'text-green-600 dark:text-green-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">TensorFlow AI Status</h3>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Enabled:</span>
          <span className={isEnabled ? 'text-green-600' : 'text-gray-500'}>
            {isEnabled ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Ready:</span>
          <span className={isReady ? 'text-green-600' : 'text-red-600'}>
            {isReady ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Initializing:</span>
          <span className={isInitializing ? 'text-yellow-600' : 'text-gray-500'}>
            {isInitializing ? 'Yes' : 'No'}
          </span>
        </div>
        {modelInfo && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Model:</span>
            <span className="text-blue-600 dark:text-blue-400">
              {modelInfo.name || 'Loaded'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isEnabled && !isReady && !isInitializing && (
        <button
          onClick={reinitialize}
          className="mt-3 w-full px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Retry Initialization
        </button>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          TensorFlow provides fast, private AI analysis directly in your browser.
        </p>
      </div>
    </div>
  );
};

export default TensorFlowStatus;
