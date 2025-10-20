import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  animated?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  animated = true,
  children,
  disabled,
  ...props
}, ref) => {
  const baseClasses = cn(
    'inline-flex items-center justify-center rounded-xl font-medium',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-800',
    'transition-all duration-200 transform active:scale-[0.98]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    fullWidth && 'w-full'
  );

  const variants = {
    primary: cn(
      'bg-gradient-to-r from-primary-500 to-primary-600',
      'hover:from-primary-600 hover:to-primary-700',
      'text-white shadow-lg hover:shadow-xl',
      'focus:ring-primary-500'
    ),
    secondary: cn(
      'bg-gray-100 dark:bg-dark-700',
      'hover:bg-gray-200 dark:hover:bg-dark-600',
      'text-gray-900 dark:text-gray-100',
      'border border-gray-300 dark:border-dark-600',
      'focus:ring-gray-500'
    ),
    success: cn(
      'bg-gradient-to-r from-success-500 to-success-600',
      'hover:from-success-600 hover:to-success-700',
      'text-white shadow-lg hover:shadow-xl',
      'focus:ring-success-500'
    ),
    danger: cn(
      'bg-gradient-to-r from-danger-500 to-danger-600',
      'hover:from-danger-600 hover:to-danger-700',
      'text-white shadow-lg hover:shadow-xl',
      'focus:ring-danger-500'
    ),
    warning: cn(
      'bg-gradient-to-r from-warning-500 to-warning-600',
      'hover:from-warning-600 hover:to-warning-700',
      'text-white shadow-lg hover:shadow-xl',
      'focus:ring-warning-500'
    ),
    ghost: cn(
      'hover:bg-gray-100 dark:hover:bg-dark-700',
      'text-gray-700 dark:text-gray-300',
      'focus:ring-gray-500'
    ),
    outline: cn(
      'border-2 border-primary-500 text-primary-500',
      'hover:bg-primary-500 hover:text-white',
      'focus:ring-primary-500'
    ),
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm h-9',
    md: 'px-4 py-2.5 text-sm h-10',
    lg: 'px-6 py-3 text-base h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const content = (
    <>
      {loading && (
        <Loader2 className={cn('animate-spin', iconSizes[size], children && 'mr-2')} />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className={cn(iconSizes[size], children && 'mr-2')}>
          {icon}
        </span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={cn(iconSizes[size], children && 'ml-2')}>
          {icon}
        </span>
      )}
    </>
  );

  const buttonClasses = cn(
    baseClasses,
    variants[variant],
    sizes[size],
    className
  );

  if (animated && !disabled && !loading) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <button
          ref={ref}
          className={buttonClasses}
          disabled={disabled || loading}
          {...props}
        >
          {content}
        </button>
      </motion.div>
    );
  }

  return (
    <button
      ref={ref}
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
