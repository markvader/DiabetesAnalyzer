import { 
  Activity, 
  Heart, 
  Cloud, 
  Zap, 
  Brain, 
  Shield, 
  LineChart, 
  BarChart2, 
  Clock, 
  Target, 
  Droplet, 
  Cookie, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Thermometer, 
  Sun,
  Phone,
  Mail,
  MessageCircle
} from 'lucide-react';

const About = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">About Diabetes Analyzer</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Advanced analytics and AI-powered safety recommendations for diabetes management
        </p>
      </div>
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-xl overflow-hidden mb-8">
        <div className="p-8 md:p-10 text-white">
          <div className="flex items-center mb-6">
            <Activity className="h-10 w-10 mr-4" />
            <h3 className="text-2xl font-bold">Empowering Diabetes Management</h3>
          </div>
          
          <p className="text-lg mb-6 leading-relaxed">
            Diabetes Analyzer is a comprehensive platform designed to help people with Type 1 Diabetes 
            optimize their insulin delivery settings through advanced data analysis, pattern detection, 
            and AI-powered safety recommendations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 mr-2" />
                <h4 className="font-medium">Safety-First Approach</h4>
              </div>
              <p className="text-sm">
                Ultra-conservative recommendations with pediatric-focused safety constraints
              </p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-2">
                <Brain className="h-5 w-5 mr-2" />
                <h4 className="font-medium">AI-Powered Analysis</h4>
              </div>
              <p className="text-sm">
                Advanced machine learning algorithms for personalized insights
              </p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-2">
                <Cloud className="h-5 w-5 mr-2" />
                <h4 className="font-medium">Nightscout Integration</h4>
              </div>
              <p className="text-sm">
                Seamless connection to your Nightscout data for comprehensive analysis
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Core Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Zap className="h-7 w-7 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Core Features</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <LineChart className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Glucose Analytics</h4>
              </div>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Comprehensive glucose pattern analysis with time-in-range metrics, variability assessment, and trend detection.
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h4 className="font-medium text-green-900 dark:text-green-100">Treatment Optimization</h4>
              </div>
              <p className="text-green-800 dark:text-green-200 text-sm">
                AI-enhanced recommendations for basal rates, insulin sensitivity factors, and carb ratios based on your unique patterns.
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
                <h4 className="font-medium text-purple-900 dark:text-purple-100">Predictive Insights</h4>
              </div>
              <p className="text-purple-800 dark:text-purple-200 text-sm">
                Machine learning algorithms to predict glucose trends and provide proactive recommendations.
              </p>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <Shield className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
                <h4 className="font-medium text-orange-900 dark:text-orange-100">Safety Analysis</h4>
              </div>
              <p className="text-orange-800 dark:text-orange-200 text-sm">
                Ultra-safe recommendations with pediatric-focused safety constraints and hypoglycemia prevention as the top priority.
              </p>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <FileText className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
                <h4 className="font-medium text-red-900 dark:text-red-100">PDF Reports</h4>
              </div>
              <p className="text-red-800 dark:text-red-200 text-sm">
                Generate comprehensive PDF reports for healthcare providers with detailed analysis and recommendations.
              </p>
            </div>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-lg transition-all duration-200 hover:shadow-md">
              <div className="flex items-center mb-3">
                <BarChart2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h4 className="font-medium text-indigo-900 dark:text-indigo-100">Advanced Statistics</h4>
              </div>
              <p className="text-indigo-800 dark:text-indigo-200 text-sm">
                Detailed statistical analysis including glycemic variability, risk assessment, and A1C estimation.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Specialized Analysis Modules */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Brain className="h-7 w-7 text-purple-600 dark:text-purple-400 mr-3" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">Specialized Analysis Modules</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Time in Range Analysis</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Detailed breakdown of time spent in target range (3.9-10.0 mmol/L), above range, and below range with 
                personalized recommendations for improvement.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Target: ≥70% in range</span>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Droplet className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Basal Rate Optimization</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                AI-enhanced analysis of your background insulin needs throughout the day, with ultra-safe 
                recommendations for adjusting basal rates to prevent hypoglycemia.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Safety-first approach</span>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Cookie className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Meal Pattern Analysis</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Identifies patterns in your meal-related glucose responses and provides insights for 
                optimizing carb ratios and pre-bolusing strategies.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Machine learning powered</span>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">OpenAPS SMB Analysis</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Ultra-safe recommendations for OpenAPS Super Micro Bolus settings with pediatric-focused 
                safety constraints and carbohydrate coverage analysis.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Multi-tier safety system</span>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Thermometer className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Weather Impact Analysis</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Analyzes correlations between weather conditions and your glucose patterns, helping you 
                understand how temperature, humidity, and pressure affect your diabetes management.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Environmental factors</span>
              </div>
            </div>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <div className="flex items-center mb-3">
                <Sun className="h-6 w-6 text-amber-600 dark:text-amber-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Circadian Rhythm Analysis</h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                Examines how your glucose levels vary throughout different times of the day, including 
                dawn phenomenon detection and sleep pattern analysis.
              </p>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>24-hour patterns</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* How It Works */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/30 rounded-lg shadow-md overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Zap className="h-7 w-7 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">How It Works</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4">
                1
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Connect Your Data</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Simply enter your Nightscout URL in the settings. Diabetes Analyzer securely connects to your 
                  data without storing it on external servers. Your privacy is protected as all analysis happens 
                  directly in your browser.
                </p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 font-bold text-lg mr-4">
                2
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Advanced Analysis</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Our AI-powered algorithms analyze your glucose readings, insulin treatments, and current profile 
                  settings to identify patterns, detect anomalies, and understand your unique diabetes management needs.
                </p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-lg mr-4">
                3
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Safety-First Recommendations</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Receive ultra-safe, pediatric-focused recommendations for adjusting your insulin delivery settings. 
                  Our multi-tier safety system prioritizes hypoglycemia prevention above all else, with conservative 
                  suggestions that can be gradually adjusted.
                </p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-bold text-lg mr-4">
                4
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Implement & Monitor</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Work with your healthcare provider to implement suggested changes. Use the monitoring tools to 
                  track improvements in time-in-range, glycemic variability, and overall diabetes management. 
                  Generate comprehensive reports to share with your care team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Safety & Privacy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Safety First Approach</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Ultra-conservative recommendations with pediatric-focused safety constraints
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Multi-tier safety system with emergency-safe starting points
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  AI-powered hypoglycemia risk assessment and prevention
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Clear implementation guidelines with gradual adjustment protocols
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Comprehensive safety warnings and contraindications
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Heart className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Privacy & Data Security</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  All analysis happens directly in your browser - your data never leaves your device
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  No data is stored on external servers or shared with third parties
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Your Nightscout URL is stored only in your browser's local storage
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Read-only access to your Nightscout data - no changes are ever made
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Clear your data anytime by clearing your browser's local storage
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Important Disclaimer */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-md overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Important Medical Disclaimer</h3>
          </div>
          
          <div className="space-y-4 text-red-800 dark:text-red-200">
            <p>
              Diabetes Analyzer is designed to be a decision support tool, not a medical device. The recommendations 
              and insights provided are for educational purposes only and should not replace proper medical care 
              from your healthcare team.
            </p>
            
            <p>
              <strong>Always consult with your healthcare provider before making any changes to your diabetes management settings.</strong> 
              This is especially important for children, adolescents, and individuals with complex medical needs.
            </p>
            
            <p>
              The safety recommendations in this application are intentionally ultra-conservative and prioritize 
              hypoglycemia prevention above all else. They should be reviewed by your healthcare provider and 
              adjusted based on your individual needs and medical history.
            </p>
          </div>
        </div>
      </div>
      
      {/* About Nightscout */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-8 transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">About Nightscout</h3>
          </div>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Nightscout (CGM in the Cloud) is an open-source DIY project that allows real-time access to CGM data 
            via personal website, smartwatch viewers, or apps and widgets. It was created by parents of children 
            with Type 1 Diabetes and has continued to be developed, maintained, and supported by volunteers.
          </p>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Diabetes Analyzer connects to your existing Nightscout site to analyze your data and provide 
            personalized recommendations. If you don't have a Nightscout site yet, you can set one up by 
            following the instructions at the Nightscout website.
          </p>
          
          <div className="flex justify-center mt-6">
            <a 
              href="http://www.nightscout.info" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 flex items-center"
            >
              <Cloud className="h-5 w-5 mr-2" />
              Visit Nightscout.info
            </a>
          </div>
        </div>
      </div>
      
      {/* Team & Contact */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Heart className="h-6 w-6 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Our Mission</h3>
          </div>
          
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Diabetes Analyzer was created by a team of developers, data scientists, and people living with Type 1 Diabetes. 
            Our mission is to make advanced diabetes analytics accessible to everyone, with a special focus on safety 
            for pediatric patients. We believe that data-driven insights can lead to better outcomes and improved 
            quality of life for people with diabetes.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Get in Touch</h4>
            <p className="text-blue-800 dark:text-blue-200 mb-4">
              We're constantly working to improve Diabetes Analyzer based on user feedback. If you have questions, 
              suggestions, or need support, please reach out to us.
            </p>
            
            {/* Contact Information */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-center text-blue-800 dark:text-blue-200">
                <Mail className="h-4 w-4 mr-2" />
                <span className="text-sm">milan.krnjajic@gmail.com</span>
              </div>
              <div className="flex items-center justify-center text-blue-800 dark:text-blue-200">
                <Phone className="h-4 w-4 mr-2" />
                <span className="text-sm">+385 99 402 3492</span>
              </div>
            </div>
            
            {/* Contact Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a 
                href="mailto:milan.krnjajic@gmail.com" 
                className="flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Support
              </a>
              
              <a 
                href="https://wa.me/385994023492" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors duration-200"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </a>
              
              <a 
                href="viber://chat?number=385994023492" 
                className="flex items-center justify-center px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors duration-200"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Viber
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;