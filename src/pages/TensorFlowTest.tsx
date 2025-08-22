import React, { useState } from 'react';
import { useTensorFlow } from '../contexts/TensorFlowContext';
import { aiService } from '../services/aiService';

// Mock data generator
const generateMockGlucoseData = () => {
  const data = [];
  const now = Date.now();
  
  for (let i = 0; i < 288; i++) { // 24 hours of 5-minute readings
    const timestamp = now - (i * 5 * 60 * 1000);
    data.unshift({
      date: timestamp,
      sgv: 90 + Math.random() * 60 + Math.sin(i / 48) * 20, // 90-150 with circadian pattern
      device: 'xDrip-DexcomG6',
      type: 'sgv',
      direction: 'Flat'
    });
  }
  
  return data;
};

const generateMockTreatments = () => {
  const treatments = [];
  const now = Date.now();
  
  // Add some meal entries
  for (let i = 0; i < 3; i++) {
    treatments.push({
      created_at: new Date(now - (i * 6 * 60 * 60 * 1000)).toISOString(),
      eventType: 'Meal',
      carbs: 30 + Math.random() * 40,
      notes: 'Test meal'
    });
  }
  
  // Add some exercise entries
  treatments.push({
    created_at: new Date(now - (2 * 60 * 60 * 1000)).toISOString(),
    eventType: 'Exercise',
    notes: 'Running 30 minutes'
  });
  
  return treatments;
};

const TensorFlowTest = () => {
  const { isReady, isEnabled, error, toggleEnabled } = useTensorFlow();
  const [testResults, setTestResults] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);

  const mockReadings = generateMockGlucoseData();
  const mockTreatments = generateMockTreatments();
  const mockProfile = {
    isf: 2.5,
    sens: [
      { time: '00:00', value: 2.5 },
      { time: '06:00', value: 2.0 },
      { time: '12:00', value: 2.5 }
    ]
  };

  const runAllTests = async () => {
    if (!isReady) return;
    
    setIsRunning(true);
    const results: any = {};

    try {
      console.log('🧪 Running comprehensive TensorFlow analysis tests...');

      // Test 1: Exercise Impact Analysis
      console.log('🏃 Testing Exercise Impact Analysis...');
      const exerciseResult = await aiService.analyzeExerciseImpact(mockReadings, mockTreatments);
      results.exercise = exerciseResult;
      
      // Test 2: Sleep Pattern Analysis
      console.log('🌙 Testing Sleep Pattern Analysis...');
      const sleepResult = await aiService.analyzeSleepPatterns(mockReadings);
      results.sleep = sleepResult;
      
      // Test 3: Stress Impact Analysis
      console.log('😰 Testing Stress Impact Analysis...');
      const stressResult = await aiService.analyzeStressImpact(mockReadings);
      results.stress = stressResult;
      
      // Test 4: ISF Optimization
      console.log('🎯 Testing ISF Optimization...');
      const isfResult = await aiService.optimizeInsulinSensitivity(mockReadings, mockTreatments, mockProfile);
      results.isf = isfResult;
      
      // Test 5: General Glucose Analysis (for comparison)
      console.log('📊 Testing General Glucose Analysis...');
      const generalResult = await aiService.analyzeGlucosePatterns(mockReadings, mockTreatments);
      results.general = generalResult;

      console.log('✅ All TensorFlow analysis tests completed!');
      
    } catch (error) {
      console.error('❌ Test error:', error);
      results.error = error;
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const handleToggleEnabled = () => {
    toggleEnabled(!isEnabled);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            🤖 TensorFlow Integration Test Suite
          </h1>
          <p className="text-gray-600">
            Comprehensive testing of TensorFlow.js integration across all analysis methods
          </p>
        </div>

        {/* TensorFlow Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">TensorFlow Status</h2>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`font-medium ${isReady ? 'text-green-600' : 'text-red-600'}`}>
                {isReady ? 'Ready' : 'Not Ready'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{isReady ? '✅' : '❌'}</div>
              <div className="text-sm text-gray-600">TensorFlow Ready</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{isEnabled ? '🟢' : '🔴'}</div>
              <div className="text-sm text-gray-600">Enabled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{error ? '⚠️' : '✨'}</div>
              <div className="text-sm text-gray-600">{error ? 'Error' : 'No Error'}</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm font-medium">Error: {error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleToggleEnabled}
              disabled={!isReady}
              className={`px-4 py-2 rounded-lg font-medium ${
                isEnabled 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isEnabled ? 'Disable' : 'Enable'} TensorFlow
            </button>
            
            <button
              onClick={runAllTests}
              disabled={!isReady || !isEnabled || isRunning}
              className={`px-6 py-2 rounded-lg font-medium ${
                isReady && isEnabled && !isRunning
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isRunning ? '🔄 Testing...' : '🧪 Run All Tests'}
            </button>
          </div>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exercise Analysis Results */}
            {testResults.exercise && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  🏃 Exercise Impact Analysis
                  <span className="ml-2 text-sm bg-green-100 text-green-600 px-2 py-1 rounded">
                    {testResults.exercise.insights?.length > 0 ? 'Success' : 'No Data'}
                  </span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Insights:</strong> {testResults.exercise.insights?.length || 0}
                  </div>
                  <div>
                    <strong>Recommendations:</strong> {testResults.exercise.recommendations?.length || 0}
                  </div>
                  <div>
                    <strong>Exercise Types:</strong> {testResults.exercise.exerciseTypes?.length || 0}
                  </div>
                  <div>
                    <strong>Variability:</strong> {testResults.exercise.variability || 'N/A'}
                  </div>
                </div>
              </div>
            )}

            {/* Sleep Analysis Results */}
            {testResults.sleep && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  🌙 Sleep Pattern Analysis
                  <span className="ml-2 text-sm bg-green-100 text-green-600 px-2 py-1 rounded">
                    {testResults.sleep.insights?.length > 0 ? 'Success' : 'No Data'}
                  </span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Insights:</strong> {testResults.sleep.insights?.length || 0}
                  </div>
                  <div>
                    <strong>Recommendations:</strong> {testResults.sleep.recommendations?.length || 0}
                  </div>
                  <div>
                    <strong>Sleep Quality:</strong> {testResults.sleep.sleepQualityScore || 'N/A'}
                  </div>
                  <div>
                    <strong>Dawn Phenomenon:</strong> {testResults.sleep.dawnPhenomenon || 'N/A'}
                  </div>
                  <div>
                    <strong>Disruptions:</strong> {testResults.sleep.sleepDisruptions || 'N/A'}
                  </div>
                </div>
              </div>
            )}

            {/* Stress Analysis Results */}
            {testResults.stress && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  😰 Stress Impact Analysis
                  <span className="ml-2 text-sm bg-green-100 text-green-600 px-2 py-1 rounded">
                    {testResults.stress.insights?.length > 0 ? 'Success' : 'No Data'}
                  </span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Insights:</strong> {testResults.stress.insights?.length || 0}
                  </div>
                  <div>
                    <strong>Recommendations:</strong> {testResults.stress.recommendations?.length || 0}
                  </div>
                  <div>
                    <strong>Stress Level:</strong> {testResults.stress.stressLevel || 'N/A'}
                  </div>
                  <div>
                    <strong>Correlations:</strong> {testResults.stress.correlations?.length || 0}
                  </div>
                  <div>
                    <strong>Management Tips:</strong> {testResults.stress.managementTips?.length || 0}
                  </div>
                </div>
              </div>
            )}

            {/* ISF Optimization Results */}
            {testResults.isf && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  🎯 ISF Optimization
                  <span className="ml-2 text-sm bg-green-100 text-green-600 px-2 py-1 rounded">
                    {testResults.isf.insights?.length > 0 ? 'Success' : 'No Data'}
                  </span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Insights:</strong> {testResults.isf.insights?.length || 0}
                  </div>
                  <div>
                    <strong>Recommendations:</strong> {testResults.isf.recommendations?.length || 0}
                  </div>
                  <div>
                    <strong>Current ISF:</strong> {testResults.isf.currentISF || 'N/A'}
                  </div>
                  <div>
                    <strong>Suggested ISF:</strong> {testResults.isf.suggestedISF || 'N/A'}
                  </div>
                  <div>
                    <strong>Confidence:</strong> {testResults.isf.confidenceLevel || 'N/A'}%
                  </div>
                  <div>
                    <strong>Time Factors:</strong> {testResults.isf.timeBasedFactors?.length || 0}
                  </div>
                </div>
              </div>
            )}

            {/* General Analysis Results */}
            {testResults.general && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  📊 General Glucose Analysis (Reference)
                  <span className="ml-2 text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded">
                    {testResults.general.insights?.length > 0 ? 'Success' : 'No Data'}
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Insights:</strong> {testResults.general.insights?.length || 0}
                      </div>
                      <div>
                        <strong>Recommendations:</strong> {testResults.general.recommendations?.length || 0}
                      </div>
                      <div>
                        <strong>Patterns:</strong> {testResults.general.patterns?.length || 0}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="space-y-1">
                      {testResults.general.insights?.slice(0, 3).map((insight: string, index: number) => (
                        <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {insight}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {testResults.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mt-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Test Error</h3>
            <p className="text-red-600 text-sm">
              {testResults.error.toString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TensorFlowTest;
