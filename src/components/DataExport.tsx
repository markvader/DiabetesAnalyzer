import React from 'react';
import { Download } from 'lucide-react';

interface ExportData {
  entries: any[];
  treatments: any[];
}

interface DataExportProps {
  data: ExportData;
}

const DataExport: React.FC<DataExportProps> = ({ data }) => {
  const exportToCSV = (type: 'entries' | 'treatments') => {
    const items = data[type];
    if (!items?.length) return;

    const headers = Object.keys(items[0]).join(',');
    const rows = items.map(item => 
      Object.values(item).map(value => 
        typeof value === 'string' ? `"${value}"` : value
      ).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diabetes-data-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Export Data</h3>
      <div className="space-y-4">
        <button
          onClick={() => exportToCSV('entries')}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Glucose Readings
        </button>
        <button
          onClick={() => exportToCSV('treatments')}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors duration-200"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Treatments
        </button>
      </div>
    </div>
  );
};

export default DataExport;