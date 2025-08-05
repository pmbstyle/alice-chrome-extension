import { WEBSOCKET_CONFIG, MESSAGE_TYPES, ERROR_CODES } from '../../shared/constants/simplified-config.js';

export class SimplifiedConnectionManager {
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

  init() {
    this.setupConnectionHandlers();
  }

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
    });
  }

  async connect() {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.url);

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
            this.emit('error', error);
          }
        });

        this.socket.addEventListener('error', (error) => {
          clearTimeout(this.connectionTimeout);
          this.isConnecting = false;
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

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Maximum 30 seconds between attempts
    );


    setTimeout(() => {
      this.connect().catch(error => {
      });
    }, delay);
  }

  async send(message) {
    if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      
      try {
        await this.connect();
      } catch (error) {
        throw error;
      }
      
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      this.socket.send(messageString);
    } catch (error) {
      throw error;
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message).catch(error => {
        this.messageQueue.unshift(message);
      });
    }
  }

  handleMessage(message) {
    if (message.type === MESSAGE_TYPES.PING) {
      this.send({
        type: MESSAGE_TYPES.PONG,
        timestamp: Date.now()
      }).catch(error => {
      });
      return;
    }

    this.emit('message', message);
  }

  startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: MESSAGE_TYPES.PING,
          timestamp: Date.now()
        }).catch(error => {
        });
      }
    }, this.config.pingInterval);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  on(event, handler) {
    if (!this.connectionHandlers.has(event)) {
      this.connectionHandlers.set(event, []);
    }
    this.connectionHandlers.get(event).push(handler);
  }

  emit(event, ...args) {
    const handlers = this.connectionHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
        }
      });
    }
  }

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

  destroy() {
    this.disconnect();
    this.messageQueue = [];
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }
}

let connectionManagerInstance = null;

export function getSimplifiedConnectionManager(config) {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new SimplifiedConnectionManager(config);
    connectionManagerInstance.init();
  }
  return connectionManagerInstance;
}