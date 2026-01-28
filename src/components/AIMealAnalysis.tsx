import React, { useState, useEffect } from 'react';
import { Cookie, Clock, Lightbulb, AlertTriangle, Loader } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useDesignMode } from '../contexts/DesignModeContext';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  useTheme,
  alpha
} from '@mui/material';
import type { NightscoutEntry, NightscoutTreatment } from '../types/nightscout';

interface AIMealAnalysisProps {
  readings: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  manualRefresh?: boolean;
}

type MealDetailsLike = Record<string, unknown> & {
  executiveSummary?: unknown;
  safetyFlags?: unknown;
  actionPlan7Days?: unknown;
  dataQualityNotes?: unknown;
};

const AIMealAnalysis: React.FC<AIMealAnalysisProps> = ({ readings, treatments, manualRefresh = false }) => {
  const { isModern, isPremium } = useDesignMode();
  const theme = useTheme();
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [mealTiming, setMealTiming] = useState<unknown[]>([]);
  const [details, setDetails] = useState<unknown | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string>('');
  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);

  useEffect(() => {
    // Create a hash of the current data to compare
    const dataHash = `${readings.length}-${treatments.length}`;
    
    // Only analyze meals if:
    // 1. We haven't loaded anything yet, OR
    // 2. Manual refresh was requested, OR
    // 3. The data has changed AND we don't have any insights yet
    const shouldAnalyze = 
      !initialLoadDone || 
      manualRefresh || 
      (dataHash !== lastAnalyzedData && insights.length === 0);
    
    if (shouldAnalyze && readings?.length > 0 && treatments?.length > 0) {
      analyzeMeals(dataHash);
    }
  }, [readings, treatments, manualRefresh]);

  const analyzeMeals = async (dataHash: string) => {
    if (!readings || readings.length === 0 || !treatments || treatments.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiService.analyzeMealPatterns(readings, treatments);
      
      if (result) {
        setInsights(result.insights);
        setRecommendations(result.recommendations);
        setMealTiming(result.mealTiming);
        setDetails((result as { details?: unknown }).details ?? null);
        setLastAnalyzedData(dataHash);
        setInitialLoadDone(true);
      } else {
        setError('Unable to generate meal pattern analysis at this time.');
      }
    } catch (err) {
      console.error('Error analyzing meal patterns:', err);
      setError('An error occurred while analyzing your meal patterns.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    // Premium Design with Advanced Effects
    if (isPremium) {
      return (
        <Paper 
          elevation={0}
          sx={{ 
            p: 4,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(90deg, #f97316 0%, #ea580c 100%)`,
            }
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cookie size={24} color="#ffffff" />
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              AI Meal Pattern Analysis
            </Typography>
          </Box>

          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            py={6}
            sx={{
              background: `radial-gradient(circle at center, #f9731608 0%, transparent 70%)`,
              borderRadius: 2,
            }}
          >
            <Box sx={{ position: 'relative', mb: 3 }}>
              <CircularProgress 
                size={64} 
                thickness={3}
                sx={{ 
                  color: '#f97316',
                  filter: 'drop-shadow(0 0 8px #f97316)',
                }} 
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                🍽️
              </Box>
            </Box>
            
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                mb: 1,
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.text.secondary} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              }}
            >
              Analyzing your meal patterns...
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              🔍 Our AI is processing your carb and glucose data for insights
            </Typography>
          </Box>
        </Paper>
      );
    }

    // Modern Material UI Design
    if (isModern) {
      return (
        <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <Cookie size={24} color="#f97316" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Meal Pattern Analysis
            </Typography>
          </Box>
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} sx={{ mb: 2, color: '#f97316' }} />
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Analyzing your meal patterns...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} textAlign="center">
              Our AI is processing your carb and glucose data
            </Typography>
          </Box>
        </Paper>
      );
    }

    // Classic Tailwind Design
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8 text-orange-600 dark:text-orange-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your meal patterns...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Our AI is processing your carb and glucose data</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Premium Design with Advanced Effects
    if (isPremium) {
      return (
        <Paper 
          elevation={0}
          sx={{ 
            p: 4,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
            }
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cookie size={24} color="#ffffff" />
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              AI Meal Pattern Analysis
            </Typography>
          </Box>

          <Alert 
            severity="error" 
            variant="outlined" 
            sx={{ 
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.error.main}08 0%, ${theme.palette.error.main}05 100%)`,
              border: `1px solid ${theme.palette.error.main}30`,
            }}
            icon={<AlertTriangle size={20} />}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
              {error}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              💡 Please try again later or check your API configuration.
            </Typography>
          </Alert>
        </Paper>
      );
    }

    // Modern Material UI Design
    if (isModern) {
      return (
        <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <Cookie size={24} color="#f97316" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Meal Pattern Analysis
            </Typography>
          </Box>
          <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {error}
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              Please try again later or check your API configuration.
            </Typography>
          </Alert>
        </Paper>
      );
    }

    // Classic Tailwind Design
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
        <div className="flex items-center mb-4">
          <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
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

  const detailsLike: MealDetailsLike | null = details && typeof details === 'object' ? (details as MealDetailsLike) : null;

  if (insights.length === 0 && recommendations.length === 0) {
    return null;
  }

  // Premium Design with Advanced Effects
  if (isPremium) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, #f97316 0%, #ea580c 100%)`,
          }
        }}
      >
        <Box sx={{ p: 4 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cookie size={24} color="#ffffff" />
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              AI Meal Pattern Analysis
            </Typography>
          </Box>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3} sx={{ mb: 4 }}>
            {insights.length > 0 && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  background: `linear-gradient(135deg, #f9731608 0%, #ea580c08 100%)`,
                  borderRadius: 2,
                  border: '1px solid #f9731620',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: `linear-gradient(180deg, #f97316 0%, #ea580c 100%)`,
                    borderRadius: '0 2px 2px 0',
                  }
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Lightbulb size={20} color="#f97316" />
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 600, 
                      background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    Meal Insights
                  </Typography>
                </Box>
                <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                  {insights.map((insight, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <Box 
                          sx={{ 
                            width: 4, 
                            height: 4, 
                            borderRadius: '50%', 
                            background: `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`,
                            boxShadow: '0 0 4px #f9731640',
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={insight}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          sx: { 
                            color: '#ea580c',
                            fontWeight: 500,
                            lineHeight: 1.5
                          }
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
                  p: 3, 
                  background: `linear-gradient(135deg, ${theme.palette.success.main}08 0%, ${theme.palette.success.dark}08 100%)`,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.success.main}20`,
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: `linear-gradient(180deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    borderRadius: '0 2px 2px 0',
                  }
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Lightbulb size={20} color={theme.palette.success.main} />
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 600, 
                      background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    Recommendations
                  </Typography>
                </Box>
                <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                  {recommendations.map((recommendation, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <Box 
                          sx={{ 
                            width: 4, 
                            height: 4, 
                            borderRadius: '50%', 
                            background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                            boxShadow: `0 0 4px ${theme.palette.success.main}40`,
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={recommendation}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          sx: { 
                            color: theme.palette.success.dark,
                            fontWeight: 500,
                            lineHeight: 1.5
                          }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {detailsLike && (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}20`,
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AlertTriangle size={20} color={theme.palette.warning.main} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  More details
                </Typography>
              </Box>

              {typeof detailsLike.executiveSummary === 'string' && detailsLike.executiveSummary.trim().length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  {detailsLike.executiveSummary}
                </Typography>
              )}

              {Array.isArray(detailsLike.safetyFlags) && detailsLike.safetyFlags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    Safety flags
                  </Typography>
                  <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                    {detailsLike.safetyFlags
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                      .map((item, idx: number) => (
                      <ListItem key={idx} sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: theme.palette.warning.main }} />
                        </ListItemIcon>
                        <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {Array.isArray(detailsLike.actionPlan7Days) && detailsLike.actionPlan7Days.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    7-day action plan
                  </Typography>
                  <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                    {detailsLike.actionPlan7Days
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                      .map((item, idx: number) => (
                      <ListItem key={idx} sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: theme.palette.text.secondary }} />
                        </ListItemIcon>
                        <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {Array.isArray(detailsLike.dataQualityNotes) && detailsLike.dataQualityNotes.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    Data quality notes
                  </Typography>
                  <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                    {detailsLike.dataQualityNotes
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                      .map((item, idx: number) => (
                      <ListItem key={idx} sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: theme.palette.divider }} />
                        </ListItemIcon>
                        <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Paper>
          )}

          {mealTiming.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 2, 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.text.secondary} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                }}
              >
                <Clock size={20} />
                Optimal Meal Timing
              </Typography>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(auto-fit, minmax(250px, 1fr))' }} gap={2}>
                {mealTiming.map((timing, index) => (
                  <Card 
                    key={index} 
                    elevation={0}
                    sx={{ 
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.secondary.main}08 100%)`,
                      border: `1px solid ${theme.palette.primary.main}20`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: `0 4px 12px ${theme.palette.primary.main}20`,
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          mb: 1,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                        }}
                      >
                        {timing.mealType || timing.timeOfDay || 'Meal'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
                        ⏰ {timing.startHour}:00 - {timing.endHour}:00
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                        {timing.recommendation}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          <Box 
            sx={{ 
              pt: 3, 
              borderTop: `1px solid ${theme.palette.divider}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
              borderRadius: 2,
              p: 2.5,
              border: `1px solid ${theme.palette.divider}10`,
            }}
          >
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                fontStyle: 'italic',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              🤖 This analysis is generated by AI based on your meal and glucose data. Always consult with your healthcare provider before making changes.
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  // Modern Material UI Design
  if (isModern) {
    return (
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <Cookie size={24} color="#f97316" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Meal Pattern Analysis
            </Typography>
          </Box>

          {details && (
            <Box sx={{ mb: 3 }}>
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>More details</summary>
                <Box sx={{ mt: 2 }}>
                  {details.executiveSummary && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {details.executiveSummary}
                    </Typography>
                  )}
                  {Array.isArray(details.actionPlan7Days) && details.actionPlan7Days.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        7-day action plan
                      </Typography>
                      <List dense>
                        {details.actionPlan7Days.map((item: string, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0, py: 0.25 }}>
                            <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  {Array.isArray(details.dataQualityNotes) && details.dataQualityNotes.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        Data quality notes
                      </Typography>
                      <List dense>
                        {details.dataQualityNotes.map((item: string, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0, py: 0.25 }}>
                            <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              </details>
            </Box>
          )}

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3} sx={{ mb: 3 }}>
            {insights.length > 0 && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  backgroundColor: alpha('#f97316', 0.08),
                  borderRadius: 2
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Lightbulb size={20} color="#f97316" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ea580c' }}>
                    Meal Insights
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
                            backgroundColor: '#f97316' 
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={insight}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          color: '#ea580c'
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
                  backgroundColor: alpha(theme.palette.success.main, 0.08),
                  borderRadius: 2
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Cookie size={20} color={theme.palette.success.main} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                    Meal Recommendations
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
                            backgroundColor: theme.palette.success.main 
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={recommendation}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          color: theme.palette.success.dark
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {mealTiming.length > 0 && (
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Clock size={20} color={theme.palette.info.main} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Optimal Meal Timing
                </Typography>
              </Box>
              
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
                {mealTiming.map((timing, index) => (
                  <Card 
                    key={index}
                    elevation={0} 
                    sx={{ 
                      backgroundColor: alpha(theme.palette.info.main, 0.08),
                      borderRadius: 2
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.info.main, mb: 1 }}>
                        {timing.timeOfDay}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {timing.startHour}:00 - {timing.endHour}:00
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {timing.recommendation}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
              <Typography variant="caption">
                This analysis is generated by AI based on your meal and glucose data. Always consult with your healthcare provider before making changes to your meal timing or insulin dosing.
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
      <div className="flex items-center mb-4">
        <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Meal Pattern Analysis</h3>
      </div>

      {details && (
        <div className="mb-6">
          <details className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">More details</summary>
            <div className="mt-3 space-y-4">
              {details.executiveSummary && (
                <p className="text-sm text-gray-700 dark:text-gray-300">{details.executiveSummary}</p>
              )}
              {Array.isArray(details.actionPlan7Days) && details.actionPlan7Days.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">7-day action plan</h5>
                  <ul className="space-y-1">
                    {details.actionPlan7Days.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(details.dataQualityNotes) && details.dataQualityNotes.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Data quality notes</h5>
                  <ul className="space-y-1">
                    {details.dataQualityNotes.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {insights.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Lightbulb className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
              <h4 className="font-medium text-orange-900 dark:text-orange-100">Meal Insights</h4>
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-orange-800 dark:text-orange-200 text-sm">• {insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {recommendations.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Cookie className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              <h4 className="font-medium text-green-900 dark:text-green-100">Meal Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-800 dark:text-green-200 text-sm">• {recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {mealTiming.length > 0 && (
        <div>
          <div className="flex items-center mb-3">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Optimal Meal Timing</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mealTiming.map((timing, index) => (
              <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">{timing.timeOfDay}</h5>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {timing.startHour}:00 - {timing.endHour}:00
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {timing.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This analysis is generated by AI based on your meal and glucose data. Always consult with your healthcare provider before making changes to your meal timing or insulin dosing.
        </p>
      </div>
    </div>
  );
};

export default AIMealAnalysis;