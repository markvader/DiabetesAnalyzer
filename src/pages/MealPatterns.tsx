import React, { useEffect, useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useNavigate } from 'react-router-dom';
import { Cookie, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { analyzeMealPatterns, identifyMealClusters } from '../services/patternDetectionService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import AIMealAnalysis from '../components/AIMealAnalysis';
import { useSubscription } from '../contexts/SubscriptionContext';

const MealPatterns = () => {
  const { data, loading, error } = useNightscout();
  const { isSubscribed } = useSubscription();
  const { formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const navigate = useNavigate();
  const [mealPatterns, setMealPatterns] = useState<any>(null);
  const [mealClusters, setMealClusters] = useState<any>(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  useEffect(() => {
    const processData = async () => {
      if (data?.entries && data?.treatments) {
        try {
          const [patternsData, clustersData] = await Promise.all([
            analyzeMealPatterns(data.entries, data.treatments),
            identifyMealClusters(data.treatments, data.entries)
          ]);
          
          setMealPatterns(patternsData);
          setMealClusters(clustersData);
        } catch (err) {
          console.error('Error processing meal patterns:', err);
          setMealPatterns(null);
          setMealClusters(null);
        }
      } else {
        setMealPatterns(null);
        setMealClusters(null);
      }
    };

    processData();
  }, [data]);

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meal Pattern Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis of glucose responses to meals and carbohydrate intake patterns
          </p>
        </div>
        
        {isSubscribed && data?.entries && data.entries.length > 0 && data?.treatments && data.treatments.length > 0 && (
          <button 
            onClick={handleRefreshAI}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200 mt-4 sm:mt-0"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh AI Analysis
          </button>
        )}
      </div>

      {/* AI-Powered Meal Analysis - Premium Feature */}
      {isSubscribed && data?.entries && data.entries.length > 0 && data?.treatments && data.treatments.length > 0 && (
        <AIMealAnalysis 
          readings={data?.entries || []}
          treatments={data?.treatments || []}
          manualRefresh={manualRefresh}
        />
      )}

      {/* Time-based Meal Patterns */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Time-based Patterns</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mealPatterns?.map((pattern, index) => (
            <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">{pattern.timeOfDay}</h4>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Average Carbs:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{pattern.avgCarbIntake}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Average Insulin:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{pattern.avgInsulinIntake || 0}U</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Glucose Response:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    +{formatGlucoseValue(pattern.avgGlucoseResponse, 'mgdl', true)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Total Meals:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{pattern.mealCount}</span>
                </div>
                {pattern.insulinSensitivity > 0 && (
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Insulin Sensitivity:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {formatGlucoseValue(pattern.insulinSensitivity, 'mgdl', false)} {getUnitLabel()}/U
                    </span>
                  </div>
                )}
                
                {/* Enhanced Carb Announcement Statistics */}
                {pattern.carbAnnouncementStats && pattern.carbAnnouncementStats.count > 0 && (
                  <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <h5 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Carb Announcement Insights:</h5>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">Announcements:</span>
                        <span className="text-blue-800 dark:text-blue-200">{pattern.carbAnnouncementStats.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">Avg Insulin After:</span>
                        <span className="text-blue-800 dark:text-blue-200">{pattern.carbAnnouncementStats.avgInsulinAfterAnnouncement}U</span>
                      </div>
                      {pattern.carbAnnouncementStats.enhancedTrackingCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Enhanced Tracking:</span>
                          <span className="text-blue-800 dark:text-blue-200">{pattern.carbAnnouncementStats.enhancedTrackingCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Meal Type Breakdown */}
                {pattern.mealTypes && (
                  <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <h5 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Meal Types:</h5>
                    <div className="space-y-1 text-xs">
                      {pattern.mealTypes.combinedMeals > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Combined (Carbs + Insulin):</span>
                          <span className="text-blue-800 dark:text-blue-200">{pattern.mealTypes.combinedMeals}</span>
                        </div>
                      )}
                      {pattern.mealTypes.carbAnnouncements > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Carb Announcements:</span>
                          <span className="text-blue-800 dark:text-blue-200">{pattern.mealTypes.carbAnnouncements}</span>
                        </div>
                      )}
                      {pattern.mealTypes.mealBolus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Meal Bolus:</span>
                          <span className="text-blue-800 dark:text-blue-200">{pattern.mealTypes.mealBolus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal Type Clusters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Meal Type Analysis</h3>
        </div>
        
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(cluster => {
            const clusterMeals = mealClusters?.filter((m: any) => m.cluster === cluster) || [];
            const avgCarbs = average(clusterMeals.map((m: any) => m.carbs));
            const avgInsulin = average(clusterMeals.map((m: any) => m.insulin));
            
            // Count meal types in this cluster
            const mealTypeCount = clusterMeals.reduce((acc: any, meal: any) => {
              acc[meal.type] = (acc[meal.type] || 0) + 1;
              return acc;
            }, {});
            
            return (
              <div key={cluster} className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-orange-900 dark:text-orange-100">
                  {cluster === 0 ? 'Small Meals' : cluster === 1 ? 'Medium Meals' : 'Large Meals'}
                </h4>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Average Carbs:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">{Math.round(avgCarbs)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Average Insulin:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">{Math.round(avgInsulin)}U</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Frequency:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">{clusterMeals.length} meals</span>
                  </div>
                  
                  {/* Show meal type breakdown for this cluster */}
                  {Object.keys(mealTypeCount).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-orange-200 dark:border-orange-700">
                      <h5 className="text-xs font-medium text-orange-800 dark:text-orange-200 mb-1">Entry Types:</h5>
                      <div className="space-y-1 text-xs">
                        {mealTypeCount.combined > 0 && (
                          <div className="flex justify-between">
                            <span className="text-orange-600 dark:text-orange-400">Combined:</span>
                            <span className="text-orange-800 dark:text-orange-200">{mealTypeCount.combined}</span>
                          </div>
                        )}
                        {mealTypeCount.carbAnnouncement > 0 && (
                          <div className="flex justify-between">
                            <span className="text-orange-600 dark:text-orange-400">Carb Announcements:</span>
                            <span className="text-orange-800 dark:text-orange-200">{mealTypeCount.carbAnnouncement}</span>
                          </div>
                        )}
                        {mealTypeCount.mealBolus > 0 && (
                          <div className="flex justify-between">
                            <span className="text-orange-600 dark:text-orange-400">Meal Boluses:</span>
                            <span className="text-orange-800 dark:text-orange-200">{mealTypeCount.mealBolus}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Meal Pattern Insights</h3>
        </div>
        
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Meal Entry Pattern Analysis</h4>
            <p className="text-green-800 dark:text-green-200">
              The system now tracks both Carb Announcements and Meal Bolus entries. This provides 
              a complete picture of your meal management approach, whether you enter carbs and insulin 
              separately or together.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Entry Method Insights</h4>
            <p className="text-green-800 dark:text-green-200">
              Your meal entry patterns show three distinct approaches: combined entries (carbs + insulin together), 
              separate carb announcements followed by boluses, and standalone meal boluses. Each method 
              can provide valuable insights for diabetes management.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Enhanced Insulin Tracking</h4>
            <p className="text-green-800 dark:text-green-200">
              The analysis now intelligently tracks insulin doses given up to 2 hours after carb announcements, 
              providing more accurate average insulin calculations. This gives better insights into your daughter's 
              actual insulin-to-carb ratios and dosing patterns.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Best Meal Times</h4>
            <p className="text-green-800 dark:text-green-200">
              Based on glucose responses, the optimal meal times appear to be during periods
              of higher insulin sensitivity, typically in the morning and early afternoon.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Recommendations</h4>
            <ul className="list-disc list-inside text-green-800 dark:text-green-200">
              <li>Consider timing larger meals during periods of better insulin sensitivity</li>
              <li>Track both carb announcements and insulin boluses for complete meal analysis</li>
              <li>Use consistent entry methods to improve pattern recognition accuracy</li>
              <li>Review the enhanced insulin tracking to optimize carb-to-insulin ratios</li>
              <li>Monitor the "Avg Insulin After" metric for carb announcements to improve dosing timing</li>
              <li>Use the meal type distribution to identify patterns in your diabetes management approach</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Premium Feature Teaser */}
      {!isSubscribed && data?.entries && data.entries.length > 0 && data?.treatments && data.treatments.length > 0 && (
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg shadow-md overflow-hidden">
          <div className="p-6 text-white">
            <div className="flex items-center mb-4">
              <Cookie className="h-7 w-7 mr-3" />
              <h3 className="text-xl font-bold">AI-Powered Meal Analysis Available</h3>
            </div>
            <p className="mb-4">
              Upgrade to Premium to access advanced AI analysis of your meal patterns, personalized recommendations for meal timing, and insights to improve post-meal glucose control.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => navigate('/subscription')}
                className="px-4 py-2 bg-white text-orange-700 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const average = (numbers: number[]): number => {
  return numbers.length === 0 ? 0 : numbers.reduce((a, b) => a + b, 0) / numbers.length;
};

export default MealPatterns;