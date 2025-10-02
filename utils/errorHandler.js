// Centralized error handling utilities
const { validationResult } = require('express-validator');
const logger = require('./logger');

/**
 * Standard error response format
 */
const createErrorResponse = (message, details = null, statusCode = 500) => {
  const error = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    statusCode
  };

  if (details) {
    error.details = details;
  }

  return error;
};

/**
 * Handle validation errors from express-validator
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json(createErrorResponse(
      'Validation failed',
      errorDetails,
      400
    ));
  }
  next();
};

/**
 * Handle database constraint errors
 */
const handleDatabaseError = (error, context = '') => {
  logger.error(`Database error in ${context}:`, error);
  
  let message = 'Database operation failed';
  let statusCode = 500;
  let details = null;

  // Handle specific PostgreSQL errors
  switch (error.code) {
    case '23505': // Unique constraint violation
      message = 'A record with this information already exists';
      statusCode = 409;
      details = {
        constraint: error.constraint,
        detail: error.detail
      };
      break;
    case '23503': // Foreign key constraint violation
      message = 'Related record not found or cannot be deleted due to dependencies';
      statusCode = 400;
      details = {
        constraint: error.constraint,
        detail: error.detail
      };
      break;
    case '23502': // Not null constraint violation
      message = 'Required field is missing';
      statusCode = 400;
      details = {
        column: error.column,
        detail: error.detail
      };
      break;
    case '42P01': // Undefined table
      message = 'Database table not found - system may need migration';
      statusCode = 500;
      break;
    case '42703': // Undefined column
      message = 'Database column not found - system may need migration';
      statusCode = 500;
      break;
    default:
      // Generic database error
      details = {
        code: error.code,
        severity: error.severity
      };
  }

  return createErrorResponse(message, details, statusCode);
};

/**
 * Handle file upload errors
 */
const handleFileUploadError = (error, context = '') => {
  logger.error(`File upload error in ${context}:`, error);
  
  let message = 'File upload failed';
  let statusCode = 400;
  let details = null;

  if (error.code === 'LIMIT_FILE_SIZE') {
    message = 'File size exceeds maximum allowed limit';
    details = {
      limit: error.limit,
      received: error.received
    };
  } else if (error.code === 'LIMIT_FILE_COUNT') {
    message = 'Too many files uploaded';
    details = {
      limit: error.limit
    };
  } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Unexpected file field';
    details = {
      fieldName: error.field
    };
  } else if (error.message.includes('Invalid file type')) {
    message = 'Invalid file type. Please upload a supported file format';
    statusCode = 415;
  }

  return createErrorResponse(message, details, statusCode);
};

/**
 * Handle import/export errors
 */
const handleImportError = (error, context = '') => {
  logger.error(`Import error in ${context}:`, error);
  
  let message = 'Import operation failed';
  let statusCode = 400;
  let details = null;

  if (error.message.includes('parse')) {
    message = 'Failed to parse file. Please check file format and content';
    details = {
      suggestion: 'Ensure file is valid CSV/Excel format with proper headers'
    };
  } else if (error.message.includes('empty')) {
    message = 'File appears to be empty or contains no valid data';
    details = {
      suggestion: 'Check that file contains data rows below the header'
    };
  } else if (error.message.includes('validation')) {
    message = 'Data validation failed';
    details = {
      suggestion: 'Review error messages and correct data before retrying'
    };
  } else if (error.message.includes('duplicate')) {
    message = 'Duplicate records found in import data';
    details = {
      suggestion: 'Remove duplicate entries or enable duplicate handling options'
    };
  }

  return createErrorResponse(message, details, statusCode);
};

/**
 * Handle authentication errors
 */
const handleAuthError = (error, context = '') => {
  logger.error(`Authentication error in ${context}:`, error);
  
  let message = 'Authentication failed';
  let statusCode = 401;
  let details = null;

  if (error.message.includes('token')) {
    message = 'Invalid or expired authentication token';
    details = {
      suggestion: 'Please log in again'
    };
  } else if (error.message.includes('credentials')) {
    message = 'Invalid username or password';
    details = {
      suggestion: 'Check your credentials and try again'
    };
  } else if (error.message.includes('permission')) {
    message = 'Insufficient permissions for this operation';
    statusCode = 403;
    details = {
      suggestion: 'Contact your administrator for access'
    };
  }

  return createErrorResponse(message, details, statusCode);
};

/**
 * Generic error handler for unexpected errors
 */
const handleGenericError = (error, context = '') => {
  logger.error(`Unexpected error in ${context}:`, error);
  
  return createErrorResponse(
    'An unexpected error occurred. Please try again later.',
    {
      context,
      type: error.name || 'Unknown'
    },
    500
  );
};

/**
 * Express middleware for final error handling
 */
const errorMiddleware = (err, req, res, next) => {
  let errorResponse;

  // Determine error type and create appropriate response
  if (err.code && err.severity) {
    // Database error
    errorResponse = handleDatabaseError(err, req.originalUrl);
  } else if (err.code && err.code.startsWith('LIMIT_')) {
    // File upload error
    errorResponse = handleFileUploadError(err, req.originalUrl);
  } else if (err.message && err.message.includes('token')) {
    // Authentication error
    errorResponse = handleAuthError(err, req.originalUrl);
  } else {
    // Generic error
    errorResponse = handleGenericError(err, req.originalUrl);
  }

  res.status(errorResponse.statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  createErrorResponse,
  handleValidationErrors,
  handleDatabaseError,
  handleFileUploadError,
  handleImportError,
  handleAuthError,
  handleGenericError,
  errorMiddleware,
  asyncHandler
};