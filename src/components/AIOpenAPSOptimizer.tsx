import React, { useState } from 'react';
import { Brain, Zap, Shield, TrendingUp, AlertTriangle, CheckCircle, Settings, Target } from 'lucide-react';
import { aiOpenAPSOptimizer } from '../services/aiOpenAPSOptimizer';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';

type OptimizationResult = Awaited<ReturnType<typeof aiOpenAPSOptimizer.optimizeOpenAPSSettings>>;

interface AIOptimizerProps {
  readings: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  analysisDays: number;
  onOptimizationComplete?: (results: OptimizationResult) => void;
}

const AIOpenAPSOptimizer: React.FC<AIOptimizerProps> = ({ readings, treatments, analysisDays, onOptimizationComplete }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { formatGlucoseValue } = useGlucoseFormatting();

  const runOptimization = async () => {
    setIsOptimizing(true);
    setError(null);
    
    try {
      const result = await aiOpenAPSOptimizer.optimizeOpenAPSSettings(
        readings, 
        treatments, 
        analysisDays
      );
      setOptimization(result);
      // Call the callback if provided
      if (onOptimizationComplete) {
        onOptimizationComplete(result);
      }
    } catch (err) {
      setError('Failed to optimize OpenAPS settings. Please try again.');
      console.error('Optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAggressionColor = (aggression: 'conservative' | 'moderate' | 'aggressive') => {
    switch (aggression) {
      case 'conservative': return 'text-blue-600 bg-blue-100';
      case 'moderate': return 'text-purple-600 bg-purple-100';
      case 'aggressive': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-8 w-8 text-purple-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              AI OpenAPS SMB Optimizer
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Advanced algorithm to optimize your OpenAPS settings based on {analysisDays} days of data
            </p>
          </div>
        </div>
        
        <button
          onClick={runOptimization}
          disabled={isOptimizing || readings.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isOptimizing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Optimizing...</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              <span>Optimize Settings</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {optimization && (
        <div className="space-y-6">
          {/* Current Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Time in Range</span>
                <Target className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {optimization.currentPerformance.timeInRange}%
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Time Below {formatGlucoseValue(70, 'mgdl', true)}</span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {optimization.currentPerformance.timeBelow70}%
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Time Above {formatGlucoseValue(180, 'mgdl', true)}</span>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {optimization.currentPerformance.timeAbove180}%
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Risk Assessment
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(optimization.riskAssessment.overallRisk)}`}>
                  {optimization.riskAssessment.overallRisk.toUpperCase()} RISK
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Overall</p>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {optimization.riskAssessment.hypoglycemiaRisk}%
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">Hypo Risk</p>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {optimization.riskAssessment.hyperglycemiaRisk}%
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">Hyper Risk</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getAggressionColor(optimization.riskAssessment.settingsAggression)}`}>
                  {optimization.riskAssessment.settingsAggression.toUpperCase()}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Settings</p>
              </div>
            </div>
          </div>

          {/* Optimized Settings */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Optimized OpenAPS Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Max Temp Basal</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {optimization.optimizedSettings.maxTempBasal} U/hr
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Maximum IOB</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {optimization.optimizedSettings.maximumIOB} U
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Dynamic ISF Factor</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {optimization.optimizedSettings.dynamicISFFactor}%
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">SMB Max Minutes</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {optimization.optimizedSettings.smbMaxMinutes} min
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">SMB Delivery Ratio</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {(optimization.optimizedSettings.smbDeliveryRatio * 100).toFixed(0)}%
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-600 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Carbs Req Threshold</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {optimization.optimizedSettings.carbsReqThreshold} g
                </div>
              </div>
            </div>
            
            {/* SMB Toggles */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-600 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SMB with COB</span>
                <div className={`w-8 h-4 rounded-full flex items-center ${optimization.optimizedSettings.enableSMBWithCOB ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${optimization.optimizedSettings.enableSMBWithCOB ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-600 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SMB Always</span>
                <div className={`w-8 h-4 rounded-full flex items-center ${optimization.optimizedSettings.enableSMBAlways ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${optimization.optimizedSettings.enableSMBAlways ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              AI Recommendations
            </h3>
            
            {optimization.recommendations.warnings.length > 0 && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">⚠️ Important Warnings</h4>
                <ul className="space-y-1">
                  {optimization.recommendations.warnings.map((warning: string, index: number) => (
                    <li key={index} className="text-sm text-red-600 dark:text-red-400">• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Immediate Actions</h4>
                <ul className="space-y-1">
                  {optimization.recommendations.immediate.map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                      <CheckCircle className="h-3 w-3 text-green-500 mr-2 mt-1 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Short-term (1-2 weeks)</h4>
                <ul className="space-y-1">
                  {optimization.recommendations.shortTerm.map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                      <CheckCircle className="h-3 w-3 text-blue-500 mr-2 mt-1 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Long-term (1+ months)</h4>
                <ul className="space-y-1">
                  {optimization.recommendations.longTerm.map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                      <CheckCircle className="h-3 w-3 text-purple-500 mr-2 mt-1 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Expected Outcomes */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Expected Outcomes
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {optimization.expectedOutcomes.projectedTimeInRange}%
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Projected TIR</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {optimization.expectedOutcomes.projectedTimeBelow70}%
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Time Below {formatGlucoseValue(70, 'mgdl', true)}</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {optimization.expectedOutcomes.projectedTimeAbove180}%
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Time Above {formatGlucoseValue(180, 'mgdl', true)}</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {optimization.expectedOutcomes.expectedImprovementDays}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Days to Improve</p>
              </div>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">AI Confidence Score</div>
            <div className="text-3xl font-bold text-purple-600">
              {optimization.riskAssessment.confidenceScore}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Based on {optimization.analysisPeriod.dataPoints} data points over {optimization.analysisPeriod.days} days
            </div>
          </div>
        </div>
      )}

      {!optimization && !isOptimizing && (
        <div className="text-center py-8">
          <Brain className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">
            Click "Optimize Settings" to analyze your data and get AI-powered OpenAPS recommendations
          </p>
        </div>
      )}
    </div>
  );
};

export default AIOpenAPSOptimizer;
