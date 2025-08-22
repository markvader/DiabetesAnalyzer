import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type TimeFormat = '12h' | '24h';

interface TimeFormatContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
  formatTimeString: (timeStr: string) => string;
}

const TimeFormatContext = createContext<TimeFormatContextType | undefined>(undefined);

export const useTimeFormat = (): TimeFormatContextType => {
  const context = useContext(TimeFormatContext);
  if (!context) {
    throw new Error('useTimeFormat must be used within a TimeFormatProvider');
  }
  return context;
};

interface TimeFormatProviderProps {
  children: ReactNode;
}

export const TimeFormatProvider: React.FC<TimeFormatProviderProps> = ({ children }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('24h');

  // Load time format preference from localStorage on mount
  useEffect(() => {
    const savedFormat = localStorage.getItem('timeFormat') as TimeFormat;
    if (savedFormat === '12h' || savedFormat === '24h') {
      setTimeFormatState(savedFormat);
    }
  }, []);

  // Save time format preference to localStorage
  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    localStorage.setItem('timeFormat', format);
  };

  // Format time only (HH:MM or h:MM AM/PM)
  const formatTime = (date: Date): string => {
    if (timeFormat === '12h') {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } else {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  };

  // Format full date and time (dd.MM.yyyy HH:MM or dd.MM.yyyy h:MM AM/PM)
  const formatDateTime = (date: Date): string => {
    const dateStr = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    return `${dateStr} ${formatTime(date)}`;
  };

  // Format time string from HH:MM format to preferred format
  const formatTimeString = (timeStr: string): string => {
    if (!timeStr) return '';
    
    const [hours, minutes] = timeStr.split(':');
    if (!hours || !minutes) return timeStr;
    
    const hour = parseInt(hours, 10);
    
    if (timeFormat === '12h') {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } else {
      return `${hour.toString().padStart(2, '0')}:${minutes}`;
    }
  };

  const value: TimeFormatContextType = {
    timeFormat,
    setTimeFormat,
    formatTime,
    formatDateTime,
    formatTimeString
  };

  return (
    <TimeFormatContext.Provider value={value}>
      {children}
    </TimeFormatContext.Provider>
  );
};
