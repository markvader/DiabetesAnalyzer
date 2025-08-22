import React, { useState } from 'react';
import { FileText, Download, Calendar, Activity, Shield, Brain, Target, BarChart2, Zap, AlertTriangle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';
import { toMmol } from '../utils/glucoseUtils';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';

interface PDFExportProps {
  data: any;
}

const PDFExport: React.FC<PDFExportProps> = ({ data }) => {
  const { formatGlucoseValue, getUnitLabel, getCurrentGlucoseRanges, convertToCurrentUnit } = useGlucoseFormatting();
  const [timeWindow, setTimeWindow] = useState(168); // Default to 7 days
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [includeAdvancedStats, setIncludeAdvancedStats] = useState(true);
  const [includeTreatments, setIncludeTreatments] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);

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

    const glucoseValues = filteredReadings.map(r => r.sgv);
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
      averageGlucose: mean,
      timeInRange: (inRangeCount / filteredReadings.length) * 100,
      highPercentage: (highCount / filteredReadings.length) * 100,
      lowPercentage: (lowCount / filteredReadings.length) * 100,
      standardDeviation,
      cv,
      estimatedA1C,
      veryHighPercentage: (veryHighCount / filteredReadings.length) * 100,
      veryLowPercentage: (veryLowCount / filteredReadings.length) * 100,
      highLowRatio,
      dailyReadings,
      readingGaps: gaps,
      longestGap,
      timeAbove250: (above250Count / filteredReadings.length) * 100,
      timeBelow54: (below54Count / filteredReadings.length) * 100,
      avgDailyHighs,
      avgDailyLows,
      dayNightVariation,
      glucoseManagementIndicator
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

  const handleTimeWindowChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
      setShowCalendar(true);
    } else {
      setIsCustomRange(false);
      setTimeWindow(parseInt(value));
      setShowCalendar(false);
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
    return [
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
  };

  // Calculate available data span
  const dataSpanInfo = React.useMemo(() => {
    if (!data?.entries?.length) return null;
    
    const sortedEntries = [...data.entries].sort((a, b) => a.date - b.date);
    const oldestEntry = sortedEntries[0];
    const newestEntry = sortedEntries[sortedEntries.length - 1];
    const spanDays = Math.round((newestEntry.date - oldestEntry.date) / (1000 * 60 * 60 * 24));
    
    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      totalReadings: data.entries.length
    };
  }, [data?.entries]);

  const generatePDF = async () => {
    if (filteredReadings.length === 0) {
      alert('No data available for the selected time period');
      return;
    }

    setExporting(true);

    try {
      const stats = calculateStats();
      // Treatment stats calculated but not used in current PDF generation
      
      // Create PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set up fonts and colors
      pdf.setFont('helvetica');
      
      // Add background color to header
      pdf.setFillColor(41, 82, 163); // Dark blue header
      pdf.rect(0, 0, 210, 40, 'F');
      
      // Add header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Diabetes Management Report', 15, 20);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 15, 30);
      
      // Add report period
      pdf.setTextColor(0, 0, 0);
      pdf.setFillColor(240, 240, 240); // Light gray background
      pdf.rect(0, 40, 210, 12, 'F');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Report Period: ${getDisplayLabel()} | ${stats.totalReadings.toLocaleString()} readings`, 15, 48);
      
      // Add patient info section
      let yPos = 65;
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 82, 163); // Dark blue
      pdf.text('DIABETES MANAGEMENT SUMMARY', 15, yPos);
      
      yPos += 10;
      
      // Add key metrics section with colored boxes
      const addMetricBox = (title: string, value: string, subtext: string, color: [number, number, number], x: number, y: number, width: number) => {
        // Background
        pdf.setFillColor(color[0], color[1], color[2], 0.1);
        pdf.roundedRect(x, y, width, 20, 2, 2, 'F');
        
        // Border
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, y, width, 20, 2, 2, 'S');
        
        // Title
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(title, x + 4, y + 5);
        
        // Value
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(value, x + 4, y + 13);
        
        // Subtext
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(subtext, x + 4, y + 18);
      };
      
      // First row of metrics
      const ranges = getCurrentGlucoseRanges();
      const rangeLabel = `${formatGlucoseValue(ranges.TARGET_MIN, 'mgdl')}-${formatGlucoseValue(ranges.TARGET_MAX, 'mgdl')} ${getUnitLabel()}`;
      addMetricBox('AVERAGE GLUCOSE', formatGlucoseValue(stats.averageGlucose, 'mgdl'), 'Mean glucose level', [41, 82, 163], 15, yPos, 42); // Blue
      addMetricBox('TIME IN RANGE', `${stats.timeInRange.toFixed(1)}%`, rangeLabel, [46, 184, 89], 62, yPos, 42); // Green
      addMetricBox('ESTIMATED A1C', `${stats.estimatedA1C.toFixed(1)}%`, 'Based on average glucose', [156, 39, 176], 109, yPos, 42); // Purple
      addMetricBox('GMI', `${stats.glucoseManagementIndicator.toFixed(1)}%`, 'Glucose Management Indicator', [230, 126, 34], 156, yPos, 42); // Orange
      
      yPos += 25;
      
      // Second row of metrics
      const lowThreshold = formatGlucoseValue(ranges.TARGET_MIN, 'mgdl');
      const highThreshold = formatGlucoseValue(ranges.TARGET_MAX, 'mgdl');
      addMetricBox('VARIABILITY (CV)', `${stats.cv.toFixed(1)}%`, 'Coefficient of Variation', [41, 128, 185], 15, yPos, 42); // Light blue
      addMetricBox('TIME BELOW RANGE', `${stats.lowPercentage.toFixed(1)}%`, `<${lowThreshold} ${getUnitLabel()}`, [231, 76, 60], 62, yPos, 42); // Red
      addMetricBox('TIME ABOVE RANGE', `${stats.highPercentage.toFixed(1)}%`, `>${highThreshold} ${getUnitLabel()}`, [243, 156, 18], 109, yPos, 42); // Yellow
      addMetricBox('STANDARD DEVIATION', `±${formatGlucoseValue(stats.standardDeviation, 'mgdl', false)}`, getUnitLabel(), [149, 165, 166], 156, yPos, 42); // Gray
      
      yPos += 30;
      
      // Time in Range visualization
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 82, 163);
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
      const veryLowThreshold = formatGlucoseValue(convertToCurrentUnit(54, 'mgdl'), 'mgdl');
      const lowThresholdLabel = formatGlucoseValue(currentRanges.TARGET_MIN, 'mgdl');
      const highThresholdLabel = formatGlucoseValue(currentRanges.TARGET_MAX, 'mgdl');
      const veryHighThreshold = formatGlucoseValue(convertToCurrentUnit(250, 'mgdl'), 'mgdl');
      
      // Very Low legend
      pdf.setFillColor(156, 39, 176);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Very Low (<${veryLowThreshold} ${getUnitLabel()}): ${stats.veryLowPercentage.toFixed(1)}%`, barX + 5, yPos + 3);
      
      yPos += 6;
      
      // Low legend
      pdf.setFillColor(231, 76, 60);
      pdf.rect(barX, yPos, 3, 3, 'F');
      pdf.text(`Low (${veryLowThreshold}-${lowThresholdLabel} ${getUnitLabel()}): ${(stats.lowPercentage - stats.veryLowPercentage).toFixed(1)}%`, barX + 5, yPos + 3);
      
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
      
      // Add target ranges
      pdf.setFillColor(240, 240, 240);
      pdf.rect(15, yPos, 180, 20, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('TARGET RANGES', 20, yPos + 7);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const targetRangeText = `${lowThresholdLabel}-${highThresholdLabel} ${getUnitLabel()}`;
      const belowRangeText = `${lowThresholdLabel} ${getUnitLabel()}`;
      pdf.text(`• Time in Range (${targetRangeText}): ≥70%`, 20, yPos + 15);
      pdf.text(`• Time Below Range (<${belowRangeText}): <4%`, 100, yPos + 15);
      
      yPos += 25;
      
      // Add assessment
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(41, 82, 163);
      pdf.text('CLINICAL ASSESSMENT', 15, yPos);
      
      yPos += 8;
      
      // Assessment box
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(15, yPos, 180, 25, 'S');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      // Determine assessment text
      let assessmentText = '';
      let assessmentColor: [number, number, number] = [0, 0, 0];
      
      if (stats.timeInRange >= 70 && stats.lowPercentage < 4) {
        assessmentText = '✓ Excellent glucose control with optimal time in range and minimal hypoglycemia.';
        assessmentColor = [46, 184, 89]; // Green
      } else if (stats.timeInRange >= 60 && stats.lowPercentage < 5) {
        assessmentText = '✓ Good glucose control with room for improvement in time in range.';
        assessmentColor = [41, 128, 185]; // Blue
      } else if (stats.lowPercentage > 5) {
        assessmentText = '⚠ Elevated hypoglycemia risk. Consider adjusting insulin doses to reduce low glucose events.';
        assessmentColor = [231, 76, 60]; // Red
      } else if (stats.highPercentage > 30) {
        assessmentText = '⚠ Significant time above range. Consider reviewing insulin-to-carb ratios and correction factors.';
        assessmentColor = [243, 156, 18]; // Yellow
      } else {
        assessmentText = '⚠ Glucose management needs improvement. Consider reviewing diabetes management plan with healthcare provider.';
        assessmentColor = [243, 156, 18]; // Yellow
      }
      
      pdf.setTextColor(assessmentColor[0], assessmentColor[1], assessmentColor[2]);
      pdf.text(assessmentText, 20, yPos + 10);
      
      // Add variability assessment
      let variabilityText = '';
      if (stats.cv < 36) {
        variabilityText = '✓ Glucose variability is within target range (CV <36%).';
        pdf.setTextColor(46, 184, 89); // Green
      } else {
        variabilityText = '⚠ Elevated glucose variability (CV >36%). Consider more consistent meal timing and insulin dosing.';
        pdf.setTextColor(243, 156, 18); // Yellow
      }
      
      pdf.text(variabilityText, 20, yPos + 20);
      
      // Add second page with advanced statistics if selected
      if (includeAdvancedStats) {
        pdf.addPage();
        
        // Add header to second page
        pdf.setFillColor(41, 82, 163);
        pdf.rect(0, 0, 210, 20, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Advanced Glucose Statistics', 15, 14);
        
        yPos = 30;
        
        // Daily patterns section
        pdf.setTextColor(41, 82, 163);
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
        
        // Extreme values section
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('EXTREME VALUES & RISK ANALYSIS', 15, yPos);
        
        yPos += 10;
        
        // Extreme values table
        const extremeHeaders = ['Metric', 'Value', 'Target', 'Risk Level'];
        const veryLowThresholdLabel = formatGlucoseValue(convertToCurrentUnit(54, 'mgdl'), 'mgdl');
        const veryHighThresholdLabel = formatGlucoseValue(convertToCurrentUnit(250, 'mgdl'), 'mgdl');
        const lowTargetLabel = formatGlucoseValue(currentRanges.TARGET_MIN, 'mgdl');
        const highTargetLabel = formatGlucoseValue(currentRanges.TARGET_MAX, 'mgdl');
        
        const extremeData = [
          [`Time <${veryLowThresholdLabel} ${getUnitLabel()}`, `${stats.veryLowPercentage.toFixed(1)}%`, '<1%', stats.veryLowPercentage < 1 ? 'Low' : stats.veryLowPercentage < 3 ? 'Medium' : 'High'],
          [`Time >${veryHighThresholdLabel} ${getUnitLabel()}`, `${stats.veryHighPercentage.toFixed(1)}%`, '<5%', stats.veryHighPercentage < 5 ? 'Low' : stats.veryHighPercentage < 10 ? 'Medium' : 'High'],
          ['Avg. Daily Low', `${formatGlucoseValue(stats.avgDailyLows, 'mgdl')} ${getUnitLabel()}`, `>${lowTargetLabel} ${getUnitLabel()}`, convertToCurrentUnit(stats.avgDailyLows, 'mgdl') > currentRanges.TARGET_MIN ? 'Low' : 'Medium'],
          ['Avg. Daily High', `${formatGlucoseValue(stats.avgDailyHighs, 'mgdl')} ${getUnitLabel()}`, `<${highTargetLabel} ${getUnitLabel()}`, convertToCurrentUnit(stats.avgDailyHighs, 'mgdl') < currentRanges.TARGET_MAX ? 'Low' : 'Medium']
        ];
        
        yPos = createTable(extremeHeaders, extremeData, 15, yPos, 180);
        
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
          pdf.setFillColor(41, 82, 163);
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
        pdf.setTextColor(41, 82, 163);
        pdf.setFontSize(14);
        pdf.text('INSULIN & CARBOHYDRATE SUMMARY', 15, yPos);
        
        yPos += 10;
        
        // Create treatment metrics boxes
        const boxWidth = 85;
        const boxHeight = 50;
        const boxSpacing = 10;
        
        // Insulin box
        pdf.setFillColor(41, 128, 185, 0.1); // Light blue
        pdf.setDrawColor(41, 128, 185);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(15, yPos, boxWidth, boxHeight, 3, 3, 'FD');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(41, 128, 185);
        pdf.text('Insulin Summary', 20, yPos + 10);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Total Insulin: ${treatmentStats.totalInsulin.toFixed(1)} U`, 20, yPos + 20);
        pdf.text(`Daily Average: ${treatmentStats.dailyInsulin.toFixed(1)} U/day`, 20, yPos + 28);
        pdf.text(`Meal Boluses: ${treatmentStats.mealBoluses}`, 20, yPos + 36);
        pdf.text(`Correction Boluses: ${treatmentStats.correctionBoluses}`, 20, yPos + 44);
        
        // Carbohydrate box
        pdf.setFillColor(46, 184, 89, 0.1); // Light green
        pdf.setDrawColor(46, 184, 89);
        pdf.roundedRect(15 + boxWidth + boxSpacing, yPos, boxWidth, boxHeight, 3, 3, 'FD');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(46, 184, 89);
        pdf.text('Carbohydrate Summary', 20 + boxWidth + boxSpacing, yPos + 10);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
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
          pdf.setFillColor(41, 82, 163);
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
      
      // Add footer to all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Footer line
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(15, 280, 195, 280);
        
        // Footer text
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('This report is for informational purposes only and should not replace medical advice.', 15, 285);
        pdf.text(`Page ${i} of ${pageCount}`, 180, 285);
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
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeAdvancedStats"
              checked={includeAdvancedStats}
              onChange={(e) => setIncludeAdvancedStats(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded transition-colors duration-200"
            />
            <label htmlFor="includeAdvancedStats" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Include Advanced Statistics
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
              Include Treatment Analysis
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
              Include Recommendations
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
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatGlucoseValue(stats.averageGlucose, 'mgdl')} {getUnitLabel()}</span>
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
              <span className="text-gray-700 dark:text-gray-300">Advanced Statistics & Pattern Analysis</span>
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
              <Target className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Personalized Recommendations & Next Steps</span>
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