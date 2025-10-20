import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNightscout } from '../contexts/NightscoutContext';
import { useDesignMode } from '../contexts/DesignModeContext';
import AIManagementPlan from '../components/AIManagementPlan';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, Brain, RefreshCw, Sparkles } from 'lucide-react';

const ManagementPlan = () => {
  const { data, loading, error } = useNightscout();
  const { isPremium } = useDesignMode();
  const [manualRefresh, setManualRefresh] = useState(false);

  const handleRefreshAI = () => {
    setManualRefresh(prev => !prev);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h2 className={
            isPremium 
              ? "text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent" 
              : "text-2xl font-bold text-gray-900 dark:text-gray-100"
          }>
            {isPremium && <Sparkles className="inline-block w-6 h-6 mr-2 text-purple-500 animate-pulse" />}
            AI Management Plan
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Personalized diabetes management plan based on your unique data
          </p>
        </div>
        
        <motion.button 
          onClick={handleRefreshAI}
          className={
            isPremium
              ? "px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center transition-all duration-200 mt-4 sm:mt-0 shadow-lg hover:shadow-xl"
              : "px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center transition-colors duration-200 mt-4 sm:mt-0"
          }
          whileHover={isPremium ? { scale: 1.05 } : {}}
          whileTap={isPremium ? { scale: 0.95 } : {}}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh AI Plan
        </motion.button>
      </motion.div>

      {/* Hero Section */}
      <motion.div 
        className={
          isPremium
            ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-lg shadow-2xl overflow-hidden"
            : "bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-md overflow-hidden"
        }
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        whileHover={isPremium ? { scale: 1.02, boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)" } : {}}
      >
        <div className="p-6 text-white">
          <motion.div 
            className="flex items-center mb-4"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <FileText className="h-7 w-7 mr-3" />
            <h3 className="text-xl font-bold">Personalized Management Plan</h3>
          </motion.div>
          <motion.p 
            className="mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Our AI analyzes your glucose patterns, meal responses, and treatment data to create a 
            personalized diabetes management plan tailored to your unique needs. This plan includes 
            specific recommendations, realistic goals, and monitoring suggestions to help you optimize 
            your diabetes management.
          </motion.p>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.div 
              className={
                isPremium
                  ? "bg-white/20 p-4 rounded-lg backdrop-blur-sm border border-white/30"
                  : "bg-white/10 p-4 rounded-lg"
              }
              whileHover={isPremium ? { scale: 1.05, y: -5 } : {}}
            >
              <h4 className="font-medium mb-2">Data-Driven</h4>
              <p className="text-sm">
                Based on your actual glucose patterns and treatment history
              </p>
            </motion.div>
            <motion.div 
              className={
                isPremium
                  ? "bg-white/20 p-4 rounded-lg backdrop-blur-sm border border-white/30"
                  : "bg-white/10 p-4 rounded-lg"
              }
              whileHover={isPremium ? { scale: 1.05, y: -5 } : {}}
            >
              <h4 className="font-medium mb-2">Actionable</h4>
              <p className="text-sm">
                Specific, practical recommendations you can implement
              </p>
            </motion.div>
            <motion.div 
              className={
                isPremium
                  ? "bg-white/20 p-4 rounded-lg backdrop-blur-sm border border-white/30"
                  : "bg-white/10 p-4 rounded-lg"
              }
              whileHover={isPremium ? { scale: 1.05, y: -5 } : {}}
            >
              <h4 className="font-medium mb-2">Downloadable</h4>
              <p className="text-sm">
                Save your plan as a document to share with your healthcare team
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {data?.entries && data.entries.length > 0 && data?.treatments && data.treatments.length > 0 ? (
        <AIManagementPlan 
          readings={data.entries}
          treatments={data.treatments}
          manualRefresh={manualRefresh}
        />
      ) : (
        <motion.div 
          className={
            isPremium
              ? "bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 p-6 rounded-lg shadow-lg text-center border-2 border-blue-200 dark:border-blue-700"
              : "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center"
          }
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={isPremium ? { rotate: [0, 5, -5, 0] } : {}}
            transition={isPremium ? { duration: 3, repeat: Infinity } : {}}
          >
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          </motion.div>
          <h3 className={
            isPremium
              ? "text-lg font-medium bg-gradient-to-r from-gray-900 to-blue-900 dark:from-gray-100 dark:to-blue-100 bg-clip-text text-transparent mb-2"
              : "text-lg font-medium text-gray-900 dark:text-gray-100 mb-2"
          }>
            Insufficient Data
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            To generate a personalized management plan, we need both glucose readings and treatment data.
            Please ensure your Nightscout site has this information available.
          </p>
        </motion.div>
      )}

      {/* How to Use */}
      <motion.div 
        className={
          isPremium
            ? "bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20 p-6 rounded-lg shadow-lg border-2 border-purple-200 dark:border-purple-700"
            : "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
        }
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <h3 className={
          isPremium
            ? "text-lg font-medium bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-4"
            : "text-lg font-medium text-gray-900 dark:text-gray-100 mb-4"
        }>
          How to Use Your Management Plan
        </h3>
        
        <div className="space-y-4">
          <motion.div 
            className="flex"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            whileHover={isPremium ? { x: 5 } : {}}
          >
            <div className={
              isPremium
                ? "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg mr-4 shadow-lg"
                : "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4"
            }>
              1
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Review with Your Healthcare Team</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Share your management plan with your healthcare provider to discuss the recommendations and ensure they're appropriate for you
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            className="flex"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            whileHover={isPremium ? { x: 5 } : {}}
          >
            <div className={
              isPremium
                ? "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg mr-4 shadow-lg"
                : "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4"
            }>
              2
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Implement Gradually</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Make changes one at a time and monitor their effects before implementing additional recommendations
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            className="flex"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            whileHover={isPremium ? { x: 5 } : {}}
          >
            <div className={
              isPremium
                ? "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg mr-4 shadow-lg"
                : "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4"
            }>
              3
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Track Your Progress</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Use the monitoring suggestions to track your progress toward your goals
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            className="flex"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
            whileHover={isPremium ? { x: 5 } : {}}
          >
            <div className={
              isPremium
                ? "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg mr-4 shadow-lg"
                : "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg mr-4"
            }>
              4
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Generate Updated Plans</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Return to this page periodically to generate updated management plans based on your latest data
              </p>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          className={
            isPremium
              ? "mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border-2 border-yellow-300 dark:border-yellow-700"
              : "mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        >
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> This AI-generated plan is for informational purposes only and does not replace 
            medical advice. Always consult with your healthcare provider before making changes to your diabetes management.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default ManagementPlan;