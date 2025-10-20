import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import { Dashboard as DashboardIcon, TrendingUp, Assessment } from '@mui/icons-material';
import { motion } from 'framer-motion';

const SimpleModernDemo: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 4, minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
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
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
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
              background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.3)} 0%, transparent 70%)`,
              borderRadius: '50%',
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h2" fontWeight="bold" gutterBottom>
              🩺 Diabetes Analyzer
            </Typography>
            <Typography variant="h5" sx={{ opacity: 0.9, mb: 2 }}>
              Modern Material UI Integration Demo
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.8 }}>
              Advanced glucose monitoring dashboard with beautiful, responsive design
            </Typography>
          </Box>
        </Paper>
      </motion.div>

      {/* Cards Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card
              elevation={3}
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <DashboardIcon sx={{ fontSize: 40, mr: 2 }} />
                  <Typography variant="h5" fontWeight="bold">
                    Dashboard
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                  120 mg/dL
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Current glucose level
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Updated 2 minutes ago
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card
              elevation={3}
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ fontSize: 40, mr: 2 }} />
                  <Typography variant="h5" fontWeight="bold">
                    Time in Range
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                  78%
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Last 24 hours
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Target: {'>'} 70%
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card
              elevation={3}
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                color: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assessment sx={{ fontSize: 40, mr: 2 }} />
                  <Typography variant="h5" fontWeight="bold">
                    Average
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                  134 mg/dL
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  7-day average
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  GMI: 6.8%
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Feature Showcase */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Paper
              elevation={2}
              sx={{
                p: 4,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              }}
            >
              <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
                🎉 Material UI Integration Complete!
              </Typography>
              
              <Typography variant="h6" color="text.secondary" paragraph>
                Successfully integrated advanced Material UI components with:
              </Typography>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      🎨 Custom Theme
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Diabetes-specific color palette with dark/light mode support
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      📊 Data Visualization
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Recharts integration for glucose charts and analytics
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      ✨ Animations
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Framer Motion for smooth transitions and interactions
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      📱 Responsive
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mobile-first design with adaptive layout system
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  sx={{
                    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  }}
                >
                  View Full Dashboard
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                >
                  Explore Components
                </Button>
              </Box>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimpleModernDemo;
