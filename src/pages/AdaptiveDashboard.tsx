import React from 'react';
import ClassicDashboard from './Dashboard'; // The existing dashboard

const AdaptiveDashboard: React.FC = () => {
  // Always use classic dashboard since Modern design is removed
  return <ClassicDashboard />;
};

export default AdaptiveDashboard;
