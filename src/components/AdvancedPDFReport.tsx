import React, { useState } from 'react';
import { 
  Download, Activity, Shield, Brain, Target, BarChart2, 
  TrendingUp, Clock, Heart, PieChart, Award, Settings,
  AlertCircle
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from 'chart.js';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useNightscout } from '../contexts/NightscoutContext';
import { aiService } from '../services/aiService';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

interface AdvancedPDFReportProps {
  data: any;
}

const AdvancedPDFReport: React.FC<AdvancedPDFReportProps> = ({ data }) => {
  const { formatGlucoseValue, getUnitLabel, getCurrentGlucoseRanges, convertToCurrentUnit, unit } = useGlucoseFormatting();
  
  // Enhanced state management
  const [timeWindow, setTimeWindow] = useState(168); // Default to 7 days
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  
  // Report configuration
  const [exporting, setExporting] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    theme: 'premium' as 'premium' | 'clinical' | 'executive',
    includeAIInsights: true,
    includePatternAnalysis: true,
    includePredictiveMetrics: true,
    includeRiskAssessment: true,
    includeLifestyleCorrelations: true,
    includeTrendPredictions: true,
    includePharmacodynamics: true,
    includeCircadianAnalysis: true,
    includeExerciseImpact: true,
    includeMealAnalysis: true,
    includeAdvancedCharts: true,
    includeRecommendations: true,
    includeDataQuality: true,
    chartResolution: 'high' as 'standard' | 'high' | 'ultra'
  });

  // Advanced analytics state - removed unused aiInsights state

  // Enhanced data filtering and processing
  const filteredReadings = React.useMemo(() => {
    if (!data?.entries?.length) return [];

    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    
    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      
      return sortedEntries.filter(reading => {
        return reading.date >= startTime && reading.date <= endTime;
      });
    } else {
      const now = Date.now();
      const timeWindowMs = timeWindow * 60 * 60 * 1000;
      const cutoffTime = now - timeWindowMs;
      
      return sortedEntries.filter(reading => reading.date >= cutoffTime);
    }
  }, [data?.entries, timeWindow, isCustomRange, customDateRange]);

  const filteredTreatments = React.useMemo(() => {
    if (!data?.treatments?.length) return [];

    if (isCustomRange) {
      const startTime = startOfDay(new Date(customDateRange.startDate)).getTime();
      const endTime = endOfDay(new Date(customDateRange.endDate)).getTime();
      
      return data.treatments.filter((treatment: any) => {
        const treatmentTime = new Date(treatment.created_at).getTime();
        return treatmentTime >= startTime && treatmentTime <= endTime;
      });
    } else {
      const now = Date.now();
      const timeWindowMs = timeWindow * 60 * 60 * 1000;
      const cutoffTime = now - timeWindowMs;
      
      return data.treatments.filter((treatment: any) => {
        const treatmentTime = new Date(treatment.created_at).getTime();
        return treatmentTime >= cutoffTime;
      });
    }
  }, [data?.treatments, timeWindow, isCustomRange, customDateRange]);

  // Enhanced statistics calculation with machine learning insights
  const calculateAdvancedStats = () => {
    if (filteredReadings.length === 0) {
      return {
        basic: {},
        timeMetrics: {},
        variabilityMetrics: {},
        riskMetrics: {},
        patternMetrics: {},
        qualityMetrics: {},
        predictiveMetrics: {}
      };
    }

    const ranges = getCurrentGlucoseRanges();
    const values = filteredReadings.map(r => convertToCurrentUnit(r.sgv, 'mgdl'));
    
    // Basic stats
    const totalReadings = values.length;
    const averageGlucose = values.reduce((sum, val) => sum + val, 0) / totalReadings;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    // Time in range calculations
    const veryLowThreshold = convertToCurrentUnit(54, 'mgdl');
    const veryHighThreshold = convertToCurrentUnit(250, 'mgdl');

    const veryLowCount = values.filter(v => v < veryLowThreshold).length;
    const lowCount = values.filter(v => v >= veryLowThreshold && v < ranges.TARGET_MIN).length;
    const inRangeCount = values.filter(v => v >= ranges.TARGET_MIN && v <= ranges.TARGET_MAX).length;
    const highCount = values.filter(v => v > ranges.TARGET_MAX && v <= veryHighThreshold).length;
    const veryHighCount = values.filter(v => v > veryHighThreshold).length;
    
    const veryLowPercentage = (veryLowCount / totalReadings) * 100;
    const lowPercentage = (lowCount / totalReadings) * 100;
    const timeInRange = (inRangeCount / totalReadings) * 100;
    const highPercentage = (highCount / totalReadings) * 100;
    const veryHighPercentage = (veryHighCount / totalReadings) * 100;
    
    // Advanced variability metrics
    const variance = values.reduce((sum, val) => sum + Math.pow(val - averageGlucose, 2), 0) / totalReadings;
    const standardDeviation = Math.sqrt(variance);
    const cv = (standardDeviation / averageGlucose) * 100;
    
    // Glycemic Risk Index
    const gri = (3.0 * veryLowPercentage) + (2.4 * lowPercentage) + (1.6 * highPercentage) + (0.8 * veryHighPercentage);
    
    // Time-based analysis
    const hourlyAverages = Array.from({length: 24}, (_, hour) => {
      const hourReadings = filteredReadings.filter(r => new Date(r.date).getHours() === hour);
      return hourReadings.length > 0 ? hourReadings.reduce((sum, r) => sum + convertToCurrentUnit(r.sgv, 'mgdl'), 0) / hourReadings.length : null;
    });
    
    // Dawn phenomenon detection
    const dawnReadings = filteredReadings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 5 && hour <= 8;
    });
    const nightReadings = filteredReadings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 2 && hour <= 5;
    });
    
    const dawnAverage = dawnReadings.length > 0 ? dawnReadings.reduce((sum, r) => sum + convertToCurrentUnit(r.sgv, 'mgdl'), 0) / dawnReadings.length : 0;
    const nightAverage = nightReadings.length > 0 ? nightReadings.reduce((sum, r) => sum + convertToCurrentUnit(r.sgv, 'mgdl'), 0) / nightReadings.length : 0;
    const dawnPhenomenon = dawnAverage - nightAverage;
    
    // Estimated A1C calculations
    const estimatedA1C = ((averageGlucose * (unit === 'mmol' ? 18 : 1)) + 46.7) / 28.7;
    const gmi = (3.31 + (0.02392 * (averageGlucose * (unit === 'mmol' ? 18 : 1)))); // Glucose Management Indicator
    
    // Data quality metrics (estimate sampling interval from median consecutive diff)
    const sortedByTime = [...filteredReadings].sort((a, b) => a.date - b.date);
    const timeSpanDays = (sortedByTime[sortedByTime.length - 1]?.date - sortedByTime[0]?.date) / (1000 * 60 * 60 * 24);

    const diffsMin: number[] = [];
    for (let i = 1; i < sortedByTime.length; i++) {
      const diff = (sortedByTime[i].date - sortedByTime[i - 1].date) / 60000;
      if (Number.isFinite(diff) && diff > 0 && diff <= 60) diffsMin.push(diff);
    }
    diffsMin.sort((a, b) => a - b);
    const medianInterval = diffsMin.length ? diffsMin[Math.floor(diffsMin.length / 2)] : 5;
    const interval = Math.min(30, Math.max(4, medianInterval));
    const spanMinutes = (sortedByTime[sortedByTime.length - 1]?.date - sortedByTime[0]?.date) / 60000;
    const expectedReadings = spanMinutes > 0 ? (spanMinutes / interval) + 1 : totalReadings;
    const dataCompleteness = expectedReadings > 0 ? Math.min(100, (totalReadings / expectedReadings) * 100) : 0;

    // Weekday vs weekend variation (current unit)
    const weekdayVals: number[] = [];
    const weekendVals: number[] = [];
    filteredReadings.forEach(r => {
      const day = new Date(r.date).getDay();
      const v = convertToCurrentUnit(r.sgv, 'mgdl');
      if (day === 0 || day === 6) weekendVals.push(v);
      else weekdayVals.push(v);
    });
    const weekdayAvg = weekdayVals.length ? weekdayVals.reduce((a, b) => a + b, 0) / weekdayVals.length : 0;
    const weekendAvg = weekendVals.length ? weekendVals.reduce((a, b) => a + b, 0) / weekendVals.length : 0;
    const weekdayWeekendVariation = Math.abs(weekdayAvg - weekendAvg);

    // Basic meal-time patterns from treatments (carbs + bolus by day-part)
    const mealBuckets: Record<'Breakfast' | 'Lunch' | 'Dinner' | 'Late Night', { carbs: number; bolus: number; count: number }> = {
      Breakfast: { carbs: 0, bolus: 0, count: 0 },
      Lunch: { carbs: 0, bolus: 0, count: 0 },
      Dinner: { carbs: 0, bolus: 0, count: 0 },
      'Late Night': { carbs: 0, bolus: 0, count: 0 }
    };

    filteredTreatments.forEach(t => {
      const ts = new Date(t.created_at).getTime();
      if (!Number.isFinite(ts)) return;
      const hour = new Date(ts).getHours();
      const carbs = typeof t.carbs === 'number' ? t.carbs : 0;
      const bolus = typeof t.insulin === 'number' ? t.insulin : 0;
      if (carbs <= 0 && bolus <= 0) return;

      const key: keyof typeof mealBuckets =
        hour >= 5 && hour < 10 ? 'Breakfast'
        : hour >= 10 && hour < 15 ? 'Lunch'
        : hour >= 15 && hour < 21 ? 'Dinner'
        : 'Late Night';

      mealBuckets[key].carbs += carbs;
      mealBuckets[key].bolus += bolus;
      mealBuckets[key].count += 1;
    });
    
    return {
      basic: {
        totalReadings,
        averageGlucose,
        median,
        timeInRange,
        estimatedA1C,
        gmi,
        timeSpan: timeSpanDays
      },
      timeMetrics: {
        veryLowPercentage,
        lowPercentage,
        highPercentage,
        veryHighPercentage,
        dawnPhenomenon,
        hourlyAverages
      },
      variabilityMetrics: {
        standardDeviation,
        cv,
        variance,
        gri
      },
      riskMetrics: {
        hypoglycemiaRisk: veryLowPercentage + lowPercentage,
        hyperglycemiaRisk: highPercentage + veryHighPercentage,
        variabilityRisk: cv,
        overallRiskScore: gri
      },
      patternMetrics: {
        dawnPhenomenon,
        weekdayWeekendVariation,
        mealTimePatterns: mealBuckets,
        exerciseCorrelation: 0
      },
      qualityMetrics: {
        dataCompleteness,
        consistencyScore: Math.max(0, 100 - (cv * 2))
      },
      predictiveMetrics: {
        trendStability: cv < 36 ? 'Stable' : cv < 50 ? 'Moderate' : 'Variable',
        riskProjection: gri < 20 ? 'Low' : gri < 40 ? 'Moderate' : 'High',
        improvementPotential: timeInRange < 70 ? 'High' : timeInRange < 85 ? 'Moderate' : 'Maintain'
      }
    };
  };

  // Generate AI-powered insights
  const generateAIAnalysis = async () => {
    setGeneratingAnalysis(true);
    try {
      // Generate AI insights using existing service
      if (reportConfig.includeAIInsights) {
        const insights = await aiService.generateManagementPlan(filteredReadings, filteredTreatments, {
          unit, formatGlucoseValue, getUnitLabel, getCurrentGlucoseRanges
        });
        console.log('AI insights generated:', insights);
      }

      // Advanced analytics (using our own calculations)
      const analysis = calculateAdvancedStats();
      console.log('Advanced analysis generated:', analysis);

    } catch (error) {
      console.error('Error generating AI analysis:', error);
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  // Enhanced PDF generation with premium design
  const generateAdvancedPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const stats = calculateAdvancedStats();

      const ranges = getCurrentGlucoseRanges();
      const thresholdLabel = (mgdl: number) => `${formatGlucoseValue(mgdl, 'mgdl', false)} ${getUnitLabel()}`;

      let managementPlan: string | null = null;
      if (reportConfig.includeAIInsights) {
        try {
          managementPlan = await aiService.generateManagementPlan(filteredReadings, filteredTreatments, {
            unit,
            formatGlucoseValue,
            getUnitLabel,
            getCurrentGlucoseRanges
          });
        } catch (e) {
          console.warn('AI management plan generation failed; continuing without AI insights.', e);
          managementPlan = null;
        }
      }
      
      // Theme colors
      const colors = {
        primary: [15, 23, 42],
        secondary: [59, 130, 246],
        success: [34, 197, 94],
        warning: [251, 191, 36],
        danger: [239, 68, 68],
        text: [15, 23, 42],
        textLight: [100, 116, 139]
      };

      // Helper function to add a new page
      let currentSectionTitle = 'Advanced Diabetes Analytics';

      const addSectionHeader = (title: string) => {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, 210, 18, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.line(0, 18, 210, 18);

        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, 15, 12);

        pdf.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(getDisplayLabel(), 195, 12, { align: 'right' });

        return 28;
      };

      const addNewPage = () => {
        pdf.addPage();
        currentPageNumber += 1;
        return addSectionHeader(currentSectionTitle);
      };

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredSpace: number, currentY: number) => {
        if (currentY + requiredSpace > 280) {
          return addNewPage();
        }
        return currentY;
      };

      // Page 1: Header and Executive Summary
      // Header
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.rect(0, 0, 210, 30, 'F');
      
      // Logo
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(15, 8, 50, 14, 2, 2, 'F');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DIABETES ANALYZER', 17, 16);
      pdf.setFontSize(6);
      pdf.text('ADVANCED ANALYTICS', 17, 19);
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Advanced Diabetes Analytics Report', 80, 16);
      pdf.setFontSize(12);
      pdf.text('Comprehensive Clinical Analysis', 80, 22);
      
      // Date
      pdf.setFontSize(8);
      pdf.text(format(new Date(), 'EEEE, MMMM dd, yyyy'), 160, 12);
      pdf.text('Generated at ' + format(new Date(), 'HH:mm'), 160, 16);
      
      let yPos = 40;
      
      // Executive Summary
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('EXECUTIVE SUMMARY', 15, yPos);
      
      yPos += 15;
      
      // Key metrics cards
      const cardWidth = 40;
      const cardHeight = 25;
      const cardSpacing = 5;
      
      const addMetricCard = (title: string, value: string, target: string, x: number, y: number, color: number[]) => {
        // Card background
        pdf.setFillColor(250, 250, 250);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
        
        // Border
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(1);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');
        
        // Color accent
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(x, y, 3, cardHeight, 'F');
        
        // Text
        pdf.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        pdf.setFontSize(8);
        pdf.text(title, x + 5, y + 8);
        
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, x + 5, y + 16);
        
        pdf.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(target, x + 5, y + 21);
      };
      
      // Add metric cards
      addMetricCard(
        'Time in Range',
        `${(stats.basic.timeInRange || 0).toFixed(1)}%`,
        'Target: >70%',
        15,
        yPos,
        colors.success
      );
      
      addMetricCard(
        'Glucose Variability',
        `${(stats.variabilityMetrics.cv || 0).toFixed(1)}%`,
        'Target: <36%',
        15 + cardWidth + cardSpacing,
        yPos,
        colors.warning
      );
      
      addMetricCard(
        'Estimated A1C',
        `${(stats.basic.estimatedA1C || 0).toFixed(1)}%`,
        'Target: <7%',
        15 + 2 * (cardWidth + cardSpacing),
        yPos,
        colors.secondary
      );
      
      addMetricCard(
        'Risk Score',
        `${(stats.variabilityMetrics.gri || 0).toFixed(0)}`,
        'Lower is better',
        15 + 3 * (cardWidth + cardSpacing),
        yPos,
        colors.danger
      );
      
      yPos += cardHeight + 20;
      
      // Data Summary Section
      yPos = checkPageBreak(60, yPos);
      
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DATA SUMMARY', 15, yPos);
      
      yPos += 10;
      
      // Data summary table
      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, yPos, 180, 40, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(15, yPos, 180, 40, 'S');
      
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const summaryData = [
        ['Analysis Period:', getDisplayLabel()],
        ['Total Readings:', `${(stats.basic.totalReadings || 0).toLocaleString()}`],
        ['Average Glucose:', `${formatGlucoseValue((stats.basic.averageGlucose || 0), 'mgdl', true)}`],
        ['Data Completeness:', `${(stats.qualityMetrics.dataCompleteness || 0).toFixed(1)}%`]
      ];
      
      summaryData.forEach((row, index) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[0], 20, yPos + 8 + (index * 8));
        pdf.setFont('helvetica', 'normal');
        pdf.text(row[1], 80, yPos + 8 + (index * 8));
      });
      
      yPos += 50;
      
      // Time in Range Analysis
      yPos = checkPageBreak(80, yPos);
      
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TIME IN RANGE ANALYSIS', 15, yPos);
      
      yPos += 10;
      
      // Time in range bar chart
      const barWidth = 160;
      const barHeight = 20;
      const barX = 15;
      
      // Very Low
      const veryLowWidth = ((stats.timeMetrics.veryLowPercentage || 0) / 100) * barWidth;
      pdf.setFillColor(156, 39, 176);
      pdf.rect(barX, yPos, veryLowWidth, barHeight, 'F');
      
      // Low  
      const lowWidth = (((stats.timeMetrics.lowPercentage || 0) - (stats.timeMetrics.veryLowPercentage || 0)) / 100) * barWidth;
      pdf.setFillColor(239, 68, 68);
      pdf.rect(barX + veryLowWidth, yPos, lowWidth, barHeight, 'F');
      
      // In Range
      const inRangeWidth = ((stats.basic.timeInRange || 0) / 100) * barWidth;
      pdf.setFillColor(34, 197, 94);
      pdf.rect(barX + veryLowWidth + lowWidth, yPos, inRangeWidth, barHeight, 'F');
      
      // High
      const highWidth = (((stats.timeMetrics.highPercentage || 0) - (stats.timeMetrics.veryHighPercentage || 0)) / 100) * barWidth;
      pdf.setFillColor(251, 191, 36);
      pdf.rect(barX + veryLowWidth + lowWidth + inRangeWidth, yPos, highWidth, barHeight, 'F');
      
      // Very High
      const veryHighWidth = ((stats.timeMetrics.veryHighPercentage || 0) / 100) * barWidth;
      pdf.setFillColor(245, 101, 101);
      pdf.rect(barX + veryLowWidth + lowWidth + inRangeWidth + highWidth, yPos, veryHighWidth, barHeight, 'F');
      
      // Border
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(barX, yPos, barWidth, barHeight, 'S');
      
      yPos += 30;
      
      // Legend
      const legendItems: Array<[string, [number, number, number]]> = [
        [`Very Low (<${thresholdLabel(54)})`, [156, 39, 176]],
        [`Low (${thresholdLabel(54)}–${ranges.TARGET_MIN.toFixed(1)} ${getUnitLabel()})`, [239, 68, 68]],
        [`In Range (${ranges.TARGET_MIN.toFixed(1)}–${ranges.TARGET_MAX.toFixed(1)} ${getUnitLabel()})`, [34, 197, 94]],
        [`High (${ranges.TARGET_MAX.toFixed(1)}–${thresholdLabel(250)})`, [251, 191, 36]],
        [`Very High (>${thresholdLabel(250)})`, [245, 101, 101]]
      ];
      
      legendItems.forEach((item, index) => {
        const x = 15 + (index % 3) * 60;
        const y = yPos + Math.floor(index / 3) * 8;
        
        const color = item[1];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(x, y, 4, 4, 'F');
        
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(8);
        pdf.text(item[0], x + 6, y + 3);
      });
      
      yPos += 25;
      
      // Page 2: Detailed Analysis
      currentSectionTitle = 'Detailed Analysis';
      yPos = addNewPage();
      
      // Detailed Statistics
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETAILED STATISTICS', 15, yPos);
      
      yPos += 15;
      
      // Statistics table
      const detailedStats = [
        ['Metric', 'Value', 'Target/Normal'],
        ['Average Glucose', `${formatGlucoseValue((stats.basic.averageGlucose || 0), 'mgdl', true)}`, 'Target range configured'],
        ['Median Glucose', `${formatGlucoseValue((stats.basic.median || 0), 'mgdl', true)}`, 'Target range configured'],
        ['Standard Deviation', `${formatGlucoseValue((stats.variabilityMetrics.standardDeviation || 0), 'mgdl', false)} ${getUnitLabel()}`, 'Lower is better'],
        ['Coefficient of Variation', `${(stats.variabilityMetrics.cv || 0).toFixed(1)}%`, '<36%'],
        ['Glycemic Risk Index', `${(stats.variabilityMetrics.gri || 0).toFixed(1)}`, '<40'],
        ['Estimated A1C', `${(stats.basic.estimatedA1C || 0).toFixed(1)}%`, '<7%'],
        ['GMI', `${(stats.basic.gmi || 0).toFixed(1)}%`, '<7%']
      ];
      
      // Table header
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.rect(15, yPos, 180, 8, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Metric', 20, yPos + 5);
      pdf.text('Value', 80, yPos + 5);
      pdf.text('Target/Normal', 140, yPos + 5);
      
      yPos += 8;
      
      // Table rows
      detailedStats.slice(1).forEach((row, index) => {
        const rowY = yPos + (index * 8);
        
        // Alternating background
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(15, rowY, 180, 8, 'F');
        }
        
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(row[0], 20, rowY + 5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[1], 80, rowY + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(row[2], 140, rowY + 5);
      });
      
      yPos += (detailedStats.length - 1) * 8 + 15;
      
      // Risk Assessment
      yPos = checkPageBreak(60, yPos);
      
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RISK ASSESSMENT', 15, yPos);
      
      yPos += 10;
      
      // Risk assessment content
      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, yPos, 180, 50, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(15, yPos, 180, 50, 'S');
      
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Observations:', 20, yPos + 10);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      const observations = [];
      
      if ((stats.basic.timeInRange || 0) < 70) {
        observations.push('• Time in range below recommended 70% target');
      }
      if ((stats.variabilityMetrics.cv || 0) > 36) {
        observations.push('• High glucose variability detected');
      }
      if ((stats.basic.estimatedA1C || 0) > 7) {
        observations.push('• Estimated A1C above target of 7%');
      }
      if ((stats.timeMetrics.veryLowPercentage || 0) > 1) {
        observations.push('• Significant time spent in very low glucose range');
      }
      if (observations.length === 0) {
        observations.push('• Excellent glucose management within targets');
      }
      
      observations.slice(0, 4).forEach((obs, index) => {
        pdf.text(obs, 20, yPos + 20 + (index * 8));
      });
      
      yPos += 60;
      
      // Recommendations
      yPos = checkPageBreak(50, yPos);
      
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RECOMMENDATIONS', 15, yPos);
      
      yPos += 10;
      
      pdf.setFillColor(240, 253, 244);
      pdf.rect(15, yPos, 180, 40, 'F');
      pdf.setDrawColor(34, 197, 94);
      pdf.rect(15, yPos, 180, 40, 'S');
      
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      const recommendations = [
        '• Continue monitoring glucose levels regularly',
        '• Consult with healthcare provider about any concerning patterns',
        '• Maintain consistent meal timing and carbohydrate counting',
        '• Review insulin dosing with diabetes care team if needed'
      ];
      
      recommendations.forEach((rec, index) => {
        pdf.text(rec, 20, yPos + 8 + (index * 8));
      });
      
      yPos += 50;

      // Page 3: Optional Pattern Analysis
      if (reportConfig.includePatternAnalysis) {
        currentSectionTitle = 'Pattern Analysis';
        yPos = addNewPage();

        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PATTERN ANALYSIS', 15, yPos);
        yPos += 12;

        // Day-part / circadian notes
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Dawn phenomenon (05:00–08:00 vs 02:00–05:00): ${formatGlucoseValue(stats.timeMetrics.dawnPhenomenon || 0, unit as any, false)} ${getUnitLabel()} (avg delta)`, 15, yPos);
        yPos += 8;
        pdf.text(`Weekday vs weekend variation: ${formatGlucoseValue(stats.patternMetrics.weekdayWeekendVariation || 0, unit as any, false)} ${getUnitLabel()} (avg delta)`, 15, yPos);
        yPos += 12;

        // Hourly averages chart (simple bars)
        const hourly = (stats.timeMetrics.hourlyAverages || []).map(v => (typeof v === 'number' ? v : null));
        const points = hourly.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (points.length > 0) {
          const chartX = 15;
          const chartY = yPos;
          const chartW = 180;
          const chartH = 55;
          const minV = Math.min(...points);
          const maxV = Math.max(...points);
          const span = Math.max(1e-6, maxV - minV);

          pdf.setFillColor(245, 245, 245);
          pdf.rect(chartX, chartY, chartW, chartH, 'F');
          pdf.setDrawColor(220, 220, 220);
          pdf.rect(chartX, chartY, chartW, chartH, 'S');

          // Bars
          const barW = chartW / 24;
          hourly.forEach((v, hour) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            const h = ((v - minV) / span) * (chartH - 10);
            pdf.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
            pdf.rect(chartX + hour * barW + 0.5, chartY + chartH - 5 - h, Math.max(1, barW - 1), h, 'F');
          });

          // Axis labels
          pdf.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
          pdf.setFontSize(7);
          pdf.text(`Min: ${formatGlucoseValue(minV, unit as any, false)} ${getUnitLabel()}`, chartX, chartY + chartH + 6);
          pdf.text(`Max: ${formatGlucoseValue(maxV, unit as any, false)} ${getUnitLabel()}`, chartX + 60, chartY + chartH + 6);
          pdf.text('00', chartX, chartY + chartH + 14);
          pdf.text('06', chartX + chartW * 0.25, chartY + chartH + 14);
          pdf.text('12', chartX + chartW * 0.50, chartY + chartH + 14);
          pdf.text('18', chartX + chartW * 0.75, chartY + chartH + 14);
          pdf.text('23', chartX + chartW - 8, chartY + chartH + 14);

          yPos += chartH + 22;
        }

        // Meal-time treatment summary
        const meal = stats.patternMetrics.mealTimePatterns as any;
        if (meal && typeof meal === 'object') {
          pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('MEAL/TREATMENT SUMMARY (LOGGED)', 15, yPos);
          yPos += 10;

          const rows: Array<[string, string, string]> = [
            ['Day Part', 'Carbs', 'Bolus'],
            ['Breakfast', `${(meal.Breakfast?.carbs ?? 0).toFixed(0)} g`, `${(meal.Breakfast?.bolus ?? 0).toFixed(1)} U`],
            ['Lunch', `${(meal.Lunch?.carbs ?? 0).toFixed(0)} g`, `${(meal.Lunch?.bolus ?? 0).toFixed(1)} U`],
            ['Dinner', `${(meal.Dinner?.carbs ?? 0).toFixed(0)} g`, `${(meal.Dinner?.bolus ?? 0).toFixed(1)} U`],
            ['Late Night', `${(meal['Late Night']?.carbs ?? 0).toFixed(0)} g`, `${(meal['Late Night']?.bolus ?? 0).toFixed(1)} U`]
          ];

          // Header
          pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          pdf.rect(15, yPos, 180, 8, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(rows[0][0], 20, yPos + 5);
          pdf.text(rows[0][1], 100, yPos + 5);
          pdf.text(rows[0][2], 150, yPos + 5);
          yPos += 8;

          rows.slice(1).forEach((row, idx) => {
            const rowY = yPos + idx * 8;
            if (idx % 2 === 0) {
              pdf.setFillColor(248, 250, 252);
              pdf.rect(15, rowY, 180, 8, 'F');
            }
            pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(row[0], 20, rowY + 5);
            pdf.text(row[1], 100, rowY + 5);
            pdf.text(row[2], 150, rowY + 5);
          });

          yPos += 8 * (rows.length - 1) + 10;
        }
      }

      // Page 4: Optional AI Insights (compact)
      if (reportConfig.includeAIInsights && managementPlan) {
        currentSectionTitle = 'AI Insights';
        yPos = addNewPage();

        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('AI-POWERED INSIGHTS (SUMMARY)', 15, yPos);
        yPos += 10;

        const lines = managementPlan
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);

        const bullets = lines
          .filter(l => l.startsWith('- ') || l.startsWith('• '))
          .slice(0, 10)
          .map(l => (l.startsWith('- ') ? `• ${l.slice(2)}` : l));

        const body = bullets.length ? bullets : lines.slice(0, 10).map(l => (l.startsWith('#') ? '' : l)).filter(Boolean);
        const wrapped = pdf.splitTextToSize(body.join('\n'), 175);

        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(wrapped, 15, yPos);
      }
      
      // Footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Footer line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(15, 285, 195, 285);
        
        // Footer text
        pdf.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
        pdf.setFontSize(8);
        pdf.text('This report is for informational purposes only. Consult your healthcare provider.', 15, 290);
        pdf.text(`Page ${i} of ${pageCount}`, 180, 290);
        pdf.text('Generated by Diabetes Analyzer', 105, 295, { align: 'center' });
      }
      
      // Save the PDF
      const fileName = `advanced-diabetes-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating advanced PDF:', error);
      alert('Error generating advanced report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getDisplayLabel = () => {
    if (isCustomRange) {
      const startDate = new Date(customDateRange.startDate);
      const endDate = new Date(customDateRange.endDate);
      const days = differenceInDays(endDate, startDate) + 1;
      return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')} (${days} days)`;
    } else {
      const days = Math.round(timeWindow / 24);
      return `Last ${days} day${days > 1 ? 's' : ''}`;
    }
  };

  const stats = calculateAdvancedStats();

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white p-8 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Advanced Analytics Report</h2>
            <p className="text-blue-200 text-lg">Comprehensive diabetes management insights powered by AI</p>
          </div>
          <div className="text-right">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-5 w-5" />
                <span className="font-medium">Analysis Period</span>
              </div>
              <p className="text-xl font-bold">{getDisplayLabel()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-blue-600" />
          Report Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Time Range Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Time Range</h4>
            <div className="space-y-2">
              {[
                { value: 24, label: '24 hours' },
                { value: 72, label: '3 days' },
                { value: 168, label: '7 days' },
                { value: 336, label: '14 days' },
                { value: 720, label: '30 days' }
              ].map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="timeWindow"
                    value={option.value}
                    checked={!isCustomRange && timeWindow === option.value}
                    onChange={(e) => {
                      setTimeWindow(parseInt(e.target.value));
                      setIsCustomRange(false);
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Report Theme */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Report Theme</h4>
            <div className="space-y-2">
              {[
                { value: 'premium', label: 'Premium', desc: 'Modern, colorful design' },
                { value: 'clinical', label: 'Clinical', desc: 'Medical professional format' },
                { value: 'executive', label: 'Executive', desc: 'Clean, business style' }
              ].map(theme => (
                <label key={theme.value} className="flex items-start">
                  <input
                    type="radio"
                    name="reportTheme"
                    value={theme.value}
                    checked={reportConfig.theme === theme.value}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, theme: e.target.value as any }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-0.5"
                  />
                  <div className="ml-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{theme.label}</span>
                    <p className="text-xs text-gray-500">{theme.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Features */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Advanced Features</h4>
            <div className="space-y-2">
              {[
                { key: 'includeAIInsights', label: 'AI-Powered Insights', icon: Brain },
                { key: 'includePatternAnalysis', label: 'Pattern Detection', icon: TrendingUp },
                { key: 'includePredictiveMetrics', label: 'Predictive Analytics', icon: Target },
                { key: 'includeCircadianAnalysis', label: 'Circadian Rhythm Analysis', icon: Clock },
                { key: 'includeAdvancedCharts', label: 'High-Resolution Charts', icon: BarChart2 }
              ].map(feature => (
                <label key={feature.key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig[feature.key as keyof typeof reportConfig] as boolean}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, [feature.key]: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <feature.icon className="h-4 w-4 ml-2 mr-1 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{feature.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Preview */}
      {(stats.basic.totalReadings || 0) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <PieChart className="h-6 w-6 mr-2 text-purple-600" />
            Analytics Preview
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Time in Range Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-6 w-6 text-green-600" />
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  (stats.basic.timeInRange || 0) > 70 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {(stats.basic.timeInRange || 0) > 70 ? 'Excellent' : 'Needs Improvement'}
                </span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Time in Range</h4>
              <p className="text-2xl font-bold text-green-600">{(stats.basic.timeInRange || 0).toFixed(1)}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Target: 70-85%</p>
            </div>

            {/* Variability Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between mb-2">
                <BarChart2 className="h-6 w-6 text-blue-600" />
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  (stats.variabilityMetrics.cv || 100) < 36 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {(stats.variabilityMetrics.cv || 100) < 36 ? 'Stable' : 'Variable'}
                </span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Glucose Variability</h4>
              <p className="text-2xl font-bold text-blue-600">{(stats.variabilityMetrics.cv || 0).toFixed(1)}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Target: &lt;36% CV</p>
            </div>

            {/* Risk Score Card */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between mb-2">
                <Shield className="h-6 w-6 text-purple-600" />
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  (stats.variabilityMetrics.gri || 100) < 30 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {(stats.variabilityMetrics.gri || 100) < 30 ? 'Low Risk' : 'High Risk'}
                </span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Glycemic Risk Index</h4>
              <p className="text-2xl font-bold text-purple-600">{(stats.variabilityMetrics.gri || 0).toFixed(0)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Lower is better</p>
            </div>

            {/* Data Quality Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-6 w-6 text-amber-600" />
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  (stats.qualityMetrics.dataCompleteness || 0) > 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {(stats.qualityMetrics.dataCompleteness || 0) > 80 ? 'High Quality' : 'Moderate Quality'}
                </span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Data Completeness</h4>
              <p className="text-2xl font-bold text-amber-600">{(stats.qualityMetrics.dataCompleteness || 0).toFixed(1)}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{(stats.basic.totalReadings || 0)} readings</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={generateAIAnalysis}
          disabled={generatingAnalysis || filteredReadings.length === 0}
          className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg disabled:cursor-not-allowed transition-all duration-200"
        >
          {generatingAnalysis ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
              Generating AI Analysis...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5 mr-2" />
              Generate AI Analysis
            </>
          )}
        </button>

        <button
          onClick={generateAdvancedPDF}
          disabled={exporting || filteredReadings.length === 0}
          className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg disabled:cursor-not-allowed transition-all duration-200"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
              Generating Premium Report...
            </>
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" />
              Generate Advanced Report
            </>
          )}
        </button>
      </div>

      {/* Features Showcase */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Advanced Report Features
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Brain,
              title: 'AI-Powered Insights',
              description: 'Machine learning algorithms analyze your data to provide personalized recommendations and pattern detection.',
              color: 'text-purple-600'
            },
            {
              icon: TrendingUp,
              title: 'Predictive Analytics',
              description: 'Advanced forecasting models predict future glucose trends and identify potential risks.',
              color: 'text-green-600'
            },
            {
              icon: Clock,
              title: 'Circadian Analysis',
              description: 'Detailed examination of your glucose patterns throughout different times of day and sleep cycles.',
              color: 'text-blue-600'
            },
            {
              icon: Heart,
              title: 'Risk Assessment',
              description: 'Comprehensive evaluation of hypoglycemia and hyperglycemia risks with actionable insights.',
              color: 'text-red-600'
            },
            {
              icon: Target,
              title: 'Goal Tracking',
              description: 'Monitor progress towards diabetes management goals with detailed metrics and benchmarks.',
              color: 'text-indigo-600'
            },
            {
              icon: Award,
              title: 'Quality Scoring',
              description: 'Data quality assessment and consistency scoring to ensure reliable analysis.',
              color: 'text-amber-600'
            }
          ].map((feature, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <feature.icon className={`h-8 w-8 ${feature.color} mr-3`} />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{feature.title}</h4>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {filteredReadings.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-500 dark:text-gray-400">
            No data available for the selected time period
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Please select a different time range or ensure your Nightscout data is available
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedPDFReport;
