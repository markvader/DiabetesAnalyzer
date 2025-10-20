
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
import { useDesignMode } from '../contexts/DesignModeContext';

const About = () => {
  const { isPremium } = useDesignMode();
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
    <div className={cn(
      "min-h-screen",
      isPremium 
        ? "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20" 
        : "bg-gradient-to-br from-gray-50 to-blue-50 dark:from-dark-900 dark:to-dark-800"
    )}>
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
              <motion.div 
                className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center",
                  isPremium 
                    ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-2xl" 
                    : "bg-gradient-to-r from-primary-500 to-blue-600 shadow-glow"
                )}
                animate={isPremium ? { 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                } : {}}
                transition={isPremium ? { 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
              >
                <Activity className="w-10 h-10 text-white" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className={cn(
                  "w-6 h-6",
                  isPremium ? "text-purple-400 animate-pulse" : "text-yellow-400"
                )} />
              </motion.div>
            </div>
          </div>
          
          <h1 className={cn(
            "text-5xl md:text-6xl font-bold mb-6",
            isPremium 
              ? "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent" 
              : "bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent"
          )}>
            Diabetes Analyzer
          </h1>
          
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8"
            animate={isPremium ? { y: [0, -5, 0] } : {}}
            transition={isPremium ? { 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            } : {}}
          >
            Empowering people with Type 1 Diabetes through advanced analytics, AI-powered insights, 
            and personalized safety recommendations for optimal glucose management.
          </motion.p>
          
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <motion.div
              whileHover={isPremium ? { scale: 1.05, y: -2 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="primary" size="lg" animated>
                <Brain className="w-4 h-4 mr-1" />
                AI-Powered
              </Badge>
            </motion.div>
            <motion.div
              whileHover={isPremium ? { scale: 1.05, y: -2 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="success" size="lg" animated>
                <Shield className="w-4 h-4 mr-1" />
                Safety First
              </Badge>
            </motion.div>
            <motion.div
              whileHover={isPremium ? { scale: 1.05, y: -2 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="info" size="lg" animated>
                <Cloud className="w-4 h-4 mr-1" />
                Nightscout Ready
              </Badge>
            </motion.div>
          </div>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              whileHover={isPremium ? { scale: 1.05 } : {}}
              whileTap={isPremium ? { scale: 0.95 } : {}}
            >
              <Button variant="primary" size="lg" icon={<LineChart className="w-5 h-5" />}>
                View Dashboard
              </Button>
            </motion.div>
            <motion.div
              whileHover={isPremium ? { scale: 1.05 } : {}}
              whileTap={isPremium ? { scale: 0.95 } : {}}
            >
              <Button variant="outline" size="lg" icon={<FileText className="w-5 h-5" />}>
                Documentation
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              whileHover={isPremium ? { 
                scale: 1.05, 
                y: -5,
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
              } : {}}
              transition={{ duration: 0.3 }}
            >
              <Card 
                variant="glass" 
                className={cn(
                  "text-center",
                  isPremium && "bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-700"
                )}
              >
                <div className={cn(
                  "text-3xl font-bold mb-2",
                  isPremium 
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent" 
                    : "text-primary-600 dark:text-primary-400"
                )}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </Card>
            </motion.div>
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
            <h2 className={cn(
              "text-3xl font-bold mb-4",
              isPremium 
                ? "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent" 
                : "text-gray-900 dark:text-gray-100"
            )}>
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
                whileHover={isPremium ? { 
                  y: -10,
                  boxShadow: "0 30px 60px rgba(0, 0, 0, 0.2)"
                } : {}}
              >
                <Card className={cn(
                  "h-full transition-all duration-300 group",
                  isPremium 
                    ? "bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-700 hover:border-purple-400 dark:hover:border-purple-500" 
                    : "hover:shadow-2xl"
                )}>
                  <motion.div 
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg",
                      "bg-gradient-to-r", feature.color,
                      isPremium && "shadow-2xl"
                    )}
                    whileHover={isPremium ? { 
                      scale: 1.15,
                      rotate: 5
                    } : { scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </motion.div>
                  
                  <h3 className={cn(
                    "text-xl font-semibold mb-3",
                    isPremium 
                      ? "bg-gradient-to-r from-gray-900 to-blue-900 dark:from-gray-100 dark:to-blue-100 bg-clip-text text-transparent" 
                      : "text-gray-900 dark:text-gray-100"
                  )}>
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
            <h2 className={cn(
              "text-3xl font-bold mb-4",
              isPremium 
                ? "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent" 
                : "text-gray-900 dark:text-gray-100"
            )}>
              Modern Design System
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Beautiful, accessible, and user-friendly interface components
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              whileHover={isPremium ? { scale: 1.02, y: -5 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Alert variant="success" title="Glucose in Target Range">
                Your current glucose is within the target range. Great job maintaining stable levels!
              </Alert>
            </motion.div>
            
            <motion.div
              whileHover={isPremium ? { scale: 1.02, y: -5 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Alert variant="warning" title="Predicted High Glucose">
                AI models predict glucose may rise above target in the next 2 hours. Consider adjusting insulin delivery.
              </Alert>
            </motion.div>
            
            <motion.div
              whileHover={isPremium ? { scale: 1.02, y: -5 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Alert variant="info" title="New Data Available">
                Fresh glucose readings have been synchronized from your Nightscout instance.
              </Alert>
            </motion.div>
            
            <motion.div
              whileHover={isPremium ? { scale: 1.02, y: -5 } : {}}
              transition={{ duration: 0.2 }}
            >
              <Alert variant="danger" title="Safety Alert">
                Low glucose detected. Please treat immediately and monitor closely.
              </Alert>
            </motion.div>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          whileHover={isPremium ? { scale: 1.02 } : {}}
        >
          <Card 
            variant="gradient" 
            className={cn(
              "text-center text-white",
              isPremium && "bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 shadow-2xl"
            )}
          >
            <motion.div 
              className="flex justify-center mb-6"
              animate={isPremium ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 10, -10, 0]
              } : {}}
              transition={isPremium ? { 
                duration: 4, 
                repeat: Infinity,
                ease: "easeInOut"
              } : {}}
            >
              <Heart className="w-16 h-16" />
            </motion.div>
            
            <h3 className="text-3xl font-bold mb-4">
              Ready to Optimize Your Diabetes Management?
            </h3>
            
            <p className="text-xl mb-8 text-white/90">
              Join thousands of people already using Diabetes Analyzer to improve their glucose control and quality of life.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div
                whileHover={isPremium ? { scale: 1.05 } : {}}
                whileTap={isPremium ? { scale: 0.95 } : {}}
              >
                <Button variant="secondary" size="lg" icon={<Users className="w-5 h-5" />}>
                  Join Community
                </Button>
              </motion.div>
              <motion.div
                whileHover={isPremium ? { scale: 1.05 } : {}}
                whileTap={isPremium ? { scale: 0.95 } : {}}
              >
                <Button variant="ghost" size="lg" icon={<Star className="w-5 h-5" />} className="text-white hover:bg-white/20">
                  Give Feedback
                </Button>
              </motion.div>
            </div>
          </Card>
        </motion.div>
        
      </div>
    </div>
  );
};

export default About;
