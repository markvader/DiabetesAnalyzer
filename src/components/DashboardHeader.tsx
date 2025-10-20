import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, Clock, Settings } from 'lucide-react';
import Button from './Button';
import Badge from './Badge';
import { cn } from '../utils/cn';

interface DashboardHeaderProps {
  title: string;
  description: string;
  lastUpdate?: Date;
  timeWindow: number;
  isCustomRange: boolean;
  onTimeWindowChange: (value: string) => void;
  onCalendarToggle: () => void;
  onRefresh: () => void;
  onAutoRefreshToggle: () => void;
  autoRefreshEnabled: boolean;
  isLoading?: boolean;
  className?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  description,
  lastUpdate,
  timeWindow,
  isCustomRange,
  onTimeWindowChange,
  onCalendarToggle,
  onRefresh,
  onAutoRefreshToggle,
  autoRefreshEnabled,
  isLoading = false,
  className,
}) => {
  const getAllTimeWindows = () => [
    { value: 1, label: '24 Hours' },
    { value: 3, label: '3 Days' },
    { value: 7, label: '7 Days' },
    { value: 14, label: '14 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
  ];

  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'bg-gradient-to-r from-primary-50 to-blue-50 dark:from-dark-800 dark:to-dark-700',
        'rounded-2xl p-6 mb-8 border border-primary-100 dark:border-dark-600',
        className
      )}
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Title Section */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent">
              {title}
            </h1>
            {autoRefreshEnabled && (
              <Badge variant="success" size="sm" animated pulse>
                Live
              </Badge>
            )}
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
            {description}
          </p>
          
          {lastUpdate && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Updated {formatLastUpdate(lastUpdate)}</span>
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Time Window Selector */}
          <div className="flex items-center gap-2">
            <select
              value={isCustomRange ? 'custom' : timeWindow.toString()}
              onChange={(e) => onTimeWindowChange(e.target.value)}
              className={cn(
                'px-4 py-2.5 bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600',
                'rounded-xl shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                'text-gray-900 dark:text-gray-100 transition-all duration-200',
                'hover:shadow-md'
              )}
            >
              {getAllTimeWindows().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              icon={<Calendar className="w-4 h-4" />}
              onClick={onCalendarToggle}
              className="whitespace-nowrap"
            >
              Calendar
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={<RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />}
              onClick={onRefresh}
              loading={isLoading}
              className="whitespace-nowrap"
            >
              Refresh
            </Button>

            <Button
              variant={autoRefreshEnabled ? "success" : "secondary"}
              size="md"
              icon={<Settings className="w-4 h-4" />}
              onClick={onAutoRefreshToggle}
              className="whitespace-nowrap"
            >
              Auto
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardHeader;
