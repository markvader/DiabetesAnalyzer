import React from 'react';
import Layout from './Layout';

interface AdaptiveLayoutProps {
  children: React.ReactNode;
}

const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({ children }) => {
  // Always use classic Layout since Modern design is removed
  return <Layout>{children}</Layout>;
};

export default AdaptiveLayout;
