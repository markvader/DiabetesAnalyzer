import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Glucose status utilities
export const getGlucoseStatusColor = (value: number, unit: 'mmol' | 'mgdl' = 'mgdl') => {
  const targetValue = unit === 'mmol' ? value : value / 18;
  
  if (targetValue < 3.9) return 'danger';
  if (targetValue < 4.4) return 'warning';
  if (targetValue <= 10.0) return 'success';
  if (targetValue <= 13.9) return 'warning';
  return 'danger';
};

export const getGlucoseStatusClasses = (status: 'danger' | 'warning' | 'success') => {
  switch (status) {
    case 'danger':
      return 'bg-gradient-to-r from-danger-500 to-danger-600 text-white shadow-glow-danger';
    case 'warning':
      return 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-glow-warning';
    case 'success':
      return 'bg-gradient-to-r from-success-500 to-success-600 text-white shadow-glow-success';
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
  }
};

// Card variants
export const cardVariants = {
  default: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-lg',
  elevated: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-xl shadow-black/10',
  gradient: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow',
  glass: 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-white/20 dark:border-white/10',
};

// Button variants
export const buttonVariants = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-glow transition-all duration-200',
  secondary: 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-900 dark:text-gray-100 transition-all duration-200',
  success: 'bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 text-white shadow-glow-success transition-all duration-200',
  danger: 'bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 text-white shadow-glow-danger transition-all duration-200',
  ghost: 'hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 transition-all duration-200',
};

// Animation utilities
export const animationClasses = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  scaleIn: 'animate-scale-in',
  pulse: 'animate-pulse-slow',
  bounce: 'animate-bounce-subtle',
};
