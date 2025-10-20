import React from 'react';
import { useDesignMode } from '../contexts/DesignModeContext';
import ClassicSettings from './Settings'; // The existing settings page
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import { Settings as SettingsIcon, Palette, Notifications, Security, Storage } from '@mui/icons-material';
import { motion } from 'framer-motion';
import DesignModeSelector from '../components/DesignModeSelector';

const ModernSettings: React.FC = () => {
  const theme = useTheme();

  const settingCategories = [
    {
      title: 'Appearance',
      icon: <Palette />,
      description: 'Customize your interface design and theme preferences',
      component: <DesignModeSelector />,
    },
    {
      title: 'Data & Sync',
      icon: <Storage />,
      description: 'Configure Nightscout connection and data synchronization',
      component: (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">Data sync settings coming soon...</Typography>
        </Box>
      ),
    },
    {
      title: 'Notifications',
      icon: <Notifications />,
      description: 'Set up alerts and notification preferences',
      component: (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">Notification settings coming soon...</Typography>
        </Box>
      ),
    },
    {
      title: 'Privacy & Security',
      icon: <Security />,
      description: 'Manage your privacy settings and data security',
      component: (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">Privacy settings coming soon...</Typography>
        </Box>
      ),
    },
  ];

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Paper
          elevation={4}
          sx={{
            p: 4,
            mb: 4,
            background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
            color: 'white',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              background: `radial-gradient(circle, ${alpha(theme.palette.secondary.light, 0.3)} 0%, transparent 70%)`,
              borderRadius: '50%',
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
            <SettingsIcon sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h3" fontWeight="bold" gutterBottom>
                Settings
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Customize your Diabetes Analyzer experience
              </Typography>
            </Box>
          </Box>
        </Paper>
      </motion.div>

      {/* Settings Categories */}
      <Grid container spacing={3}>
        {settingCategories.map((category, index) => (
          <Grid item xs={12} key={category.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card
                elevation={2}
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  '&:hover': {
                    boxShadow: theme.shadows[8],
                    transform: 'translateY(-2px)',
                    transition: 'all 0.3s ease-in-out',
                  },
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  {/* Category Header */}
                  <Box
                    sx={{
                      p: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                        }}
                      >
                        {category.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          {category.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Category Content */}
                  <Box sx={{ p: 3 }}>
                    {category.component}
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Classic Settings Integration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Paper
          elevation={2}
          sx={{
            mt: 4,
            p: 3,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <SettingsIcon sx={{ color: 'info.main' }} />
            <Typography variant="h6" fontWeight="bold" color="info.main">
              Advanced Settings
            </Typography>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <Box sx={{ 
            '& .bg-white': { backgroundColor: 'background.paper' },
            '& .dark\\:bg-gray-800': { backgroundColor: 'background.paper' },
            '& .text-gray-900': { color: 'text.primary' },
            '& .dark\\:text-white': { color: 'text.primary' },
            '& .border-gray-200': { borderColor: 'divider' },
            '& .dark\\:border-gray-700': { borderColor: 'divider' },
          }}>
            <ClassicSettings />
          </Box>
        </Paper>
      </motion.div>
    </Container>
  );
};

const AdaptiveSettings: React.FC = () => {
  const { isModern } = useDesignMode();

  return isModern ? <ModernSettings /> : <ClassicSettings />;
};

export default AdaptiveSettings;
