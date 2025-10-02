/**
 * Frontend logging utility
 * Provides structured logging for the React application
 */

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Log info level messages
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   */
  info(message, data = {}) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    }
    // In production, you might want to send to analytics or logging service
  }

  /**
   * Log warning level messages
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   */
  warn(message, data = {}) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    }
    // In production, you might want to send to logging service
  }

  /**
   * Log error level messages
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   */
  error(message, data = {}) {
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, data);
    }
    
    // Always log errors (even in production) for debugging
    // You might want to send these to an error tracking service
    this.reportError(message, data);
  }

  /**
   * Log debug level messages (development only)
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   */
  debug(message, data = {}) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  /**
   * Report errors to tracking service
   * @param {string} message - Error message
   * @param {object} data - Error data
   */
  async reportError(message, data = {}) {
    try {
      // Only report errors in production to avoid spam during development
      if (!this.isDevelopment) {
        await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message,
            stack: data.stack || new Error().stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: localStorage.getItem('userId'),
            buildVersion: process.env.REACT_APP_VERSION || 'unknown',
            errorType: 'LOGGED_ERROR',
            data
          })
        });
      }
    } catch (err) {
      // Don't throw on logging errors
      if (this.isDevelopment) {
        console.error('Failed to report error:', err);
      }
    }
  }
}

// Export a singleton instance
export default new Logger();