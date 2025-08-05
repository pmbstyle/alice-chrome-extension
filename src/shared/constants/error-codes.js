/**
 * Error code definitions for the Alice Browser Context extension
 */

// Import error codes
import { ERROR_CODES } from './default-config.js';

/**
 * Error categories
 */
export const ERROR_CATEGORIES = {
  WEBSOCKET: 'websocket',
  BROWSER_CONTEXT: 'browser_context',
  CONFIGURATION: 'configuration',
  CONTENT_SCRIPT: 'content_script',
  VALIDATION: 'validation',
  NETWORK: 'network',
  UNKNOWN: 'unknown'
};

/**
 * Error definitions with detailed information
 */
export const ERROR_DEFINITIONS = {
  // WebSocket errors
  [ERROR_CODES.WS_CONNECTION_FAILED]: {
    category: ERROR_CATEGORIES.WEBSOCKET,
    message: 'Failed to connect to WebSocket server',
    description: 'The extension could not establish a connection to the Alice WebSocket server',
    severity: 'error',
    retryable: true
  },
  [ERROR_CODES.WS_CONNECTION_TIMEOUT]: {
    category: ERROR_CATEGORIES.WEBSOCKET,
    message: 'WebSocket connection timeout',
    description: 'The connection attempt to the WebSocket server timed out',
    severity: 'error',
    retryable: true
  },
  [ERROR_CODES.WS_MESSAGE_PARSE_ERROR]: {
    category: ERROR_CATEGORIES.WEBSOCKET,
    message: 'Failed to parse WebSocket message',
    description: 'The received WebSocket message could not be parsed as valid JSON',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.WS_INVALID_MESSAGE_TYPE]: {
    category: ERROR_CATEGORIES.WEBSOCKET,
    message: 'Invalid WebSocket message type',
    description: 'The received WebSocket message has an unknown or unsupported type',
    severity: 'warn',
    retryable: false
  },
  [ERROR_CODES.WS_MISSING_REQUEST_ID]: {
    category: ERROR_CATEGORIES.WEBSOCKET,
    message: 'WebSocket message missing request ID',
    description: 'The browser_context request is missing a required requestId',
    severity: 'error',
    retryable: false
  },
  
  // Browser context errors
  [ERROR_CODES.BC_NO_ACTIVE_TAB]: {
    category: ERROR_CATEGORIES.BROWSER_CONTEXT,
    message: 'No active tab found',
    description: 'Could not find an active tab in any browser window',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.BC_RESTRICTED_PAGE]: {
    category: ERROR_CATEGORIES.BROWSER_CONTEXT,
    message: 'Cannot access restricted page',
    description: 'The current page uses a restricted protocol that prevents content script access',
    severity: 'warn',
    retryable: false
  },
  [ERROR_CODES.BC_CONTENT_SCRIPT_INJECTION_FAILED]: {
    category: ERROR_CATEGORIES.BROWSER_CONTEXT,
    message: 'Content script injection failed',
    description: 'Failed to inject the content script into the current page',
    severity: 'error',
    retryable: true
  },
  [ERROR_CODES.BC_CONTENT_SCRIPT_TIMEOUT]: {
    category: ERROR_CATEGORIES.BROWSER_CONTEXT,
    message: 'Content script response timeout',
    description: 'The content script did not respond within the expected time',
    severity: 'error',
    retryable: true
  },
  [ERROR_CODES.BC_CONTENT_SCRIPT_ERROR]: {
    category: ERROR_CATEGORIES.BROWSER_CONTEXT,
    message: 'Content script error',
    description: 'The content script encountered an error while processing the request',
    severity: 'error',
    retryable: true
  },
  
  // Configuration errors
  [ERROR_CODES.CONFIG_INVALID]: {
    category: ERROR_CATEGORIES.CONFIGURATION,
    message: 'Invalid configuration',
    description: 'The provided configuration is not valid',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.CONFIG_MISSING_REQUIRED]: {
    category: ERROR_CATEGORIES.CONFIGURATION,
    message: 'Missing required configuration',
    description: 'One or more required configuration properties are missing',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.CONFIG_VALIDATION_FAILED]: {
    category: ERROR_CATEGORIES.CONFIGURATION,
    message: 'Configuration validation failed',
    description: 'The configuration failed validation against the schema',
    severity: 'error',
    retryable: false
  },
  
  // General errors
  [ERROR_CODES.UNKNOWN_ERROR]: {
    category: ERROR_CATEGORIES.UNKNOWN,
    message: 'Unknown error occurred',
    description: 'An unexpected error occurred',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.INVALID_INPUT]: {
    category: ERROR_CATEGORIES.VALIDATION,
    message: 'Invalid input provided',
    description: 'The provided input is not valid',
    severity: 'error',
    retryable: false
  },
  [ERROR_CODES.OPERATION_FAILED]: {
    category: ERROR_CATEGORIES.UNKNOWN,
    message: 'Operation failed',
    description: 'The requested operation could not be completed',
    severity: 'error',
    retryable: true
  }
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Custom error class for extension errors
 */
export class ExtensionError extends Error {
  /**
   * Create a new ExtensionError
   * @param {string} code - Error code
   * @param {string} [message] - Custom error message (optional)
   * @param {any} [details] - Additional error details (optional)
   * @param {Error} [originalError] - Original error that caused this error (optional)
   */
  constructor(code, message, details = null, originalError = null) {
    const errorDef = ERROR_DEFINITIONS[code];
    const defaultMessage = errorDef ? errorDef.message : 'Unknown error';
    
    super(message || defaultMessage);
    
    this.name = 'ExtensionError';
    this.code = code;
    this.category = errorDef ? errorDef.category : ERROR_CATEGORIES.UNKNOWN;
    this.severity = errorDef ? errorDef.severity : ERROR_SEVERITY.ERROR;
    this.retryable = errorDef ? errorDef.retryable : false;
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
  
  /**
   * Convert error to a plain object for serialization
   * @returns {Object} Plain object representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null
    };
  }
}

/**
 * Create an error with the given code and optional details
 * @param {string} code - Error code
 * @param {string} [message] - Custom error message (optional)
 * @param {any} [details] - Additional error details (optional)
 * @param {Error} [originalError] - Original error that caused this error (optional)
 * @returns {ExtensionError} Created error instance
 */
export function createError(code, message, details, originalError) {
  return new ExtensionError(code, message, details, originalError);
}

/**
 * Check if an error is retryable
 * @param {Error|ExtensionError} error - Error to check
 * @returns {boolean} True if the error is retryable
 */
export function isRetryableError(error) {
  return error instanceof ExtensionError ? error.retryable : false;
}

/**
 * Get error severity level
 * @param {Error|ExtensionError} error - Error to check
 * @returns {string} Error severity level
 */
export function getErrorSeverity(error) {
  return error instanceof ExtensionError ? error.severity : ERROR_SEVERITY.ERROR;
}

/**
 * Get error category
 * @param {Error|ExtensionError} error - Error to check
 * @returns {string} Error category
 */
export function getErrorCategory(error) {
  return error instanceof ExtensionError ? error.category : ERROR_CATEGORIES.UNKNOWN;
}