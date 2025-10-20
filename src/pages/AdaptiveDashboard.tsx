import React from 'react';
// import { useDesignMode } from '../contexts/DesignModeContext';
import ClassicDashboard from './Dashboard'; // The existing dashboard
// import ModernDashboard from './ModernDashboard'; // The new Material UI dashboard - temporarily disabled

const AdaptiveDashboard: React.FC = () => {
  // const { isModern } = useDesignMode();

  // Temporarily use classic dashboard while we fix Material UI issues
  return <ClassicDashboard />;
  // return isModern ? <ModernDashboard /> : <ClassicDashboard />;
};

export default AdaptiveDashboard;
