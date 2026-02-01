import React, { useEffect, useState, type ReactNode } from 'react';
import { TimeFormatContext, type TimeFormatContextType } from './TimeFormatContext';

type TimeFormat = '12h' | '24h';

interface TimeFormatProviderProps {
  children: ReactNode;
}

export const TimeFormatProvider: React.FC<TimeFormatProviderProps> = ({ children }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('24h');

  useEffect(() => {
    const savedFormat = localStorage.getItem('timeFormat') as TimeFormat;
    if (savedFormat === '12h' || savedFormat === '24h') {
      setTimeFormatState(savedFormat);
    }
  }, []);

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    localStorage.setItem('timeFormat', format);
  };

  const formatTime = (date: Date): string => {
    if (timeFormat === '12h') {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateTime = (date: Date): string => {
    const dateStr = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    return `${dateStr} ${formatTime(date)}`;
  };

  const formatTimeString = (timeStr: string): string => {
    if (!timeStr) return '';

    const [hours, minutes] = timeStr.split(':');
    if (!hours || !minutes) return timeStr;

    const hour = parseInt(hours, 10);

    if (timeFormat === '12h') {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    }

    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  };

  const value: TimeFormatContextType = {
    timeFormat,
    setTimeFormat,
    formatTime,
    formatDateTime,
    formatTimeString
  };

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
};
