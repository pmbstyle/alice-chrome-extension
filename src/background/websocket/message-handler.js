/**
 * WebSocket message handler for the background script
 */

import { createError } from '../../shared/constants/error-codes.js';
import { MESSAGE_TYPES } from '../../shared/constants/default-config.js';

/**
 * WebSocket message handler class
 */
export class WebSocketMessageHandler {
  /**
   * Create a new WebSocketMessageHandler
   * @param {Object} configManager - Configuration manager instance
   * @param {Object} logger - Logger instance
   * @param {Object} errorHandler - Error handler instance
   * @param {Object} browserContextManager - Browser context manager instance
   */
  constructor(configManager, logger, errorHandler, browserContextManager) {
    this.configManager = configManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.browserContextManager = browserContextManager;
    
    this.requestHandlers = new Map();
    this.messageValidators = new Map();
    
    this.setupMessageValidators();
    this.setupRequestHandlers();
  }

  /**
   * Initialize the WebSocket message handler
   */
  init() {
    this.logger.info('WebSocket message handler initialized');
  }

  /**
   * Set up message validators for different message types
   */
  setupMessageValidators() {
    // Browser context request validator
    this.messageValidators.set(MESSAGE_TYPES.BROWSER_CONTEXT, (message) => {
      if (!message.requestId) {
        return { valid: false, error: 'Missing requestId' };
      }
      if (!message.data || typeof message.data !== 'object') {
        return { valid: false, error: 'Missing or invalid data object' };
      }
      return { valid: true };
    });

    // Ping message validator
    this.messageValidators.set(MESSAGE_TYPES.PING, (message) => {
      if (!message.timestamp || typeof message.timestamp !== 'number') {
        return { valid: false, error: 'Missing or invalid timestamp' };
      }
      return { valid: true };
    });
  }

  /**
   * Set up request handlers for different message types
   */
  setupRequestHandlers() {
    // Browser context request handler
    this.requestHandlers.set(MESSAGE_TYPES.BROWSER_CONTEXT, this.handleBrowserContextRequest.bind(this));
  }

  /**
   * Handle an incoming WebSocket message
   * @param {Object} message - The received message
   */
  async handleMessage(message) {
    try {
      this.logger.debug('Handling WebSocket message', { type: message.type });
      
      // Validate message structure
      const validation = this.validateMessage(message);
      if (!validation.valid) {
        throw createError('WS_INVALID_MESSAGE_TYPE', validation.error, { message });
      }

      // Find and execute the appropriate handler
      const handler = this.requestHandlers.get(message.type);
      if (handler) {
        await handler(message);
      } else {
        this.logger.debug('No handler found for message type', { type: message.type });
      }

    } catch (error) {
      this.errorHandler.handleError(error, { 
        source: 'websocket-message-handler', 
        messageType: message.type 
      });
      
      // Send error response if the message has a requestId
      if (message.requestId) {
        this.sendErrorResponse(message.requestId, error);
      }
    }
  }

  /**
   * Validate a WebSocket message
   * @param {Object} message - The message to validate
   * @returns {Object} Validation result
   */
  validateMessage(message) {
    // Basic structure validation
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be an object' };
    }

    if (!message.type || typeof message.type !== 'string') {
      return { valid: false, error: 'Message must have a string type' };
    }

    // Type-specific validation
    const validator = this.messageValidators.get(message.type);
    if (validator) {
      return validator(message);
    }

    // No specific validator for this type, assume it's valid
    return { valid: true };
  }

  /**
   * Handle browser context request
   * @param {Object} message - The browser context request message
   */
  async handleBrowserContextRequest(message) {
    const { requestId, data } = message;
    
    this.logger.info('Handling browser context request', { requestId });
    
    try {
      // Collect browser context data
      const contextData = await this.browserContextManager.collectBrowserContext(data);
      
      // Send successful response
      this.sendResponse(requestId, contextData);
      
    } catch (error) {
      this.logger.error('Failed to collect browser context', { 
        requestId, 
        error: error.message 
      });
      
      // Send error response
      this.sendErrorResponse(requestId, error);
    }
  }

  /**
   * Send a response to a WebSocket request
   * @param {string} requestId - The request ID
   * @param {Object} data - The response data
   */
  sendResponse(requestId, data) {
    const response = {
      type: MESSAGE_TYPES.BROWSER_CONTEXT_RESPONSE,
      requestId,
      data,
      timestamp: new Date().toISOString()
    };

    // This will be sent by the WebSocket connection manager
    this.logger.debug('Sending WebSocket response', { requestId });
    
    // Emit response event for the connection manager to handle
    this.emit('send', response);
  }

  /**
   * Send an error response to a WebSocket request
   * @param {string} requestId - The request ID
   * @param {Error} error - The error that occurred
   */
  sendErrorResponse(requestId, error) {
    const response = {
      type: MESSAGE_TYPES.BROWSER_CONTEXT_RESPONSE,
      requestId,
      data: {
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // This will be sent by the WebSocket connection manager
    this.logger.debug('Sending WebSocket error response', { 
      requestId, 
      errorCode: error.code 
    });
    
    // Emit response event for the connection manager to handle
    this.emit('send', response);
  }

  /**
   * Register a handler for a specific message type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  registerHandler(type, handler) {
    this.requestHandlers.set(type, handler);
    this.logger.debug('Registered message handler', { type });
  }

  /**
   * Unregister a handler for a specific message type
   * @param {string} type - Message type
   */
  unregisterHandler(type) {
    this.requestHandlers.delete(type);
    this.logger.debug('Unregistered message handler', { type });
  }

  /**
   * Register a validator for a specific message type
   * @param {string} type - Message type
   * @param {Function} validator - Validator function
   */
  registerValidator(type, validator) {
    this.messageValidators.set(type, validator);
    this.logger.debug('Registered message validator', { type });
  }

  /**
   * Unregister a validator for a specific message type
   * @param {string} type - Message type
   */
  unregisterValidator(type) {
    this.messageValidators.delete(type);
    this.logger.debug('Unregistered message validator', { type });
  }

  /**
   * Emit an event (simple event system)
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   */
  emit(event, ...args) {
    if (this.eventCallbacks && this.eventCallbacks.has(event)) {
      const callbacks = this.eventCallbacks.get(event);
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          this.logger.error('Error in event callback', { event, error: error.message });
        }
      }
    }
  }

  /**
   * Register an event callback
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventCallbacks) {
      this.eventCallbacks = new Map();
    }
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }

  /**
   * Unregister an event callback
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.eventCallbacks && this.eventCallbacks.has(event)) {
      const callbacks = this.eventCallbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get message handler statistics
   * @returns {Object} Message handler statistics
   */
  getStats() {
    return {
      registeredHandlers: this.requestHandlers.size,
      registeredValidators: this.messageValidators.size,
      handlerTypes: Array.from(this.requestHandlers.keys()),
      validatorTypes: Array.from(this.messageValidators.keys())
    };
  }

  /**
   * Destroy the WebSocket message handler and clean up resources
   */
  destroy() {
    this.requestHandlers.clear();
    this.messageValidators.clear();
    if (this.eventCallbacks) {
      this.eventCallbacks.clear();
    }
  }
}

// Create a singleton instance
let messageHandlerInstance = null;

/**
 * Get the singleton WebSocket message handler instance
 * @param {Object} configManager - Configuration manager instance
 * @param {Object} logger - Logger instance
 * @param {Object} errorHandler - Error handler instance
 * @param {Object} browserContextManager - Browser context manager instance
 * @returns {WebSocketMessageHandler} The WebSocket message handler instance
 */
export function getWebSocketMessageHandler(configManager, logger, errorHandler, browserContextManager) {
  if (!messageHandlerInstance) {
    messageHandlerInstance = new WebSocketMessageHandler(configManager, logger, errorHandler, browserContextManager);
  }
  return messageHandlerInstance;
}