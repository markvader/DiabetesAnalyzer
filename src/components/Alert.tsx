import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
  icon,
}) => {
  const variants = {
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      content: 'text-blue-700 dark:text-blue-300',
      defaultIcon: Info,
    },
    success: {
      container: 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800',
      icon: 'text-success-600 dark:text-success-400',
      title: 'text-success-800 dark:text-success-200',
      content: 'text-success-700 dark:text-success-300',
      defaultIcon: CheckCircle,
    },
    warning: {
      container: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800',
      icon: 'text-warning-600 dark:text-warning-400',
      title: 'text-warning-800 dark:text-warning-200',
      content: 'text-warning-700 dark:text-warning-300',
      defaultIcon: AlertTriangle,
    },
    danger: {
      container: 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800',
      icon: 'text-danger-600 dark:text-danger-400',
      title: 'text-danger-800 dark:text-danger-200',
      content: 'text-danger-700 dark:text-danger-300',
      defaultIcon: XCircle,
    },
  };

  const config = variants[variant];
  const IconComponent = icon || React.createElement(config.defaultIcon, { className: 'w-5 h-5' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border p-4',
        config.container,
        className
      )}
    >
      <div className="flex">
        <div className={cn('flex-shrink-0', config.icon)}>
          {IconComponent}
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={cn('text-sm font-medium mb-1', config.title)}>
              {title}
            </h3>
          )}
          
          <div className={cn('text-sm', config.content)}>
            {children}
          </div>
        </div>
        
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={cn(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                config.icon,
                'hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Alert;
