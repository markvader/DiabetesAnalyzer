import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SubscriptionContextType {
  isSubscribed: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  // All users now have full access to all features
  const [isSubscribed, setIsSubscribed] = useState(true);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};