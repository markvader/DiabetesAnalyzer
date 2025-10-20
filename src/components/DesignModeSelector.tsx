import React from 'react';
import { useDesignMode } from '../contexts/DesignModeContext';

// Material UI version
import {
  Box,
  FormControl,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import { Palette, AutoAwesome } from '@mui/icons-material';
import { motion } from 'framer-motion';

// Classic version using Tailwind
const ClassicDesignModeSelector: React.FC = () => {
  const { designMode, setDesignMode, isModern, isClassic, isPremium } = useDesignMode();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              UI Style
            </span>
          </div>
          <div className="flex space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isClassic
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
              onClick={() => setDesignMode('classic')}
            >
              Classic
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isModern
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }`}
              onClick={() => setDesignMode('modern')}
            >
              Modern
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isPremium
                  ? 'bg-gradient-to-r from-pink-100 to-purple-100 text-purple-800 dark:from-pink-900 dark:to-purple-900 dark:text-purple-200 shadow-md'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-pink-900/20 dark:hover:to-purple-900/20'
              }`}
              onClick={() => setDesignMode('premium')}
            >
              ✨ Premium
            </span>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isModern}
            onChange={(e) => setDesignMode(e.target.checked ? 'modern' : 'classic')}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
        </label>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        {isModern 
          ? 'Using modern Material UI design with advanced components and animations'
          : 'Using classic Tailwind CSS design with traditional styling'
        }
      </p>
    </div>
  );
};

// Modern Material UI version
const ModernDesignModeSelector: React.FC = () => {
  const { designMode, setDesignMode, isModern, isClassic, isPremium } = useDesignMode();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          borderRadius: 3,
          background: isPremium 
            ? 'linear-gradient(135deg, rgba(233, 30, 99, 0.05) 0%, rgba(156, 39, 176, 0.05) 50%, rgba(63, 81, 181, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AutoAwesome sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold" color="primary">
              Design Experience
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label="Classic"
              variant={isClassic ? 'filled' : 'outlined'}
              color={isClassic ? 'info' : 'default'}
              size="small"
              onClick={() => setDesignMode('classic')}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label="Modern"
              variant={isModern ? 'filled' : 'outlined'}
              color={isModern ? 'secondary' : 'default'}
              size="small"
              onClick={() => setDesignMode('modern')}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label="✨ Premium"
              variant={isPremium ? 'filled' : 'outlined'}
              color={isPremium ? 'primary' : 'default'}
              size="small"
              onClick={() => setDesignMode('premium')}
              sx={{ 
                cursor: 'pointer',
                background: isPremium 
                  ? 'linear-gradient(135deg, #e91e63 0%, #9c27b0 50%, #3f51b5 100%)'
                  : undefined,
                color: isPremium ? 'white' : undefined,
                '&:hover': {
                  background: isPremium 
                    ? 'linear-gradient(135deg, #c2185b 0%, #7b1fa2 50%, #303f9f 100%)'
                    : undefined,
                }
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body1" fontWeight="medium">
            {isPremium ? '✨ Premium Experience' : isModern ? 'Modern Material UI' : 'Classic Tailwind'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isPremium 
              ? 'Advanced animations, gradient styling, and premium visual effects'
              : isModern 
                ? 'Advanced components with animations and Material Design'
                : 'Traditional styling with Tailwind CSS utilities'
            }
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: isPremium ? 'linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(156, 39, 176, 0.1))' : isModern ? 'secondary.light' : 'info.light',
            opacity: 0.8,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            ✨ {isPremium ? 'Premium' : isModern ? 'Enhanced' : 'Familiar'} user experience activated
          </Typography>
        </Box>
      </Paper>
    </motion.div>
  );
};

// Main component that chooses which version to render
const DesignModeSelector: React.FC = () => {
  const { isModern } = useDesignMode();

  return isModern ? <ModernDesignModeSelector /> : <ClassicDesignModeSelector />;
};

export default DesignModeSelector;
