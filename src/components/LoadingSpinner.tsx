import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Activity } from 'lucide-react';
import { cn } from '../utils/cn';
import { useDesignMode } from '../contexts/DesignModeContext';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glucose' | 'minimal';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Loading data...", 
  size = 'md',
  variant = 'default',
  className 
}) => {
  const { isModern, isPremium } = useDesignMode();
  const theme = useTheme();
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-6 w-6';
      case 'lg': return 'h-16 w-16';
      default: return 'h-12 w-12';
    }
  };

  const getSpinner = () => {
    const sizeClass = getSizeClasses();
    
    if (variant === 'glucose') {
      return (
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className={cn("rounded-full border-4 border-glucose-target/20 border-t-glucose-target", sizeClass)}
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-glucose-target/10"
          />
          <Activity className="absolute inset-0 m-auto w-6 h-6 text-glucose-target" />
        </div>
      );
    }

    if (variant === 'minimal') {
      return (
        <Loader2 className={cn("animate-spin text-primary-500", sizeClass)} />
      );
    }

    return (
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={cn(
            "rounded-full border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400",
            sizeClass
          )}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={cn(
            "absolute inset-0 rounded-full border-2 border-primary-400/20 dark:border-primary-500/20",
            sizeClass
          )}
        />
      </div>
    );
  };

  // Premium Design with Advanced Effects
  if (isPremium) {
    const getCircularSize = () => {
      switch (size) {
        case 'sm': return 28;
        case 'lg': return 72;
        default: return 56;
      }
    };

    if (variant === 'minimal') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -180 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
        >
          <Box display="flex" alignItems="center" justifyContent="center" className={className}>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress 
                size={getCircularSize()} 
                thickness={3}
                sx={{ 
                  position: 'absolute',
                  background: `conic-gradient(from 0deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                  borderRadius: '50%',
                  '& .MuiCircularProgress-circle': {
                    stroke: `url(#gradient-${Math.random().toString(36).substr(2, 9)})`,
                  }
                }}
              />
              <svg width="0" height="0">
                <defs>
                  <linearGradient id={`gradient-premium`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={theme.palette.primary.main} />
                    <stop offset="50%" stopColor={theme.palette.secondary.main} />
                    <stop offset="100%" stopColor={theme.palette.primary.dark} />
                  </linearGradient>
                </defs>
              </svg>
            </Box>
          </Box>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
      >
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          p={6}
          gap={4}
          className={className}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            borderRadius: 4,
            boxShadow: theme.shadows[8],
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 50%, ${theme.palette.primary.main} 100%)`,
            }
          }}
        >
          {/* Animated background glow */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: getCircularSize() * 2,
              height: getCircularSize() * 2,
              background: `radial-gradient(circle, ${theme.palette.primary.main}20 0%, transparent 70%)`,
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
          
          {/* Enhanced loading spinner */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Multiple layered spinners */}
              <CircularProgress 
                size={getCircularSize()} 
                thickness={2}
                sx={{ 
                  position: 'absolute',
                  color: theme.palette.primary.main,
                  filter: 'drop-shadow(0 0 8px currentColor)',
                }}
              />
              <CircularProgress 
                size={getCircularSize() - 8} 
                thickness={4}
                variant="determinate"
                value={75}
                sx={{ 
                  position: 'absolute',
                  color: theme.palette.secondary.main,
                  opacity: 0.6,
                  transform: 'rotate(45deg)',
                }}
              />
              
              {/* Center icon with glow effect */}
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ 
                  rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: `0 0 16px ${theme.palette.primary.main}50`,
                  }}
                >
                  {variant === 'glucose' ? '🩸' : '⚡'}
                </Box>
              </motion.div>
            </Box>
          </Box>
          
          {/* Enhanced text with animations */}
          <Box textAlign="center" sx={{ position: 'relative', zIndex: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  mb: 1
                }}
              >
                {message}
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                {variant === 'glucose' 
                  ? '🧬 Analyzing glucose patterns with AI precision...'
                  : '⚙️ Processing large datasets may take a moment...'
                }
              </Typography>
            </motion.div>
          </Box>
          
          {/* Enhanced animated dots with gradient */}
          <Box display="flex" gap={1} sx={{ position: 'relative', zIndex: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
                  }}
                />
              </motion.div>
            ))}
          </Box>
        </Box>
      </motion.div>
    );
  }

  // Modern Material UI Design
  if (isModern) {
    const getCircularSize = () => {
      switch (size) {
        case 'sm': return 24;
        case 'lg': return 64;
        default: return 48;
      }
    };

    if (variant === 'minimal') {
      return (
        <Box display="flex" alignItems="center" justifyContent="center" className={className}>
          <CircularProgress size={getCircularSize()} />
        </Box>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          p={4}
          gap={3}
          className={className}
        >
          <CircularProgress 
            size={getCircularSize()} 
            thickness={4}
            sx={{ 
              color: variant === 'glucose' ? theme.palette.success.main : theme.palette.primary.main,
            }}
          />
          
          <Box textAlign="center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Typography variant="h6" color="text.primary" gutterBottom>
                {message}
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Typography variant="body2" color="text.secondary">
                Processing large datasets may take a moment...
              </Typography>
            </motion.div>
          </Box>
          
          {/* Animated dots */}
          <Box display="flex" gap={0.5}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: '50%'
                }}
              />
            ))}
          </Box>
        </Box>
      </motion.div>
    );
  }

  // Classic Tailwind Design
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        {getSpinner()}
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center justify-center p-8 space-y-6", className)}
    >
      {getSpinner()}
      
      <div className="text-center space-y-2">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-700 dark:text-gray-300 font-medium"
        >
          {message}
        </motion.p>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          Processing large datasets may take a moment...
        </motion.p>
      </div>
      
      {/* Animated dots */}
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="w-2 h-2 bg-primary-500 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
};

export default LoadingSpinner;