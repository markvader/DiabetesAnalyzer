import { createContext, useContext } from 'react';

type TimeFormat = '12h' | '24h';

export interface TimeFormatContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
  formatTimeString: (timeStr: string) => string;
}

export const TimeFormatContext = createContext<TimeFormatContextType | undefined>(undefined);

export const useTimeFormat = (): TimeFormatContextType => {
  const context = useContext(TimeFormatContext);
  if (!context) {
    throw new Error('useTimeFormat must be used within a TimeFormatProvider');
  }
  return context;
};

export default TimeFormatContext;
