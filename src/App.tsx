import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NightscoutProvider } from './contexts/NightscoutContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { GlucoseUnitsProvider } from './contexts/GlucoseUnitsContext';
import { InsulinPumpProvider } from './contexts/InsulinPumpContext';
import { TimeFormatProvider } from './contexts/TimeFormatContext';
import { TensorFlowProvider } from './contexts/TensorFlowContext';
import { DashboardDisplayProvider } from './contexts/DashboardDisplayContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';
import About from './pages/About';
import TimeInRange from './pages/TimeInRange';
import GlucoseChart from './pages/GlucoseChart';
import Predictions from './pages/Predictions';
import AdvancedStats from './pages/AdvancedStats';
import A1C from './pages/A1C';
import Basal from './pages/Basal';
import ISF from './pages/ISF';
import CarbRatio from './pages/CarbRatio';
import OpenAPSSMB from './pages/OpenAPSSMB';
import LoopAnalysis from './pages/LoopAnalysis';
import PumpSettings from './pages/PumpSettings';
import CGMCalibration from './pages/CGMCalibration';
import ExportData from './pages/ExportData';
import DataQuality from './pages/DataQuality';
import BackupSync from './pages/BackupSync';
import MealPatterns from './pages/MealPatterns';
import TrendAnalysis from './pages/TrendAnalysis';
import WeatherImpact from './pages/WeatherImpact';
import CircadianRhythm from './pages/CircadianRhythm';
import Alerts from './pages/Alerts';
import MonitoringPage from './pages/MonitoringPage';
import AIInsights from './pages/AIInsights';
import ManagementPlan from './pages/ManagementPlan';
import SafetyAnalysis from './pages/SafetyAnalysis';
import ExerciseImpact from './pages/ExerciseImpact';
import SleepAnalysis from './pages/SleepAnalysis';
import StressImpact from './pages/StressImpact';
import ISFOptimization from './pages/ISFOptimization';
import TensorFlowTest from './pages/TensorFlowTest';

function App() {
  return (
    <ThemeProvider>
      <TimeFormatProvider>
        <GlucoseUnitsProvider>
          <InsulinPumpProvider>
            <TensorFlowProvider>
              <DashboardDisplayProvider>
                <NightscoutProvider>
                  <SubscriptionProvider>
              <Router>
                <Layout>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
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
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/ai-insights" element={<AIInsights />} />
                  <Route path="/management-plan" element={<ManagementPlan />} />
                  <Route path="/safety-analysis" element={<SafetyAnalysis />} />
                  <Route path="/exercise-impact" element={<ExerciseImpact />} />
                  <Route path="/sleep-analysis" element={<SleepAnalysis />} />
                  <Route path="/stress-impact" element={<StressImpact />} />
                  <Route path="/isf-optimization" element={<ISFOptimization />} />
                  <Route path="/tensorflow-test" element={<TensorFlowTest />} />
                </Routes>
                  </ErrorBoundary>
              </Layout>
            </Router>
          </SubscriptionProvider>
        </NightscoutProvider>
      </DashboardDisplayProvider>
    </TensorFlowProvider>
  </InsulinPumpProvider>
  </GlucoseUnitsProvider>
  </TimeFormatProvider>
  </ThemeProvider>
  );
}

export default App;