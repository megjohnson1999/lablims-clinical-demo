const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced error handling middleware with user-friendly messages and detailed logging
 */

// Error categories for better handling
const ERROR_CATEGORIES = {
  DATABASE: 'database',
  VALIDATION: 'validation', 
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  FILE_SYSTEM: 'file_system',
  NETWORK: 'network',
  BUSINESS_LOGIC: 'business_logic',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES = {
  // Database errors
  'ECONNREFUSED': 'Unable to connect to the database. Please try again later.',
  'ENOTFOUND': 'Database server not found. Please contact support.',
  'ETIMEDOUT': 'Database connection timed out. Please try again.',
  'CONNECTION_TIMEOUT': 'Database took too long to respond. Please try again.',
  'QUERY_TIMEOUT': 'The database query took too long to complete. Please try a simpler search or contact support.',
  'DUPLICATE_KEY': 'This record already exists. Please check your data and try again.',
  'FOREIGN_KEY_VIOLATION': 'Cannot perform this action because it would break data relationships.',
  'CHECK_VIOLATION': 'The data provided does not meet the required format or constraints.',
  'NOT_NULL_VIOLATION': 'Please fill in all required fields.',
  
  // File system errors
  'EACCES': 'Permission denied. Please contact your administrator.',
  'ENOENT': 'The requested file was not found.',
  'ENOSPC': 'Not enough storage space available.',
  'EMFILE': 'Too many files are open. Please try again later.',
  'EISDIR': 'Expected a file but found a directory.',
  
  // Network errors
  'NETWORK_ERROR': 'Network connection problem. Please check your internet connection and try again.',
  'REQUEST_TIMEOUT': 'The request took too long to complete. Please try again.',
  'SERVICE_UNAVAILABLE': 'The service is temporarily unavailable. Please try again later.',
  
  // Validation errors
  'VALIDATION_ERROR': 'Please check your input data and try again.',
  'INVALID_FORMAT': 'The data format is not valid. Please check the requirements.',
  'MISSING_REQUIRED_FIELD': 'Please fill in all required fields.',
  'INVALID_EMAIL': 'Please enter a valid email address.',
  'INVALID_DATE': 'Please enter a valid date.',
  'INVALID_NUMBER': 'Please enter a valid number.',
  
  // Authentication/Authorization
  'UNAUTHORIZED': 'Please log in to access this feature.',
  'FORBIDDEN': 'You do not have permission to perform this action.',
  'TOKEN_EXPIRED': 'Your session has expired. Please log in again.',
  'INVALID_CREDENTIALS': 'Invalid username or password.',
  
  // Business logic errors
  'INSUFFICIENT_PERMISSIONS': 'You do not have sufficient permissions for this action.',
  'RESOURCE_NOT_FOUND': 'The requested item was not found.',
  'CONFLICT': 'This action conflicts with existing data.',
  'PRECONDITION_FAILED': 'The required conditions for this action are not met.',
  
  // Import/Export specific
  'INVALID_FILE_FORMAT': 'The file format is not supported. Please use CSV or Excel files.',
  'FILE_TOO_LARGE': 'The file is too large. Please use files smaller than 10MB.',
  'CORRUPT_FILE': 'The file appears to be corrupted. Please try again with a different file.',
  'MISSING_COLUMNS': 'Required columns are missing from your file.',
  'INVALID_DATA_TYPE': 'Some data in your file is not in the correct format.',
  'DUPLICATE_RECORDS': 'Your file contains duplicate records.',
  
  // ID Generation specific
  'ID_GENERATION_FAILED': 'Failed to generate a unique ID. Please try again.',
  'SEQUENCE_ERROR': 'There was a problem with the ID numbering system. Please contact support.',
  'CONCURRENT_MODIFICATION': 'Someone else modified this record while you were working on it. Please refresh and try again.'
};

/**
 * Categorize errors based on their characteristics
 */
function categorizeError(error) {
  // Database-related errors
  if (error.code && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) {
    return ERROR_CATEGORIES.DATABASE;
  }
  
  if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint violations
    return ERROR_CATEGORIES.DATABASE;
  }
  
  if (error.message && (
    error.message.includes('database') || 
    error.message.includes('connection') ||
    error.message.includes('query') ||
    error.message.includes('relation')
  )) {
    return ERROR_CATEGORIES.DATABASE;
  }
  
  // File system errors
  if (error.code && ['EACCES', 'ENOENT', 'ENOSPC', 'EMFILE', 'EISDIR'].includes(error.code)) {
    return ERROR_CATEGORIES.FILE_SYSTEM;
  }
  
  // Authentication/Authorization
  if (error.status && [401, 403].includes(error.status)) {
    return ERROR_CATEGORIES.AUTHENTICATION;
  }
  
  if (error.message && (
    error.message.includes('unauthorized') ||
    error.message.includes('forbidden') ||
    error.message.includes('token') ||
    error.message.includes('permission')
  )) {
    return ERROR_CATEGORIES.AUTHENTICATION;
  }
  
  // Validation errors
  if (error.status === 400 || (error.message && (
    error.message.includes('validation') ||
    error.message.includes('invalid') ||
    error.message.includes('required') ||
    error.message.includes('format')
  ))) {
    return ERROR_CATEGORIES.VALIDATION;
  }
  
  // Network errors
  if (error.code && ['ECONNRESET', 'EHOSTUNREACH', 'ENETDOWN'].includes(error.code)) {
    return ERROR_CATEGORIES.NETWORK;
  }
  
  // Business logic errors
  if (error.status && [404, 409, 412].includes(error.status)) {
    return ERROR_CATEGORIES.BUSINESS_LOGIC;
  }
  
  return ERROR_CATEGORIES.UNKNOWN;
}

/**
 * Generate user-friendly error message
 */
function getUserFriendlyMessage(error) {
  // Direct code mapping
  if (error.code && USER_FRIENDLY_MESSAGES[error.code]) {
    return USER_FRIENDLY_MESSAGES[error.code];
  }
  
  // PostgreSQL error codes
  if (error.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return USER_FRIENDLY_MESSAGES.DUPLICATE_KEY;
      case '23503': // foreign_key_violation  
        return USER_FRIENDLY_MESSAGES.FOREIGN_KEY_VIOLATION;
      case '23514': // check_violation
        return USER_FRIENDLY_MESSAGES.CHECK_VIOLATION;
      case '23502': // not_null_violation
        return USER_FRIENDLY_MESSAGES.NOT_NULL_VIOLATION;
      case '08003': // connection_does_not_exist
      case '08006': // connection_failure
        return USER_FRIENDLY_MESSAGES.ECONNREFUSED;
      case '57014': // query_canceled
        return USER_FRIENDLY_MESSAGES.QUERY_TIMEOUT;
    }
  }
  
  // HTTP status codes
  if (error.status) {
    switch (error.status) {
      case 400:
        return USER_FRIENDLY_MESSAGES.VALIDATION_ERROR;
      case 401:
        return USER_FRIENDLY_MESSAGES.UNAUTHORIZED;
      case 403:
        return USER_FRIENDLY_MESSAGES.FORBIDDEN;
      case 404:
        return USER_FRIENDLY_MESSAGES.RESOURCE_NOT_FOUND;
      case 409:
        return USER_FRIENDLY_MESSAGES.CONFLICT;
      case 412:
        return USER_FRIENDLY_MESSAGES.PRECONDITION_FAILED;
      case 413:
        return USER_FRIENDLY_MESSAGES.FILE_TOO_LARGE;
      case 415:
        return USER_FRIENDLY_MESSAGES.INVALID_FILE_FORMAT;
      case 503:
        return USER_FRIENDLY_MESSAGES.SERVICE_UNAVAILABLE;
    }
  }
  
  // Message pattern matching
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('timeout')) {
    return USER_FRIENDLY_MESSAGES.REQUEST_TIMEOUT;
  }
  
  if (message.includes('file format') || message.includes('mime type')) {
    return USER_FRIENDLY_MESSAGES.INVALID_FILE_FORMAT;
  }
  
  if (message.includes('file size') || message.includes('too large')) {
    return USER_FRIENDLY_MESSAGES.FILE_TOO_LARGE;
  }
  
  if (message.includes('duplicate') || message.includes('already exists')) {
    return USER_FRIENDLY_MESSAGES.DUPLICATE_KEY;
  }
  
  if (message.includes('not found')) {
    return USER_FRIENDLY_MESSAGES.RESOURCE_NOT_FOUND;
  }
  
  if (message.includes('email')) {
    return USER_FRIENDLY_MESSAGES.INVALID_EMAIL;
  }
  
  if (message.includes('date')) {
    return USER_FRIENDLY_MESSAGES.INVALID_DATE;
  }
  
  if (message.includes('number') || message.includes('numeric')) {
    return USER_FRIENDLY_MESSAGES.INVALID_NUMBER;
  }
  
  if (message.includes('sequence') || message.includes('id generation')) {
    return USER_FRIENDLY_MESSAGES.ID_GENERATION_FAILED;
  }
  
  // Default fallback
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Log error with appropriate detail level
 */
async function logError(error, req, additionalContext = {}) {
  const timestamp = new Date().toISOString();
  const category = categorizeError(error);
  
  const logEntry = {
    timestamp,
    category,
    level: category === ERROR_CATEGORIES.SYSTEM ? 'critical' : 
           category === ERROR_CATEGORIES.DATABASE ? 'high' : 'medium',
    
    // Request context
    method: req?.method,
    url: req?.originalUrl,
    userAgent: req?.get('User-Agent'),
    ip: req?.ip,
    user: req?.user?.id || req?.user?.email,
    
    // Error details
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.status,
    
    // Additional context
    ...additionalContext
  };
  
  // Console logging (will be replaced with proper logging service)
  console.error(`[${timestamp}] ${category.toUpperCase()} ERROR:`, {
    message: error.message,
    code: error.code,
    status: error.status,
    url: req?.originalUrl,
    user: req?.user?.email || 'anonymous',
    stack: process.env.NODE_ENV === 'development' ? error.stack : '[REDACTED]'
  });
  
  // Log to file for persistence (optional)
  if (process.env.LOG_TO_FILE === 'true') {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
    } catch (logError) {
      console.error('Failed to write error log to file:', logError.message);
    }
  }
  
  return logEntry;
}

/**
 * Determine if error should be retried
 */
function isRetryableError(error) {
  const retryableCodes = [
    'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH',
    '08003', '08006', // PostgreSQL connection errors
    '53300', // too_many_connections
    '57014'  // query_canceled
  ];
  
  const retryableStatuses = [503, 502, 504, 429]; // Service unavailable, bad gateway, timeout, rate limit
  
  return (
    retryableCodes.includes(error.code) ||
    retryableStatuses.includes(error.status) ||
    (error.message && error.message.includes('timeout'))
  );
}

/**
 * Generate error response with retry information
 */
function generateErrorResponse(error, req) {
  const category = categorizeError(error);
  const userMessage = getUserFriendlyMessage(error);
  const isRetryable = isRetryableError(error);
  
  // Determine HTTP status code
  let statusCode = error.status || error.statusCode || 500;
  
  if (category === ERROR_CATEGORIES.VALIDATION) {
    statusCode = 400;
  } else if (category === ERROR_CATEGORIES.AUTHENTICATION) {
    statusCode = error.status || 401;
  } else if (category === ERROR_CATEGORIES.BUSINESS_LOGIC && statusCode === 500) {
    statusCode = 404;
  }
  
  const response = {
    success: false,
    error: {
      message: userMessage,
      category,
      code: error.code,
      retryable: isRetryable,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add retry suggestions
  if (isRetryable) {
    response.error.retryAfter = category === ERROR_CATEGORIES.DATABASE ? 30 : 5; // seconds
    response.error.retryMessage = 'This error may be temporary. Please try again in a few moments.';
  }
  
  // Add helpful actions based on error category
  switch (category) {
    case ERROR_CATEGORIES.VALIDATION:
      response.error.action = 'Please review your input and correct any errors before trying again.';
      break;
    case ERROR_CATEGORIES.AUTHENTICATION:
      response.error.action = 'Please log in again or contact your administrator.';
      break;
    case ERROR_CATEGORIES.DATABASE:
      response.error.action = 'Please try again. If the problem persists, contact support.';
      break;
    case ERROR_CATEGORIES.FILE_SYSTEM:
      response.error.action = 'Please check your file and try again.';
      break;
    default:
      response.error.action = 'Please try again or contact support if the problem continues.';
  }
  
  // Include technical details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.technical = {
      originalMessage: error.message,
      stack: error.stack?.split('\n').slice(0, 5), // First 5 lines only
      code: error.code,
      constraint: error.constraint,
      detail: error.detail
    };
  }
  
  return { statusCode, response };
}

/**
 * Enhanced error handling middleware
 */
const enhancedErrorHandler = async (error, req, res, next) => {
  // Log the error
  await logError(error, req);
  
  // Generate appropriate response
  const { statusCode, response } = generateErrorResponse(error, req);
  
  // Set appropriate headers
  res.status(statusCode);
  
  if (response.error.retryable) {
    res.set('Retry-After', response.error.retryAfter);
  }
  
  // Send response
  res.json(response);
};

/**
 * Async error wrapper for routes
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };
};

/**
 * Validation error handler
 */
const validationErrorHandler = (errors) => {
  const validationError = new Error('Validation failed');
  validationError.status = 400;
  validationError.validationErrors = errors;
  validationError.message = errors.map(err => err.message || err.msg).join('; ');
  return validationError;
};

/**
 * Database error handler with specific error mapping
 */
const databaseErrorHandler = (error) => {
  const dbError = new Error();
  dbError.code = error.code;
  dbError.constraint = error.constraint;
  dbError.detail = error.detail;
  dbError.table = error.table;
  dbError.column = error.column;
  
  // Map common PostgreSQL errors
  switch (error.code) {
    case '23505': // unique_violation
      dbError.message = `This ${error.constraint?.replace(/_/g, ' ')} already exists`;
      dbError.status = 409;
      break;
    case '23503': // foreign_key_violation
      dbError.message = 'Cannot perform this action due to data dependencies';
      dbError.status = 400;
      break;
    case '23502': // not_null_violation
      dbError.message = `${error.column} is required`;
      dbError.status = 400;
      break;
    case '42P01': // undefined_table
      dbError.message = 'Database structure error';
      dbError.status = 500;
      break;
    case '42703': // undefined_column
      dbError.message = 'Database structure error';  
      dbError.status = 500;
      break;
    default:
      dbError.message = error.message;
      dbError.status = 500;
  }
  
  return dbError;
};

module.exports = {
  enhancedErrorHandler,
  asyncErrorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  categorizeError,
  getUserFriendlyMessage,
  isRetryableError,
  ERROR_CATEGORIES,
  USER_FRIENDLY_MESSAGES
};