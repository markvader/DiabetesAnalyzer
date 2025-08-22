import React, { useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import AIManagementPlan from '../components/AIManagementPlan';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, Brain, RefreshCw } from 'lucide-react';

const ManagementPlan = () => {
  const { data, loading, error } = useNightscout();
  const [manualRefresh, setManualRefresh] = useState(false);

  const handleRefreshAI = () => {
    setManualRefresh(prev => !prev);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Management Plan</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Personalized diabetes management plan based on your unique data
          </p>
        </div>
        
        <button 
          onClick={handleRefreshAI}
          className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200 mt-4 sm:mt-0"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh AI Plan
        </button>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-md overflow-hidden">
        <div className="p-6 text-white">
          <div className="flex items-center mb-4">
            <FileText className="h-7 w-7 mr-3" />
            <h3 className="text-xl font-bold">Personalized Management Plan</h3>
          </div>
          <p className="mb-4">
            Our AI analyzes your glucose patterns, meal responses, and treatment data to create a 
            personalized diabetes management plan tailored to your unique needs. This plan includes 
            specific recommendations, realistic goals, and monitoring suggestions to help you optimize 
            your diabetes management.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Data-Driven</h4>
              <p className="text-sm">
                Based on your actual glucose patterns and treatment history
              </p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Actionable</h4>
              <p className="text-sm">
                Specific, practical recommendations you can implement
              </p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Downloadable</h4>
              <p className="text-sm">
                Save your plan as a document to share with your healthcare team
              </p>
            </div>
          </div>
        </div>
      </div>

      {data?.entries?.length > 0 && data?.treatments?.length > 0 ? (
        <AIManagementPlan 
          readings={data.entries}
          treatments={data.treatments}
          manualRefresh={manualRefresh}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Insufficient Data</h3>
          <p className="text-gray-600 dark:text-gray-400">
            To generate a personalized management plan, we need both glucose readings and treatment data.
            Please ensure your Nightscout site has this information available.
          </p>
        </div>
      )}

      {/* How to Use */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">How to Use Your Management Plan</h3>
        
        <div className="space-y-4">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4">
              1
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Review with Your Healthcare Team</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Share your management plan with your healthcare provider to discuss the recommendations and ensure they're appropriate for you
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4">
              2
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Implement Gradually</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Make changes one at a time and monitor their effects before implementing additional recommendations
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4">
              3
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Track Your Progress</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Use the monitoring suggestions to track your progress toward your goals
              </p>
            </div>
          </div>
          
          <div className="flex">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4">
              4
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Generate Updated Plans</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Return to this page periodically to generate updated management plans based on your latest data
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> This AI-generated plan is for informational purposes only and does not replace 
            medical advice. Always consult with your healthcare provider before making changes to your diabetes management.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManagementPlan;