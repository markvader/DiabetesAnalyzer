import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'gradient' | 'glass' | 'success' | 'warning' | 'danger';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  animated = true,
  hover = true,
}) => {
  const baseClasses = 'rounded-2xl transition-all duration-300';

  const variants = {
    default: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-lg',
    elevated: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-xl shadow-black/10',
    gradient: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow border-0',
    glass: 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-white/20 dark:border-white/10',
    success: 'bg-gradient-to-br from-success-500 to-success-600 text-white shadow-glow-success border-0',
    warning: 'bg-gradient-to-br from-warning-500 to-warning-600 text-white shadow-glow-warning border-0',
    danger: 'bg-gradient-to-br from-danger-500 to-danger-600 text-white shadow-glow-danger border-0',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverClasses = hover ? 'hover:shadow-2xl hover:scale-[1.01]' : '';

  const cardClasses = cn(
    baseClasses,
    variants[variant],
    paddings[padding],
    hoverClasses,
    className
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cardClasses}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cardClasses}>
      {children}
    </div>
  );
};

export default Card;
