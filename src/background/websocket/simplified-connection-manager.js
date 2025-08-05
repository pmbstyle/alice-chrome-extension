/**
 * Simplified WebSocket connection manager for LLM-optimized Chrome Extension
 * Provides efficient connection management with automatic reconnection and message queuing
 */

import { WEBSOCKET_CONFIG, MESSAGE_TYPES, ERROR_CODES } from '../../shared/constants/simplified-config.js';

/**
 * Simplified WebSocket connection manager
 */
export class SimplifiedConnectionManager {
  /**
   * Create a new SimplifiedConnectionManager
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = {
      url: config.url || WEBSOCKET_CONFIG.URL,
      reconnectInterval: config.reconnectInterval || WEBSOCKET_CONFIG.RECONNECT_INTERVAL,
      connectionTimeout: config.connectionTimeout || WEBSOCKET_CONFIG.CONNECTION_TIMEOUT,
      pingInterval: config.pingInterval || WEBSOCKET_CONFIG.PING_INTERVAL,
      autoReconnect: config.autoReconnect !== false,
      maxReconnectAttempts: config.maxReconnectAttempts || 5
    };

    this.socket = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.connectionTimeout = null;
    this.pingInterval = null;
    this.messageHandlers = new Map();
    this.connectionHandlers = new Map();
  }

  /**
   * Initialize the connection manager
   */
  init() {
    // Set up connection event handlers
    this.setupConnectionHandlers();
  }

  /**
   * Set up connection event handlers
   */
  setupConnectionHandlers() {
    this.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.processMessageQueue();
      this.startPingInterval();
    });

    this.on('disconnected', () => {
      this.isConnected = false;
      this.stopPingInterval();
      
      if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.on('error', (error) => {
      console.error('[SimplifiedConnectionManager] Connection error:', error);
    });
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  async connect() {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    this.isConnecting = true;
    console.log(`[SimplifiedConnectionManager] Connecting to WebSocket at: ${this.config.url}`);

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.url);
        console.log(`[SimplifiedConnectionManager] WebSocket object created`);

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          this.isConnecting = false;
          if (this.socket) {
            this.socket.close();
          }
          reject(new Error('Connection timeout'));
        }, this.config.connectionTimeout);

        this.socket.addEventListener('open', () => {
          clearTimeout(this.connectionTimeout);
          this.isConnecting = false;
          this.emit('connected', this.socket);
          resolve(this.socket);
        });

        this.socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[SimplifiedConnectionManager] Error parsing message:', error);
            this.emit('error', error);
          }
        });

        this.socket.addEventListener('error', (error) => {
          clearTimeout(this.connectionTimeout);
          this.isConnecting = false;
          console.error(`[SimplifiedConnectionManager] WebSocket connection error for URL ${this.config.url}:`, error);
          this.emit('error', error);
          reject(error);
        });

        this.socket.addEventListener('close', (event) => {
          clearTimeout(this.connectionTimeout);
          this.isConnecting = false;
          this.emit('disconnected', event);
        });

      } catch (error) {
        clearTimeout(this.connectionTimeout);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Wait for existing connection to complete
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
          resolve(this.socket);
        } else if (!this.isConnecting) {
          resolve(this.connect());
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Maximum 30 seconds between attempts
    );

    console.log(`[SimplifiedConnectionManager] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error(`[SimplifiedConnectionManager] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
      });
    }, delay);
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message to send
   * @returns {Promise<void>} Promise that resolves when message is sent
   */
  async send(message) {
    if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Queue message for later delivery
      this.messageQueue.push(message);
      console.log('[SimplifiedConnectionManager] Message queued, attempting to connect...');
      
      try {
        await this.connect();
      } catch (error) {
        console.error('[SimplifiedConnectionManager] Failed to connect for message delivery:', error);
        throw error;
      }
      
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      console.log('[SimplifiedConnectionManager] 📤 Sending WebSocket message:', {
        type: message.type,
        requestId: message.requestId,
        timestamp: message.timestamp,
        dataSize: messageString.length
      });
      this.socket.send(messageString);
      console.log('[SimplifiedConnectionManager] ✅ WebSocket message sent successfully');
    } catch (error) {
      console.error('[SimplifiedConnectionManager] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message).catch(error => {
        console.error('[SimplifiedConnectionManager] Failed to send queued message:', error);
        // Re-queue message on failure
        this.messageQueue.unshift(message);
      });
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param {Object} message - Received message
   */
  handleMessage(message) {
    // Handle ping/pong automatically
    if (message.type === MESSAGE_TYPES.PING) {
      this.send({
        type: MESSAGE_TYPES.PONG,
        timestamp: Date.now()
      }).catch(error => {
        console.error('[SimplifiedConnectionManager] Failed to send pong:', error);
      });
      return;
    }

    // Emit message to registered handlers
    this.emit('message', message);
  }

  /**
   * Start ping interval for connection keep-alive
   */
  startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: MESSAGE_TYPES.PING,
          timestamp: Date.now()
        }).catch(error => {
          console.error('[SimplifiedConnectionManager] Failed to send ping:', error);
        });
      }
    }, this.config.pingInterval);
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (!this.connectionHandlers.has(event)) {
      this.connectionHandlers.set(event, []);
    }
    this.connectionHandlers.get(event).push(handler);
  }

  /**
   * Emit event to registered handlers
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   */
  emit(event, ...args) {
    const handlers = this.connectionHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[SimplifiedConnectionManager] Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      messageQueueLength: this.messageQueue.length,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.config.autoReconnect = false;
    this.stopPingInterval();
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Destroy the connection manager and clean up resources
   */
  destroy() {
    this.disconnect();
    this.messageQueue = [];
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }
}

// Create a singleton instance
let connectionManagerInstance = null;

/**
 * Get the singleton connection manager instance
 * @param {Object} config - Configuration object
 * @returns {SimplifiedConnectionManager} The connection manager instance
 */
export function getSimplifiedConnectionManager(config) {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new SimplifiedConnectionManager(config);
    connectionManagerInstance.init();
  }
  return connectionManagerInstance;
}