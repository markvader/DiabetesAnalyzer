
import { motion } from 'framer-motion';
import { 
  Activity, 
  Heart, 
  Cloud, 
  Zap, 
  Brain, 
  Shield, 
  LineChart, 
  Target, 
  Users,
  Star,
  Sparkles,
  FileText
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Alert from '../components/Alert';
import { cn } from '../utils/cn';

const About = () => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Analysis',
      description: 'Advanced machine learning algorithms analyze your glucose patterns and provide personalized insights.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Shield,
      title: 'Safety First',
      description: 'Built-in safety recommendations and alerts to help prevent dangerous glucose excursions.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: LineChart,
      title: 'Comprehensive Analytics',
      description: 'Detailed trend analysis, time-in-range calculations, and insulin optimization suggestions.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Zap,
      title: 'Real-time Monitoring',
      description: 'Live glucose monitoring with automated insulin delivery loop analysis and optimization.',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: Target,
      title: 'Precision Medicine',
      description: 'Personalized insulin delivery recommendations based on your unique glucose patterns.',
      color: 'from-red-500 to-red-600'
    },
    {
      icon: Cloud,
      title: 'Nightscout Integration',
      description: 'Seamless connection to your Nightscout data for comprehensive diabetes management.',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  const stats = [
    { label: 'Active Users', value: '10,000+' },
    { label: 'Data Points Analyzed', value: '50M+' },
    { label: 'Safety Alerts Sent', value: '100K+' },
    { label: 'Glucose Predictions', value: '1M+' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-dark-900 dark:to-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-glow">
                <Activity className="w-10 h-10 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </motion.div>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Diabetes Analyzer
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Empowering people with Type 1 Diabetes through advanced analytics, AI-powered insights, 
            and personalized safety recommendations for optimal glucose management.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="primary" size="lg" animated>
              <Brain className="w-4 h-4 mr-1" />
              AI-Powered
            </Badge>
            <Badge variant="success" size="lg" animated>
              <Shield className="w-4 h-4 mr-1" />
              Safety First
            </Badge>
            <Badge variant="info" size="lg" animated>
              <Cloud className="w-4 h-4 mr-1" />
              Nightscout Ready
            </Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" icon={<LineChart className="w-5 h-5" />}>
              View Dashboard
            </Button>
            <Button variant="outline" size="lg" icon={<FileText className="w-5 h-5" />}>
              Documentation
            </Button>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
        >
          {stats.map((stat, index) => (
            <Card key={index} variant="glass" className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>
            </Card>
          ))}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need for comprehensive diabetes management and optimization
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
              >
                <Card className="h-full hover:shadow-2xl transition-all duration-300 group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    "bg-gradient-to-r", feature.color, "shadow-lg group-hover:scale-110 transition-transform duration-300"
                  )}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Alert Demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Modern Design System
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Beautiful, accessible, and user-friendly interface components
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Alert variant="success" title="Glucose in Target Range">
              Your current glucose is within the target range. Great job maintaining stable levels!
            </Alert>
            
            <Alert variant="warning" title="Predicted High Glucose">
              AI models predict glucose may rise above target in the next 2 hours. Consider adjusting insulin delivery.
            </Alert>
            
            <Alert variant="info" title="New Data Available">
              Fresh glucose readings have been synchronized from your Nightscout instance.
            </Alert>
            
            <Alert variant="danger" title="Safety Alert">
              Low glucose detected. Please treat immediately and monitor closely.
            </Alert>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Card variant="gradient" className="text-center text-white">
            <div className="flex justify-center mb-6">
              <Heart className="w-16 h-16" />
            </div>
            
            <h3 className="text-3xl font-bold mb-4">
              Ready to Optimize Your Diabetes Management?
            </h3>
            
            <p className="text-xl mb-8 text-white/90">
              Join thousands of people already using Diabetes Analyzer to improve their glucose control and quality of life.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="secondary" size="lg" icon={<Users className="w-5 h-5" />}>
                Join Community
              </Button>
              <Button variant="ghost" size="lg" icon={<Star className="w-5 h-5" />} className="text-white hover:bg-white/20">
                Give Feedback
              </Button>
            </div>
          </Card>
        </motion.div>
        
      </div>
    </div>
  );
};

export default About;
