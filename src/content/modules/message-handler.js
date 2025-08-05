/**
 * Message handler module for the content script
 * Handles communication with the background script
 */

/**
 * Message handler class
 */
export class MessageHandler {
  /**
   * Create a new MessageHandler
   */
  constructor() {
    this.messageHandlers = new Map();
    this.messageCallbacks = new Map();
  }

  /**
   * Initialize the message handler
   */
  init() {
    // Set up message listener
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  /**
   * Handle incoming messages from the background script
   * @param {Object} request - The message request
   * @param {Object} sender - Message sender information
   * @param {Function} sendResponse - Function to send response
   * @returns {boolean} True if the response will be sent asynchronously
   */
  handleMessage(request, sender, sendResponse) {
    console.log('[Content] Received message from background:', request);
    console.log('[Content] Message type:', request.type);
    console.log('[Content] Message keys:', Object.keys(request));
    
    // Find the appropriate handler for this message type
    const handler = this.messageHandlers.get(request.type);
    if (handler) {
      try {
        const result = handler(request, sender, sendResponse);
        
        // If the handler returns a Promise, it's an async response
        if (result instanceof Promise) {
          result
            .then(response => {
              if (response !== undefined) {
                sendResponse(response);
              }
            })
            .catch(error => {
              console.error('[Content] Error in async message handler:', error);
              sendResponse({ success: false, error: error.message });
            });
          
          return true; // Indicates async response
        }
        
        // If the handler returned a value, send it as the response
        if (result !== undefined) {
          sendResponse(result);
        }
        
        return false; // Indicates synchronous response
        
      } catch (error) {
        console.error('[Content] Error in message handler:', error);
        sendResponse({ success: false, error: error.message });
        return false;
      }
    }
    
    // No handler found for this message type
    console.log('[Content] Unhandled message type:', request.type);
    return false;
  }

  /**
   * Register a handler for a specific message type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);
    
    console.log(`[Content] Registered handler for message type: ${type}`);
  }

  /**
   * Unregister a handler for a specific message type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function to remove
   */
  offMessage(type, handler) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log(`[Content] Unregistered handler for message type: ${type}`);
      }
    }
  }

  /**
   * Send a message to the background script
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Promise that resolves to the response
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a message to the background script with a timeout
   * @param {Object} message - Message to send
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<Object>} Promise that resolves to the response
   */
  async sendMessageWithTimeout(message, timeout = 5000) {
    return Promise.race([
      this.sendMessage(message),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Message response timeout')), timeout)
      )
    ]);
  }

  /**
   * Register a callback for when a message of a specific type is received
   * @param {string} type - Message type
   * @param {Function} callback - Callback function
   */
  on(type, callback) {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
    }
    this.messageCallbacks.get(type).push(callback);
  }

  /**
   * Unregister a callback for when a message of a specific type is received
   * @param {string} type - Message type
   * @param {Function} callback - Callback function to remove
   */
  off(type, callback) {
    const callbacks = this.messageCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify callbacks for a specific message type
   * @param {string} type - Message type
   * @param {Object} message - The message
   * @param {Object} response - The response (if any)
   */
  notifyCallbacks(type, message, response) {
    const callbacks = this.messageCallbacks.get(type) || [];
    
    for (const callback of callbacks) {
      try {
        callback(message, response);
      } catch (error) {
        console.error('[Content] Error in message callback:', error);
      }
    }
  }

  /**
   * Get message handler statistics
   * @returns {Object} Message handler statistics
   */
  getStats() {
    return {
      registeredHandlers: Array.from(this.messageHandlers.keys()).reduce((acc, type) => {
        acc[type] = this.messageHandlers.get(type).length;
        return acc;
      }, {}),
      registeredCallbacks: Array.from(this.messageCallbacks.keys()).reduce((acc, type) => {
        acc[type] = this.messageCallbacks.get(type).length;
        return acc;
      }, {})
    };
  }

  /**
   * Destroy the message handler and clean up resources
   */
  destroy() {
    // Clear handlers and callbacks
    this.messageHandlers.clear();
    this.messageCallbacks.clear();
    
    // Remove message listener
    chrome.runtime.onMessage.removeListener(this.handleMessage);
  }
}