/**
 * System-Wide Error Handling Utilities
 * 
 * This module provides consistent error handling patterns across the entire LIMS system
 * to eliminate silent failures and ensure reliable error reporting.
 */

const logger = require('./logger');

/**
 * Standard error response formatter
 * Ensures all API error responses have consistent structure and sufficient detail
 */
const createErrorResponse = (operation, error, context = {}) => {
  const errorContext = {
    operation,
    timestamp: new Date().toISOString(),
    errorType: error.name || 'Error',
    errorCode: error.code,
    constraint: error.constraint,
    severity: error.severity || 'ERROR',
    ...context
  };

  // Log detailed error for debugging
  logger.error(`${operation} failed`, {
    error: error.message,
    stack: error.stack,
    context: errorContext
  });

  const isRetryable = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code);
  const isCritical = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'connection_failure'].includes(error.code) || 
                     error.severity === 'FATAL';

  return {
    success: false,
    message: `${operation} failed`,
    error: error.message,
    errorCode: error.code,
    constraint: error.constraint,
    retryable: isRetryable,
    critical: isCritical,
    context: errorContext,
    supportInfo: {
      timestamp: errorContext.timestamp,
      errorId: generateErrorId()
    }
  };
};

/**
 * Generate unique error ID for tracking
 */
const generateErrorId = () => {
  return `ERR_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};

/**
 * Database operation error handler
 * Provides consistent handling for all database operation failures
 */
const handleDatabaseError = (error, operation, entityType, entityId, additionalContext = {}) => {
  const context = {
    entityType,
    entityId,
    operation,
    ...additionalContext
  };

  // Check for critical errors that should abort operations
  const criticalErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'connection_failure'];
  const isCritical = criticalErrorCodes.includes(error.code) || error.severity === 'FATAL';

  // Classify error for tracking
  const errorType = error.code || error.constraint || 'unknown_database_error';

  const errorDetails = {
    ...createErrorResponse(operation, error, context),
    isCritical,
    errorType,
    entityType,
    entityId
  };

  return errorDetails;
};

/**
 * Success validation utility
 * Ensures operations actually succeeded before returning success responses
 */
const validateOperationSuccess = (results, operation, expectedResults = null) => {
  // Check if results indicate actual success
  if (!results) {
    return {
      isValid: false,
      reason: 'No results returned from operation',
      recommendation: 'Check database connection and query execution'
    };
  }

  // For database operations, check row counts
  if (results.rowCount !== undefined) {
    if (results.rowCount === 0 && expectedResults > 0) {
      return {
        isValid: false,
        reason: `Expected to affect ${expectedResults} records but affected 0`,
        recommendation: 'Check data validity and database constraints'
      };
    }
  }

  // For bulk operations, validate imported vs expected
  if (results.imported !== undefined && results.expected !== undefined) {
    if (results.imported === 0 && results.expected > 0) {
      return {
        isValid: false,
        reason: `Expected to import ${results.expected} records but imported 0`,
        recommendation: 'Check for constraint violations, data format issues, or foreign key failures'
      };
    }

    // Low success rate warning
    if (results.imported < results.expected * 0.8) {
      return {
        isValid: true,
        warning: `Low success rate: ${results.imported}/${results.expected} (${((results.imported/results.expected)*100).toFixed(1)}%) records processed`,
        recommendation: 'Review failed records and data quality'
      };
    }
  }

  return { isValid: true };
};

/**
 * Standard success response formatter
 * Ensures all success responses include validation and meaningful details
 */
const createSuccessResponse = (operation, results, additionalData = {}) => {
  const validation = validateOperationSuccess(results, operation, additionalData.expected);
  
  if (!validation.isValid) {
    throw new Error(validation.reason);
  }

  const response = {
    success: true,
    message: `${operation} completed successfully`,
    timestamp: new Date().toISOString(),
    results: results,
    ...additionalData
  };

  // Add warning if present
  if (validation.warning) {
    response.warning = validation.warning;
    response.recommendation = validation.recommendation;
  }

  return response;
};

/**
 * Async operation wrapper with comprehensive error handling
 * Wraps any async operation to provide consistent error handling
 */
const withErrorHandling = async (operation, operationFn, context = {}) => {
  try {
    const result = await operationFn();
    
    // Validate success before returning
    const successResponse = createSuccessResponse(operation, result, context);
    
    logger.info(`${operation} completed successfully`, {
      operation,
      context,
      resultSummary: {
        affected: result.rowCount,
        imported: result.imported,
        processed: result.processed
      }
    });
    
    return successResponse;
    
  } catch (error) {
    const errorResponse = createErrorResponse(operation, error, context);
    
    // For critical errors, log at error level
    if (errorResponse.critical) {
      logger.error(`Critical error in ${operation}:`, errorResponse);
    }
    
    throw error; // Re-throw so caller can handle appropriately
  }
};

/**
 * Batch operation error tracking
 * Tracks errors across batch operations and determines when to abort
 */
class BatchErrorTracker {
  constructor(operation, options = {}) {
    this.operation = operation;
    this.totalAttempted = 0;
    this.totalFailed = 0;
    this.errors = [];
    this.criticalFailures = [];
    this.failuresByType = {};
    this.lastSuccessfulRecord = null;
    
    // Configurable thresholds
    this.options = {
      maxFailureRate: options.maxFailureRate || 0.2, // 20% overall failure rate
      maxEntityFailureRate: options.maxEntityFailureRate || 0.5, // 50% per entity type
      minAttemptsBeforeCheck: options.minAttemptsBeforeCheck || 10,
      ...options
    };
  }

  recordAttempt() {
    this.totalAttempted++;
  }

  recordSuccess(entityType, entityId, uuid) {
    this.lastSuccessfulRecord = { type: entityType, id: entityId, uuid, timestamp: new Date().toISOString() };
  }

  recordFailure(error, entityType, entityId, file, rowNumber, record) {
    this.totalFailed++;
    
    const errorType = error.code || error.constraint || 'unknown';
    this.failuresByType[errorType] = (this.failuresByType[errorType] || 0) + 1;
    
    const isCritical = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'connection_failure'].includes(error.code) || 
                       error.severity === 'FATAL';
    
    const errorDetails = {
      entityType,
      entityId,
      file: file?.originalname || file,
      row: rowNumber,
      message: `Failed to process ${entityType} ${entityId}: ${error.message}`,
      errorCode: error.code,
      constraint: error.constraint,
      severity: error.severity || 'ERROR',
      timestamp: new Date().toISOString(),
      isCritical
    };
    
    if (isCritical) {
      this.criticalFailures.push(errorDetails);
    }
    
    this.errors.push(errorDetails);
    
    return { isCritical, errorType };
  }

  shouldAbortOperation() {
    // Abort immediately for critical failures
    if (this.criticalFailures.length > 0) {
      return {
        shouldAbort: true,
        reason: `Critical error detected: ${this.criticalFailures[0].message}`,
        type: 'critical_error'
      };
    }

    // Check failure rates periodically
    if (this.totalAttempted >= this.options.minAttemptsBeforeCheck) {
      const overallFailureRate = this.totalFailed / this.totalAttempted;
      
      if (overallFailureRate > this.options.maxFailureRate) {
        return {
          shouldAbort: true,
          reason: `High failure rate detected: ${(overallFailureRate * 100).toFixed(1)}% of operations failed (${this.totalFailed}/${this.totalAttempted})`,
          type: 'high_failure_rate'
        };
      }
    }

    return { shouldAbort: false };
  }

  getSummary() {
    return {
      totalAttempted: this.totalAttempted,
      totalFailed: this.totalFailed,
      successRate: this.totalAttempted > 0 ? ((this.totalAttempted - this.totalFailed) / this.totalAttempted * 100).toFixed(1) + '%' : '0%',
      failuresByType: this.failuresByType,
      criticalFailures: this.criticalFailures.length,
      lastSuccessfulRecord: this.lastSuccessfulRecord,
      errors: this.errors
    };
  }
}

module.exports = {
  createErrorResponse,
  createSuccessResponse,
  handleDatabaseError,
  validateOperationSuccess,
  withErrorHandling,
  BatchErrorTracker,
  generateErrorId
};