/**
 * Centralized error handling for the background script
 */

import { createError, isRetryableError, getErrorSeverity, getErrorCategory } from '../../shared/constants/error-codes.js';
import { LOG_LEVELS } from '../../shared/constants/default-config.js';

/**
 * Error handler class for managing errors in the background script
 */
export class ErrorHandler {
  /**
   * Create a new ErrorHandler
   * @param {Object} logger - Logger instance for logging errors
   * @param {Object} config - Configuration object
   */
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.errorCallbacks = new Map();
    this.errorCounts = new Map();
    this.maxErrorCount = 10; // Max errors of the same type before throttling
    this.errorThrottleTime = 60000; // 1 minute throttle period
    this.lastErrorTime = new Map();
  }

  /**
   * Initialize the error handler
   */
  init() {
    // Set up global error handlers
    self.addEventListener('error', this.handleGlobalError.bind(this));
    self.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    this.logger.info('Error handler initialized');
  }

  /**
   * Handle an error with proper logging and callback execution
   * @param {Error|ExtensionError} error - The error to handle
   * @param {Object} [context] - Additional context information
   * @returns {boolean} True if the error was handled successfully
   */
  handleError(error, context = {}) {
    try {
      // Create extension error if it's a regular error
      const extensionError = error.code ? error : createError(
        'UNKNOWN_ERROR',
        error.message,
        { ...context, originalError: error },
        error
      );

      // Check if we should throttle this error type
      if (this.shouldThrottleError(extensionError.code)) {
        this.logger.warn(`Error throttled: ${extensionError.code}`, { error: extensionError.toJSON() });
        return false;
      }

      // Update error counts
      this.updateErrorCount(extensionError.code);

      // Log the error with appropriate severity
      this.logError(extensionError, context);

      // Execute callbacks for this error type
      this.executeErrorCallbacks(extensionError, context);

      // Attempt recovery if the error is retryable
      if (isRetryableError(extensionError)) {
        this.attemptRecovery(extensionError, context);
      }

      return true;
    } catch (handlingError) {
      // If error handling fails, log it and return false
      console.error('Failed to handle error:', handlingError);
      console.error('Original error:', error);
      return false;
    }
  }

  /**
   * Log an error with the appropriate severity level
   * @param {ExtensionError} error - The error to log
   * @param {Object} context - Additional context information
   */
  logError(error, context) {
    const logData = {
      error: error.toJSON(),
      context,
      timestamp: new Date().toISOString()
    };

    switch (getErrorSeverity(error)) {
      case 'debug':
        this.logger.debug(`Error occurred: ${error.message}`, logData);
        break;
      case 'info':
        this.logger.info(`Error occurred: ${error.message}`, logData);
        break;
      case 'warn':
        this.logger.warn(`Error occurred: ${error.message}`, logData);
        break;
      case 'error':
        this.logger.error(`Error occurred: ${error.message}`, logData);
        break;
      case 'fatal':
        this.logger.error(`Fatal error occurred: ${error.message}`, logData);
        break;
      default:
        this.logger.error(`Unknown severity error: ${error.message}`, logData);
    }
  }

  /**
   * Check if an error should be throttled
   * @param {string} errorCode - The error code to check
   * @returns {boolean} True if the error should be throttled
   */
  shouldThrottleError(errorCode) {
    const count = this.errorCounts.get(errorCode) || 0;
    const lastTime = this.lastErrorTime.get(errorCode) || 0;
    const now = Date.now();

    // Reset count if throttle period has passed
    if (now - lastTime > this.errorThrottleTime) {
      this.errorCounts.set(errorCode, 0);
      return false;
    }

    // Throttle if we've exceeded the max count
    return count >= this.maxErrorCount;
  }

  /**
   * Update the error count for a specific error code
   * @param {string} errorCode - The error code to update
   */
  updateErrorCount(errorCode) {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);
    this.lastErrorTime.set(errorCode, Date.now());
  }

  /**
   * Execute callbacks registered for a specific error type
   * @param {ExtensionError} error - The error that occurred
   * @param {Object} context - Additional context information
   */
  executeErrorCallbacks(error, context) {
    const callbacks = this.errorCallbacks.get(error.code) || [];
    const categoryCallbacks = this.errorCallbacks.get(error.category) || [];
    
    const allCallbacks = [...callbacks, ...categoryCallbacks];
    
    for (const callback of allCallbacks) {
      try {
        callback(error, context);
      } catch (callbackError) {
        this.logger.error('Error in error callback:', { 
          callbackError: callbackError.message, 
          originalError: error.code 
        });
      }
    }
  }

  /**
   * Attempt to recover from a retryable error
   * @param {ExtensionError} error - The error to recover from
   * @param {Object} context - Additional context information
   */
  attemptRecovery(error, context) {
    this.logger.info(`Attempting recovery from error: ${error.code}`, { error: error.toJSON() });
    
    // Recovery strategies based on error type
    switch (error.code) {
      case 'WS_CONNECTION_FAILED':
      case 'WS_CONNECTION_TIMEOUT':
        // WebSocket connection errors will be handled by the WebSocket manager
        break;
        
      case 'BC_CONTENT_SCRIPT_INJECTION_FAILED':
      case 'BC_CONTENT_SCRIPT_TIMEOUT':
        // Content script errors will be handled by the browser context manager
        break;
        
      default:
        this.logger.debug(`No specific recovery strategy for error: ${error.code}`);
        break;
    }
  }

  /**
   * Register a callback for a specific error type or category
   * @param {string} type - Error code or category
   * @param {Function} callback - Callback function to execute
   */
  onError(type, callback) {
    if (!this.errorCallbacks.has(type)) {
      this.errorCallbacks.set(type, []);
    }
    this.errorCallbacks.get(type).push(callback);
  }

  /**
   * Remove a callback for a specific error type or category
   * @param {string} type - Error code or category
   * @param {Function} callback - Callback function to remove
   */
  offError(type, callback) {
    const callbacks = this.errorCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Handle global errors
   * @param {ErrorEvent} event - The error event
   */
  handleGlobalError(event) {
    this.handleError(event.error, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      type: 'global_error'
    });
  }

  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event - The rejection event
   */
  handleUnhandledRejection(event) {
    this.handleError(event.reason, {
      type: 'unhandled_promise_rejection'
    });
    
    // Prevent the default handling (which would log to console)
    event.preventDefault();
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorsByCode: {},
      errorsByCategory: {},
      recentErrors: []
    };

    for (const [code, count] of this.errorCounts) {
      stats.totalErrors += count;
      stats.errorsByCode[code] = count;
    }

    return stats;
  }

  /**
   * Reset error counts
   */
  resetErrorCounts() {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
    this.logger.info('Error counts reset');
  }

  /**
   * Destroy the error handler and clean up resources
   */
  destroy() {
    self.removeEventListener('error', this.handleGlobalError);
    self.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.errorCallbacks.clear();
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
}

// Create a singleton instance
let errorHandlerInstance = null;

/**
 * Get the singleton error handler instance
 * @param {Object} logger - Logger instance
 * @param {Object} config - Configuration object
 * @returns {ErrorHandler} The error handler instance
 */
export function getErrorHandler(logger, config) {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler(logger, config);
  }
  return errorHandlerInstance;
}