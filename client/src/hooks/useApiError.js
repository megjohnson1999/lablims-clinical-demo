import { useState, useCallback } from 'react';

const useApiError = () => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((err) => {
    console.error('API Error:', err);
    
    let errorObj = {
      message: 'An unexpected error occurred',
      details: null,
      statusCode: null,
      timestamp: new Date().toISOString(),
      suggestions: []
    };

    if (err.response) {
      // Server responded with error
      const { data, status, statusText } = err.response;
      
      errorObj = {
        message: data?.message || data?.msg || statusText || 'Server error',
        details: data?.details || null,
        statusCode: status,
        timestamp: data?.timestamp || new Date().toISOString(),
        suggestions: data?.suggestions || []
      };

      // Add status-specific suggestions
      if (status === 401) {
        errorObj.suggestions.push('Please log in again');
      } else if (status === 403) {
        errorObj.suggestions.push('Contact your administrator for access');
      } else if (status === 404) {
        errorObj.suggestions.push('The requested resource was not found');
      } else if (status === 413) {
        errorObj.suggestions.push('File is too large - try a smaller file');
      } else if (status === 415) {
        errorObj.suggestions.push('File type not supported - try CSV or Excel format');
      } else if (status >= 500) {
        errorObj.suggestions.push('Server error - please try again later');
      }
    } else if (err.request) {
      // Network error
      errorObj = {
        message: 'Network error - could not connect to server',
        details: { type: 'network_error' },
        statusCode: null,
        timestamp: new Date().toISOString(),
        suggestions: [
          'Check your internet connection',
          'Verify the server is running',
          'Try refreshing the page'
        ]
      };
    } else {
      // Other error
      errorObj = {
        message: err.message || 'An unexpected error occurred',
        details: { type: 'client_error' },
        statusCode: null,
        timestamp: new Date().toISOString(),
        suggestions: ['Try refreshing the page']
      };
    }

    setError(errorObj);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeWithErrorHandling = useCallback(async (asyncFn, options = {}) => {
    const { showLoading = true, onSuccess, onError } = options;
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    clearError();
    
    try {
      const result = await asyncFn();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      handleError(err);
      
      if (onError) {
        onError(err);
      }
      
      throw err; // Re-throw for caller to handle if needed
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [handleError, clearError]);

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeWithErrorHandling
  };
};

export default useApiError;