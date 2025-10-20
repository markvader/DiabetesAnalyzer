import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
  pulse?: boolean;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  animated = false,
  pulse = false,
}) => {
  const baseClasses = cn(
    'inline-flex items-center font-medium rounded-full',
    'transition-all duration-200',
    pulse && 'animate-pulse'
  );

  const variants = {
    default: 'bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-200',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200',
    danger: 'bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-200',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    outline: 'border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const badgeClasses = cn(
    baseClasses,
    variants[variant],
    sizes[size],
    className
  );

  if (animated) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={badgeClasses}
      >
        {children}
      </motion.span>
    );
  }

  return (
    <span className={badgeClasses}>
      {children}
    </span>
  );
};

export default Badge;
