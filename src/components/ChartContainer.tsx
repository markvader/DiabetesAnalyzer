import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Maximize2, Download } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { cn } from '../utils/cn';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'gradient' | 'glass';
  className?: string;
  actions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  }>;
  loading?: boolean;
  error?: string;
  height?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  description,
  children,
  variant = 'default',
  className,
  actions = [],
  loading = false,
  error,
  height = 'h-96',
}) => {
  const defaultActions = [
    {
      label: 'Expand',
      icon: <Maximize2 className="w-4 h-4" />,
      onClick: () => console.log('Expand chart'),
      variant: 'ghost' as const,
    },
    {
      label: 'Export',
      icon: <Download className="w-4 h-4" />,
      onClick: () => console.log('Export chart'),
      variant: 'ghost' as const,
    },
  ];

  const allActions = [...actions, ...defaultActions];

  return (
    <Card variant={variant} className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div className="flex-1">
          <h3 className={cn(
            'text-xl font-semibold',
            variant === 'gradient' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
          )}>
            {title}
          </h3>
          {description && (
            <p className={cn(
              'text-sm mt-1',
              variant === 'gradient' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
            )}>
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {allActions.length > 0 && (
          <div className="flex items-center gap-2">
            {allActions.slice(0, 2).map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'ghost'}
                size="sm"
                icon={action.icon}
                onClick={action.onClick}
                className={cn(
                  variant === 'gradient' && 'text-white hover:bg-white/20'
                )}
              >
                {action.label}
              </Button>
            ))}
            
            {allActions.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<MoreHorizontal className="w-4 h-4" />}
                onClick={() => console.log('More actions')}
                className={cn(
                  variant === 'gradient' && 'text-white hover:bg-white/20'
                )}
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn('px-6 pb-6', height)}>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-500 text-lg mb-2">⚠️</div>
              <p className="text-red-600 dark:text-red-400 font-medium">Chart Error</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        )}
      </div>
    </Card>
  );
};

export default ChartContainer;
