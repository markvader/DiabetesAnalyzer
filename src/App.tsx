import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MaterialUIProvider } from './theme/MaterialUIProvider';
import { NightscoutProvider } from './contexts/NightscoutContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { GlucoseUnitsProvider } from './contexts/GlucoseUnitsContext';
import { InsulinPumpProvider } from './contexts/InsulinPumpContext';
import { TimeFormatProvider } from './contexts/TimeFormatContext';
import { TensorFlowProvider } from './contexts/TensorFlowContext';
import { DashboardDisplayProvider } from './contexts/DashboardDisplayContext';
import { TimeInRangeProvider } from './contexts/TimeInRangeContext';
import { DesignModeProvider } from './contexts/DesignModeContext';
import { AsyncErrorProvider } from './contexts/AsyncErrorContext';
import AdaptiveLayout from './components/AdaptiveLayout';
import ErrorBoundary from './components/ErrorBoundary';

const AdaptiveDashboard = lazy(() => import('./pages/AdaptiveDashboard'));
const AdaptiveSettings = lazy(() => import('./pages/AdaptiveSettings'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ModernDashboard = lazy(() => import('./pages/ModernDashboard'));
const SimpleModernDemo = lazy(() => import('./pages/SimpleModernDemo'));
const Analysis = lazy(() => import('./pages/Analysis'));
const About = lazy(() => import('./pages/About'));
const TimeInRange = lazy(() => import('./pages/TimeInRange'));
const GlucoseChart = lazy(() => import('./pages/GlucoseChart'));
const Predictions = lazy(() => import('./pages/Predictions'));
const AdvancedStats = lazy(() => import('./pages/AdvancedStats'));
const A1C = lazy(() => import('./pages/A1C'));
const Basal = lazy(() => import('./pages/Basal'));
const ISF = lazy(() => import('./pages/ISF'));
const CarbRatio = lazy(() => import('./pages/CarbRatio'));
const OpenAPSSMB = lazy(() => import('./pages/OpenAPSSMB'));
const LoopAnalysis = lazy(() => import('./pages/LoopAnalysis'));
const PumpSettings = lazy(() => import('./pages/PumpSettings'));
const CGMCalibration = lazy(() => import('./pages/CGMCalibration'));
const ExportData = lazy(() => import('./pages/ExportData'));
const DataQuality = lazy(() => import('./pages/DataQuality'));
const BackupSync = lazy(() => import('./pages/BackupSync'));
const MealPatterns = lazy(() => import('./pages/MealPatterns'));
const TrendAnalysis = lazy(() => import('./pages/TrendAnalysis'));
const WeatherImpact = lazy(() => import('./pages/WeatherImpact'));
const CircadianRhythm = lazy(() => import('./pages/CircadianRhythm'));
const Alerts = lazy(() => import('./pages/Alerts'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const ManagementPlan = lazy(() => import('./pages/ManagementPlan'));
const SafetyAnalysis = lazy(() => import('./pages/SafetyAnalysis'));
const ExerciseImpact = lazy(() => import('./pages/ExerciseImpact'));
const SleepAnalysis = lazy(() => import('./pages/SleepAnalysis'));
const StressImpact = lazy(() => import('./pages/StressImpact'));
const ISFOptimization = lazy(() => import('./pages/ISFOptimization'));
const TensorFlowTest = lazy(() => import('./pages/TensorFlowTest'));
const HypoRiskForecast = lazy(() => import('./pages/HypoRiskForecast'));
const ISFCRTuning = lazy(() => import('./pages/ISFCRTuning'));
const BasalSanity = lazy(() => import('./pages/BasalSanity'));
const MealAbsorption = lazy(() => import('./pages/MealAbsorption'));

function App() {
  return (
    <ThemeProvider>
      <DesignModeProvider>
        <MaterialUIProvider>
          <TimeFormatProvider>
            <GlucoseUnitsProvider>
              <TimeInRangeProvider>
                <InsulinPumpProvider>
                  <TensorFlowProvider>
                    <DashboardDisplayProvider>
                      <NightscoutProvider>
                        <SubscriptionProvider>
                          <AsyncErrorProvider>
                            <Router>
                              <AdaptiveLayout>
                                <ErrorBoundary>
                                  <Suspense fallback={null}>
                                    <Routes>
                                    <Route path="/" element={<AdaptiveDashboard />} />
                                    <Route path="/classic" element={<Dashboard />} />
                                    <Route path="/modern" element={<ModernDashboard />} />
                                    <Route path="/demo" element={<SimpleModernDemo />} />
                                    <Route path="/settings" element={<AdaptiveSettings />} />
                                    <Route path="/time-in-range" element={<TimeInRange />} />
                                    <Route path="/glucose-chart" element={<GlucoseChart />} />
                                    <Route path="/predictions" element={<Predictions />} />
                                    <Route path="/analysis" element={<Analysis />} />
                                    <Route path="/advanced-stats" element={<AdvancedStats />} />
                                    <Route path="/a1c" element={<A1C />} />
                                    <Route path="/basal" element={<Basal />} />
                                    <Route path="/isf" element={<ISF />} />
                                    <Route path="/carb-ratio" element={<CarbRatio />} />
                                    <Route path="/openaps-smb" element={<OpenAPSSMB />} />
                                    <Route path="/loop-analysis" element={<LoopAnalysis />} />
                                    <Route path="/pump-settings" element={<PumpSettings />} />
                                    <Route path="/cgm-calibration" element={<CGMCalibration />} />
                                    <Route path="/export" element={<ExportData />} />
                                    <Route path="/data-quality" element={<DataQuality />} />
                                    <Route path="/backup-sync" element={<BackupSync />} />
                                    <Route path="/alerts" element={<Alerts />} />
                                    <Route path="/meal-patterns" element={<MealPatterns />} />
                                    <Route path="/trends" element={<TrendAnalysis />} />
                                    <Route path="/weather-impact" element={<WeatherImpact />} />
                                    <Route path="/circadian" element={<CircadianRhythm />} />
                                    <Route path="/monitoring" element={<MonitoringPage />} />
                                    <Route path="/about" element={<About />} />
                                    <Route path="/ai-insights" element={<AIInsights />} />
                                    <Route path="/management-plan" element={<ManagementPlan />} />
                                    <Route path="/safety-analysis" element={<SafetyAnalysis />} />
                                    <Route path="/exercise-impact" element={<ExerciseImpact />} />
                                    <Route path="/sleep-analysis" element={<SleepAnalysis />} />
                                    <Route path="/stress-impact" element={<StressImpact />} />
                                    <Route path="/hypo-risk" element={<HypoRiskForecast />} />
                                    <Route path="/isf-optimization" element={<ISFOptimization />} />
                                    <Route path="/isf-cr-tuning" element={<ISFCRTuning />} />
                                    <Route path="/basal-sanity" element={<BasalSanity />} />
                                    <Route path="/meal-absorption" element={<MealAbsorption />} />
                                    <Route path="/tensorflow-test" element={<TensorFlowTest />} />
                                    </Routes>
                                  </Suspense>
                                </ErrorBoundary>
                              </AdaptiveLayout>
                            </Router>
                          </AsyncErrorProvider>
                        </SubscriptionProvider>
                      </NightscoutProvider>
                    </DashboardDisplayProvider>
                  </TensorFlowProvider>
                </InsulinPumpProvider>
              </TimeInRangeProvider>
            </GlucoseUnitsProvider>
          </TimeFormatProvider>
        </MaterialUIProvider>
      </DesignModeProvider>
    </ThemeProvider>
  );
}

export default App;
