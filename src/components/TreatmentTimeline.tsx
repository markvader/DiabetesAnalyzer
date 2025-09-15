import React from 'react';
import { Utensils, Syringe, Zap, Activity, Droplets, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface Treatment {
  id: string;
  type: 'meal' | 'bolus' | 'correction' | 'smb' | 'tempBasal' | 'exercise';
  timestamp: Date;
  description: string;
  value?: number;
  unit?: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

interface TreatmentTimelineProps {
  treatments: Treatment[];
  maxItems?: number;
}

const TreatmentTimeline: React.FC<TreatmentTimelineProps> = ({ 
  treatments, 
  maxItems = 8 
}) => {
  const { formatGlucoseValue } = useGlucoseFormatting();

  // Sort treatments by timestamp (most recent first) and limit
  const sortedTreatments = treatments
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxItems);

  const getIcon = (type: Treatment['type']) => {
    switch (type) {
      case 'meal':
        return <Utensils className="w-4 h-4" />;
      case 'bolus':
      case 'correction':
        return <Syringe className="w-4 h-4" />;
      case 'smb':
        return <Zap className="w-4 h-4" />;
      case 'tempBasal':
        return <Droplets className="w-4 h-4" />;
      case 'exercise':
        return <Activity className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getColor = (type: Treatment['type'], impact?: Treatment['impact']) => {
    switch (type) {
      case 'meal':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'bolus':
      case 'correction':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'smb':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'tempBasal':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300';
      case 'exercise':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  const getTypeLabel = (type: Treatment['type']) => {
    switch (type) {
      case 'meal':
        return 'Meal';
      case 'bolus':
        return 'Bolus';
      case 'correction':
        return 'Correction';
      case 'smb':
        return 'SMB';
      case 'tempBasal':
        return 'Temp Basal';
      case 'exercise':
        return 'Exercise';
      default:
        return 'Treatment';
    }
  };

  const getRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return format(timestamp, 'MMM d, HH:mm');
    }
  };

  if (sortedTreatments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Treatments
          </h3>
        </div>
        <div className="text-center py-4">
          <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No recent treatments found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Treatments
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Last {sortedTreatments.length} events
        </span>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {sortedTreatments.map((treatment, index) => (
          <div key={treatment.id} className="relative">
            {/* Timeline connector */}
            {index < sortedTreatments.length - 1 && (
              <div className="absolute left-5 top-10 w-0.5 h-6 bg-gray-200 dark:bg-gray-700"></div>
            )}
            
            <div className="flex items-start space-x-3">
              {/* Icon */}
              <div className={`p-2 rounded-full ${getColor(treatment.type, treatment.impact)}`}>
                {getIcon(treatment.type)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {getTypeLabel(treatment.type)}
                    </span>
                    {treatment.value && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {treatment.value}{treatment.unit}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getRelativeTime(treatment.timestamp)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {treatment.description}
                </p>

                {/* Impact indicator */}
                {treatment.impact && (
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      treatment.impact === 'positive' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : treatment.impact === 'negative'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                    }`}>
                      {treatment.impact === 'positive' && '↗ Raising'}
                      {treatment.impact === 'negative' && '↘ Lowering'}
                      {treatment.impact === 'neutral' && '→ Stable'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {sortedTreatments.filter(t => t.type === 'meal').length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Meals</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {sortedTreatments.filter(t => t.type === 'bolus' || t.type === 'correction').length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Boluses</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {sortedTreatments.filter(t => t.type === 'smb').length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">SMBs</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatmentTimeline;
