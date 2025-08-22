import React, { useState, useEffect } from 'react';
import { Cookie, Clock, Lightbulb, AlertTriangle, Loader } from 'lucide-react';
import { aiService } from '../services/aiService';

interface AIMealAnalysisProps {
  readings: any[];
  treatments: any[];
  manualRefresh?: boolean;
}

const AIMealAnalysis: React.FC<AIMealAnalysisProps> = ({ readings, treatments, manualRefresh = false }) => {
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [mealTiming, setMealTiming] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string>('');
  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);

  useEffect(() => {
    // Create a hash of the current data to compare
    const dataHash = `${readings.length}-${treatments.length}`;
    
    // Only analyze meals if:
    // 1. We haven't loaded anything yet, OR
    // 2. Manual refresh was requested, OR
    // 3. The data has changed AND we don't have any insights yet
    const shouldAnalyze = 
      !initialLoadDone || 
      manualRefresh || 
      (dataHash !== lastAnalyzedData && insights.length === 0);
    
    if (shouldAnalyze && readings?.length > 0 && treatments?.length > 0) {
      analyzeMeals(dataHash);
    }
  }, [readings, treatments, manualRefresh]);

  const analyzeMeals = async (dataHash: string) => {
    if (!readings || readings.length === 0 || !treatments || treatments.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiService.analyzeMealPatterns(readings, treatments);
      
      if (result) {
        setInsights(result.insights);
        setRecommendations(result.recommendations);
        setMealTiming(result.mealTiming);
        setLastAnalyzedData(dataHash);
        setInitialLoadDone(true);
      } else {
        setError('Unable to generate meal pattern analysis at this time.');
      }
    } catch (err) {
      console.error('Error analyzing meal patterns:', err);
      setError('An error occurred while analyzing your meal patterns.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8 text-orange-600 dark:text-orange-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your meal patterns...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Our AI is processing your carb and glucose data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Please try again later or check your API configuration.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0 && recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center mb-4">
        <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {insights.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Lightbulb className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
              <h4 className="font-medium text-orange-900 dark:text-orange-100">Meal Insights</h4>
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-orange-800 dark:text-orange-200 text-sm">• {insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {recommendations.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Cookie className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              <h4 className="font-medium text-green-900 dark:text-green-100">Meal Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-800 dark:text-green-200 text-sm">• {recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {mealTiming.length > 0 && (
        <div>
          <div className="flex items-center mb-3">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Optimal Meal Timing</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mealTiming.map((timing, index) => (
              <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">{timing.timeOfDay}</h5>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {timing.startHour}:00 - {timing.endHour}:00
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {timing.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This analysis is generated by AI based on your meal and glucose data. Always consult with your healthcare provider before making changes to your meal timing or insulin dosing.
        </p>
      </div>
    </div>
  );
};

export default AIMealAnalysis;