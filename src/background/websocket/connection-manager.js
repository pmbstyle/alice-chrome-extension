/**
 * WebSocket connection manager for the background script
 */

import { createError } from '../../shared/constants/error-codes.js';
import { MESSAGE_TYPES } from '../../shared/constants/default-config.js';

/**
 * WebSocket connection manager class
 */
export class WebSocketConnectionManager {
  /**
   * Create a new WebSocketConnectionManager
   * @param {Object} configManager - Configuration manager instance
   * @param {Object} logger - Logger instance
   * @param {Object} errorHandler - Error handler instance
   */
  constructor(configManager, logger, errorHandler) {
    this.configManager = configManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    this.socket = null;
    this.isConnecting = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.connectionCallbacks = new Map();
    this.messageCallbacks = new Map();
    
    this.connectionState = {
      connected: false,
      connecting: false,
      reconnecting: false,
      lastConnected: null,
      lastDisconnected: null,
      connectionCount: 0
    };
  }

  /**
   * Initialize the WebSocket connection manager
   */
  init() {
    this.logger.info('WebSocket connection manager initialized');
    
    // Set up error callbacks
    this.errorHandler.onError('websocket', this.handleWebSocketError.bind(this));
    
    // Connect to WebSocket server
    this.connect().catch(error => {
      this.logger.error('Failed to initialize WebSocket connection', { error: error.message });
    });
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<WebSocket>} Promise that resolves to the WebSocket connection
   */
  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    this.isConnecting = true;
    this.connectionState.connecting = true;
    
    const config = this.configManager.getConfig();
    const wsConfig = config.websocket;

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(wsConfig.url);

        this.socket.addEventListener('open', () => {
          this.handleConnectionOpen();
          resolve(this.socket);
        });

        this.socket.addEventListener('message', (event) => {
          this.handleMessage(event);
        });

        this.socket.addEventListener('error', (error) => {
          this.handleConnectionError(error);
          reject(error);
        });

        this.socket.addEventListener('close', (event) => {
          this.handleConnectionClose(event);
        });

        // Set connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            const error = createError('WS_CONNECTION_TIMEOUT');
            this.handleConnectionError(error);
            reject(error);
          }
        }, wsConfig.connectionTimeout);

      } catch (error) {
        this.isConnecting = false;
        this.connectionState.connecting = false;
        reject(createError('WS_CONNECTION_FAILED', 'Failed to create WebSocket connection', { originalError: error }));
      }
    });
  }

  /**
   * Wait for an existing connection to complete
   * @returns {Promise<WebSocket>} Promise that resolves to the WebSocket connection
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          resolve(this.socket);
        } else if (!this.isConnecting) {
          this.connect().then(resolve).catch(reject);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  /**
   * Handle WebSocket connection open event
   */
  handleConnectionOpen() {
    this.isConnecting = false;
    this.connectionState.connected = true;
    this.connectionState.connecting = false;
    this.connectionState.reconnecting = false;
    this.connectionState.lastConnected = new Date();
    this.connectionState.connectionCount++;
    this.reconnectAttempts = 0;

    this.logger.info('WebSocket connection established');
    
    // Clear reconnect timer if it exists
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Start ping timer
    this.startPingTimer();

    // Process queued messages
    this.processMessageQueue();

    // Notify connection callbacks
    this.notifyConnectionCallbacks('connected');
  }

  /**
   * Handle WebSocket message event
   * @param {MessageEvent} event - The message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.logger.debug('Received WebSocket message', { type: message.type, hasRequestId: !!message.requestId });
      
      // Validate message structure
      if (!message.type) {
        throw createError('WS_INVALID_MESSAGE_TYPE', 'Message missing required type field');
      }

      // Handle different message types
      switch (message.type) {
        case MESSAGE_TYPES.PING:
          this.handlePingMessage(message);
          break;
        case MESSAGE_TYPES.BROWSER_CONTEXT:
          this.handleBrowserContextMessage(message);
          break;
        default:
          this.logger.debug('Unhandled WebSocket message type', { type: message.type });
      }

      // Notify message callbacks
      this.notifyMessageCallbacks(message);

    } catch (error) {
      this.errorHandler.handleError(error, { 
        source: 'websocket-message', 
        rawData: event.data 
      });
    }
  }

  /**
   * Handle ping message
   * @param {Object} message - The ping message
   */
  handlePingMessage(message) {
    this.send({
      type: MESSAGE_TYPES.PONG,
      timestamp: Date.now()
    });
  }

  /**
   * Handle browser context message
   * @param {Object} message - The browser context message
   */
  handleBrowserContextMessage(message) {
    // This will be handled by the browser context manager
    this.logger.debug('Received browser context message', { requestId: message.requestId });
  }

  /**
   * Handle WebSocket connection error event
   * @param {Error|Event} error - The error event
   */
  handleConnectionError(error) {
    this.isConnecting = false;
    this.connectionState.connecting = false;
    
    const wsError = createError(
      'WS_CONNECTION_FAILED', 
      'WebSocket connection error', 
      { 
        readyState: this.socket ? this.socket.readyState : 'unknown',
        url: this.socket ? this.socket.url : 'unknown',
        error: error.message || error
      }
    );
    
    this.errorHandler.handleError(wsError, { source: 'websocket-connection' });
    
    // Notify connection callbacks
    this.notifyConnectionCallbacks('error', wsError);
  }

  /**
   * Handle WebSocket connection close event
   * @param {CloseEvent} event - The close event
   */
  handleConnectionClose(event) {
    this.isConnecting = false;
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.lastDisconnected = new Date();
    
    this.logger.info('WebSocket connection closed', { 
      code: event.code, 
      reason: event.reason,
      wasClean: event.wasClean 
    });
    
    // Clear ping timer
    this.stopPingTimer();
    
    // Attempt to reconnect if auto-reconnect is enabled
    const config = this.configManager.getConfig();
    if (config.websocket.autoReconnect) {
      this.attemptReconnect();
    }
    
    // Notify connection callbacks
    this.notifyConnectionCallbacks('disconnected', event);
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  attemptReconnect() {
    const config = this.configManager.getConfig();
    const wsConfig = config.websocket;
    
    if (this.reconnectAttempts >= wsConfig.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.connectionState.reconnecting = false;
      return;
    }
    
    this.reconnectAttempts++;
    this.connectionState.reconnecting = true;
    
    const delay = wsConfig.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error('Reconnection attempt failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Start the ping timer to keep the connection alive
   */
  startPingTimer() {
    const config = this.configManager.getConfig();
    const wsConfig = config.websocket;
    
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: MESSAGE_TYPES.PING,
          timestamp: Date.now()
        });
      }
    }, wsConfig.pingInterval);
  }

  /**
   * Stop the ping timer
   */
  stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message).catch(error => {
        this.logger.error('Failed to send queued message', { error: error.message });
        // Re-queue the message if it's important
        if (message.type !== MESSAGE_TYPES.PING) {
          this.messageQueue.unshift(message);
        }
      });
    }
  }

  /**
   * Send a message through the WebSocket connection
   * @param {Object} message - The message to send
   * @returns {Promise<void>} Promise that resolves when the message is sent
   */
  async send(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Queue the message if not connected
      this.messageQueue.push(message);
      this.logger.debug('Message queued (WebSocket not connected)', { type: message.type });
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.socket.send(messageStr);
      this.logger.debug('Message sent', { type: message.type });
    } catch (error) {
      this.errorHandler.handleError(
        createError('WS_CONNECTION_FAILED', 'Failed to send WebSocket message', { originalError: error }),
        { message }
      );
      throw error;
    }
  }

  /**
   * Register a callback for connection events
   * @param {string} event - Event type ('connected', 'disconnected', 'error')
   * @param {Function} callback - Callback function to execute
   */
  onConnection(event, callback) {
    if (!this.connectionCallbacks.has(event)) {
      this.connectionCallbacks.set(event, []);
    }
    this.connectionCallbacks.get(event).push(callback);
  }

  /**
   * Remove a callback for connection events
   * @param {string} event - Event type
   * @param {Function} callback - Callback function to remove
   */
  offConnection(event, callback) {
    const callbacks = this.connectionCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Register a callback for WebSocket messages
   * @param {string} type - Message type or 'all' for all messages
   * @param {Function} callback - Callback function to execute
   */
  onMessage(type, callback) {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
    }
    this.messageCallbacks.get(type).push(callback);
  }

  /**
   * Remove a callback for WebSocket messages
   * @param {string} type - Message type
   * @param {Function} callback - Callback function to remove
   */
  offMessage(type, callback) {
    const callbacks = this.messageCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify connection callbacks
   * @param {string} event - Event type
   * @param {any} [data] - Event data
   */
  notifyConnectionCallbacks(event, data) {
    const callbacks = this.connectionCallbacks.get(event) || [];
    
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error('Error in connection callback', { event, error: error.message });
      }
    }
  }

  /**
   * Notify message callbacks
   * @param {Object} message - The received message
   */
  notifyMessageCallbacks(message) {
    const typeCallbacks = this.messageCallbacks.get(message.type) || [];
    const allCallbacks = this.messageCallbacks.get('all') || [];
    
    const allCallbacksToExecute = [...typeCallbacks, ...allCallbacks];
    
    for (const callback of allCallbacksToExecute) {
      try {
        callback(message);
      } catch (error) {
        this.logger.error('Error in message callback', { type: message.type, error: error.message });
      }
    }
  }

  /**
   * Handle WebSocket errors
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context
   */
  handleWebSocketError(error, context) {
    this.logger.error('WebSocket error occurred', { error: error.message, context });
    
    // If the connection is in a bad state, attempt to reconnect
    if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
      this.attemptReconnect();
    }
  }

  /**
   * Get the current connection state
   * @returns {Object} Connection state information
   */
  getConnectionState() {
    return { ...this.connectionState };
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      ...this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      socketReadyState: this.socket ? this.socket.readyState : 'NO_SOCKET',
      socketUrl: this.socket ? this.socket.url : null
    };
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    this.logger.info('Disconnecting WebSocket');
    
    // Clear timers
    this.stopPingTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Close socket if it exists
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
    
    // Update state
    this.isConnecting = false;
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.reconnecting = false;
    this.connectionState.lastDisconnected = new Date();
    
    // Clear message queue
    this.messageQueue = [];
    
    // Notify callbacks
    this.notifyConnectionCallbacks('disconnected');
  }

  /**
   * Destroy the WebSocket connection manager and clean up resources
   */
  destroy() {
    this.disconnect();
    this.connectionCallbacks.clear();
    this.messageCallbacks.clear();
  }
}

// Create a singleton instance
let webSocketManagerInstance = null;

/**
 * Get the singleton WebSocket connection manager instance
 * @param {Object} configManager - Configuration manager instance
 * @param {Object} logger - Logger instance
 * @param {Object} errorHandler - Error handler instance
 * @returns {WebSocketConnectionManager} The WebSocket connection manager instance
 */
export function getWebSocketConnectionManager(configManager, logger, errorHandler) {
  if (!webSocketManagerInstance) {
    webSocketManagerInstance = new WebSocketConnectionManager(configManager, logger, errorHandler);
  }
  return webSocketManagerInstance;
}