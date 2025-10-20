import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  useTheme,
  alpha,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Remove,
  Info,
  Warning,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useGlucoseFormatting } from '../../hooks/useGlucoseFormatting';

interface GlucoseMetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  isGlucose?: boolean;
  glucoseValue?: number;
  subtitle?: string;
  loading?: boolean;
  onClick?: () => void;
  info?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

export const GlucoseMetricCard: React.FC<GlucoseMetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  isGlucose = false,
  glucoseValue,
  subtitle,
  loading = false,
  onClick,
  info,
  variant = 'default',
}) => {
  const theme = useTheme();
  const { getCurrentGlucoseRanges } = useGlucoseFormatting();

  const getGlucoseColor = (value: number) => {
    if (!isGlucose) return theme.palette.primary.main;
    
    const ranges = getCurrentGlucoseRanges();
    if (value < ranges.LOW_THRESHOLD) return theme.palette.glucose.low;
    if (value > ranges.HIGH_THRESHOLD) return theme.palette.glucose.high;
    if (value >= ranges.TARGET_MIN && value <= ranges.TARGET_MAX) return theme.palette.glucose.target;
    return theme.palette.warning.main;
  };

  const getGlucoseStatus = (value: number) => {
    if (!isGlucose) return 'normal';
    
    const ranges = getCurrentGlucoseRanges();
    if (value < ranges.LOW_THRESHOLD) return 'low';
    if (value > ranges.HIGH_THRESHOLD) return 'high';
    if (value >= ranges.TARGET_MIN && value <= ranges.TARGET_MAX) return 'target';
    return 'borderline';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'low': return <Error fontSize="small" />;
      case 'high': return <Warning fontSize="small" />;
      case 'target': return <CheckCircle fontSize="small" />;
      default: return <Info fontSize="small" />;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp fontSize="small" />;
      case 'down': return <TrendingDown fontSize="small" />;
      default: return <Remove fontSize="small" />;
    }
  };

  const getTrendColor = () => {
    if (!isGlucose) {
      switch (trend) {
        case 'up': return theme.palette.success.main;
        case 'down': return theme.palette.error.main;
        default: return theme.palette.text.secondary;
      }
    }
    
    // For glucose, up trend might be bad if already high
    const ranges = getCurrentGlucoseRanges();
    const currentValue = glucoseValue || (typeof value === 'number' ? value : 0);
    
    if (trend === 'up') {
      return currentValue > ranges.TARGET_MAX ? theme.palette.glucose.high : theme.palette.success.main;
    }
    if (trend === 'down') {
      return currentValue < ranges.TARGET_MIN ? theme.palette.glucose.low : theme.palette.success.main;
    }
    return theme.palette.text.secondary;
  };

  const mainColor = isGlucose && typeof glucoseValue === 'number' 
    ? getGlucoseColor(glucoseValue) 
    : theme.palette.primary.main;

  const status = isGlucose && typeof glucoseValue === 'number' 
    ? getGlucoseStatus(glucoseValue) 
    : 'normal';

  if (loading) {
    return (
      <Card 
        sx={{ 
          height: variant === 'compact' ? 120 : 180,
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="80%" height={20} sx={{ mt: 'auto' }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card
        onClick={onClick}
        sx={{
          height: variant === 'compact' ? 120 : 180,
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'visible',
          background: `linear-gradient(135deg, 
            ${alpha(mainColor, 0.1)} 0%, 
            ${alpha(mainColor, 0.05)} 100%)`,
          border: `2px solid ${alpha(mainColor, 0.2)}`,
          '&:hover': onClick ? {
            transform: 'translateY(-4px)',
            boxShadow: `0px 8px 30px ${alpha(mainColor, 0.3)}`,
            border: `2px solid ${alpha(mainColor, 0.4)}`,
          } : {},
        }}
      >
        {/* Status Indicator */}
        {isGlucose && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: 12,
              bgcolor: mainColor,
              color: 'white',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 2,
            }}
          >
            {getStatusIcon(status)}
          </Box>
        )}

        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {title}
            </Typography>
            {info && (
              <Tooltip title={info} arrow>
                <IconButton size="small" sx={{ color: 'text.secondary' }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Main Value */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', my: 1 }}>
            <Typography
              variant={variant === 'compact' ? 'h5' : 'h4'}
              component="div"
              sx={{
                fontWeight: 700,
                color: mainColor,
                lineHeight: 1,
              }}
            >
              {value}
            </Typography>
            {unit && (
              <Typography
                variant="body2"
                sx={{
                  ml: 0.5,
                  color: 'text.secondary',
                  alignSelf: 'flex-end',
                  mb: 0.5,
                }}
              >
                {unit}
              </Typography>
            )}
          </Box>

          {/* Bottom Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {subtitle}
              </Typography>
            )}
            
            {trend && (
              <Chip
                size="small"
                icon={getTrendIcon()}
                label={trendValue ? `${trendValue > 0 ? '+' : ''}${trendValue}` : trend}
                sx={{
                  bgcolor: alpha(getTrendColor(), 0.1),
                  color: getTrendColor(),
                  border: `1px solid ${alpha(getTrendColor(), 0.3)}`,
                  fontSize: '0.75rem',
                  height: 24,
                  '& .MuiChip-icon': {
                    color: getTrendColor(),
                  },
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};
