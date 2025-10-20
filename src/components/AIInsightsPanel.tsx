import React, { useState, useEffect, useRef } from 'react';
import { Brain, Lightbulb, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useDesignMode } from '../contexts/DesignModeContext';
import { motion } from 'framer-motion';
import { 
  Paper, 
  Typography, 
  Box, 
  Chip, 
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface AIInsightsPanelProps {
  readings: any[];
  timeInRange: {
    timeInRange: number;
    highPercentage: number;
    lowPercentage: number;
  };
  manualRefresh?: boolean;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ readings, timeInRange, manualRefresh = false }) => {
  const { unit, formatGlucoseValue, getUnitLabel } = useGlucoseFormatting();
  const { isModern, isPremium } = useDesignMode();
  const theme = useTheme();
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string>('');
  const initialLoadDone = useRef<boolean>(false);

  useEffect(() => {
    // Create a hash of the current data to compare - with safe number handling
    const safeTimeInRange = typeof timeInRange.timeInRange === 'number' ? timeInRange.timeInRange.toFixed(1) : '0.0';
    const safeHighPercentage = typeof timeInRange.highPercentage === 'number' ? timeInRange.highPercentage.toFixed(1) : '0.0';
    const safeLowPercentage = typeof timeInRange.lowPercentage === 'number' ? timeInRange.lowPercentage.toFixed(1) : '0.0';
    const dataHash = `${readings.length}-${safeTimeInRange}-${safeHighPercentage}-${safeLowPercentage}`;
    
    // Debug logging to catch any objects
    if (typeof timeInRange.timeInRange !== 'number' || typeof timeInRange.highPercentage !== 'number' || typeof timeInRange.lowPercentage !== 'number') {
      console.error('❌ AIInsightsPanel received non-number timeInRange values:', {
        timeInRange: { value: timeInRange.timeInRange, type: typeof timeInRange.timeInRange },
        highPercentage: { value: timeInRange.highPercentage, type: typeof timeInRange.highPercentage },
        lowPercentage: { value: timeInRange.lowPercentage, type: typeof timeInRange.lowPercentage }
      });
    }
    
    // Only fetch insights if:
    // 1. We haven't loaded anything yet, OR
    // 2. Manual refresh was requested, OR
    // 3. The data has changed AND we don't have any insights yet
    const shouldFetch = 
      !initialLoadDone.current || 
      manualRefresh || 
      (dataHash !== lastAnalyzedData && insights.length === 0);
    
    if (shouldFetch && readings && readings.length > 0) {
      fetchInsights(dataHash);
    }
  }, [readings, timeInRange, manualRefresh]);

  const fetchInsights = async (dataHash: string) => {
    if (!readings || readings.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiService.analyzeGlucosePatterns(readings, timeInRange, { unit, formatGlucoseValue, getUnitLabel });
      
      if (result) {
        setInsights(result.insights);
        setRecommendations(result.recommendations);
        setRiskAssessment(result.riskAssessment);
        setConfidence(result.confidence);
        setLastAnalyzedData(dataHash);
        initialLoadDone.current = true;
      } else {
        setError('Unable to generate AI insights at this time.');
      }
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setError('An error occurred while analyzing your data.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = () => {
    switch (riskAssessment) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your glucose patterns...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Our AI is processing your data to provide personalized insights</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Please try again later or check your API configuration.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0 && recommendations.length === 0) {
    return null;
  }

  const getRiskColorMui = () => {
    if (!riskAssessment) return theme.palette.text.secondary;
    switch (riskAssessment.toLowerCase()) {
      case 'low': return theme.palette.success.main;
      case 'moderate': return theme.palette.warning.main;
      case 'high': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  // Premium Design with Demo Styling
  if (isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Paper 
          elevation={6}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            position: 'relative',
            '&:hover': {
              transform: 'translateY(-2px)',
              transition: 'transform 0.3s ease-in-out',
              boxShadow: theme.shadows[8],
            },
          }}
        >
          {/* Decorative gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 50%, ${theme.palette.primary.main} 100%)`,
            }}
          />
          
          <Box sx={{ p: 4, position: 'relative' }}>
            {/* Header with enhanced styling */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
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
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.3)} 0%, transparent 70%)`,
                  borderRadius: '50%',
                }}
              />
              
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={2}>
                    <Brain size={28} color="#ffffff" />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      🧠 AI-Powered Insights
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={`${riskAssessment ? riskAssessment.charAt(0).toUpperCase() + riskAssessment.slice(1) : 'Unknown'} Risk`}
                      size="small"
                      sx={{ 
                        backgroundColor: alpha('#ffffff', 0.2),
                        color: '#ffffff',
                        fontWeight: 600,
                        backdropFilter: 'blur(10px)',
                      }}
                    />
                    <Typography variant="caption" sx={{ opacity: 0.9, color: '#ffffff' }}>
                      {confidence}% Confidence
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Enhanced content cards */}
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
              {insights.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <Paper 
                    elevation={3}
                    sx={{ 
                      p: 3, 
                      background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`,
                      borderRadius: 3,
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        transition: 'transform 0.2s ease-in-out',
                        boxShadow: theme.shadows[4],
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Lightbulb size={18} color="#ffffff" />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.secondary.main }}>
                        💡 Pattern Insights
                      </Typography>
                    </Box>
                    <List dense sx={{ '& .MuiListItem-root': { mb: 1 } }}>
                      {insights.map((insight, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 * index }}
                        >
                          <ListItem 
                            sx={{ 
                              px: 0, 
                              py: 1,
                              backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                                }} 
                              />
                            </ListItemIcon>
                            <ListItemText 
                              primary={insight}
                              primaryTypographyProps={{ 
                                variant: 'body2',
                                color: theme.palette.secondary.dark,
                                fontWeight: 500,
                              }}
                            />
                          </ListItem>
                        </motion.div>
                      ))}
                    </List>
                  </Paper>
                </motion.div>
              )}

              {recommendations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Paper 
                    elevation={3}
                    sx={{ 
                      p: 3, 
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)`,
                      borderRadius: 3,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        transition: 'transform 0.2s ease-in-out',
                        boxShadow: theme.shadows[4],
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircle size={18} color="#ffffff" />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                        🎯 Recommendations
                      </Typography>
                    </Box>
                    <List dense sx={{ '& .MuiListItem-root': { mb: 1 } }}>
                      {recommendations.map((recommendation, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 * index }}
                        >
                          <ListItem 
                            sx={{ 
                              px: 0, 
                              py: 1,
                              backgroundColor: alpha(theme.palette.primary.main, 0.05),
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                }} 
                              />
                            </ListItemIcon>
                            <ListItemText 
                              primary={recommendation}
                              primaryTypographyProps={{ 
                                variant: 'body2',
                                color: theme.palette.primary.dark,
                                fontWeight: 500,
                              }}
                            />
                          </ListItem>
                        </motion.div>
                      ))}
                    </List>
                  </Paper>
                </motion.div>
              )}
            </Box>

            {/* Enhanced footer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Box sx={{ mt: 4, pt: 3, borderTop: `2px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Alert 
                  severity="info" 
                  variant="outlined" 
                  sx={{ 
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.light, 0.02)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    🏥 <strong>Medical Disclaimer:</strong> These insights are generated by AI based on your glucose data. Always consult with your healthcare provider before making changes to your diabetes management.
                  </Typography>
                </Alert>
              </Box>
            </motion.div>
          </Box>
        </Paper>
      </motion.div>
    );
  }

  // Modern Material UI Design
  if (isModern) {
    return (
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={1}>
              <Brain size={24} color={theme.palette.secondary.main} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                AI-Powered Insights
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={`${riskAssessment ? riskAssessment.charAt(0).toUpperCase() + riskAssessment.slice(1) : 'Unknown'} Risk`}
                size="small"
                sx={{ 
                  backgroundColor: alpha(getRiskColorMui(), 0.1),
                  color: getRiskColorMui(),
                  fontWeight: 600
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {confidence}% Confidence
              </Typography>
            </Box>
          </Box>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
            {insights.length > 0 && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                  borderRadius: 2
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Lightbulb size={20} color={theme.palette.secondary.main} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.secondary.main }}>
                    Pattern Insights
                  </Typography>
                </Box>
                <List dense>
                  {insights.map((insight, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <Box 
                          sx={{ 
                            width: 4, 
                            height: 4, 
                            borderRadius: '50%', 
                            backgroundColor: theme.palette.secondary.main 
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={insight}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          color: theme.palette.secondary.dark
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {recommendations.length > 0 && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  borderRadius: 2
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CheckCircle size={20} color={theme.palette.primary.main} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                    Recommendations
                  </Typography>
                </Box>
                <List dense>
                  {recommendations.map((recommendation, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <Box 
                          sx={{ 
                            width: 4, 
                            height: 4, 
                            borderRadius: '50%', 
                            backgroundColor: theme.palette.primary.main 
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={recommendation}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          color: theme.palette.primary.dark
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
              <Typography variant="caption">
                These insights are generated by AI based on your glucose data. Always consult with your healthcare provider before making changes to your diabetes management.
              </Typography>
            </Alert>
          </Box>
        </Box>
      </Paper>
    );
  }

  // Classic Tailwind Design
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Insights</h3>
        </div>
        <div className="flex items-center">
          <span className={`text-sm font-medium ${getRiskColor()}`}>
            {riskAssessment ? riskAssessment.charAt(0).toUpperCase() + riskAssessment.slice(1) : 'Unknown'} Risk
          </span>
          <span className="mx-2 text-gray-400">|</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {confidence}% Confidence
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
              <h4 className="font-medium text-purple-900 dark:text-purple-100">Pattern Insights</h4>
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-purple-800 dark:text-purple-200 text-sm">• {insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {recommendations.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-800 dark:text-blue-200 text-sm">• {recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          These insights are generated by AI based on your glucose data. Always consult with your healthcare provider before making changes to your diabetes management.
        </p>
      </div>
    </div>
  );
};

export default AIInsightsPanel;