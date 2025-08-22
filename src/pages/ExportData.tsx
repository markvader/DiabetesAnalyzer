import React from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import DataExport from '../components/DataExport';
import PDFExport from '../components/PDFExport';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, Download, Share } from 'lucide-react';

const ExportData = () => {
  const { data, loading, error } = useNightscout();

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Export Data</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Export your diabetes data in various formats for analysis, sharing, or backup
        </p>
      </div>

      {data ? (
        <div className="space-y-6">
          {/* PDF Export Section */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10 p-1 rounded-lg">
            <PDFExport data={data} />
          </div>

          {/* CSV Export Section */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10 p-1 rounded-lg">
            <DataExport data={data} />
          </div>
          
          {/* Export Information */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
            <div className="flex items-center mb-4">
              <Share className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">About Data Export</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center mb-3">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">PDF Reports</h4>
                </div>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Professional medical reports with comprehensive analysis</li>
                  <li>• Perfect for sharing with healthcare providers</li>
                  <li>• Includes time in range analysis and recommendations</li>
                  <li>• Customizable time periods (days, weeks, months)</li>
                  <li>• Beautiful formatting with charts and insights</li>
                </ul>
              </div>
              
              <div>
                <div className="flex items-center mb-3">
                  <Download className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">CSV Data Files</h4>
                </div>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Raw data export for detailed analysis</li>
                  <li>• Compatible with Excel, Google Sheets, and other tools</li>
                  <li>• Separate files for glucose readings and treatments</li>
                  <li>• Complete data backup for your records</li>
                  <li>• Ideal for researchers and data analysts</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Pro Tips:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Use PDF reports for medical appointments and consultations</li>
                <li>• Export CSV data for detailed trend analysis in spreadsheet software</li>
                <li>• Regular exports serve as excellent data backups</li>
                <li>• Different time periods help identify patterns and changes over time</li>
                <li>• Share reports with your diabetes care team for better management</li>
              </ul>
            </div>
          </div>

          {/* Data Summary */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Available Data Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Glucose Readings</h4>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {data.entries?.length?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {data.entries?.length > 0 && (
                    <>
                      From {new Date(Math.min(...data.entries.map(e => e.date))).toLocaleDateString()} to{' '}
                      {new Date(Math.max(...data.entries.map(e => e.date))).toLocaleDateString()}
                    </>
                  )}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Treatments</h4>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {data.treatments?.length?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Insulin, carbs, and other treatments
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Profiles</h4>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {data.profile?.length || 0}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Basal, ISF, and carb ratio settings
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-8">
          <p className="text-gray-600 dark:text-gray-400">No data available for export. Please fetch data first.</p>
        </div>
      )}
    </div>
  );
};

export default ExportData;