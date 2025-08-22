import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error details
    console.error('❌ React Error Boundary caught an error:', error);
    console.error('❌ Error Info:', errorInfo);
    console.error('❌ Component Stack:', errorInfo.componentStack);
    
    // Check if this is the object rendering error
    if (error.message.includes('Objects are not valid as a React child')) {
      console.error('🚨 OBJECT RENDERING ERROR DETECTED!');
      console.error('This error occurs when trying to render an object (like {percent: 50}) as a React child');
      console.error('Check for places where objects might be passed to JSX instead of primitive values');
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-red-50 dark:bg-red-900/20 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 dark:bg-red-900/50 rounded-full p-2 mr-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.956-.833-2.726 0L3.084 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Application Error
              </h2>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Something went wrong
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The application encountered an unexpected error. This has been logged for debugging.
              </p>
              
              {this.state.error && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Error Details:</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                  Show Technical Details (Development Mode)
                </summary>
                <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-auto whitespace-pre-wrap">
                    {this.state.error && this.state.error.stack}
                  </pre>
                  <hr className="my-2 border-gray-300 dark:border-gray-600" />
                  <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
