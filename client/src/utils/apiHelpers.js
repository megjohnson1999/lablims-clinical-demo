import { toast } from 'react-toastify';

// Enhanced API call wrapper with loading states and error handling
export const withLoadingState = async (apiCall, options = {}) => {
  const {
    loadingMessage = 'Loading...',
    successMessage = null,
    errorMessage = 'An error occurred',
    showSuccessToast = true,
    showErrorToast = true,
    onStart = null,
    onSuccess = null,
    onError = null,
    onFinally = null
  } = options;

  try {
    // Start loading
    if (onStart) onStart();

    // Execute the API call
    const response = await apiCall();

    // Success handling
    if (successMessage && showSuccessToast) {
      toast.success(successMessage);
    }
    if (onSuccess) onSuccess(response);

    return response;
  } catch (error) {
    // Error handling
    const errorMsg = error.response?.data?.msg || error.message || errorMessage;
    
    if (showErrorToast) {
      toast.error(errorMsg);
    }
    
    if (onError) {
      onError(error, errorMsg);
    }
    
    throw error;
  } finally {
    // Cleanup
    if (onFinally) onFinally();
  }
};

// Enhanced fetch with loading states
export const enhancedFetch = async (url, options = {}, loadingOptions = {}) => {
  const {
    setLoading,
    setError,
    loadingMessage = 'Loading...',
    showToastOnError = true
  } = loadingOptions;

  try {
    if (setLoading) setLoading(true);
    if (setError) setError('');

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.msg || errorData.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    const errorMsg = error.message || 'Network error occurred';
    
    if (setError) setError(errorMsg);
    if (showToastOnError) {
      toast.error(errorMsg);
    }
    
    throw error;
  } finally {
    if (setLoading) setLoading(false);
  }
};

// Debounced function utility
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Progress tracking for file uploads
export const createUploadProgress = (onProgress) => {
  return (progressEvent) => {
    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    if (onProgress) onProgress(percentCompleted);
  };
};

// Generic retry mechanism
export const withRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  
  throw lastError;
};