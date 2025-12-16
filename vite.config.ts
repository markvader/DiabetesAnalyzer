import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // We intentionally split heavy dependencies (TensorFlow, charts, MUI, PDF tooling)
    // into separate chunks to keep the entry bundle small.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          charts: ['chart.js', 'react-chartjs-2', 'recharts', '@mui/x-charts', '@mui/x-data-grid', 'chartjs-adapter-date-fns'],
          ml: ['ml-kmeans', 'ml-matrix', 'ml-random-forest', 'ml-regression-multivariate-linear', 'ml-xgboost', 'regression'],
          pdf: ['jspdf'],
          tensorflow: ['@tensorflow/tfjs']
        }
      }
    }
  }
});
