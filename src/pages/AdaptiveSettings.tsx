import React from 'react';
import ClassicSettings from './Settings';

const AdaptiveSettings: React.FC = () => {
  // Always use classic settings since Modern design is removed
  return <ClassicSettings />;
};

export default AdaptiveSettings;
