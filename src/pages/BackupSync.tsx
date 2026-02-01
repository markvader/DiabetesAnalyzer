import React, { useState } from 'react';
import { useNightscout } from '../contexts/NightscoutContext';
import { useTimeFormat } from '../contexts/TimeFormatContext';
import { Download, Upload, Cloud, HardDrive, CheckCircle, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { safeAsync } from '../utils/safeAsync';

const BackupSync = () => {
  const { data, loading, error } = useNightscout();
  const { formatDateTime } = useTimeFormat();
  const [backupStatus, setBackupStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const createBackup = async () => {
    if (!data) return;
    
    setBackupStatus('creating');
    
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          entries: data.entries,
          treatments: data.treatments,
          profile: data.profile
        },
        metadata: {
          totalEntries: data.entries?.length || 0,
          totalTreatments: data.treatments?.length || 0,
          dateRange: data.entries?.length > 0 ? {
            start: new Date(Math.min(...data.entries.map(e => e.date))).toISOString(),
            end: new Date(Math.max(...data.entries.map(e => e.date))).toISOString()
          } : null
        }
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diabetes-backup-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setBackupStatus('success');
      setTimeout(() => setBackupStatus('idle'), 3000);
    } catch (_err) {
      setBackupStatus('error');
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  const exportCSV = (type: 'entries' | 'treatments') => {
    if (!data) return;

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
    a.download = `diabetes-${type}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const simulateSync = async () => {
    setSyncStatus('syncing');
    
    // Simulate sync process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setSyncStatus('success');
    setTimeout(() => setSyncStatus('idle'), 3000);
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Backup & Sync</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Create backups and sync your diabetes data
        </p>
      </div>

      {/* Backup Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Data Backup</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Complete Backup</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Create a complete backup of all your diabetes data including glucose readings, 
              treatments, and profile settings in JSON format.
            </p>
            <button
              onClick={safeAsync(createBackup, { label: 'BackupSync: createBackup' })}
              disabled={!data || backupStatus === 'creating'}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {backupStatus === 'creating' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Creating Backup...
                </>
              ) : backupStatus === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Backup Created!
                </>
              ) : backupStatus === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Backup Failed
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Create Full Backup
                </>
              )}
            </button>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">CSV Export</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Export specific data types as CSV files for analysis in spreadsheet applications 
              or sharing with healthcare providers.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportCSV('entries')}
                disabled={!data?.entries?.length}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Glucose Data
              </button>
              <button
                onClick={() => exportCSV('treatments')}
                disabled={!data?.treatments?.length}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Treatments
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      {data && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Glucose Readings</h4>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {data.entries?.length?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {data.entries?.length > 0 && (
                  <>
                    From {format(new Date(Math.min(...data.entries.map(e => e.date))), 'dd.MM.yyyy')} to{' '}
                    {format(new Date(Math.max(...data.entries.map(e => e.date))), 'dd.MM.yyyy')}
                  </>
                )}
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Treatments</h4>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {data.treatments?.length?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Insulin, carbs, and other treatments
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
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
      )}

      {/* Sync Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <Cloud className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Cloud Sync</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Sync Status</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Last Sync</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {formatDateTime(new Date())}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Sync Status</span>
                <span className="text-green-600 dark:text-green-400">Up to date</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">Auto Sync</span>
                <span className="text-blue-600 dark:text-blue-400">Enabled</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Manual Sync</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Manually sync your data with cloud storage to ensure all devices have the latest information.
            </p>
            <button
              onClick={safeAsync(simulateSync, { label: 'BackupSync: simulateSync' })}
              disabled={syncStatus === 'syncing'}
              className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Syncing...
                </>
              ) : syncStatus === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sync Complete!
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backup Guidelines */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Backup Best Practices</h3>
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <ul className="list-disc list-inside space-y-2">
            <li>Create regular backups of your diabetes data, especially before making major changes</li>
            <li>Store backups in multiple locations (local device, cloud storage, external drive)</li>
            <li>Verify backup integrity by occasionally testing restore procedures</li>
            <li>Keep backups for extended periods as historical data can be valuable for trend analysis</li>
            <li>Consider automating backups to ensure consistency</li>
            <li>Share relevant data exports with your healthcare team during appointments</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BackupSync;