import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Target, Clock, Droplets, Zap } from 'lucide-react';
import StatCard from './StatCard';
import { cn } from '../utils/cn';

interface MetricData {
  id: string;
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  isGlucose?: boolean;
  glucoseValue?: number;
  variant?: 'default' | 'gradient' | 'glass' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

interface MetricsGridProps {
  metrics: MetricData[];
  className?: string;
  columns?: 2 | 3 | 4;
}

const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  className,
  columns = 3,
}) => {
  const getGridClasses = () => {
    switch (columns) {
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  const getDefaultIcon = (title: string) => {
    const iconClass = "w-6 h-6";
    
    if (title.toLowerCase().includes('glucose') || title.toLowerCase().includes('bg')) {
      return <Droplets className={iconClass} />;
    }
    if (title.toLowerCase().includes('range') || title.toLowerCase().includes('tir')) {
      return <Target className={iconClass} />;
    }
    if (title.toLowerCase().includes('trend') || title.toLowerCase().includes('change')) {
      return <TrendingUp className={iconClass} />;
    }
    if (title.toLowerCase().includes('time') || title.toLowerCase().includes('duration')) {
      return <Clock className={iconClass} />;
    }
    if (title.toLowerCase().includes('iob') || title.toLowerCase().includes('cob')) {
      return <Zap className={iconClass} />;
    }
    
    return <Activity className={iconClass} />;
  };

  return (
    <div className={cn("grid gap-6", getGridClasses(), className)}>
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <StatCard
            title={metric.title}
            value={metric.value}
            description={metric.description}
            trend={metric.trend}
            isGlucose={metric.isGlucose}
            glucoseValue={metric.glucoseValue}
            variant={metric.variant || 'default'}
            icon={metric.icon || getDefaultIcon(metric.title)}
            animated={true}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default MetricsGrid;
