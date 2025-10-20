import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { cn, getGlucoseStatusColor, getGlucoseStatusClasses } from '../utils/cn';
import { useDesignMode } from '../contexts/DesignModeContext';
import { Card, CardContent, Typography, Box, useTheme, alpha } from '@mui/material';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  isGlucose?: boolean;
  glucoseValue?: number;
  variant?: 'default' | 'gradient' | 'glass' | 'success' | 'warning' | 'danger';
  className?: string;
  animated?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  description,
  trend,
  isGlucose = false,
  glucoseValue,
  variant = 'default',
  className,
  animated = true
}) => {
  const { unit } = useGlucoseFormatting();
  const { isModern, isPremium } = useDesignMode();
  const theme = useTheme();
  
  const getTrendIcon = () => {
    if (!trend) return null;
    
    const iconClass = "w-4 h-4";
    switch (trend) {
      case 'up':
        return <TrendingUp className={cn(iconClass, "text-danger-500")} />;
      case 'down':
        return <TrendingDown className={cn(iconClass, "text-success-500")} />;
      case 'neutral':
        return <Minus className={cn(iconClass, "text-gray-500")} />;
      default:
        return null;
    }
  };

  const getGlucoseColor = () => {
    if (!isGlucose || !glucoseValue) return theme.palette.text.primary;
    
    // Convert to mg/dL for consistent comparison
    const valueInMgDl = unit === 'mmol' ? glucoseValue * 18 : glucoseValue;
    
    if (valueInMgDl < 70) return theme.palette.error.main;
    if (valueInMgDl > 180) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  // Premium Design with Demo Styling
  if (isPremium) {
    const cardContent = (
      <Card
        elevation={variant === 'gradient' ? 6 : 3}
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          background: variant === 'gradient' 
            ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
          color: variant === 'gradient' ? 'white' : theme.palette.text.primary,
          border: variant === 'gradient' ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          backdropFilter: 'blur(20px)',
          '&:hover': {
            transform: 'translateY(-4px)',
            transition: 'all 0.3s ease-in-out',
            boxShadow: variant === 'gradient' 
              ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`
              : theme.shadows[8],
          },
          '&::before': variant === 'gradient' ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.light} 100%)`,
          } : {},
        }}
        className={className}
      >
        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
          {/* Decorative gradient circle for gradient variant */}
          {variant === 'gradient' && (
            <Box
              sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.3)} 0%, transparent 70%)`,
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />
          )}
          
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: variant === 'gradient' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mb: 1.5,
                  display: 'block'
                }}
              >
                {title}
              </Typography>
              
              <Box display="flex" alignItems="baseline" gap={1.5} mb={1.5}>
                <Typography 
                  variant="h3" 
                  component="div" 
                  sx={{ 
                    fontWeight: 800,
                    color: isGlucose ? getGlucoseColor() : (variant === 'gradient' ? 'white' : theme.palette.text.primary),
                    lineHeight: 1,
                    background: variant === 'gradient' && !isGlucose 
                      ? 'linear-gradient(45deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 100%)'
                      : 'inherit',
                    backgroundClip: variant === 'gradient' && !isGlucose ? 'text' : 'inherit',
                    WebkitBackgroundClip: variant === 'gradient' && !isGlucose ? 'text' : 'inherit',
                  }}
                >
                  {typeof value === 'object' && value !== null ? String(value) : value}
                </Typography>
                {trend && (
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    sx={{ 
                      color: variant === 'gradient' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
                      background: variant === 'gradient' 
                        ? 'rgba(255,255,255,0.15)' 
                        : alpha(theme.palette.background.default, 0.5),
                      borderRadius: 1,
                      p: 0.5,
                    }}
                  >
                    {getTrendIcon()}
                  </Box>
                )}
              </Box>
              
              {description && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: variant === 'gradient' ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {description}
                </Typography>
              )}
            </Box>
            
            {icon && (
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: variant === 'gradient' 
                    ? `linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                  color: variant === 'gradient' 
                    ? 'white' 
                    : theme.palette.primary.main,
                  backdropFilter: 'blur(10px)',
                  border: variant === 'gradient' 
                    ? '1px solid rgba(255,255,255,0.2)'
                    : `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  '& svg': {
                    fontSize: '1.75rem',
                    filter: variant === 'gradient' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none',
                  }
                }}
              >
                {icon}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );

    if (animated) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.6,
            type: "spring",
            stiffness: 100,
            damping: 15
          }}
          whileHover={{ 
            y: -2,
            transition: { duration: 0.2 }
          }}
        >
          {cardContent}
        </motion.div>
      );
    }

    return cardContent;
  }

  // Modern Material UI Design
  if (isModern) {
    const cardContent = (
      <Card
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: 'visible',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            elevation: 8,
            transform: 'translateY(-4px)',
          },
          background: variant === 'gradient' 
            ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            : theme.palette.background.paper,
          color: variant === 'gradient' ? theme.palette.primary.contrastText : theme.palette.text.primary,
        }}
        className={className}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: variant === 'gradient' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  mb: 1,
                  display: 'block'
                }}
              >
                {title}
              </Typography>
              
              <Box display="flex" alignItems="baseline" gap={1} mb={1}>
                <Typography 
                  variant="h4" 
                  component="div" 
                  sx={{ 
                    fontWeight: 700,
                    color: isGlucose ? getGlucoseColor() : (variant === 'gradient' ? 'white' : theme.palette.text.primary),
                    lineHeight: 1.2
                  }}
                >
                  {typeof value === 'object' && value !== null ? String(value) : value}
                </Typography>
                {trend && (
                  <Box display="flex" alignItems="center" sx={{ color: theme.palette.text.secondary }}>
                    {getTrendIcon()}
                  </Box>
                )}
              </Box>
              
              {description && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: variant === 'gradient' ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary,
                    lineHeight: 1.4
                  }}
                >
                  {description}
                </Typography>
              )}
            </Box>
            
            {icon && (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: variant === 'gradient' 
                    ? 'rgba(255,255,255,0.15)' 
                    : alpha(theme.palette.primary.main, 0.1),
                  color: variant === 'gradient' 
                    ? 'white' 
                    : theme.palette.primary.main,
                  '& svg': {
                    fontSize: '1.5rem'
                  }
                }}
              >
                {icon}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );

    if (animated) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          whileHover={{ y: -2 }}
        >
          {cardContent}
        </motion.div>
      );
    }

    return cardContent;
  }

  // Classic Tailwind Design (existing implementation)
  const getCardVariant = () => {
    if (isGlucose && glucoseValue) {
      const status = getGlucoseStatusColor(glucoseValue, unit);
      return getGlucoseStatusClasses(status);
    }
    
    switch (variant) {
      case 'gradient':
        return 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow border-0';
      case 'glass':
        return 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-md border border-white/20 dark:border-white/10';
      case 'success':
        return 'bg-gradient-to-br from-success-500 to-success-600 text-white shadow-glow-success border-0';
      case 'warning':
        return 'bg-gradient-to-br from-warning-500 to-warning-600 text-white shadow-glow-warning border-0';
      case 'danger':
        return 'bg-gradient-to-br from-danger-500 to-danger-600 text-white shadow-glow-danger border-0';
      default:
        return 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-lg hover:shadow-xl';
    }
  };

  const isGradientVariant = variant !== 'default' && variant !== 'glass';
  const textColorClass = isGradientVariant ? 'text-white' : 'text-gray-900 dark:text-gray-100';
  const subtitleColorClass = isGradientVariant ? 'text-white/80' : 'text-gray-500 dark:text-gray-400';
  const descriptionColorClass = isGradientVariant ? 'text-white/70' : 'text-gray-500 dark:text-gray-400';

  const cardContent = (
    <div className={cn(
      'rounded-2xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl',
      getCardVariant(),
      className
    )}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className={cn("text-sm font-medium mb-2", subtitleColorClass)}>{title}</h3>
          <div className="flex items-baseline gap-2 mb-1">
            <p className={cn("text-3xl font-bold tracking-tight", textColorClass)}>
              {typeof value === 'object' && value !== null ? (
                (() => {
                  console.error('❌ StatCard received object value:', value);
                  return String(value);
                })()
              ) : value}
            </p>
            {trend && (
              <div className="flex items-center gap-1">
                {getTrendIcon()}
              </div>
            )}
          </div>
          {description && (
            <p className={cn("text-sm", descriptionColorClass)}>{description}</p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isGradientVariant 
              ? 'bg-white/20 text-white' 
              : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ y: -2 }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
};

export default StatCard;