import React from 'react';
import MonitoringDashboard from '../components/MonitoringDashboard';

const MonitoringPage = () => {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          System Monitoring & Analytics
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive analysis of system performance, user engagement, and weather patterns
        </p>
      </div>

      <MonitoringDashboard />
    </div>
  );
};

export default MonitoringPage;