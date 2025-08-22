import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error handler to catch object rendering errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Objects are not valid as a React child')) {
    console.error('🚨 GLOBAL ERROR HANDLER - Object rendering error caught:', {
      message: event.error.message,
      stack: event.error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    
    // Try to identify the object that's causing the issue
    if (event.error.message.includes('found: object with keys')) {
      const match = event.error.message.match(/found: object with keys \{([^}]+)\}/);
      if (match) {
        console.error('🔍 Object keys causing the error:', match[1]);
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
