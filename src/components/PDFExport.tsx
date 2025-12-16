import React, { useState } from 'react';
import { FileText, Download, Calendar, Activity, Shield, Brain, Target, BarChart2, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';
import { toMmol } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import { useNightscout } from '../contexts/NightscoutContext';

interface PDFExportProps {
  data: any;
}

const PDFExport: React.FC<PDFExportProps> = ({ data }) => {
  const { formatGlucoseValue, getUnitLabel, getCurrentGlucoseRanges, convertToCurrentUnit, unit } = useGlucoseFormatting();
  const { fetchDataForDays, analysisPeriod } = useNightscout();
  const [timeWindow, setTimeWindow] = useState(168); // Default to 7 days
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fetchingMoreData, setFetchingMoreData] = useState(false);
  const [includeAdvancedStats, setIncludeAdvancedStats] = useState(true);
  const [includeTreatments, setIncludeTreatments] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeDistributionChart, setIncludeDistributionChart] = useState(true);
  const [includePersonalizedInsights, setIncludePersonalizedInsights] = useState(true);
  const [reportTheme, setReportTheme] = useState<'professional' | 'clinical' | 'personal'>('professional');

  // Get filtered readings based on time selection
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

  // Get filtered treatments based on time selection
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

  // Calculate statistics for the filtered period
  const calculateStats = () => {
    if (filteredReadings.length === 0) {
      return {
        totalReadings: 0,
        averageGlucose: 0,
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0,
        standardDeviation: 0,
        cv: 0,
        estimatedA1C: 0,
        veryHighPercentage: 0,
        veryLowPercentage: 0,
        highLowRatio: 0,
        dailyReadings: 0,
        readingGaps: 0,
        longestGap: 0,
        timeAbove250: 0,
        timeBelow54: 0,
        avgDailyHighs: 0,
        avgDailyLows: 0,
        dayNightVariation: 0,
        glucoseManagementIndicator: 0
      };
    }

    const glucoseValues = filteredReadings.map(r => r.sgv).filter(val => !isNaN(val) && val > 0);
    
    if (glucoseValues.length === 0) {
      console.warn('No valid glucose values found in filtered readings');
      return {
        totalReadings: filteredReadings.length,
        averageGlucose: 0,
        timeInRange: 0,
        highPercentage: 0,
        lowPercentage: 0,
        standardDeviation: 0,
        cv: 0,
        estimatedA1C: 0,
        veryHighPercentage: 0,
        veryLowPercentage: 0,
        highLowRatio: 0,
        dailyReadings: 0,
        readingGaps: 0,
        longestGap: 0,
        timeAbove250: 0,
        timeBelow54: 0,
        avgDailyHighs: 0,
        avgDailyLows: 0,
        dayNightVariation: 0,
        glucoseManagementIndicator: 0
      };
    }

    const mean = glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length;
    
    // Get current glucose ranges for calculations
    const currentRanges = getCurrentGlucoseRanges();
    
    // Calculate time in range
    let inRangeCount = 0;
    let highCount = 0;
    let lowCount = 0;
    let veryHighCount = 0;
    let veryLowCount = 0;
    let above250Count = 0;
    let below54Count = 0;

    glucoseValues.forEach(value => {
      const convertedValue = convertToCurrentUnit(value, 'mgdl');
      if (convertedValue >= currentRanges.TARGET_MIN && convertedValue <= currentRanges.TARGET_MAX) {
        inRangeCount++;
      } else if (convertedValue > currentRanges.TARGET_MAX) {
        highCount++;
        // Very high: >250 mg/dL or >13.9 mmol/L 
        const veryHighThreshold = convertToCurrentUnit(250, 'mgdl');
        if (convertedValue > veryHighThreshold) {
          veryHighCount++;
        }
        if (convertedValue > convertToCurrentUnit(250, 'mgdl')) { // >250 mg/dL converted to current unit
          above250Count++;
        }
      } else if (convertedValue < currentRanges.TARGET_MIN) {
        lowCount++;
        // Very low: <54 mg/dL or <3.0 mmol/L
        const veryLowThreshold = convertToCurrentUnit(54, 'mgdl');
        if (convertedValue < veryLowThreshold) {
          veryLowCount++;
        }
        if (convertedValue < convertToCurrentUnit(54, 'mgdl')) { // <54 mg/dL converted to current unit
          below54Count++;
        }
      }
    });

    // Calculate standard deviation
    const variance = glucoseValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / glucoseValues.length;
    const standardDeviation = Math.sqrt(variance);
    const cv = (standardDeviation / mean) * 100;

    // Calculate estimated A1C (IFCC formula)
    // Note: The formula requires glucose in mmol/L, so we always convert to mmol for this calculation
    const mmolAvg = toMmol(mean);
    const estimatedA1C = (mmolAvg + 2.59) / 1.59;

    // Calculate high/low ratio
    const highLowRatio = lowCount > 0 ? highCount / lowCount : highCount;

    // Calculate reading frequency
    const startDate = new Date(filteredReadings[0].date);
    const endDate = new Date(filteredReadings[filteredReadings.length - 1].date);
    const daysDiff = Math.max(1, differenceInDays(endDate, startDate));
    const dailyReadings = filteredReadings.length / daysDiff;

    // Calculate reading gaps
    let gaps = 0;
    let longestGap = 0;
    for (let i = 1; i < filteredReadings.length; i++) {
      const timeDiff = (filteredReadings[i].date - filteredReadings[i-1].date) / (1000 * 60); // in minutes
      if (timeDiff > 20) { // Gap defined as >20 minutes between readings
        gaps++;
        longestGap = Math.max(longestGap, timeDiff);
      }
    }

    // Calculate day/night variation
    const dayReadings = filteredReadings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 7 && hour <= 22; // 7am to 10pm
    });
    const nightReadings = filteredReadings.filter(r => {
      const hour = new Date(r.date).getHours();
      return hour < 7 || hour > 22; // 10pm to 7am
    });

    const dayAvg = dayReadings.length > 0 ? 
      dayReadings.reduce((sum, r) => sum + r.sgv, 0) / dayReadings.length : 0;
    const nightAvg = nightReadings.length > 0 ? 
      nightReadings.reduce((sum, r) => sum + r.sgv, 0) / nightReadings.length : 0;
    
    const dayNightVariation = Math.abs(dayAvg - nightAvg);

    // Calculate average daily highs and lows
    const dayHighs: number[] = [];
    const dayLows: number[] = [];
    
    // Group readings by day
    const readingsByDay: Record<string, number[]> = {};
    filteredReadings.forEach(reading => {
      const day = format(new Date(reading.date), 'yyyy-MM-dd');
      if (!readingsByDay[day]) {
        readingsByDay[day] = [];
      }
      readingsByDay[day].push(reading.sgv);
    });

    // Find daily highs and lows
    Object.values(readingsByDay).forEach((dayReadings: any) => {
      if (dayReadings.length > 0) {
        dayHighs.push(Math.max(...dayReadings));
        dayLows.push(Math.min(...dayReadings));
      }
    });

    const avgDailyHighs = dayHighs.length > 0 ? 
      dayHighs.reduce((sum, val) => sum + val, 0) / dayHighs.length : 0;
    const avgDailyLows = dayLows.length > 0 ? 
      dayLows.reduce((sum, val) => sum + val, 0) / dayLows.length : 0;

    // Calculate Glucose Management Indicator (GMI)
    // GMI (%) = 3.31 + (1.354 × mean glucose in mmol/L)
    const glucoseManagementIndicator = 3.31 + (1.354 * mmolAvg);

    return {
      totalReadings: filteredReadings.length,
      averageGlucose: isNaN(mean) ? 0 : mean,
      timeInRange: glucoseValues.length > 0 ? (inRangeCount / glucoseValues.length) * 100 : 0,
      highPercentage: glucoseValues.length > 0 ? (highCount / glucoseValues.length) * 100 : 0,
      lowPercentage: glucoseValues.length > 0 ? (lowCount / glucoseValues.length) * 100 : 0,
      standardDeviation: isNaN(standardDeviation) ? 0 : standardDeviation,
      cv: isNaN(cv) ? 0 : cv,
      estimatedA1C: isNaN(estimatedA1C) ? 0 : estimatedA1C,
      veryHighPercentage: glucoseValues.length > 0 ? (veryHighCount / glucoseValues.length) * 100 : 0,
      veryLowPercentage: glucoseValues.length > 0 ? (veryLowCount / glucoseValues.length) * 100 : 0,
      highLowRatio: isNaN(highLowRatio) ? 0 : highLowRatio,
      dailyReadings: isNaN(dailyReadings) ? 0 : dailyReadings,
      readingGaps: gaps,
      longestGap: isNaN(longestGap) ? 0 : longestGap,
      timeAbove250: glucoseValues.length > 0 ? (above250Count / glucoseValues.length) * 100 : 0,
      timeBelow54: glucoseValues.length > 0 ? (below54Count / glucoseValues.length) * 100 : 0,
      avgDailyHighs: isNaN(avgDailyHighs) ? 0 : avgDailyHighs,
      avgDailyLows: isNaN(avgDailyLows) ? 0 : avgDailyLows,
      dayNightVariation: isNaN(dayNightVariation) ? 0 : dayNightVariation,
      glucoseManagementIndicator: isNaN(glucoseManagementIndicator) ? 0 : glucoseManagementIndicator
    };
  };

  // Calculate treatment statistics
  const calculateTreatmentStats = () => {
    if (filteredTreatments.length === 0) {
      return {
        totalTreatments: 0,
        insulinTreatments: 0,
        carbTreatments: 0,
        totalInsulin: 0,
        totalCarbs: 0,
        avgInsulin: 0,
        avgCarbs: 0,
        dailyInsulin: 0,
        dailyCarbs: 0,
        insulinCarbRatio: 0,
        correctionBoluses: 0,
        mealBoluses: 0
      };
    }

    const insulinTreatments = filteredTreatments.filter((t: any) => t.insulin);
    const carbTreatments = filteredTreatments.filter((t: any) => t.carbs);
    const mealBoluses = filteredTreatments.filter((t: any) => t.insulin && t.carbs);
    const correctionBoluses = filteredTreatments.filter((t: any) => t.insulin && !t.carbs);

    const totalInsulin = insulinTreatments.reduce((sum: number, t: any) => sum + (t.insulin || 0), 0);
    const totalCarbs = carbTreatments.reduce((sum: number, t: any) => sum + (t.carbs || 0), 0);

    // Calculate days span
    const startDate = new Date(Math.min(...filteredTreatments.map((t: any) => new Date(t.created_at).getTime())));
    const endDate = new Date(Math.max(...filteredTreatments.map((t: any) => new Date(t.created_at).getTime())));
    const daysDiff = Math.max(1, differenceInDays(endDate, startDate));

    return {
      totalTreatments: filteredTreatments.length,
      insulinTreatments: insulinTreatments.length,
      carbTreatments: carbTreatments.length,
      totalInsulin,
      totalCarbs,
      avgInsulin: insulinTreatments.length > 0 ? totalInsulin / insulinTreatments.length : 0,
      avgCarbs: carbTreatments.length > 0 ? totalCarbs / carbTreatments.length : 0,
      dailyInsulin: totalInsulin / daysDiff,
      dailyCarbs: totalCarbs / daysDiff,
      insulinCarbRatio: totalCarbs > 0 ? totalInsulin / totalCarbs : 0,
      correctionBoluses: correctionBoluses.length,
      mealBoluses: mealBoluses.length
    };
  };

  const getTimeWindowLabel = (hours: number) => {
    if (hours < 24) {
      return `${hours} hours`;
    } else if (hours < 168) {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours < 720) {
      const weeks = hours / 168;
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.round(hours / 720);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  };

  const getDisplayLabel = () => {
    if (isCustomRange) {
      return `${format(new Date(customDateRange.startDate), 'dd.MM.yyyy')} - ${format(new Date(customDateRange.endDate), 'dd.MM.yyyy')}`;
    }
    return getTimeWindowLabel(timeWindow);
  };

  const handleTimeWindowChange = async (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      const newTimeWindow = parseInt(value);
      setTimeWindow(newTimeWindow);
      setShowCalendar(false);
      
      // Check if we need to fetch more data
      const requestedDays = Math.ceil(newTimeWindow / 24);
      if (requestedDays > analysisPeriod && dataSpanInfo && requestedDays > dataSpanInfo.spanDays) {
        // Show loading and fetch more data
        setFetchingMoreData(true);
        try {
          await fetchDataForDays(requestedDays);
        } catch (error) {
          console.error('Failed to fetch more data:', error);
        } finally {
          setFetchingMoreData(false);
        }
      }
    }
  };

  const handleCustomDateSubmit = () => {
    const startDate = new Date(customDateRange.startDate);
    const endDate = new Date(customDateRange.endDate);
    
    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }
    
    if (endDate > new Date()) {
      alert('End date cannot be in the future');
      return;
    }
    
    setIsCustomRange(true);
    setShowCalendar(false);
  };

  const getAllTimeWindows = () => {
    return getAvailableTimeWindows();
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (!data?.entries?.length) return null;
    
    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    const oldestEntry = sortedEntries[0];
    const newestEntry = sortedEntries[sortedEntries.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    const spanHours = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      spanHours,
      totalReadings: data.entries.length
    };
  }, [data?.entries]);

  // Get available time windows based on actual data
  const getAvailableTimeWindows = () => {
    const allWindows = [
      { value: 24, label: '24 hours' },
      { value: 48, label: '2 days' },
      { value: 72, label: '3 days' },
      { value: 96, label: '4 days' },
      { value: 120, label: '5 days' },
      { value: 144, label: '6 days' },
      { value: 168, label: '7 days' },
      { value: 336, label: '2 weeks' },
      { value: 504, label: '3 weeks' },
      { value: 720, label: '1 month' },
      { value: 1440, label: '2 months' },
      { value: 2160, label: '3 months' }
    ];

    if (!dataSpanInfo) return allWindows;

    // Add availability indicators and fetch suggestions
    return allWindows.map(window => {
      const hasEnoughData = dataSpanInfo.spanHours >= window.value;
      const requestedDays = Math.ceil(window.value / 24);
      
      if (hasEnoughData) {
        return { ...window, hasEnoughData: true };
      } else if (requestedDays <= 90) { // We can fetch up to 3 months
        return {
          ...window,
          label: `${window.label} (will fetch more data)`,
          hasEnoughData: false,
          canFetch: true
        };
      } else {
        return {
          ...window,
          label: `${window.label} (limited data available)`,
          hasEnoughData: false,
          canFetch: false
        };
      }
    });
  };

  const generatePDF = async () => {
    if (filteredReadings.length === 0) {
      alert('No data available for the selected time period');
      return;
    }

    setExporting(true);

    try {
      const stats = calculateStats();
      // Treatment stats calculated but not used in current PDF generation
      
      // Create PDF document with theme-based styling
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set up fonts and colors based on theme
      pdf.setFont('helvetica');
      const themeColors = {
        professional: { primary: [41, 82, 163], secondary: [46, 184, 89], accent: [243, 156, 18] },
        clinical: { primary: [34, 139, 34], secondary: [70, 130, 180], accent: [220, 20, 60] },
        personal: { primary: [106, 90, 205], secondary: [255, 140, 0], accent: [50, 205, 50] }
      };
      const colors = themeColors[reportTheme];

      const lighten = (rgb: [number, number, number], amount: number) => {
        const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
        return [
          clamp(rgb[0] + (255 - rgb[0]) * amount),
          clamp(rgb[1] + (255 - rgb[1]) * amount),
          clamp(rgb[2] + (255 - rgb[2]) * amount)
        ] as [number, number, number];
      };
      
      // Add professional header with logo area
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.rect(0, 0, 210, 45, 'F');
      
      // Add header text with better typography
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Diabetes Management Report', 15, 22);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on ${format(new Date(), 'EEEE, dd MMMM yyyy \'at\' HH:mm')}`, 15, 34);
      
      // Add report type indicator
      const reportTypeLabels = {
        professional: 'Professional Clinical Report',
        clinical: 'Clinical Summary Report',
        personal: 'Personal Diabetes Summary'
      };
      pdf.setFontSize(10);
      pdf.text(reportTypeLabels[reportTheme], 150, 40);
      
      // Add modern report period banner
      pdf.setTextColor(0, 0, 0);
      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setLineWidth(1);
      pdf.roundedRect(0, 45, 210, 15, 0, 0, 'FD');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      const periodText = `Analysis Period: ${getDisplayLabel()} | ${stats.totalReadings.toLocaleString()} glucose readings`;
      pdf.text(periodText, 15, 55);
      
      // Add footer function with enhanced styling and correct positioning
      const addFooter = (pageNum: number, totalPages: number) => {
        // Footer line
        pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setLineWidth(0.8);
        pdf.line(15, 280, 195, 280);
        
        // Footer text with better formatting and positioning
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text('This report is for informational purposes only.', 15, 288);
        pdf.text(`Page ${pageNum} of ${totalPages}`, 185, 288, { align: 'right' });
        pdf.text('Generated by Diabetes Analyzer', 105, 294, { align: 'center' });
      };
      
      // Function to check if we need a new page (improved spacing)
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > 275) { // Leave more space for footer
          pdf.addPage();
          
          // Add header to new page
          pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          pdf.rect(0, 0, 210, 25, 'F');
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Diabetes Management Report (continued)', 15, 16);
          
          yPos = 35;
        }
      };
      
      // Add patient info section
      let yPos = 70;
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text('DIABETES MANAGEMENT SUMMARY', 15, yPos);
      
      yPos += 10;
      
      // Add key metrics section with colored boxes
      const addMetricBox = (title: string, value: string, subtext: string, color: [number, number, number], x: number, y: number, width: number) => {
        // Background
        const bg = lighten(color, 0.9);
        pdf.setFillColor(bg[0], bg[1], bg[2]);
        pdf.roundedRect(x, y, width, 20, 2, 2, 'F');
        
        // Border
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, y, width, 20, 2, 2, 'S');
        
        // Title
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(title, x + 4, y + 5);
        
        // Value
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(value, x + 4, y + 13);
        
        // Subtext
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(subtext, x + 4, y + 18);
      };
      
      // First row of metrics
      const ranges = getCurrentGlucoseRanges();
      const rangeLabel = `${ranges.TARGET_MIN.toFixed(1)}-${ranges.TARGET_MAX.toFixed(1)} ${getUnitLabel()}`;
      addMetricBox('AVERAGE GLUCOSE', formatGlucoseValue(stats.averageGlucose, 'mgdl', true), 'Mean glucose level', [41, 82, 163], 15, yPos, 42); // Blue
      addMetricBox('TIME IN RANGE', `${stats.timeInRange.toFixed(1)}%`, rangeLabel, [46, 184, 89], 62, yPos, 42); // Green
      addMetricBox('ESTIMATED A1C', `${stats.estimatedA1C.toFixed(1)}%`, 'Based on average glucose', [156, 39, 176], 109, yPos, 42); // Purple
      addMetricBox('GMI', `${stats.glucoseManagementIndicator.toFixed(1)}%`, 'Glucose Management Indicator', [230, 126, 34], 156, yPos, 42); // Orange
      
      yPos += 25;
      
      // Second row of metrics
      const lowThreshold = ranges.TARGET_MIN.toFixed(1);
      const highThreshold = ranges.TARGET_MAX.toFixed(1);
      addMetricBox('VARIABILITY (CV)', `${stats.cv.toFixed(1)}%`, 'Coefficient of Variation', [41, 128, 185], 15, yPos, 42); // Light blue
      addMetricBox('TIME BELOW RANGE', `${stats.lowPercentage.toFixed(1)}%`, `<${lowThreshold} ${getUnitLabel()}`, [231, 76, 60], 62, yPos, 42); // Red
      addMetricBox('TIME ABOVE RANGE', `${stats.highPercentage.toFixed(1)}%`, `>${highThreshold} ${getUnitLabel()}`, [243, 156, 18], 109, yPos, 42); // Yellow
      addMetricBox('STANDARD DEVIATION', `±${formatGlucoseValue(stats.standardDeviation, 'mgdl', false)}`, getUnitLabel(), [149, 165, 166], 156, yPos, 42); // Gray
      
      yPos += 30;
      
      // Time in Range visualization
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text('TIME IN RANGE ANALYSIS', 15, yPos);
      
      yPos += 10;
      
      // Draw time in range bar
      const barWidth = 180;
      const barHeight = 15;
      const barX = 15;
      const barY = yPos;
      
      // Very Low
      const veryLowWidth = (stats.veryLowPercentage / 100) * barWidth;
      pdf.setFillColor(156, 39, 176); // Purple for very low
      pdf.rect(barX, barY, veryLowWidth, barHeight, 'F');
      
      // Low
      const lowWidth = ((stats.lowPercentage - stats.veryLowPercentage) / 100) * barWidth;
      pdf.setFillColor(231, 76, 60); // Red for low
      pdf.rect(barX + veryLowWidth, barY, lowWidth, barHeight, 'F');
      
      // In Range
      const inRangeWidth = (stats.timeInRange / 100) * barWidth;
      pdf.setFillColor(46, 184, 89); // Green for in range
      pdf.rect(barX + veryLowWidth + lowWidth, barY, inRangeWidth, barHeight, 'F');
      
      // High
      const highWidth = ((stats.highPercentage - stats.veryHighPercentage) / 100) * barWidth;
      pdf.setFillColor(243, 156, 18); // Yellow for high
      pdf.rect(barX + veryLowWidth + lowWidth + inRangeWidth, barY, highWidth, barHeight, 'F');
      
      // Very High
      const veryHighWidth = (stats.veryHighPercentage / 100) * barWidth;
      pdf.setFillColor(211, 84, 0); // Orange for very high
      pdf.rect(barX + veryLowWidth + lowWidth + inRangeWidth + highWidth, barY, veryHighWidth, barHeight, 'F');
      
      yPos += barHeight + 5;
      
      // Add legend
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      // Get current glucose ranges for legend
      const currentRanges = getCurrentGlucoseRanges();
      const veryLowThreshold = formatGlucoseValue(convertToCurrentUnit(54, 'mgdl'), unit, false);
      const lowThresholdLabel = currentRanges.TARGET_MIN.toFixed(1);
      const highThresholdLabel = currentRanges.TARGET_MAX.toFixed(1);
      const veryHighThreshold = formatGlucoseValue(convertToCurrentUnit(250, 'mgdl'), unit, false);
      
      // Very Low legend
      pdf.setFillColor(156, 39, 176);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Very Low (<${veryLowThreshold} ${getUnitLabel()}): ${stats.veryLowPercentage.toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 6;
      
      // Low legend
      pdf.setFillColor(231, 76, 60);
      pdf.rect(barX, yPos, 3, 3, 'F');
      const lowRangeStart = formatGlucoseValue(convertToCurrentUnit(55, 'mgdl'), unit, false);
      pdf.text(`Low (${lowRangeStart}-${lowThresholdLabel} ${getUnitLabel()}): ${(stats.lowPercentage - stats.veryLowPercentage).toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 6;
      
      // In Range legend
      pdf.setFillColor(46, 184, 89);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.text(`In Range (${lowThresholdLabel}-${highThresholdLabel} ${getUnitLabel()}): ${stats.timeInRange.toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 6;
      
      // High legend
      pdf.setFillColor(243, 156, 18);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.text(`High (${highThresholdLabel}-${veryHighThreshold} ${getUnitLabel()}): ${(stats.highPercentage - stats.veryHighPercentage).toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 6;
      
      // Very High legend
      pdf.setFillColor(211, 84, 0);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.text(`Very High (>${veryHighThreshold} ${getUnitLabel()}): ${stats.veryHighPercentage.toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 15;
      
      // Add target ranges with better formatting and correct values
      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(15, yPos, 180, 50, 2, 2, 'FD');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text('TARGET RANGES', 20, yPos + 10);
      
      // Get the correct target ranges from current settings
      const targetRanges = getCurrentGlucoseRanges();
      const targetMinValue = targetRanges.TARGET_MIN.toFixed(1);
      const targetMaxValue = targetRanges.TARGET_MAX.toFixed(1);
      const targetRangeDisplay = `${targetMinValue}-${targetMaxValue} ${getUnitLabel()}`;
      const belowRangeDisplay = `${targetMinValue} ${getUnitLabel()}`;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      // Create two columns for better readability with proper spacing
      pdf.text(`Time in Range (${targetRangeDisplay}): >=70%`, 20, yPos + 22);
      pdf.text(`Time Below Range (<${belowRangeDisplay}): <4%`, 20, yPos + 32);
      
      // Add glucose management targets on the right side (positioned for better balance)
      pdf.text(`Glucose Variability (CV): <36%`, 100, yPos + 22);
      pdf.text(`Estimated A1C: <7.0% (individualized)`, 100, yPos + 32);
      
      yPos += 55;
      
      // Check if we need a new page before clinical assessment (reduced space requirement)
      checkPageBreak(150); // Reduced from 180 to 150
      
      // Add comprehensive clinical assessment with better styling
      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.setLineWidth(1);
      pdf.roundedRect(15, yPos - 5, 180, 8, 2, 2, 'FD');
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('CLINICAL ASSESSMENT', 20, yPos);
      
      yPos += 10;
      
      // Assessment cards with better visual hierarchy and improved spacing
      const createAssessmentCard = (title: string, score: number, description: string, recommendations: string[], color: [number, number, number], y: number) => {
        // Card background with reduced height
        const cardBg = lighten(color, 0.93);
        pdf.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(15, y, 180, 40, 3, 3, 'FD'); // Reduced from 50 to 40
        
        // Title and score
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(title, 20, y + 8);
        
        // Score indicator
        const scoreWidth = 30;
        const scoreHeight = 6;
        pdf.setFillColor(240, 240, 240);
        pdf.roundedRect(150, y + 3, scoreWidth, scoreHeight, 1, 1, 'F');
        
        const filledWidth = (score / 100) * scoreWidth;
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.roundedRect(150, y + 3, filledWidth, scoreHeight, 1, 1, 'F');
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${Math.round(score)}%`, 185, y + 7);
        
        // Description
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9); // Reduced font size slightly
        pdf.setTextColor(15, 23, 42);
        pdf.text(description, 20, y + 18);
        
        // Recommendations (limited to 1 line each)
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8); // Smaller font for recommendations
        pdf.setTextColor(51, 65, 85);
        recommendations.forEach((rec, index) => {
          if (index < 2) { // Limit to 2 recommendations per card
            // Truncate long recommendations
            const maxLength = 70;
            const truncatedRec = rec.length > maxLength ? rec.substring(0, maxLength) + '...' : rec;
            pdf.text(truncatedRec, 20, y + 26 + (index * 7)); // Tighter spacing
          }
        });
        
        return y + 45; // Reduced spacing between cards
      };
      
      // Calculate scores and assessments
      const tirScore = Math.min(100, (stats.timeInRange / 70) * 100);
      const hypoScore = Math.max(0, 100 - (stats.lowPercentage / 4) * 100);
      const variabilityScore = Math.max(0, Math.min(100, 100 - ((stats.cv - 20) / 30) * 100));
      
      // Time in Range Assessment
      let tirRecommendations = [];
      if (stats.timeInRange < 50) {
        tirRecommendations = [
          '• Consider comprehensive diabetes management review',
          '• Evaluate insulin regimen and glucose monitoring frequency'
        ];
      } else if (stats.timeInRange < 70) {
        tirRecommendations = [
          '• Review meal timing and carbohydrate counting accuracy',
          '• Consider insulin dose optimization with healthcare provider'
        ];
      } else {
        tirRecommendations = [
          '• Excellent glucose control - maintain current strategies',
          '• Continue regular monitoring and lifestyle consistency'
        ];
      }
      
      const tirColor: [number, number, number] = stats.timeInRange >= 70 ? [46, 184, 89] : stats.timeInRange >= 50 ? [243, 156, 18] : [231, 76, 60];
      checkPageBreak(50); // Reduced space requirement
      yPos = createAssessmentCard(
        'Time in Range Performance',
        tirScore,
        `${stats.timeInRange.toFixed(1)}% of readings in target range (Goal: ≥70%)`,
        tirRecommendations,
        tirColor,
        yPos
      );
      
      // Hypoglycemia Risk Assessment
      let hypoRecommendations = [];
      if (stats.lowPercentage > 10) {
        hypoRecommendations = [
          '• High hypoglycemia risk - immediate attention needed',
          '• Review insulin doses and consider reducing basal rates'
        ];
      } else if (stats.lowPercentage > 4) {
        hypoRecommendations = [
          '• Moderate hypoglycemia risk - evaluate insulin sensitivity',
          '• Consider adjusting correction factors and meal bolus timing'
        ];
      } else {
        hypoRecommendations = [
          '• Low hypoglycemia risk - well-managed glucose lows',
          '• Maintain current hypoglycemia prevention strategies'
        ];
      }
      
      const hypoColor: [number, number, number] = stats.lowPercentage < 4 ? [46, 184, 89] : stats.lowPercentage < 10 ? [243, 156, 18] : [231, 76, 60];
      checkPageBreak(50); // Reduced space requirement
      yPos = createAssessmentCard(
        'Hypoglycemia Risk Management',
        hypoScore,
        `${stats.lowPercentage.toFixed(1)}% time below range (Goal: <4%)`,
        hypoRecommendations,
        hypoColor,
        yPos
      );
      
      // Glucose Variability Assessment
      let varRecommendations = [];
      if (stats.cv > 50) {
        varRecommendations = [
          '• High glucose variability - focus on consistency',
          '• Review meal timing, stress management, and sleep patterns'
        ];
      } else if (stats.cv > 36) {
        varRecommendations = [
          '• Moderate variability - work on glucose stability',
          '• Consider more frequent glucose monitoring and dose adjustments'
        ];
      } else {
        varRecommendations = [
          '• Excellent glucose stability - maintain current approach',
          '• Continue consistent diabetes management practices'
        ];
      }
      
      const varColor: [number, number, number] = stats.cv < 36 ? [46, 184, 89] : stats.cv < 50 ? [243, 156, 18] : [231, 76, 60];
      checkPageBreak(50); // Reduced space requirement
      yPos = createAssessmentCard(
        'Glucose Variability Control',
        variabilityScore,
        `${stats.cv.toFixed(1)}% coefficient of variation (Goal: <36%)`,
        varRecommendations,
        varColor,
        yPos
      );
      
      // Add second page with enhanced analytics
      if (includeAdvancedStats) {
        pdf.addPage();
        
        // Add modern header to second page
        pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.rect(0, 0, 210, 25, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Advanced Analytics & Trends', 15, 16);
        
        yPos = 35;
        
        // Add glucose trends analysis
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('GLUCOSE TRENDS & PATTERNS', 15, yPos);
        
        yPos += 10;
        
        // Create trend indicators
        const createTrendCard = (title: string, value: string, trend: 'up' | 'down' | 'stable', color: [number, number, number], x: number, y: number, width: number) => {
          // Card background with gradient effect
          const cardBg = lighten(color, 0.9);
          pdf.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
          pdf.roundedRect(x, y, width, 35, 3, 3, 'F');
          
          // Border
          pdf.setDrawColor(color[0], color[1], color[2]);
          pdf.setLineWidth(0.8);
          pdf.roundedRect(x, y, width, 35, 3, 3, 'S');
          
          // Title
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(71, 85, 105);
          pdf.text(title, x + 5, y + 8);
          
          // Value
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.setTextColor(color[0], color[1], color[2]);
          pdf.text(value, x + 5, y + 20);
          
          // Trend indicator
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          const trendSymbol = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
          const trendColor = trend === 'up' ? [231, 76, 60] : trend === 'down' ? [46, 184, 89] : [200, 200, 200];
          pdf.setTextColor(trendColor[0], trendColor[1], trendColor[2]);
          pdf.text(trendSymbol, x + width - 15, y + 20);
          
          // Trend label
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          const trendLabel = trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable';
          pdf.text(trendLabel, x + 5, y + 30);
        };
        
        // Calculate weekly averages for trend analysis
        const calculateTrends = () => {
          const weeklyData = [];
          const sortedReadings = [...filteredReadings].sort((a, b) => a.date - b.date);
          const weeksBack = Math.min(4, Math.floor(sortedReadings.length / (7 * 24 * 4))); // 4 readings per hour estimate
          
          for (let i = 0; i < weeksBack; i++) {
            const weekStart = sortedReadings.length - (i + 1) * Math.floor(sortedReadings.length / weeksBack);
            const weekEnd = sortedReadings.length - i * Math.floor(sortedReadings.length / weeksBack);
            const weekReadings = sortedReadings.slice(Math.max(0, weekStart), weekEnd);
            
            if (weekReadings.length > 0) {
              const weekAvg = weekReadings.reduce((sum, r) => sum + r.sgv, 0) / weekReadings.length;
              weeklyData.push(weekAvg);
            }
          }
          
          return weeklyData.reverse(); // Most recent first
        };
        
        const weeklyTrends = calculateTrends();
        const avgTrend = weeklyTrends.length >= 2 ? 
          (weeklyTrends[weeklyTrends.length - 1] > weeklyTrends[0] ? 'up' : 
           weeklyTrends[weeklyTrends.length - 1] < weeklyTrends[0] ? 'down' : 'stable') : 'stable';
        
        // Daily patterns analysis
        const hourlyAverages = Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
        filteredReadings.forEach(reading => {
          const hour = new Date(reading.date).getHours();
          hourlyAverages[hour].sum += reading.sgv;
          hourlyAverages[hour].count++;
        });
        
        const hourlyMeans = hourlyAverages.map(h => h.count > 0 ? h.sum / h.count : 0);
        const morningAvg = hourlyMeans.slice(6, 12).reduce((a, b) => a + b, 0) / 6;
        const afternoonAvg = hourlyMeans.slice(12, 18).reduce((a, b) => a + b, 0) / 6;
        const nightAvg = hourlyMeans.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
        
        // Create trend cards in a grid
        const cardWidth = 42;
        const cardSpacing = 4;
        
        createTrendCard(
          'Average Glucose',
          formatGlucoseValue(stats.averageGlucose, 'mgdl', true),
          avgTrend,
          [41, 82, 163],
          15,
          yPos,
          cardWidth
        );
        
        createTrendCard(
          'Morning (6-12h)',
          formatGlucoseValue(morningAvg, 'mgdl', true),
          morningAvg > stats.averageGlucose ? 'up' : morningAvg < stats.averageGlucose ? 'down' : 'stable',
          [46, 184, 89],
          15 + cardWidth + cardSpacing,
          yPos,
          cardWidth
        );
        
        createTrendCard(
          'Afternoon (12-18h)', 
          formatGlucoseValue(afternoonAvg, 'mgdl', true),
          afternoonAvg > stats.averageGlucose ? 'up' : afternoonAvg < stats.averageGlucose ? 'down' : 'stable',
          [243, 156, 18],
          15 + 2 * (cardWidth + cardSpacing),
          yPos,
          cardWidth
        );
        
        createTrendCard(
          'Night (0-6h)',
          formatGlucoseValue(nightAvg, 'mgdl', true),
          nightAvg > stats.averageGlucose ? 'up' : nightAvg < stats.averageGlucose ? 'down' : 'stable',
          [156, 39, 176],
          15 + 3 * (cardWidth + cardSpacing),
          yPos,
          cardWidth
        );
        
        yPos += 45;
        
        // Check page break before data quality section
        checkPageBreak(100);
        
        // Add comprehensive data quality section
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DATA QUALITY & MONITORING', 15, yPos);
        
        yPos += 10;
        
        // Data quality metrics table with modern styling
        const createModernTable = (headers: string[], data: any[][], x: number, y: number, width: number) => {
          const rowHeight = 10;
          const colWidth = width / headers.length;
          
          // Header with gradient effect
          pdf.setFillColor(41, 82, 163);
          pdf.roundedRect(x, y, width, rowHeight, 2, 2, 'F');
          
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          
          headers.forEach((header, i) => {
            pdf.text(header, x + (i * colWidth) + 3, y + 7);
          });
          
          // Data rows with alternating colors
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          
          data.forEach((row, rowIndex) => {
            const rowY = y + (rowIndex + 1) * rowHeight;
            
            // Alternating row background
            if (rowIndex % 2 === 0) {
              pdf.setFillColor(248, 249, 250);
              pdf.rect(x, rowY, width, rowHeight, 'F');
            }
            
            pdf.setTextColor(0, 0, 0);
            row.forEach((cell, cellIndex) => {
              pdf.text(cell.toString(), x + (cellIndex * colWidth) + 3, rowY + 7);
            });
          });
          
          // Table border
          pdf.setDrawColor(230, 230, 230);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(x, y, width, (data.length + 1) * rowHeight, 2, 2, 'S');
          
          return y + (data.length + 1) * rowHeight;
        };
        
        // Data quality metrics
        const qualityHeaders = ['Metric', 'Value', 'Quality Score', 'Status'];
        const dataCompleteness = Math.min(100, (stats.dailyReadings / 288) * 100); // 288 = 24h * 12 readings/hour
        const gapScore = Math.max(0, 100 - (stats.readingGaps * 5));
        const consistencyScore = Math.max(0, 100 - Math.max(0, stats.longestGap - 60) / 10);
        
        const qualityData = [
          ['Daily Readings', `${stats.dailyReadings.toFixed(1)}/day`, `${dataCompleteness.toFixed(0)}%`, dataCompleteness > 80 ? 'Excellent' : dataCompleteness > 60 ? 'Good' : 'Poor'],
          ['Data Gaps', stats.readingGaps.toString(), `${gapScore.toFixed(0)}%`, gapScore > 80 ? 'Minimal' : gapScore > 60 ? 'Moderate' : 'Frequent'],
          ['Longest Gap', `${Math.round(stats.longestGap)} min`, `${consistencyScore.toFixed(0)}%`, consistencyScore > 80 ? 'Excellent' : consistencyScore > 60 ? 'Good' : 'Poor'],
          ['Coverage Period', `${Math.round((filteredReadings[filteredReadings.length - 1]?.date - filteredReadings[0]?.date) / (1000 * 60 * 60 * 24))} days`, '100%', 'Complete']
        ];
        
        yPos = createModernTable(qualityHeaders, qualityData, 15, yPos, 180);
        
        yPos += 15;
        
        // Check page break before glucose distribution
        checkPageBreak(80);
        
        // Add glucose distribution visualization
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('GLUCOSE DISTRIBUTION ANALYSIS', 15, yPos);
        
        yPos += 10;
        
        // Create glucose distribution histogram
        const createGlucoseDistribution = (x: number, y: number, width: number, height: number) => {
          const ranges = getCurrentGlucoseRanges();
          const binSize = 20; // mg/dL bins
          const bins: { range: number; count: number }[] = [];
          const maxBinValue = 400;
          
          // Initialize bins
          for (let i = 40; i <= maxBinValue; i += binSize) {
            bins.push({ range: i, count: 0 });
          }
          
          // Count readings in each bin
          filteredReadings.forEach(reading => {
            const glucose = reading.sgv;
            const binIndex = Math.floor((glucose - 40) / binSize);
            if (binIndex >= 0 && binIndex < bins.length) {
              bins[binIndex].count++;
            }
          });
          
          const maxCount = Math.max(...bins.map(b => b.count));
          const barWidth = width / bins.length;
          
          // Draw histogram bars
          bins.forEach((bin, index) => {
            const barHeight = (bin.count / maxCount) * height;
            const barX = x + (index * barWidth);
            const barY = y + height - barHeight;
            
            // Determine color based on glucose range
            let color: [number, number, number];
            if (bin.range < convertToCurrentUnit(ranges.TARGET_MIN, 'mgdl')) {
              color = [231, 76, 60]; // Red for low
            } else if (bin.range <= convertToCurrentUnit(ranges.TARGET_MAX, 'mgdl')) {
              color = [46, 184, 89]; // Green for in range
            } else if (bin.range <= convertToCurrentUnit(250, 'mgdl')) {
              color = [243, 156, 18]; // Yellow for high
            } else {
              color = [211, 84, 0]; // Orange for very high
            }
            
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.rect(barX, barY, barWidth - 0.5, barHeight, 'F');
          });
          
          // Draw axes
          pdf.setDrawColor(100, 100, 100);
          pdf.setLineWidth(0.5);
          pdf.line(x, y + height, x + width, y + height); // X-axis
          pdf.line(x, y, x, y + height); // Y-axis
          
          // Add labels
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          
          // X-axis labels (every other bin)
          for (let i = 0; i < bins.length; i += 3) {
            const labelX = x + (i * barWidth) + barWidth / 2;
            const glucoseValue = formatGlucoseValue(bins[i].range, 'mgdl', false);
            pdf.text(glucoseValue, labelX - 5, y + height + 8);
          }
          
          // Y-axis label
          pdf.text('Frequency', x - 20, y + height / 2, { angle: 90 });
          pdf.text(`Glucose (${getUnitLabel()})`, x + width / 2 - 15, y + height + 18);
        };
        
        createGlucoseDistribution(15, yPos, 180, 40);
        
        yPos += 65;
        
        // Check page break before personalized insights
        checkPageBreak(120);
        
        // Add personalized insights section
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PERSONALIZED INSIGHTS & PATTERNS', 15, yPos);
        
        yPos += 10;
        
        // Generate personalized insights
        const generateInsights = () => {
          const insights = [];
          
          // Time-based patterns
          const morningMean = morningAvg;
          const afternoonMean = afternoonAvg;
          const nightMean = nightAvg;
          
          if (morningMean > stats.averageGlucose + 20) {
            insights.push({
              icon: '🌅',
              title: 'Dawn Phenomenon',
              description: 'Morning glucose levels are consistently elevated. Consider discussing dawn phenomenon management with your healthcare provider.',
              priority: 'high'
            });
          }
          
          if (afternoonMean < stats.averageGlucose - 20) {
            insights.push({
              icon: '🍽️',
              title: 'Post-Lunch Pattern',
              description: 'Afternoon glucose levels tend to be lower. Monitor pre-lunch insulin timing and carbohydrate intake.',
              priority: 'medium'
            });
          }
          
          if (nightMean > stats.averageGlucose + 15) {
            insights.push({
              icon: '🌙',
              title: 'Nighttime Elevation',
              description: 'Nighttime glucose levels are elevated. Consider reviewing evening meal timing and insulin doses.',
              priority: 'high'
            });
          }
          
          // Variability insights
          if (stats.cv > 45) {
            insights.push({
              icon: '📊',
              title: 'High Variability',
              description: 'Glucose levels show high variability. Focus on consistency in meal timing, carb counting, and stress management.',
              priority: 'high'
            });
          }
          
          // Data quality insights
          if (stats.readingGaps > 10) {
            insights.push({
              icon: '!',
              title: 'Data Gaps',
              description: `${stats.readingGaps} data gaps detected. Ensure CGM sensor is properly attached and connected to your device.`,
              priority: 'medium'
            });
          }
          
          // Positive reinforcement
          if (stats.timeInRange > 80) {
            insights.push({
              icon: '⭐',
              title: 'Excellent Control',
              description: 'Outstanding glucose management! Your current strategies are working very well.',
              priority: 'positive'
            });
          }
          
          return insights.slice(0, 4); // Limit to 4 insights
        };
        
        const insights = generateInsights();
        
        // Display insights in cards
        insights.forEach((insight, index) => {
          const cardY = yPos + (index * 25);
          const priorityColors = {
            high: [231, 76, 60],
            medium: [243, 156, 18],
            positive: [46, 184, 89]
          };
          const color = priorityColors[insight.priority as keyof typeof priorityColors] || [100, 100, 100];
          
          // Card background
          const cardBg = lighten(color as [number, number, number], 0.93);
          pdf.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
          pdf.setDrawColor(color[0], color[1], color[2]);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(15, cardY, 180, 20, 2, 2, 'FD');
          
          // Icon and title
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(color[0], color[1], color[2]);
          pdf.text(`${insight.icon} ${insight.title}`, 20, cardY + 8);
          
          // Description
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(51, 65, 85);
          const wrappedText = insight.description.length > 90 ? 
            insight.description.substring(0, 87) + '...' : insight.description;
          pdf.text(wrappedText, 20, cardY + 16);
        });
        
        yPos += insights.length * 25 + 10;
        
        // Add glucose distribution if selected
        if (includeDistributionChart) {
          createGlucoseDistribution(15, yPos, 180, 40);
          yPos += 65;
        }
        
        // Add personalized insights if selected
        if (includePersonalizedInsights && insights.length > 0) {
          // Display insights in cards (already rendered above)
          yPos += 10;
        }
        
        // Daily patterns section
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(14);
        pdf.text('DAILY PATTERNS & ADVANCED METRICS', 15, yPos);
        
        yPos += 10;
        
        // Create a table for advanced metrics
        const createTable = (headers: string[], data: any[][], x: number, y: number, width: number) => {
          const rowHeight = 8;
          const colWidth = width / headers.length;
          
          // Draw header
          pdf.setFillColor(230, 230, 230);
          pdf.rect(x, y, width, rowHeight, 'F');
          
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(80, 80, 80);
          
          headers.forEach((header, i) => {
            pdf.text(header, x + (i * colWidth) + 2, y + 5.5);
          });
          
          // Draw rows
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          
          data.forEach((row, rowIndex) => {
            const rowY = y + (rowIndex + 1) * rowHeight;
            
            // Alternate row background
            if (rowIndex % 2 === 0) {
              pdf.setFillColor(245, 245, 245);
              pdf.rect(x, rowY, width, rowHeight, 'F');
            }
            
            row.forEach((cell, cellIndex) => {
              pdf.text(cell.toString(), x + (cellIndex * colWidth) + 2, rowY + 5.5);
            });
          });
          
          return y + (data.length + 1) * rowHeight;
        };
        
        // Advanced metrics table
        const advancedHeaders = ['Metric', 'Value', 'Interpretation'];
        const advancedData = [
          ['Avg. Daily Readings', stats.dailyReadings.toFixed(1), stats.dailyReadings > 40 ? 'Excellent' : stats.dailyReadings > 20 ? 'Good' : 'Insufficient'],
          ['Glucose Variability (CV)', `${stats.cv.toFixed(1)}%`, stats.cv < 36 ? 'Target' : stats.cv < 45 ? 'Elevated' : 'High'],
          ['Standard Deviation', `${formatGlucoseValue(stats.standardDeviation, 'mgdl', false)} ${getUnitLabel()}`, ''],
          ['Estimated A1C', `${stats.estimatedA1C.toFixed(1)}%`, stats.estimatedA1C < 7.0 ? 'Target' : stats.estimatedA1C < 8.0 ? 'Elevated' : 'High'],
          ['GMI', `${stats.glucoseManagementIndicator.toFixed(1)}%`, ''],
          ['High/Low Ratio', stats.highLowRatio.toFixed(1), ''],
          ['Data Gaps', stats.readingGaps.toString(), ''],
          ['Longest Gap', `${Math.round(stats.longestGap)} min`, ''],
          ['Day/Night Variation', `${formatGlucoseValue(stats.dayNightVariation, 'mgdl', false)} ${getUnitLabel()}`, '']
        ];
        
        yPos = createTable(advancedHeaders, advancedData, 15, yPos, 180);
        
        yPos += 15;
        
        // Check if we need a new page for the extreme values section
        if (yPos > 250) {
          pdf.addPage();
          yPos = 30;
        }
        
        // Extreme values section
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('EXTREME VALUES & RISK ANALYSIS', 15, yPos);
        
        yPos += 10;
        
        // Extreme values table
        const extremeHeaders = ['Metric', 'Value', 'Target', 'Risk Level'];
        const veryLowThresholdLabel = formatGlucoseValue(convertToCurrentUnit(54, 'mgdl'), unit, false);
        const veryHighThresholdLabel = formatGlucoseValue(convertToCurrentUnit(250, 'mgdl'), unit, false);
        const lowTargetLabel = currentRanges.TARGET_MIN.toFixed(1);
        const highTargetLabel = currentRanges.TARGET_MAX.toFixed(1);
        
        const extremeData = [
          [`Time <${veryLowThresholdLabel} ${getUnitLabel()}`, `${stats.veryLowPercentage.toFixed(1)}%`, '<1%', stats.veryLowPercentage < 1 ? 'Low' : stats.veryLowPercentage < 3 ? 'Medium' : 'High'],
          [`Time >${veryHighThresholdLabel} ${getUnitLabel()}`, `${stats.veryHighPercentage.toFixed(1)}%`, '<5%', stats.veryHighPercentage < 5 ? 'Low' : stats.veryHighPercentage < 10 ? 'Medium' : 'High'],
          ['Avg. Daily Low', `${formatGlucoseValue(stats.avgDailyLows, 'mgdl', false)} ${getUnitLabel()}`, `>${lowTargetLabel} ${getUnitLabel()}`, convertToCurrentUnit(stats.avgDailyLows, 'mgdl') > currentRanges.TARGET_MIN ? 'Low' : 'Medium'],
          ['Avg. Daily High', `${formatGlucoseValue(stats.avgDailyHighs, 'mgdl', false)} ${getUnitLabel()}`, `<${highTargetLabel} ${getUnitLabel()}`, convertToCurrentUnit(stats.avgDailyHighs, 'mgdl') < currentRanges.TARGET_MAX ? 'Low' : 'Medium']
        ];
        
        yPos = createTable(extremeHeaders, extremeData, 15, yPos, 180);
        
        yPos += 15;
        
        // Add Hourly Glucose Patterns section
        if (yPos > 200) {
          pdf.addPage();
          yPos = 30;
        }
        
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('HOURLY GLUCOSE PATTERNS', 15, yPos);
        yPos += 10;
        
        // Create hourly analysis
        const hourlyData = [];
        const hourlyStats = Array.from({length: 24}, (_, hour) => {
          const hourReadings = filteredReadings.filter((reading: any) => new Date(reading.date).getHours() === hour);
          if (hourReadings.length === 0) return { hour, avg: 'No data', count: 0 };
          const avg = hourReadings.reduce((sum: number, r: any) => sum + r.sgv, 0) / hourReadings.length;
          return { hour, avg: `${formatGlucoseValue(avg, 'mgdl', false)} ${getUnitLabel()}`, count: hourReadings.length };
        });
        
        // Add hourly table (show every 2 hours to save space)
        const hourlyHeaders = ['Time', 'Avg Glucose', 'Readings', 'Time', 'Avg Glucose', 'Readings'];
        for (let i = 0; i < 12; i++) {
          const hour1 = hourlyStats[i * 2];
          const hour2 = hourlyStats[i * 2 + 1];
          if (hour1 && hour2) {
            hourlyData.push([
              `${hour1.hour.toString().padStart(2, '0')}:00`,
              hour1.avg,
              hour1.count.toString(),
              `${hour2.hour.toString().padStart(2, '0')}:00`,
              hour2.avg,
              hour2.count.toString()
            ]);
          }
        }
        
        yPos = createTable(hourlyHeaders, hourlyData, 15, yPos, 180);
        yPos += 15;
        
        // Add Day of Week Analysis
        if (yPos > 200) {
          pdf.addPage();
          yPos = 30;
        }
        
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('DAY OF WEEK ANALYSIS', 15, yPos);
        yPos += 10;
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weeklyHeaders = ['Day', 'Avg Glucose', 'Time in Range', 'Readings'];
        const weeklyCurrentRanges = getCurrentGlucoseRanges();
        const weeklyData = dayNames.map((day, index) => {
          const dayReadings = filteredReadings.filter((reading: any) => new Date(reading.date).getDay() === index);
          if (dayReadings.length === 0) return [day, 'No data', 'No data', '0'];
          
          const avg = dayReadings.reduce((sum: number, r: any) => sum + r.sgv, 0) / dayReadings.length;
          const inRange = dayReadings.filter((r: any) => {
            const glucose = convertToCurrentUnit(r.sgv, 'mgdl');
            return glucose >= weeklyCurrentRanges.TARGET_MIN && glucose <= weeklyCurrentRanges.TARGET_MAX;
          }).length;
          const tirPercent = ((inRange / dayReadings.length) * 100).toFixed(1);
          
          return [
            day,
            `${formatGlucoseValue(avg, 'mgdl', false)} ${getUnitLabel()}`,
            `${tirPercent}%`,
            dayReadings.length.toString()
          ];
        });
        
        yPos = createTable(weeklyHeaders, weeklyData, 15, yPos, 180);
        yPos += 15;
        
        // Add risk assessment
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('RISK ASSESSMENT & RECOMMENDATIONS', 15, yPos);
        
        yPos += 10;
        
        // Risk assessment box
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(15, yPos, 180, 50, 'S');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Key Observations:', 20, yPos + 8);
        
        pdf.setFont('helvetica', 'normal');
        
        // Generate observations based on data
        const observations = [];
        
        if (stats.timeInRange < 70) {
          observations.push(`• Time in range (${stats.timeInRange.toFixed(1)}%) is below target of 70%.`);
        } else {
          observations.push(`• Excellent time in range (${stats.timeInRange.toFixed(1)}%).`);
        }
        
        if (stats.lowPercentage > 4) {
          observations.push(`• Elevated hypoglycemia risk (${stats.lowPercentage.toFixed(1)}% below range).`);
        }
        
        if (stats.cv > 36) {
          observations.push(`• High glucose variability (CV: ${stats.cv.toFixed(1)}%).`);
        } else {
          observations.push(`• Good glucose stability (CV: ${stats.cv.toFixed(1)}%).`);
        }
        
        if (stats.readingGaps > 5) {
          observations.push(`• ${stats.readingGaps} data gaps detected, longest gap: ${Math.round(stats.longestGap)} minutes.`);
        }
        
        if (stats.dayNightVariation > 30) {
          observations.push(`• Significant day/night variation (${formatGlucoseValue(stats.dayNightVariation, 'mgdl', false)} ${getUnitLabel()}).`);
        }
        
        // Add observations to PDF
        observations.forEach((obs, index) => {
          pdf.text(obs, 20, yPos + 16 + (index * 8));
        });
      }
      
      // Add treatment data if selected
      if (includeTreatments && filteredTreatments.length > 0) {
        const treatmentStats = calculateTreatmentStats();
        
        // Add new page if needed
        if (includeAdvancedStats || yPos > 220) {
          pdf.addPage();
          
          // Add header
          pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          pdf.rect(0, 0, 210, 20, 'F');
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Treatment Analysis', 15, 14);
          
          yPos = 30;
        } else {
          yPos += 60;
        }
        
        // Treatment summary section
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.setFontSize(14);
        pdf.text('INSULIN & CARBOHYDRATE SUMMARY', 15, yPos);
        
        yPos += 10;
        
        // Create treatment metrics boxes
        const boxWidth = 85;
        const boxHeight = 50;
        const boxSpacing = 10;
        
        // Insulin box
        const insulinBg = lighten([41, 128, 185], 0.9);
        pdf.setFillColor(insulinBg[0], insulinBg[1], insulinBg[2]);
        pdf.setDrawColor(41, 128, 185);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(15, yPos, boxWidth, boxHeight, 3, 3, 'FD');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(41, 128, 185);
        pdf.text('Insulin Summary', 20, yPos + 10);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(`Total Insulin: ${treatmentStats.totalInsulin.toFixed(1)} U`, 20, yPos + 20);
        pdf.text(`Daily Average: ${treatmentStats.dailyInsulin.toFixed(1)} U/day`, 20, yPos + 28);
        pdf.text(`Meal Boluses: ${treatmentStats.mealBoluses}`, 20, yPos + 36);
        pdf.text(`Correction Boluses: ${treatmentStats.correctionBoluses}`, 20, yPos + 44);
        
        // Carbohydrate box
        const carbBg = lighten([46, 184, 89], 0.9);
        pdf.setFillColor(carbBg[0], carbBg[1], carbBg[2]);
        pdf.setDrawColor(46, 184, 89);
        pdf.roundedRect(15 + boxWidth + boxSpacing, yPos, boxWidth, boxHeight, 3, 3, 'FD');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(46, 184, 89);
        pdf.text('Carbohydrate Summary', 20 + boxWidth + boxSpacing, yPos + 10);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(`Total Carbs: ${treatmentStats.totalCarbs.toFixed(0)} g`, 20 + boxWidth + boxSpacing, yPos + 20);
        pdf.text(`Daily Average: ${treatmentStats.dailyCarbs.toFixed(0)} g/day`, 20 + boxWidth + boxSpacing, yPos + 28);
        pdf.text(`Avg. Meal Size: ${treatmentStats.avgCarbs.toFixed(0)} g`, 20 + boxWidth + boxSpacing, yPos + 36);
        pdf.text(`Insulin:Carb Ratio: 1:${(1/treatmentStats.insulinCarbRatio).toFixed(1)}`, 20 + boxWidth + boxSpacing, yPos + 44);
        
        yPos += boxHeight + 15;
      }
      
      // Add recommendations if selected
      if (includeRecommendations) {
        // Add new page if needed
        if (yPos > 220) {
          pdf.addPage();
          
          // Add header
          pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          pdf.rect(0, 0, 210, 20, 'F');
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Recommendations & Next Steps', 15, 14);
          
          yPos = 30;
        } else {
          yPos += 10;
        }
        
        // Recommendations section
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('RECOMMENDATIONS & NEXT STEPS', 15, yPos);
        
        yPos += 10;
        
        // Recommendations box
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(15, yPos, 180, 60, 'S');
        
        // Generate recommendations based on data
        const recommendations = [];
        const stats = calculateStats();
        
        if (stats.timeInRange < 70) {
          if (stats.highPercentage > 25) {
            recommendations.push('• Consider reviewing insulin-to-carb ratios and correction factors to address elevated glucose levels.');
          }
          if (stats.lowPercentage > 4) {
            recommendations.push('• Evaluate basal rates and insulin sensitivity factors to reduce hypoglycemia risk.');
          }
        }
        
        if (stats.cv > 36) {
          recommendations.push('• Work on reducing glucose variability through more consistent meal timing and carbohydrate counting.');
        }
        
        if (stats.readingGaps > 5) {
          recommendations.push('• Improve CGM wear and connectivity to reduce data gaps for better monitoring.');
        }
        
        if (stats.veryHighPercentage > 5) {
          recommendations.push('• Address frequent high glucose excursions by reviewing insulin timing and dosing strategies.');
        }
        
        if (stats.veryLowPercentage > 1) {
          recommendations.push('• Urgent: Work with your healthcare provider to address severe hypoglycemia episodes.');
        }
        
        // Add general recommendations if needed
        if (recommendations.length < 3) {
          recommendations.push('• Continue regular monitoring and data review to maintain awareness of glucose patterns.');
          recommendations.push('• Share this report with your healthcare provider at your next appointment.');
          recommendations.push('• Consider keeping a food and activity log to identify additional patterns.');
        }
        
        // Add recommendations to PDF
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        recommendations.forEach((rec, index) => {
          if (index < 6) { // Limit to 6 recommendations to fit on page
            pdf.text(rec, 20, yPos + 10 + (index * 8));
          }
        });
        
        yPos += 65;
      }
      
      // Add footer to all pages using enhanced footer function
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        addFooter(i, pageCount);
      }
      
      // Save the PDF
      const fileName = `diabetes-report-${getDisplayLabel().replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const stats = calculateStats();

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-200">
      <div className="flex items-center mb-6">
        <FileText className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Comprehensive PDF Report</h3>
      </div>

      {/* Data Availability Info */}
      {dataSpanInfo && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Data Availability
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Available data: <strong>{dataSpanInfo.spanDays} days</strong> ({dataSpanInfo.totalReadings.toLocaleString()} readings)
                <br />
                From {format(dataSpanInfo.oldestDate, 'MMM dd, yyyy')} to {format(dataSpanInfo.newestDate, 'MMM dd, yyyy')}
              </p>
              {dataSpanInfo.spanDays < 90 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  💡 Need more data? You can fetch additional historical data for longer reports.
                </p>
              )}
            </div>
            {dataSpanInfo.spanDays < 90 && (
              <button
                onClick={async () => {
                  setFetchingMoreData(true);
                  try {
                    await fetchDataForDays(90); // Fetch 3 months of data
                  } catch (error) {
                    console.error('Failed to fetch more data:', error);
                  } finally {
                    setFetchingMoreData(false);
                  }
                }}
                disabled={fetchingMoreData}
                className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs rounded flex items-center transition-colors duration-200"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${fetchingMoreData ? 'animate-spin' : ''}`} />
                {fetchingMoreData ? 'Fetching...' : 'Fetch 3 Months'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Time Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Time Period
        </label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            value={isCustomRange ? 'custom' : timeWindow.toString()}
            onChange={(e) => handleTimeWindowChange(e.target.value)}
            className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            {getAllTimeWindows().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          
          {!isCustomRange && (
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </button>
          )}
        </div>

        {/* Warning for insufficient data */}
        {!isCustomRange && dataSpanInfo && timeWindow > dataSpanInfo.spanHours && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Limited Data Available:</strong> You selected {getTimeWindowLabel(timeWindow)}, but only {dataSpanInfo.spanDays} days of data are available.
                  {fetchingMoreData 
                    ? ' Fetching more data...' 
                    : ' The report will include all available readings.'
                  }
                </p>
              </div>
              {!fetchingMoreData && (
                <button
                  onClick={async () => {
                    const requestedDays = Math.ceil(timeWindow / 24);
                    setFetchingMoreData(true);
                    try {
                      await fetchDataForDays(requestedDays);
                    } catch (error) {
                      console.error('Failed to fetch more data:', error);
                    } finally {
                      setFetchingMoreData(false);
                    }
                  }}
                  className="ml-2 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded flex items-center transition-colors duration-200"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Fetch More
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Select Date Range</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                max={customDateRange.endDate}
                min={dataSpanInfo ? format(dataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                min={customDateRange.startDate}
                max={dataSpanInfo ? format(dataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
              />
            </div>
          </div>
          {dataSpanInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Available data: {format(dataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(dataSpanInfo.newestDate, 'dd.MM.yyyy')}
            </p>
          )}
          <div className="flex space-x-3">
            <button
              onClick={handleCustomDateSubmit}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              Apply Range
            </button>
            <button
              onClick={() => {
                setShowCalendar(false);
                if (isCustomRange) {
                  setIsCustomRange(false);
                }
              }}
              className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report Options */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Report Options</h4>
        
        {/* Report Theme */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Report Theme
          </label>
          <select
            value={reportTheme}
            onChange={(e) => setReportTheme(e.target.value as 'professional' | 'clinical' | 'personal')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
          >
            <option value="professional">Professional - Comprehensive clinical report</option>
            <option value="clinical">Clinical - Focus on medical metrics</option>
            <option value="personal">Personal - Easy-to-read summary</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeAdvancedStats"
              checked={includeAdvancedStats}
              onChange={(e) => setIncludeAdvancedStats(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includeAdvancedStats" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Advanced Statistics & Patterns
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeDistributionChart"
              checked={includeDistributionChart}
              onChange={(e) => setIncludeDistributionChart(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includeDistributionChart" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Glucose Distribution Chart
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeTreatments"
              checked={includeTreatments}
              onChange={(e) => setIncludeTreatments(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includeTreatments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Treatment Analysis
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includePersonalizedInsights"
              checked={includePersonalizedInsights}
              onChange={(e) => setIncludePersonalizedInsights(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includePersonalizedInsights" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Personalized Insights
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeRecommendations"
              checked={includeRecommendations}
              onChange={(e) => setIncludeRecommendations(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includeRecommendations" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Clinical Recommendations
            </label>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Report Preview</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Period</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{getDisplayLabel()}</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Readings</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.totalReadings.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Avg Glucose</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatGlucoseValue(stats.averageGlucose, 'mgdl', true)}</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Time in Range</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.timeInRange.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        
        {/* Time in Range Visual */}
        <div className="mb-4">
          <div className="h-6 flex rounded-md overflow-hidden">
            <div 
              className="bg-purple-500 dark:bg-purple-600" 
              style={{ width: `${stats.veryLowPercentage}%` }}
              title={`Very Low: ${stats.veryLowPercentage.toFixed(1)}%`}
            ></div>
            <div 
              className="bg-red-500 dark:bg-red-600" 
              style={{ width: `${stats.lowPercentage - stats.veryLowPercentage}%` }}
              title={`Low: ${(stats.lowPercentage - stats.veryLowPercentage).toFixed(1)}%`}
            ></div>
            <div 
              className="bg-green-500 dark:bg-green-600" 
              style={{ width: `${stats.timeInRange}%` }}
              title={`In Range: ${stats.timeInRange.toFixed(1)}%`}
            ></div>
            <div 
              className="bg-yellow-500 dark:bg-yellow-600" 
              style={{ width: `${stats.highPercentage - stats.veryHighPercentage}%` }}
              title={`High: ${(stats.highPercentage - stats.veryHighPercentage).toFixed(1)}%`}
            ></div>
            <div 
              className="bg-orange-500 dark:bg-orange-600" 
              style={{ width: `${stats.veryHighPercentage}%` }}
              title={`Very High: ${stats.veryHighPercentage.toFixed(1)}%`}
            ></div>
          </div>
          <div className="flex text-xs mt-1 justify-between">
            <span className="text-purple-600 dark:text-purple-400">Very Low</span>
            <span className="text-red-600 dark:text-red-400">Low</span>
            <span className="text-green-600 dark:text-green-400">In Range</span>
            <span className="text-yellow-600 dark:text-yellow-400">High</span>
            <span className="text-orange-600 dark:text-orange-400">Very High</span>
          </div>
        </div>
        
        {/* Report Sections Preview */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-gray-700 dark:text-gray-300">Clinical Assessment & Time in Range Analysis</span>
          </div>
          
          {includeAdvancedStats && (
            <div className="flex items-center">
              <BarChart2 className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Advanced Statistics & Daily Patterns</span>
            </div>
          )}
          
          {includeDistributionChart && (
            <div className="flex items-center">
              <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Glucose Distribution Visualization</span>
            </div>
          )}
          
          {includePersonalizedInsights && (
            <div className="flex items-center">
              <Brain className="h-4 w-4 text-pink-600 dark:text-pink-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Personalized Pattern Insights</span>
            </div>
          )}
          
          {includeTreatments && (
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Insulin & Carbohydrate Analysis</span>
            </div>
          )}
          
          {includeRecommendations && (
            <div className="flex items-center">
              <Zap className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Clinical Recommendations & Next Steps</span>
            </div>
          )}
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={generatePDF}
        disabled={filteredReadings.length === 0 || exporting}
        className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg disabled:cursor-not-allowed transition-all duration-200"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
            Generating Comprehensive PDF Report...
          </>
        ) : (
          <>
            <Download className="w-5 h-5 mr-2" />
            Generate Professional PDF Report ({getDisplayLabel()})
          </>
        )}
      </button>

      {filteredReadings.length === 0 && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          No data available for the selected time period
        </p>
      )}

      {/* Report Features */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Comprehensive Analysis</h4>
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Detailed statistics including time in range, variability metrics, and pattern identification to provide a complete picture of your diabetes management.
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <h4 className="font-medium text-green-900 dark:text-green-100">Clinical Assessment</h4>
          </div>
          <p className="text-sm text-green-800 dark:text-green-200">
            Professional evaluation of your glucose control with clinical targets and personalized recommendations for improvement based on your unique patterns.
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h4 className="font-medium text-purple-900 dark:text-purple-100">Healthcare Integration</h4>
          </div>
          <p className="text-sm text-purple-800 dark:text-purple-200">
            Professionally formatted reports designed to be shared with your healthcare team, facilitating more productive discussions about your diabetes management.
          </p>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> This report is for informational purposes only and does not constitute medical advice. 
            Always consult with your healthcare provider before making changes to your diabetes management plan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PDFExport;