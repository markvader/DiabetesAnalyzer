import React from 'react';
import { useDesignMode } from '../contexts/DesignModeContext';
import Layout from './Layout'; // Original layout
import { 
  Box, 
  Container, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Analytics,
  Settings,
  TrendingUp,
  Assessment,

  Timeline,
  BarChart,
  Info,
  Palette,
  ExpandLess,
  ExpandMore,
  Home,
  Schedule,
  Psychology,
  Insights,
  Restaurant,
  Assignment,
  Security,
  FitnessCenter,
  Hotel,
  Favorite,
  Calculate,
  Cloud,
  WbSunny,
  Opacity,
  DeviceThermostat,
  MyLocation,
  Cookie,
  FlashOn,
  Settings as SettingsIcon,
  Tune,
  ScienceOutlined,
  Download,
  NotificationsActive,
  Assessment as AssessmentIcon,
  Sync,
  Monitor,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DesignModeSelector from './DesignModeSelector';

interface AdaptiveLayoutProps {
  children: React.ReactNode;
}

const ModernLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [showDesignSelector, setShowDesignSelector] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['Dashboard', 'AI Analysis']);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const navigationGroups = [
    {
      name: 'Dashboard',
      icon: <Home />,
      items: [
        { path: '/', label: 'Overview', icon: <Dashboard /> },
        { path: '/time-in-range', label: 'Time in Range', icon: <Schedule /> },
        { path: '/glucose-chart', label: 'Glucose Chart', icon: <Timeline /> },
        { path: '/predictions', label: 'Predictions', icon: <Psychology /> }
      ]
    },
    {
      name: 'AI Analysis',
      icon: <Insights />,
      items: [
        { path: '/ai-insights', label: 'AI Insights', icon: <Psychology /> },
        { path: '/meal-patterns', label: 'Meal Analysis', icon: <Restaurant /> },
        { path: '/management-plan', label: 'Management Plan', icon: <Assignment /> },
        { path: '/safety-analysis', label: 'Safety Analysis', icon: <Security /> },
        { path: '/exercise-impact', label: 'Exercise Impact', icon: <FitnessCenter /> },
        { path: '/sleep-analysis', label: 'Sleep Analysis', icon: <Hotel /> },
        { path: '/stress-impact', label: 'Stress Impact', icon: <Favorite /> }
      ]
    },
    {
      name: 'Analysis',
      icon: <Analytics />,
      items: [
        { path: '/analysis', label: 'Pattern Analysis', icon: <TrendingUp /> },
        { path: '/advanced-stats', label: 'Advanced Stats', icon: <Assessment /> },
        { path: '/a1c', label: 'A1C Estimation', icon: <Calculate /> },
        { path: '/weather-impact', label: 'Weather Impact', icon: <Cloud /> },
        { path: '/circadian', label: 'Circadian Rhythm', icon: <WbSunny /> },
        { path: '/trends', label: 'Trend Analysis', icon: <TrendingUp /> }
      ]
    },
    {
      name: 'Treatment',
      icon: <Opacity />,
      items: [
        { path: '/basal', label: 'Basal Rates', icon: <BarChart /> },
        { path: '/isf', label: 'ISF Settings', icon: <DeviceThermostat /> },
        { path: '/isf-optimization', label: 'ISF Optimization', icon: <MyLocation /> },
        { path: '/carb-ratio', label: 'Carb Ratios', icon: <Cookie /> },
        { path: '/openaps-smb', label: 'OpenAPS SMB', icon: <FlashOn /> },
        { path: '/loop-analysis', label: 'Loop Analysis', icon: <MyLocation /> },
        { path: '/pump-settings', label: 'Pump Settings', icon: <Tune /> },
        { path: '/cgm-calibration', label: 'CGM Calibration', icon: <ScienceOutlined /> }
      ]
    },
    {
      name: 'Data',
      icon: <Download />,
      items: [
        { path: '/export', label: 'Export Data', icon: <Download /> },
        { path: '/alerts', label: 'Alerts', icon: <NotificationsActive /> },
        { path: '/data-quality', label: 'Data Quality', icon: <AssessmentIcon /> },
        { path: '/backup-sync', label: 'Backup & Sync', icon: <Sync /> }
      ]
    },
    {
      name: 'System',
      icon: <SettingsIcon />,
      items: [
        { path: '/monitoring', label: 'Monitoring', icon: <Monitor /> },
        { path: '/settings', label: 'Settings', icon: <Settings /> },
        { path: '/about', label: 'About', icon: <Info /> }
      ]
    }
  ];

  const drawer = (
    <Box sx={{ width: 280 }}>
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          🩺 Diabetes Analyzer
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Modern Health Dashboard
        </Typography>
      </Box>
      
      <List sx={{ px: 2, py: 1 }}>
        {navigationGroups.map((group) => (
          <React.Fragment key={group.name}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => toggleGroup(group.name)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {group.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={group.name}
                  sx={{ 
                    '& .MuiListItemText-primary': {
                      fontWeight: 600,
                    }
                  }} 
                />
                {expandedGroups.includes(group.name) ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            
            <Collapse in={expandedGroups.includes(group.name)} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ pl: 2 }}>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItem
                      key={item.path}
                      component={Link}
                      to={item.path}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        },
                        textDecoration: 'none',
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText 
                        primary={item.label}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                          },
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Diabetes Analyzer
          </Typography>

          <IconButton
            color="inherit"
            onClick={() => setShowDesignSelector(!showDesignSelector)}
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <Palette />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: 280 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: 280,
              zIndex: theme.zIndex.drawer,
              position: 'fixed',
              height: '100vh',
              top: 0,
              left: 0,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - 280px)` },
          marginLeft: { xs: 0, md: '280px' },
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        </Container>
      </Box>

      {/* Design Mode Selector FAB */}
      <AnimatePresence>
        {showDesignSelector && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 2000,
            }}
          >
            <Box sx={{ width: 380, maxWidth: '90vw' }}>
              <DesignModeSelector />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({ children }) => {
  const { isModern } = useDesignMode();

  return isModern ? (
    <ModernLayout>{children}</ModernLayout>
  ) : (
    <Layout>{children}</Layout>
  );
};

export default AdaptiveLayout;
