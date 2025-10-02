import { toast } from 'react-toastify';
import logger from './logger';

/**
 * Enhanced error handling utilities for the frontend
 */

// Error categories for frontend handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown'
};

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
};

/**
 * Enhanced API error handler
 */
export class ApiError extends Error {
  constructor(response, data = null) {
    super();
    this.name = 'ApiError';
    this.response = response;
    this.status = response?.status;
    this.data = data;
    this.retryable = data?.error?.retryable || false;
    this.retryAfter = data?.error?.retryAfter;
    this.category = data?.error?.category || this.categorizeError();
    this.userMessage = data?.error?.message || this.generateUserMessage();
    this.technicalMessage = data?.error?.technical?.originalMessage || response?.statusText;
    this.action = data?.error?.action;
    this.timestamp = new Date().toISOString();
  }

  categorizeError() {
    if (!this.status) return ERROR_CATEGORIES.UNKNOWN;
    
    if (this.status >= 500) return ERROR_CATEGORIES.SERVER;
    if (this.status === 404) return ERROR_CATEGORIES.NOT_FOUND;
    if (this.status === 403) return ERROR_CATEGORIES.AUTHORIZATION;
    if (this.status === 401) return ERROR_CATEGORIES.AUTHENTICATION;
    if (this.status >= 400) return ERROR_CATEGORIES.VALIDATION;
    
    return ERROR_CATEGORIES.CLIENT;
  }

  generateUserMessage() {
    switch (this.status) {
      case 400:
        return 'Please check your input and try again.';
      case 401:
        return 'Please log in to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested item could not be found.';
      case 408:
        return 'The request timed out. Please try again.';
      case 409:
        return 'This action conflicts with existing data.';
      case 413:
        return 'The file you are trying to upload is too large.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'A server error occurred. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'The service is temporarily unavailable. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

/**
 * Network error handler
 */
export class NetworkError extends Error {
  constructor(message = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
    this.category = ERROR_CATEGORIES.NETWORK;
    this.retryable = true;
    this.userMessage = 'Please check your internet connection and try again.';
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Timeout error handler
 */
export class TimeoutError extends Error {
  constructor(timeout = 30000) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.category = ERROR_CATEGORIES.NETWORK;
    this.retryable = true;
    this.timeout = timeout;
    this.userMessage = 'The request took too long to complete. Please try again.';
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Parse error from API response
 */
export async function parseApiError(response) {
  let data = null;
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Try to get text for non-JSON responses
      const text = await response.text();
      if (text) {
        data = { error: { message: text } };
      }
    }
  } catch (parseError) {
    logger.warn('Failed to parse error response', { error: parseError.message });
  }
  
  return new ApiError(response, data);
}

/**
 * Enhanced fetch with automatic error handling and retry logic
 */
export async function enhancedFetch(url, options = {}, retryConfig = RETRY_CONFIG) {
  const {
    maxAttempts,
    baseDelay,
    maxDelay,
    backoffMultiplier
  } = { ...RETRY_CONFIG, ...retryConfig };

  let lastError;
  let delay = baseDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Set timeout for the request
      const timeoutMs = options.timeout || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const fetchOptions = {
        ...options,
        signal: controller.signal
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // Parse error from response
      const apiError = await parseApiError(response);
      
      // Check if error is retryable and we have attempts left
      if (apiError.retryable && attempt < maxAttempts) {
        logger.warn('Retryable error during request', { attempt, message: apiError.userMessage });
        lastError = apiError;
        
        // Wait before retrying, with exponential backoff
        await sleep(Math.min(delay, maxDelay));
        delay *= backoffMultiplier;
        continue;
      }
      
      throw apiError;

    } catch (error) {
      // Handle different types of errors
      if (error.name === 'AbortError') {
        const timeoutError = new TimeoutError(options.timeout);
        if (attempt < maxAttempts) {
          logger.warn('Request timeout, retrying', { attempt });
          lastError = timeoutError;
          await sleep(Math.min(delay, maxDelay));
          delay *= backoffMultiplier;
          continue;
        }
        throw timeoutError;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new NetworkError();
        if (attempt < maxAttempts) {
          logger.warn('Network error, retrying', { attempt });
          lastError = networkError;
          await sleep(Math.min(delay, maxDelay));
          delay *= backoffMultiplier;
          continue;
        }
        throw networkError;
      }
      
      // If it's already one of our custom errors, check if retryable
      if ((error instanceof ApiError || error instanceof NetworkError || error instanceof TimeoutError) 
          && error.retryable && attempt < maxAttempts) {
        logger.warn('Retryable error during fetch', { attempt, message: error.userMessage });
        lastError = error;
        await sleep(Math.min(delay, maxDelay));
        delay *= backoffMultiplier;
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Global error handler for displaying user-friendly error messages
 */
export function handleError(error, options = {}) {
  const {
    showToast = true,
    logError = true,
    fallbackMessage = 'An unexpected error occurred',
    context = {}
  } = options;

  if (logError) {
    logger.error('Error occurred', { error: error.message, stack: error.stack, context });
  }

  let userMessage = fallbackMessage;
  let toastType = 'error';
  let action = null;

  // Extract user-friendly message based on error type
  if (error instanceof ApiError || error instanceof NetworkError || error instanceof TimeoutError) {
    userMessage = error.userMessage || fallbackMessage;
    action = error.action;
    
    // Adjust toast type based on error category
    if (error.category === ERROR_CATEGORIES.NETWORK && error.retryable) {
      toastType = 'warning';
    }
  } else if (error.response) {
    // Axios-style error
    userMessage = error.response.data?.error?.message || 
                  error.response.data?.message || 
                  fallbackMessage;
  } else if (error.message) {
    // Use error message, but make it user-friendly
    userMessage = makeUserFriendly(error.message);
  }

  // Show toast notification
  if (showToast) {
    const toastOptions = {
      position: 'top-right',
      autoClose: toastType === 'error' ? 8000 : 5000, // Longer for errors
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    };

    if (action) {
      const messageWithAction = `${userMessage}\n\n${action}`;
      toast[toastType](messageWithAction, toastOptions);
    } else {
      toast[toastType](userMessage, toastOptions);
    }
  }

  return {
    userMessage,
    action,
    category: error.category || ERROR_CATEGORIES.UNKNOWN,
    retryable: error.retryable || false,
    technicalMessage: error.technicalMessage || error.message
  };
}

/**
 * Make technical error messages more user-friendly
 */
function makeUserFriendly(message) {
  const friendlyMappings = {
    'Network Error': 'Please check your internet connection and try again.',
    'timeout': 'The request took too long. Please try again.',
    'fetch': 'Failed to connect to the server. Please try again.',
    'JSON': 'Received an invalid response from the server.',
    'undefined is not a function': 'A technical error occurred. Please refresh the page.',
    'Cannot read property': 'A technical error occurred. Please refresh the page.',
    'Permission denied': 'You do not have permission to perform this action.',
    'Unauthorized': 'Please log in to continue.',
    'Forbidden': 'You do not have permission to access this resource.'
  };

  for (const [key, friendlyMessage] of Object.entries(friendlyMappings)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // If no mapping found, return original message but capitalized properly
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/**
 * Validate form data and show appropriate error messages
 */
export function validateAndShowErrors(data, validationRules) {
  const errors = [];

  for (const [field, rules] of Object.entries(validationRules)) {
    const value = data[field];

    if (rules.required && (!value || value.toString().trim() === '')) {
      errors.push({
        field,
        message: `${rules.label || field} is required`
      });
      continue;
    }

    if (rules.type === 'email' && value && !isValidEmail(value)) {
      errors.push({
        field,
        message: `${rules.label || field} must be a valid email address`
      });
    }

    if (rules.type === 'number' && value && isNaN(Number(value))) {
      errors.push({
        field,
        message: `${rules.label || field} must be a valid number`
      });
    }

    if (rules.minLength && value && value.length < rules.minLength) {
      errors.push({
        field,
        message: `${rules.label || field} must be at least ${rules.minLength} characters`
      });
    }

    if (rules.maxLength && value && value.length > rules.maxLength) {
      errors.push({
        field,
        message: `${rules.label || field} must be no more than ${rules.maxLength} characters`
      });
    }

    if (rules.pattern && value && !rules.pattern.test(value)) {
      errors.push({
        field,
        message: rules.patternMessage || `${rules.label || field} format is invalid`
      });
    }
  }

  if (errors.length > 0) {
    const errorMessage = errors.map(err => err.message).join('\n');
    toast.error(errorMessage, { 
      position: 'top-right',
      autoClose: 8000
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create a retry handler for failed operations
 */
export function createRetryHandler(operation, maxAttempts = 3) {
  return async (...args) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation(...args);
      } catch (error) {
        lastError = error;
        
        if (error.retryable && attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.warn('Operation failed, retrying', { attempt, delay });
          await sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    throw lastError;
  };
}

/**
 * Wrapper for async operations with automatic error handling
 */
export function withErrorHandling(asyncOperation, errorOptions = {}) {
  return async (...args) => {
    try {
      return await asyncOperation(...args);
    } catch (error) {
      handleError(error, errorOptions);
      throw error; // Re-throw so caller can handle if needed
    }
  };
}

export default {
  ApiError,
  NetworkError,
  TimeoutError,
  parseApiError,
  enhancedFetch,
  handleError,
  validateAndShowErrors,
  createRetryHandler,
  withErrorHandling,
  ERROR_CATEGORIES
};