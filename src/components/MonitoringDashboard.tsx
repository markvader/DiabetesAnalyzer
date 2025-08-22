import React, { useState, useEffect } from 'react';
import { monitoringService } from '../services/monitoringService';
import { Activity, AlertTriangle, Clock, TrendingUp, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const MonitoringDashboard: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(7);

  const generateReport = async () => {
    setLoading(true);
    try {
      const newReport = monitoringService.generateComprehensiveReport(selectedPeriod);
      setReport(newReport);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [selectedPeriod]);

  const exportReport = () => {
    if (!report) return;
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monitoring-report-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mr-3"></div>
        <p>Generating comprehensive analysis...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No monitoring data available</p>
        <button
          onClick={generateReport}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Generate Report
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            System Monitoring & Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive analysis for {report.period.start} to {report.period.end}
          </p>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm"
          >
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportReport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Interactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.summary.totalInteractions}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.summary.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.summary.averageResponseTime.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unresponsive Events</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.summary.unresponsiveCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Findings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Detailed Findings
        </h3>
        <div className="space-y-4">
          {report.detailedFindings.map((finding: any, index: number) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                finding.severity === 'critical'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : finding.severity === 'high'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {finding.category}
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">
                    {finding.description}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Impact: {finding.impact}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    finding.severity === 'critical'
                      ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      : finding.severity === 'high'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                  }`}
                >
                  {finding.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Recommended Solutions
        </h3>
        <div className="space-y-4">
          {report.recommendations.map((rec: any, index: number) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {rec.category}: {rec.issue}
                </h4>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    rec.priority === 'high'
                      ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                  }`}
                >
                  {rec.priority} priority
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-2">{rec.solution}</p>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Implementation:</strong> {rec.implementation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reproduction Steps */}
      {report.reproductionSteps.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Issue Reproduction Steps
          </h3>
          <div className="space-y-6">
            {report.reproductionSteps.map((issue: any, index: number) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {issue.issue}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Steps to Reproduce:
                    </h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {issue.steps.map((step: string, stepIndex: number) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="mb-3">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expected Behavior:
                      </h5>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {issue.expectedBehavior}
                      </p>
                    </div>
                    <div className="mb-3">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Actual Behavior:
                      </h5>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {issue.actualBehavior}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency:
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {issue.frequency}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather Correlations */}
      {report.weatherCorrelations && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Weather Pattern Analysis
          </h3>
          <div className="space-y-4">
            {report.weatherCorrelations.weatherEvents.map((event: any, index: number) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {event.timestamp}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.conditions}, {event.temperature}°C, {event.humidity}% humidity
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Concurrent Issues: {event.concurrentIssues}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {report.performanceMetrics && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.performanceMetrics.totalOperations}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Operations</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.performanceMetrics.averageDuration.toFixed(0)}ms
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Average Duration</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {report.performanceMetrics.successRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;