import React, { useState, type ReactNode } from 'react';
import { SubscriptionContext } from './SubscriptionContext';

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [isSubscribed] = useState(true);

  return <SubscriptionContext.Provider value={{ isSubscribed }}>{children}</SubscriptionContext.Provider>;
};
