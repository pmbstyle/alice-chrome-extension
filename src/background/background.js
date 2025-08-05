/**
 * Refactored background script for the Alice Browser Context extension
 * This script uses modular components for better organization and maintainability
 */

// Import modules
import { getConfigManager } from './config/config-manager.js';
import { getLogger } from './utils/logger.js';
import { getErrorHandler } from './utils/error-handler.js';
import { getWebSocketConnectionManager } from './websocket/connection-manager.js';
import { getWebSocketMessageHandler } from './websocket/message-handler.js';
import { getBrowserContextManager } from './browser-context/context-manager.js';
import { LOG_LEVELS } from '../shared/constants/default-config.js';

// Global variables for module instances
let configManager = null;
let logger = null;
let errorHandler = null;
let webSocketManager = null;
let messageHandler = null;
let browserContextManager = null;

/**
 * Initialize the extension
 */
async function initializeExtension() {
  try {
    // Initialize configuration manager
    configManager = getConfigManager();
    await configManager.init();
    
    // Initialize logger with configuration
    const loggingConfig = configManager.get('logging');
    logger = getLogger(loggingConfig);
    logger.init();
    
    // Initialize error handler
    errorHandler = getErrorHandler(logger, configManager.getConfig());
    errorHandler.init();
    
    // Initialize browser context manager
    browserContextManager = getBrowserContextManager(configManager, logger, errorHandler);
    browserContextManager.init();
    
    // Initialize WebSocket connection manager
    webSocketManager = getWebSocketConnectionManager(configManager, logger, errorHandler);
    webSocketManager.init();
    
    // Initialize WebSocket message handler
    messageHandler = getWebSocketMessageHandler(configManager, logger, errorHandler, browserContextManager);
    messageHandler.init();
    
    // Set up event listeners
    setupEventListeners();
    
    logger.info('Alice Browser Context extension initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize extension:', error);
    if (logger) {
      logger.error('Extension initialization failed', { error: error.message });
    }
  }
}

/**
 * Set up event listeners for the extension
 */
function setupEventListeners() {
  // Extension installation/update
  chrome.runtime.onInstalled.addListener(handleExtensionInstalled);
  
  // Extension startup
  chrome.runtime.onStartup.addListener(handleExtensionStartup);
  
  // Extension action (toolbar icon) click
  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener(handleActionClick);
  }
  
  
  // WebSocket message events
  webSocketManager.onMessage('all', handleWebSocketMessage);
  
  // WebSocket connection events
  webSocketManager.onConnection('connected', handleWebSocketConnected);
  webSocketManager.onConnection('disconnected', handleWebSocketDisconnected);
  webSocketManager.onConnection('error', handleWebSocketError);
  
  // Message handler events
  messageHandler.on('send', handleSendMessage);
  
  // Configuration changes
  configManager.onChange('all', handleConfigChange);
}

/**
 * Handle extension installation or update
 * @param {Object} details - Installation details
 */
function handleExtensionInstalled(details) {
  logger.info('Extension installed/updated', {
    reason: details.reason,
    previousVersion: details.previousVersion,
    version: chrome.runtime.getManifest().version
  });
}

/**
 * Handle extension startup
 */
function handleExtensionStartup() {
  logger.info('Extension started');
  
  // Reconnect to WebSocket server
  webSocketManager.connect().catch(error => {
    logger.error('Failed to connect to WebSocket server on startup', { error: error.message });
  });
}

/**
 * Handle extension action (toolbar icon) click
 * @param {Object} tab - The tab that was active when the icon was clicked
 */
async function handleActionClick(tab) {
  logger.info('Extension action clicked', { tabId: tab.id, url: tab.url });
  
  try {
    // Test WebSocket connection
    await webSocketManager.connect();
    logger.info('WebSocket connection test successful');
  } catch (error) {
    logger.error('WebSocket connection test failed', { error: error.message });
  }
}


/**
 * Handle WebSocket messages
 * @param {Object} message - The received WebSocket message
 */
function handleWebSocketMessage(message) {
  logger.debug('Received WebSocket message', { type: message.type });
  
  // Forward to message handler
  messageHandler.handleMessage(message);
}

/**
 * Handle WebSocket connection established
 */
function handleWebSocketConnected() {
  logger.info('WebSocket connection established');
}

/**
 * Handle WebSocket connection disconnected
 * @param {CloseEvent} event - The close event
 */
function handleWebSocketDisconnected(event) {
  logger.info('WebSocket connection disconnected', { 
    code: event.code, 
    reason: event.reason 
  });
}

/**
 * Handle WebSocket connection error
 * @param {Error} error - The connection error
 */
function handleWebSocketError(error) {
  logger.error('WebSocket connection error', { error: error.message });
}

/**
 * Handle send message event from message handler
 * @param {Object} message - The message to send
 */
async function handleSendMessage(message) {
  try {
    await webSocketManager.send(message);
  } catch (error) {
    logger.error('Failed to send WebSocket message', { error: error.message });
  }
}

/**
 * Handle configuration changes
 * @param {string} path - The configuration path that changed
 * @param {any} newValue - The new value
 * @param {any} oldValue - The old value
 */
function handleConfigChange(path, newValue, oldValue) {
  logger.info('Configuration changed', { path, newValue, oldValue });
  
  // Handle specific configuration changes
  if (path.startsWith('logging.')) {
    // Update logger configuration
    if (path === 'logging.level') {
      logger.setLevel(LOG_LEVELS[newValue.toUpperCase()]);
    } else if (path === 'logging.enableConsoleLogging') {
      logger.setConsoleLogging(newValue);
    } else if (path === 'logging.maxLogEntries') {
      logger.setMaxLogEntries(newValue);
    }
  }
}


/**
 * Get extension statistics for debugging
 * @returns {Object} Extension statistics
 */
function getExtensionStats() {
  return {
    config: configManager ? configManager.getConfig() : null,
    logger: logger ? logger.getStats() : null,
    errorHandler: errorHandler ? errorHandler.getErrorStats() : null,
    webSocket: webSocketManager ? webSocketManager.getStats() : null,
    messageHandler: messageHandler ? messageHandler.getStats() : null,
    browserContext: browserContextManager ? browserContextManager.getStats() : null,
    manifest: chrome.runtime.getManifest(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Clean up extension resources before unload
 */
function cleanup() {
  logger.info('Cleaning up extension resources');
  
  if (webSocketManager) {
    webSocketManager.destroy();
  }
  
  if (messageHandler) {
    messageHandler.destroy();
  }
  
  if (browserContextManager) {
    browserContextManager.destroy();
  }
  
  if (errorHandler) {
    errorHandler.destroy();
  }
  
  if (logger) {
    logger.destroy();
  }
  
  if (configManager) {
    configManager.destroy();
  }
}

// Initialize the extension when the script loads
initializeExtension().catch(error => {
  console.error('Failed to initialize extension:', error);
});

// Clean up when the service worker is terminated
self.addEventListener('beforeunload', () => {
  cleanup();
});

// Export functions for debugging (only in development)
if (chrome.runtime.id && chrome.runtime.id.includes('development')) {
  self.getExtensionStats = getExtensionStats;
  self.cleanup = cleanup;
}