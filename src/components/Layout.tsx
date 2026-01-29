import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  BarChart2, 
  Home, 
  Settings, 
  Info,
  ChevronDown,
  ChevronRight,
  LineChart,
  Clock,
  Bell,
  Download,
  Brain,
  Calculator,
  BarChart,
  Droplet,
  Cookie,
  TrendingUp,
  FileDown,
  Lightbulb,
  Sun,
  Moon,
  Cloud,
  Thermometer,
  Monitor,
  Zap,
  Target,
  Gauge,
  Beaker,
  FileText,
  Sparkles,
  Shield,
  Heart,
  Bed,
  Palette,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import DesignModeSelector from './DesignModeSelector';
import Alert from './Alert';
import { useAsyncErrors } from '../contexts/AsyncErrorContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavGroup {
  name: string;
  icon: React.ReactNode;
  items: {
    name: string;
    path: string;
    icon: React.ReactNode;
  }[];
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { lastError, clearLastError } = useAsyncErrors();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Dashboard', 'Analysis']);
  const [showDesignSelector, setShowDesignSelector] = useState(false);
  
  const isDark = theme === 'dark';
  
  const isActive = (path: string) => {
    return location.pathname === path ? 
      `bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200` : 
      `text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50`;
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const navigationGroups: NavGroup[] = [
    {
      name: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      items: [
        { name: 'Overview', path: '/', icon: <Activity className="h-4 w-4" /> },
        { name: 'Time in Range', path: '/time-in-range', icon: <Clock className="h-4 w-4" /> },
        { name: 'Glucose Chart', path: '/glucose-chart', icon: <LineChart className="h-4 w-4" /> },
        { name: 'Predictions', path: '/predictions', icon: <Brain className="h-4 w-4" /> },
        { name: 'Hypo Risk Forecast', path: '/hypo-risk', icon: <AlertTriangle className="h-4 w-4" /> }
      ]
    },
    {
      name: 'AI Analysis',
      icon: <Sparkles className="h-5 w-5" />,
      items: [
        { name: 'AI Insights', path: '/ai-insights', icon: <Brain className="h-4 w-4" /> },
        { name: 'Meal Analysis', path: '/meal-patterns', icon: <Cookie className="h-4 w-4" /> },
        { name: 'Management Plan', path: '/management-plan', icon: <FileText className="h-4 w-4" /> },
        { name: 'Safety Analysis', path: '/safety-analysis', icon: <Shield className="h-4 w-4" /> },
        { name: 'Exercise Impact', path: '/exercise-impact', icon: <Activity className="h-4 w-4" /> },
        { name: 'Sleep Analysis', path: '/sleep-analysis', icon: <Bed className="h-4 w-4" /> },
        { name: 'Stress Impact', path: '/stress-impact', icon: <Heart className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Analysis',
      icon: <BarChart2 className="h-5 w-5" />,
      items: [
        { name: 'Pattern Analysis', path: '/analysis', icon: <Lightbulb className="h-4 w-4" /> },
        { name: 'Advanced Stats', path: '/advanced-stats', icon: <BarChart className="h-4 w-4" /> },
        { name: 'A1C Estimation', path: '/a1c', icon: <Calculator className="h-4 w-4" /> },
        { name: 'Weather Impact', path: '/weather-impact', icon: <Cloud className="h-4 w-4" /> },
        { name: 'Circadian Rhythm', path: '/circadian', icon: <Sun className="h-4 w-4" /> },
        { name: 'Trend Analysis', path: '/trends', icon: <TrendingUp className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Treatment',
      icon: <Droplet className="h-5 w-5" />,
      items: [
        { name: 'Basal Rates', path: '/basal', icon: <Activity className="h-4 w-4" /> },
        { name: 'Basal Sanity', path: '/basal-sanity', icon: <Shield className="h-4 w-4" /> },
        { name: 'ISF Settings', path: '/isf', icon: <Thermometer className="h-4 w-4" /> },
        { name: 'ISF Optimization', path: '/isf-optimization', icon: <Target className="h-4 w-4" /> },
        { name: 'ISF/CR Tuning', path: '/isf-cr-tuning', icon: <SlidersHorizontal className="h-4 w-4" /> },
        { name: 'Meal Absorption', path: '/meal-absorption', icon: <Cookie className="h-4 w-4" /> },
        { name: 'Carb Ratios', path: '/carb-ratio', icon: <Cookie className="h-4 w-4" /> },
        { name: 'OpenAPS SMB', path: '/openaps-smb', icon: <Zap className="h-4 w-4" /> },
        { name: 'Loop Analysis', path: '/loop-analysis', icon: <Target className="h-4 w-4" /> },
        { name: 'Pump Settings', path: '/pump-settings', icon: <Gauge className="h-4 w-4" /> },
        { name: 'CGM Calibration', path: '/cgm-calibration', icon: <Beaker className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Data',
      icon: <Download className="h-5 w-5" />,
      items: [
        { name: 'Export Data', path: '/export', icon: <FileDown className="h-4 w-4" /> },
        { name: 'Alerts', path: '/alerts', icon: <Bell className="h-4 w-4" /> },
        { name: 'Data Quality', path: '/data-quality', icon: <BarChart className="h-4 w-4" /> },
        { name: 'Backup & Sync', path: '/backup-sync', icon: <Download className="h-4 w-4" /> }
      ]
    },
    {
      name: 'System',
      icon: <Settings className="h-5 w-5" />,
      items: [
        { name: 'Monitoring', path: '/monitoring', icon: <Monitor className="h-4 w-4" /> },
        { name: 'Settings', path: '/settings', icon: <Settings className="h-4 w-4" /> },
        { name: 'About', path: '/about', icon: <Info className="h-4 w-4" /> }
      ]
    }
  ];

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`bg-white dark:bg-gray-800 shadow-sm fixed w-full z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img 
                src="/DiabetesAnalyzer.png" 
                alt="Diabetes Analyzer Logo" 
                className="h-12 w-12 mr-3"
              />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Diabetes Analyzer</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowDesignSelector(!showDesignSelector)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Switch Design Mode"
              >
                <Palette className="h-5 w-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Toggle Theme"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-grow flex flex-col sm:flex-row pt-16">
        {/* Sidebar navigation */}
        <aside className="w-full sm:w-64 bg-white dark:bg-gray-800 shadow-sm sm:shadow-md">
          <nav className="px-2 py-4 sm:py-6">
            <div className="space-y-1">
              {navigationGroups.map((group) => (
                <div key={group.name} className="mb-2">
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md
                      ${expandedGroups.includes(group.name)
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                  >
                    {group.icon}
                    <span className="ml-3">{group.name}</span>
                    {expandedGroups.includes(group.name) ? (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    ) : (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </button>
                  
                  {expandedGroups.includes(group.name) && (
                    <div className="mt-1 space-y-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center pl-9 pr-4 py-2 text-sm font-medium rounded-md ${isActive(item.path)}`}
                        >
                          {item.icon}
                          <span className="ml-3">{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* Page content */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {lastError && (
            <div className="mb-4">
              <Alert
                variant="danger"
                title={lastError.label ? `Error (${lastError.label})` : 'Error'}
                dismissible
                onDismiss={clearLastError}
              >
                {lastError.message}
              </Alert>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Design Mode Selector Modal */}
      {showDesignSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowDesignSelector(false)}
          />
          <div className="relative z-60 max-w-md w-full mx-4">
            <DesignModeSelector />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;