import React, { useState, useEffect } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { BarChart, AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, subDays } from 'date-fns';

interface DataQualityMetrics {
  totalReadings: number;
  missingReadings: number;
  duplicateReadings: number;
  outlierReadings: number;
  gapAnalysis: {
    gaps: number;
    longestGap: number;
    avgGapDuration: number;
  };
  completeness: number;
  reliability: number;
}

interface DataGap {
  start: Date;
  end: Date;
  duration: number;
}

const DataQuality = () => {
  const { data, loading, error } = useNightscout();
  const [qualityMetrics, setQualityMetrics] = useState<DataQualityMetrics | null>(null);
  const [dataGaps, setDataGaps] = useState<DataGap[]>([]);

  useEffect(() => {
    if (data?.entries) {
      analyzeDataQuality();
    }
  }, [data]);

  const analyzeDataQuality = () => {
    if (!data?.entries) return;

    const entries = [...data.entries].sort((a, b) => a.date - b.date);
    const totalReadings = entries.length;
    
    // Analyze data gaps
    const gaps: DataGap[] = [];
    const expectedInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    let missingCount = 0;
    
    for (let i = 1; i < entries.length; i++) {
      const timeDiff = entries[i].date - entries[i - 1].date;
      if (timeDiff > expectedInterval * 2) { // More than 10 minutes gap
        const gapDuration = timeDiff / (1000 * 60); // Convert to minutes
        gaps.push({
          start: new Date(entries[i - 1].date),
          end: new Date(entries[i].date),
          duration: gapDuration
        });
        missingCount += Math.floor(gapDuration / 5) - 1; // Estimate missing readings
      }
    }

    // Detect duplicates
    const duplicates = entries.filter((entry, index) => 
      index > 0 && Math.abs(entry.date - entries[index - 1].date) < 60000 // Within 1 minute
    );

    // Detect outliers (extreme values)
    const glucoseValues = entries.map(e => e.sgv);
    const outliers = entries.filter(entry => 
      entry.sgv < 40 || entry.sgv > 400 // Extreme values
    );

    // Calculate completeness
    const timeSpan = entries.length > 0 ? 
      (entries[entries.length - 1].date - entries[0].date) / (1000 * 60) : 0;
    const expectedReadings = Math.floor(timeSpan / 5);
    const completeness = expectedReadings > 0 ? (totalReadings / expectedReadings) * 100 : 100;

    // Calculate reliability score
    const reliabilityFactors = [
      Math.max(0, 100 - (gaps.length / totalReadings * 1000)), // Gap penalty
      Math.max(0, 100 - (duplicates.length / totalReadings * 1000)), // Duplicate penalty
      Math.max(0, 100 - (outliers.length / totalReadings * 1000)), // Outlier penalty
      Math.min(100, completeness) // Completeness bonus
    ];
    const reliability = reliabilityFactors.reduce((sum, factor) => sum + factor, 0) / reliabilityFactors.length;

    const metrics: DataQualityMetrics = {
      totalReadings,
      missingReadings: missingCount,
      duplicateReadings: duplicates.length,
      outlierReadings: outliers.length,
      gapAnalysis: {
        gaps: gaps.length,
        longestGap: gaps.length > 0 ? Math.max(...gaps.map(g => g.duration)) : 0,
        avgGapDuration: gaps.length > 0 ? 
          gaps.reduce((sum, g) => sum + g.duration, 0) / gaps.length : 0
      },
      completeness: Math.min(100, completeness),
      reliability
    };

    setQualityMetrics(metrics);
    setDataGaps(gaps.slice(0, 10)); // Show only recent gaps
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
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Quality Analysis</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor the quality and completeness of your glucose data
        </p>
      </div>

      {/* Quality Overview */}
      {qualityMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <BarChart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Readings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {qualityMetrics.totalReadings.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completeness</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {qualityMetrics.completeness.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Reliability</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {qualityMetrics.reliability.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Gaps</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {qualityMetrics.gapAnalysis.gaps}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Quality Metrics */}
      {qualityMetrics && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Detailed Quality Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Data Issues</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <span className="text-red-800 dark:text-red-200">Missing Readings</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {qualityMetrics.missingReadings}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <span className="text-yellow-800 dark:text-yellow-200">Duplicate Readings</span>
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">
                    {qualityMetrics.duplicateReadings}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                  <span className="text-orange-800 dark:text-orange-200">Outlier Readings</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {qualityMetrics.outlierReadings}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Gap Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <span className="text-blue-800 dark:text-blue-200">Total Gaps</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {qualityMetrics.gapAnalysis.gaps}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <span className="text-blue-800 dark:text-blue-200">Longest Gap</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {qualityMetrics.gapAnalysis.longestGap.toFixed(0)}min
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <span className="text-blue-800 dark:text-blue-200">Avg Gap Duration</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {qualityMetrics.gapAnalysis.avgGapDuration.toFixed(0)}min
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Quality Score</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <span className="text-green-800 dark:text-green-200">Overall Score</span>
                  <span className={`font-bold text-lg ${
                    qualityMetrics.reliability >= 90 ? 'text-green-600 dark:text-green-400' :
                    qualityMetrics.reliability >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {qualityMetrics.reliability.toFixed(0)}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      qualityMetrics.reliability >= 90 ? 'bg-green-500' :
                      qualityMetrics.reliability >= 75 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${qualityMetrics.reliability}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {qualityMetrics.reliability >= 90 ? 'Excellent data quality' :
                   qualityMetrics.reliability >= 75 ? 'Good data quality' :
                   qualityMetrics.reliability >= 50 ? 'Fair data quality' :
                   'Poor data quality - needs attention'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Data Gaps */}
      {dataGaps.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Data Gaps</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    End Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dataGaps.map((gap, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(gap.start, 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(gap.end, 'dd.MM. HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {gap.duration < 60 ? 
                        `${gap.duration.toFixed(0)} min` : 
                        `${(gap.duration / 60).toFixed(1)} hours`
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        gap.duration < 30 ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                        gap.duration < 120 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}>
                        {gap.duration < 30 ? 'Minor' :
                         gap.duration < 120 ? 'Moderate' : 'Major'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Quality Recommendations */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Data Quality Recommendations</h3>
        </div>
        
        <div className="space-y-4">
          {qualityMetrics && qualityMetrics.gapAnalysis.gaps > 5 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-400">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Frequent Data Gaps Detected</h4>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                You have {qualityMetrics.gapAnalysis.gaps} data gaps. Check your CGM sensor adhesion, 
                transmitter battery, and phone connectivity.
              </p>
            </div>
          )}
          
          {qualityMetrics && qualityMetrics.duplicateReadings > 10 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-400">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">Duplicate Readings Found</h4>
              <p className="text-orange-800 dark:text-orange-200 text-sm">
                {qualityMetrics.duplicateReadings} duplicate readings detected. This may indicate 
                synchronization issues with your data source.
              </p>
            </div>
          )}
          
          {qualityMetrics && qualityMetrics.outlierReadings > 5 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-400">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Outlier Readings Detected</h4>
              <p className="text-red-800 dark:text-red-200 text-sm">
                {qualityMetrics.outlierReadings} extreme readings found. Consider sensor calibration 
                or replacement if readings seem inaccurate.
              </p>
            </div>
          )}
          
          {qualityMetrics && qualityMetrics.reliability >= 90 && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-400">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Excellent Data Quality</h4>
              <p className="text-green-800 dark:text-green-200 text-sm">
                Your data quality is excellent! Continue with your current CGM maintenance routine.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataQuality;