import React, { useMemo, useState } from 'react';
import { FileText, Database, Activity, Brain, Sparkles, Award, TrendingUp, Share, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useNightscout } from '../contexts/NightscoutContext';
import { useGlucoseFormatting } from '../hooks/useGlucoseFormatting';
import PDFExport from '../components/PDFExport';
import AdvancedPDFReport from '../components/AdvancedPDFReport';
import ComprehensivePDFReport from '../components/ComprehensivePDFReport';
import DataExport from '../components/DataExport';
import LoadingSpinner from '../components/LoadingSpinner';
import { runSafeAsync } from '../utils/safeAsync';
import { sliceSortedByTimeRange } from '../utils/sortedTimeSeries';
import { getTreatmentMs } from '../utils/nightscoutTime';

const ExportData: React.FC = () => {
  const { 
    data, 
    url, 
    loading,
    error,
    fetchDataForDays,
    analysisPeriod
  } = useNightscout();

  const { formatGlucoseValue, getUnitLabel, unit, convertToCurrentUnit, getCurrentGlucoseRanges } = useGlucoseFormatting();

  const [activeTab, setActiveTab] = useState<'comprehensive' | 'advanced' | 'standard' | 'data'>('comprehensive');

  const tabs = [
    {
      key: 'comprehensive',
      name: 'Comprehensive Report',
      icon: Award,
      description: '16-page clinical analysis',
      color: 'text-indigo-600'
    },
    {
      key: 'advanced',
      name: 'Advanced Analytics',
      icon: Brain,
      description: 'AI-powered comprehensive analysis',
      color: 'text-purple-600'
    },
    {
      key: 'standard',
      name: 'Standard Reports',
      icon: FileText,
      description: 'Professional medical reports',
      color: 'text-blue-600'
    },
    {
      key: 'data',
      name: 'Raw Data Export',
      icon: Database,
      description: 'CSV and JSON formats',
      color: 'text-green-600'
    }
  ] as const;

  // Comprehensive Report time range selection (mirrors Standard Reports UX)
  const [comprehensiveTimeWindow, setComprehensiveTimeWindow] = useState(168); // 7 days
  const [comprehensiveIsCustomRange, setComprehensiveIsCustomRange] = useState(false);
  const [comprehensiveCustomDateRange, setComprehensiveCustomDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [comprehensiveShowCalendar, setComprehensiveShowCalendar] = useState(false);
  const [comprehensiveFetchingMoreData, setComprehensiveFetchingMoreData] = useState(false);

  const entriesSortedAsc = useMemo(() => {
    if (!data?.entries?.length) return [];
    return [...data.entries].sort((a, b) => (a?.date ?? 0) - (b?.date ?? 0));
  }, [data?.entries]);

  const treatmentsSortedAsc = useMemo(() => {
    if (!data?.treatments?.length) return [];
    return [...data.treatments].sort((a, b) => getTreatmentMs(a) - getTreatmentMs(b));
  }, [data?.treatments]);

  const comprehensiveSelectedRange = useMemo(() => {
    if (comprehensiveIsCustomRange) {
      return {
        startMs: startOfDay(new Date(comprehensiveCustomDateRange.startDate)).getTime(),
        endMs: endOfDay(new Date(comprehensiveCustomDateRange.endDate)).getTime()
      };
    }

    const endMs = Date.now();
    const startMs = endMs - comprehensiveTimeWindow * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [
    comprehensiveIsCustomRange,
    comprehensiveCustomDateRange.startDate,
    comprehensiveCustomDateRange.endDate,
    comprehensiveTimeWindow
  ]);

  const comprehensiveDataSpanInfo = useMemo(() => {
    if (!entriesSortedAsc.length) return null;

    const oldestEntry = entriesSortedAsc[0];
    const newestEntry = entriesSortedAsc[entriesSortedAsc.length - 1];
    const spanDays = Math.round(((newestEntry?.date ?? 0) - (oldestEntry?.date ?? 0)) / (1000 * 60 * 60 * 24));
    const spanHours = Math.round(((newestEntry?.date ?? 0) - (oldestEntry?.date ?? 0)) / (1000 * 60 * 60));

    return {
      oldestDate: new Date(oldestEntry.date),
      newestDate: new Date(newestEntry.date),
      spanDays,
      spanHours,
      totalReadings: entriesSortedAsc.length
    };
  }, [entriesSortedAsc]);

  const comprehensiveGetTimeWindowLabel = (hours: number) => {
    if (hours < 24) return `${hours} hours`;
    if (hours < 168) {
      const days = hours / 24;
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours < 720) {
      const weeks = hours / 168;
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    const months = Math.round(hours / 720);
    return `${months} month${months > 1 ? 's' : ''}`;
  };

  const comprehensiveGetAvailableTimeWindows = () => {
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

    if (!comprehensiveDataSpanInfo) return allWindows;

    return allWindows.map(window => {
      const hasEnoughData = comprehensiveDataSpanInfo.spanHours >= window.value;
      const requestedDays = Math.ceil(window.value / 24);

      if (hasEnoughData) return { ...window, hasEnoughData: true };

      if (requestedDays <= 90) {
        return {
          ...window,
          label: `${window.label} (will fetch more data)`,
          hasEnoughData: false,
          canFetch: true
        };
      }

      return {
        ...window,
        label: `${window.label} (limited data available)`,
        hasEnoughData: false,
        canFetch: false
      };
    });
  };

  const comprehensiveHandleTimeWindowChange = async (value: string) => {
    if (value === 'custom') {
      setComprehensiveIsCustomRange(true);
      setComprehensiveShowCalendar(true);
      return;
    }

    setComprehensiveIsCustomRange(false);
    const newTimeWindow = parseInt(value);
    setComprehensiveTimeWindow(newTimeWindow);
    setComprehensiveShowCalendar(false);

    const requestedDays = Math.ceil(newTimeWindow / 24);
    if (comprehensiveDataSpanInfo && requestedDays > analysisPeriod && requestedDays > comprehensiveDataSpanInfo.spanDays) {
      setComprehensiveFetchingMoreData(true);
      try {
        await fetchDataForDays(requestedDays);
      } catch (err) {
        console.error('Failed to fetch more data for comprehensive report:', err);
      } finally {
        setComprehensiveFetchingMoreData(false);
      }
    }
  };

  const comprehensiveHandleCustomDateSubmit = () => {
    const startDate = new Date(comprehensiveCustomDateRange.startDate);
    const endDate = new Date(comprehensiveCustomDateRange.endDate);

    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }

    if (endDate > new Date()) {
      alert('End date cannot be in the future');
      return;
    }

    setComprehensiveIsCustomRange(true);
    setComprehensiveShowCalendar(false);
  };

  const comprehensiveFilteredReadings = useMemo(() => {
    if (!entriesSortedAsc.length) return [];
    return sliceSortedByTimeRange(entriesSortedAsc, (reading) => reading?.date ?? 0, comprehensiveSelectedRange.startMs, comprehensiveSelectedRange.endMs);
  }, [entriesSortedAsc, comprehensiveSelectedRange.startMs, comprehensiveSelectedRange.endMs]);

  const comprehensiveFilteredTreatments = useMemo(() => {
    if (!treatmentsSortedAsc.length) return [];
    return sliceSortedByTimeRange(treatmentsSortedAsc, getTreatmentMs, comprehensiveSelectedRange.startMs, comprehensiveSelectedRange.endMs);
  }, [treatmentsSortedAsc, comprehensiveSelectedRange.startMs, comprehensiveSelectedRange.endMs]);

  const comprehensiveReportData = useMemo(() => {
    if (!data) return data;
    return {
      ...data,
      entries: comprehensiveFilteredReadings,
      treatments: comprehensiveFilteredTreatments
    };
  }, [data, comprehensiveFilteredReadings, comprehensiveFilteredTreatments]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data || !url) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <Activity className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
                Nightscout Connection Required
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Please connect to your Nightscout instance to access export features.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Data Export & Reports</h1>
            <p className="text-blue-200 text-lg">Export your diabetes data and generate comprehensive reports</p>
          </div>
          <div className="text-right">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="h-5 w-5" />
                <span className="font-medium">Connected to</span>
              </div>
              <p className="text-xl font-bold">{url || 'Nightscout'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <tab.icon className={`h-5 w-5 ${activeTab === tab.key ? tab.color : ''}`} />
                  <div className="text-left">
                    <div>{tab.name}</div>
                    <div className="text-xs opacity-75">{tab.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'comprehensive' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <Award className="h-6 w-6 mr-2 text-indigo-600" />
                  Comprehensive Clinical Report
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Generate an extensive 16-page clinical analysis report with detailed statistics, pattern analysis, 
                  lifestyle factors, and comprehensive recommendations. Perfect for healthcare provider consultations.
                </p>
              </div>

              {/* Time Selection (same UX as Standard Reports) */}
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Time Period
                </label>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <select
                    value={comprehensiveIsCustomRange ? 'custom' : comprehensiveTimeWindow.toString()}
                    onChange={(e) =>
                      runSafeAsync(() => comprehensiveHandleTimeWindowChange(e.target.value), {
                        label: 'ExportData: comprehensiveHandleTimeWindowChange'
                      })
                    }
                    className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                  >
                    {comprehensiveGetAvailableTimeWindows().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="custom">Custom Range</option>
                  </select>

                  {!comprehensiveIsCustomRange && (
                    <button
                      onClick={() => setComprehensiveShowCalendar(!comprehensiveShowCalendar)}
                      className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Calendar
                    </button>
                  )}
                </div>

                {/* Warning for insufficient data */}
                {!comprehensiveIsCustomRange && comprehensiveDataSpanInfo && comprehensiveTimeWindow > comprehensiveDataSpanInfo.spanHours && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Limited Data Available:</strong> You selected {comprehensiveGetTimeWindowLabel(comprehensiveTimeWindow)}, but only {comprehensiveDataSpanInfo.spanDays} days of data are available.
                          {comprehensiveFetchingMoreData ? ' Fetching more data...' : ' The report will include all available readings.'}
                        </p>
                      </div>
                      {!comprehensiveFetchingMoreData && (
                        <button
                          onClick={() =>
                            runSafeAsync(
                              async () => {
                                const requestedDays = Math.ceil(comprehensiveTimeWindow / 24);
                                setComprehensiveFetchingMoreData(true);
                                try {
                                  await fetchDataForDays(requestedDays);
                                } catch (err) {
                                  console.error('Failed to fetch more data:', err);
                                } finally {
                                  setComprehensiveFetchingMoreData(false);
                                }
                              },
                              { label: 'ExportData: fetchMoreData' }
                            )
                          }
                          className="ml-2 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded flex items-center transition-colors duration-200"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Fetch More
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Calendar Panel */}
                {comprehensiveShowCalendar && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Select Date Range</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={comprehensiveCustomDateRange.startDate}
                          onChange={(e) => setComprehensiveCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                          max={comprehensiveCustomDateRange.endDate}
                          min={comprehensiveDataSpanInfo ? format(comprehensiveDataSpanInfo.oldestDate, 'yyyy-MM-dd') : undefined}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                        <input
                          type="date"
                          value={comprehensiveCustomDateRange.endDate}
                          onChange={(e) => setComprehensiveCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                          min={comprehensiveCustomDateRange.startDate}
                          max={comprehensiveDataSpanInfo ? format(comprehensiveDataSpanInfo.newestDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                        />
                      </div>
                    </div>

                    {comprehensiveDataSpanInfo && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Available data: {format(comprehensiveDataSpanInfo.oldestDate, 'dd.MM.yyyy')} - {format(comprehensiveDataSpanInfo.newestDate, 'dd.MM.yyyy')}
                      </p>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={comprehensiveHandleCustomDateSubmit}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                      >
                        Apply Range
                      </button>
                      <button
                        onClick={() => {
                          setComprehensiveShowCalendar(false);
                          if (comprehensiveIsCustomRange) setComprehensiveIsCustomRange(false);
                        }}
                        className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      {comprehensiveDataSpanInfo?.spanDays != null && comprehensiveDataSpanInfo.spanDays < 90 && (
                        <button
                          onClick={() =>
                            runSafeAsync(
                              async () => {
                                setComprehensiveFetchingMoreData(true);
                                try {
                                  await fetchDataForDays(90);
                                } catch (err) {
                                  console.error('Failed to fetch 3 months of data:', err);
                                } finally {
                                  setComprehensiveFetchingMoreData(false);
                                }
                              },
                              { label: 'ExportData: fetch3Months' }
                            )
                          }
                          disabled={comprehensiveFetchingMoreData}
                          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded flex items-center transition-colors duration-200"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${comprehensiveFetchingMoreData ? 'animate-spin' : ''}`} />
                          {comprehensiveFetchingMoreData ? 'Fetching...' : 'Fetch 3 Months'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <ComprehensivePDFReport 
                data={comprehensiveReportData} 
                basicStats={{}} 
                filteredReadings={comprehensiveFilteredReadings}
                formatGlucoseValue={formatGlucoseValue}
                getUnitLabel={getUnitLabel}
                unit={unit}
                convertToCurrentUnit={convertToCurrentUnit}
                getCurrentGlucoseRanges={getCurrentGlucoseRanges}
              />
            </div>
          )}

          {activeTab === 'advanced' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <Sparkles className="h-6 w-6 mr-2 text-purple-600" />
                  Advanced Analytics Report
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Generate comprehensive reports with AI-powered insights, pattern analysis, and predictive metrics. 
                  Perfect for detailed diabetes management analysis and sharing with healthcare providers.
                </p>
              </div>
              <AdvancedPDFReport data={data} />
            </div>
          )}

          {activeTab === 'standard' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <FileText className="h-6 w-6 mr-2 text-blue-600" />
                  Standard PDF Reports
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Generate professional medical reports with time in range analysis, glucose statistics, 
                  and treatment summaries. Ideal for medical appointments and routine diabetes monitoring.
                </p>
              </div>
              <PDFExport data={data} />
            </div>
          )}

          {activeTab === 'data' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <Database className="h-6 w-6 mr-2 text-green-600" />
                  Raw Data Export
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Export your raw glucose readings and treatment data in CSV or JSON format. 
                  Perfect for data analysis, backup purposes, or importing into other diabetes management tools.
                </p>
              </div>
              {data && <DataExport data={data} />}
            </div>
          )}
        </div>
      </div>

      {/* Features Comparison */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Export Features Comparison
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-2 border-purple-200 dark:border-purple-700">
            <div className="flex items-center mb-4">
              <Brain className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Advanced Analytics</h4>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Premium</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <Award className="h-4 w-4 text-purple-600 mr-2" />
                AI-powered insights and recommendations
              </li>
              <li className="flex items-center">
                <TrendingUp className="h-4 w-4 text-purple-600 mr-2" />
                Predictive analytics and pattern detection
              </li>
              <li className="flex items-center">
                <Activity className="h-4 w-4 text-purple-600 mr-2" />
                Circadian rhythm and lifestyle analysis
              </li>
              <li className="flex items-center">
                <Brain className="h-4 w-4 text-purple-600 mr-2" />
                Risk assessment and personalized goals
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Standard Reports</h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Professional</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Time in range analysis</li>
              <li>• Glucose statistics and trends</li>
              <li>• Treatment summaries</li>
              <li>• Data quality metrics</li>
              <li>• Medical appointment ready</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Database className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Raw Data Export</h4>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Essential</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• CSV format for spreadsheets</li>
              <li>• JSON format for developers</li>
              <li>• Complete data backup</li>
              <li>• Custom date range selection</li>
              <li>• Third-party tool compatibility</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      {data && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Available Data Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center mb-2">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Glucose Readings</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{data?.entries?.length?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total readings available</p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center mb-2">
                <Database className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Data Span</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {data?.entries?.length > 0 ? 
                  Math.ceil((Math.max(...data.entries.map(e => e.date)) - Math.min(...data.entries.map(e => e.date))) / (1000 * 60 * 60 * 24)) : 0
                }
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Days of data</p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center mb-2">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Treatments</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{data?.treatments?.length || 0}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Treatment records</p>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
              <div className="flex items-center mb-2">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Profiles</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{data?.profile?.length || 0}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Profile settings</p>
            </div>
          </div>
        </div>
      )}

      {!data && (
        <div className="text-center py-12">
          <Share className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-500 dark:text-gray-400">
            No data available for export
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Please ensure your Nightscout data is available and try refreshing
          </p>
        </div>
      )}
    </div>
  );
};

export default ExportData;