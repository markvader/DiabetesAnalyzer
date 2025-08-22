import { format, addDays, subDays, parseISO } from 'date-fns';

// Format date to display format (Croatian format)
export const formatDate = (date: Date): string => {
  return format(date, 'dd.MM.yyyy');
};

// Format date and time (Croatian 24-hour format) - Legacy function, use TimeFormatContext for new code
export const formatDateTime = (date: Date): string => {
  return format(date, 'dd.MM.yyyy HH:mm');
};

// Format time only in 24-hour format (HH:MM)
export const formatTime24 = (date: Date): string => {
  return format(date, 'HH:mm');
};

// Format time only in 12-hour format (h:MM AM/PM)
export const formatTime12 = (date: Date): string => {
  return format(date, 'h:mm a');
};

// Format date and time in 12-hour format
export const formatDateTime12 = (date: Date): string => {
  return format(date, 'dd.MM.yyyy h:mm a');
};

// Get date range for X days ago until now
export const getDateRangeForDays = (days: number): { start: Date; end: Date } => {
  const end = new Date();
  const start = subDays(end, days);
  return { start, end };
};

// Parse ISO date string to Date object
export const parseISODate = (dateString: string): Date => {
  return parseISO(dateString);
};

// Get formatted date range string (Croatian format)
export const getDateRangeString = (days: number): string => {
  const { start, end } = getDateRangeForDays(days);
  return `${formatDate(start)} - ${formatDate(end)}`;
};