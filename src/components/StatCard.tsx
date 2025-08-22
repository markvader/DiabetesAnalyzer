import React, { ReactNode } from 'react';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  isGlucose?: boolean;
  glucoseValue?: number;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  description,
  trend,
  isGlucose = false,
  glucoseValue
}) => {
  const { getGlucoseColorForValue } = useGlucoseFormatting();
  
  const getTrendColor = () => {
    if (!trend) return '';
    
    switch (trend) {
      case 'up':
        return 'text-red-600 dark:text-red-400';
      case 'down':
        return 'text-green-600 dark:text-green-400';
      case 'neutral':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return '';
    }
  };
  
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend) {
      case 'up':
        return <span>↑</span>;
      case 'down':
        return <span>↓</span>;
      case 'neutral':
        return <span>→</span>;
      default:
        return null;
    }
  };

  const valueColor = isGlucose && glucoseValue ? getGlucoseColorForValue(glucoseValue, 'mmol') : '';
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-200 hover:shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <div className="mt-1 flex items-baseline">
            <p className={`text-2xl font-semibold ${valueColor}`}>
              {typeof value === 'object' && value !== null ? (
                (() => {
                  console.error('❌ StatCard received object value:', value);
                  return String(value);
                })()
              ) : value}
            </p>
            {trend && (
              <p className={`ml-2 flex items-baseline text-sm font-semibold ${getTrendColor()}`}>
                {getTrendIcon()}
              </p>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
        {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
      </div>
    </div>
  );
};

export default StatCard;