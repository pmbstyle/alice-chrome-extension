/**
 * Simplified background script for LLM-optimized Chrome Extension
 * Uses simplified configuration and message types
 */

import {
  WEBSOCKET_CONFIG,
  BROWSER_CONTEXT_CONFIG,
  LOGGING_CONFIG,
  MESSAGE_TYPES,
  ERROR_CODES,
  DEFAULT_REQUEST_OPTIONS,
  getCurrentEnvironmentConfig
} from '../shared/constants/simplified-config.js';

import { getSimplifiedConnectionManager } from './websocket/simplified-connection-manager.js';
import { getMemoryManager } from '../shared/utils/memory-manager.js';

// Global variables
let connectionManager = null;
let memoryManager = null;
let environmentConfig = null;
let socket = null;
let isConnecting = false;
let messageQueue = [];

/**
 * Initialize the simplified background script
 */
async function initialize() {
  try {
    console.log('[SimplifiedBackground] Starting initialization...');
    
    // Get environment-specific configuration
    environmentConfig = getCurrentEnvironmentConfig();
    console.log('[SimplifiedBackground] Environment config loaded:', environmentConfig);
    
    // Initialize memory manager
    memoryManager = getMemoryManager();
    console.log('[SimplifiedBackground] Memory manager initialized');
    
    // Initialize connection manager
    connectionManager = getSimplifiedConnectionManager(environmentConfig.websocket);
    console.log('[SimplifiedBackground] Connection manager initialized with config:', environmentConfig.websocket);
    
    // Set up event listeners for the connection manager
    connectionManager.on('connected', (socketInstance) => {
      console.log('[SimplifiedBackground] Connection manager connected');
      // Store the socket for legacy compatibility
      socket = socketInstance;
    });
    
    connectionManager.on('message', (message) => {
      console.log('[SimplifiedBackground] Received message via connection manager:', message);
      handleWebSocketMessage(message);
    });
    
    connectionManager.on('error', (error) => {
      console.error('[SimplifiedBackground] Connection manager error:', error);
    });
    
    // Set up event listeners
    setupEventListeners();
    console.log('[SimplifiedBackground] Event listeners set up');
    
    // Initialize WebSocket connection
    console.log('[SimplifiedBackground] Attempting to connect to WebSocket...');
    await connectionManager.connect();
    
    console.log('[SimplifiedBackground] Initialized successfully');
  } catch (error) {
    console.error('[SimplifiedBackground] Initialization failed:', error);
  }
}

/**
 * Set up event listeners
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
}

/**
 * Handle extension installation or update
 * @param {Object} details - Installation details
 */
function handleExtensionInstalled(details) {
  console.log('[SimplifiedBackground] Extension installed/updated', {
    reason: details.reason,
    version: chrome.runtime.getManifest().version
  });
}

/**
 * Handle extension startup
 */
async function handleExtensionStartup() {
  console.log('[SimplifiedBackground] Extension started');
  await connectionManager.connect();
}

/**
 * Handle extension action (toolbar icon) click
 * @param {Object} tab - The tab that was active when the icon was clicked
 */
async function handleActionClick(tab) {
  console.log('[SimplifiedBackground] Action clicked', { tabId: tab.id });
  
  try {
    await connectionManager.connect();
    console.log('[SimplifiedBackground] WebSocket connection test successful');
  } catch (error) {
    console.error('[SimplifiedBackground] WebSocket connection test failed:', error);
  }
}

/**
 * Connect to WebSocket server
 * @returns {Promise<WebSocket>} WebSocket connection
 */
function connectWebSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return Promise.resolve(socket);
  }

  if (isConnecting) {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          resolve(socket);
        } else if (!isConnecting) {
          resolve(connectWebSocket());
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  return new Promise((resolve, reject) => {
    isConnecting = true;
    const wsUrl = environmentConfig.websocket.url || WEBSOCKET_CONFIG.URL;

    try {
      socket = new WebSocket(wsUrl);

      socket.addEventListener('open', () => {
        console.log('[SimplifiedBackground] WebSocket connected');
        isConnecting = false;

        // Process queued messages
        while (messageQueue.length > 0) {
          const message = messageQueue.shift();
          socket.send(JSON.stringify(message));
        }

        resolve(socket);
      });

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('[SimplifiedBackground] Error parsing WebSocket message:', error);
        }
      });

      socket.addEventListener('error', (error) => {
        console.error('[SimplifiedBackground] WebSocket error:', error);
        isConnecting = false;
        reject(error);
      });

      socket.addEventListener('close', () => {
        console.log('[SimplifiedBackground] WebSocket disconnected');
        isConnecting = false;
        socket = null;
      });

    } catch (error) {
      isConnecting = false;
      reject(error);
    }
  });
}

/**
 * Handle incoming WebSocket messages
 * @param {Object} message - Received WebSocket message
 */
async function handleWebSocketMessage(message) {
  console.log('[SimplifiedBackground] Received message:', message);

  switch (message.type) {
    case MESSAGE_TYPES.GET_CONTEXT:
      await handleGetContextRequest(message);
      break;
    case MESSAGE_TYPES.GET_CONTENT:
      await handleGetContentRequest(message);
      break;
    case MESSAGE_TYPES.GET_LINKS:
      await handleGetLinksRequest(message);
      break;
    case MESSAGE_TYPES.GET_SELECTION:
      await handleGetSelectionRequest(message);
      break;
    case MESSAGE_TYPES.GET_METADATA:
      await handleGetMetadataRequest(message);
      break;
    case MESSAGE_TYPES.PING:
      handlePingMessage(message);
      break;
    default:
      console.log('[SimplifiedBackground] Ignoring message type:', message.type);
  }
}

/**
 * Handle get_context request
 * @param {Object} message - Request message
 */
async function handleGetContextRequest(message) {
  const { requestId, options = {} } = message;
  
  if (!requestId) {
    sendErrorResponse(MESSAGE_TYPES.ERROR, ERROR_CODES.INVALID_REQUEST, 'Request ID is required');
    return;
  }

  try {
    // Get active tab
    const activeTab = await getActiveTab();
    
    if (!activeTab) {
      sendContextResponse(requestId, null, ERROR_CODES.BC_NO_ACTIVE_TAB, 'No active tab found');
      return;
    }

    // Check if page is restricted
    if (isRestrictedPage(activeTab.url)) {
      sendContextResponse(requestId, null, ERROR_CODES.BC_RESTRICTED_PAGE, 'Cannot access restricted page');
      return;
    }

    // Get browser context from content script
    const context = await getBrowserContextFromContentScript(activeTab, options);
    
    sendContextResponse(requestId, context);
    
  } catch (error) {
    console.error('[SimplifiedBackground] Error handling get_context request:', error);
    sendContextResponse(requestId, null, ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Handle get_content request
 * @param {Object} message - Request message
 */
async function handleGetContentRequest(message) {
  const { requestId, options = {} } = message;
  
  if (!requestId) {
    sendErrorResponse(MESSAGE_TYPES.ERROR, ERROR_CODES.INVALID_REQUEST, 'Request ID is required');
    return;
  }

  try {
    // Get active tab
    const activeTab = await getActiveTab();
    
    if (!activeTab) {
      sendContentResponse(requestId, null, ERROR_CODES.BC_NO_ACTIVE_TAB, 'No active tab found');
      return;
    }

    // Check if page is restricted
    if (isRestrictedPage(activeTab.url)) {
      sendContentResponse(requestId, null, ERROR_CODES.BC_RESTRICTED_PAGE, 'Cannot access restricted page');
      return;
    }

    // Get content from content script
    const content = await getContentFromContentScript(activeTab, options);
    
    sendContentResponse(requestId, content);
    
  } catch (error) {
    console.error('[SimplifiedBackground] Error handling get_content request:', error);
    sendContentResponse(requestId, null, ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Handle get_links request
 * @param {Object} message - Request message
 */
async function handleGetLinksRequest(message) {
  const { requestId, options = {} } = message;
  
  if (!requestId) {
    sendErrorResponse(MESSAGE_TYPES.ERROR, ERROR_CODES.INVALID_REQUEST, 'Request ID is required');
    return;
  }

  try {
    // Get active tab
    const activeTab = await getActiveTab();
    
    if (!activeTab) {
      sendLinksResponse(requestId, null, ERROR_CODES.BC_NO_ACTIVE_TAB, 'No active tab found');
      return;
    }

    // Check if page is restricted
    if (isRestrictedPage(activeTab.url)) {
      sendLinksResponse(requestId, null, ERROR_CODES.BC_RESTRICTED_PAGE, 'Cannot access restricted page');
      return;
    }

    // Get links from content script
    const links = await getLinksFromContentScript(activeTab, options);
    
    sendLinksResponse(requestId, links);
    
  } catch (error) {
    console.error('[SimplifiedBackground] Error handling get_links request:', error);
    sendLinksResponse(requestId, null, ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Handle get_selection request
 * @param {Object} message - Request message
 */
async function handleGetSelectionRequest(message) {
  const { requestId, options = {} } = message;
  
  if (!requestId) {
    sendErrorResponse(MESSAGE_TYPES.ERROR, ERROR_CODES.INVALID_REQUEST, 'Request ID is required');
    return;
  }

  try {
    // Get active tab
    const activeTab = await getActiveTab();
    
    if (!activeTab) {
      sendSelectionResponse(requestId, null, ERROR_CODES.BC_NO_ACTIVE_TAB, 'No active tab found');
      return;
    }

    // Check if page is restricted
    if (isRestrictedPage(activeTab.url)) {
      sendSelectionResponse(requestId, null, ERROR_CODES.BC_RESTRICTED_PAGE, 'Cannot access restricted page');
      return;
    }

    // Get selection from content script
    const selection = await getSelectionFromContentScript(activeTab, options);
    
    sendSelectionResponse(requestId, selection);
    
  } catch (error) {
    console.error('[SimplifiedBackground] Error handling get_selection request:', error);
    sendSelectionResponse(requestId, null, ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Handle get_metadata request
 * @param {Object} message - Request message
 */
async function handleGetMetadataRequest(message) {
  const { requestId, options = {} } = message;
  
  if (!requestId) {
    sendErrorResponse(MESSAGE_TYPES.ERROR, ERROR_CODES.INVALID_REQUEST, 'Request ID is required');
    return;
  }

  try {
    // Get active tab
    const activeTab = await getActiveTab();
    
    if (!activeTab) {
      sendMetadataResponse(requestId, null, ERROR_CODES.BC_NO_ACTIVE_TAB, 'No active tab found');
      return;
    }

    // Get metadata from content script
    const metadata = await getMetadataFromContentScript(activeTab, options);
    
    sendMetadataResponse(requestId, metadata);
    
  } catch (error) {
    console.error('[SimplifiedBackground] Error handling get_metadata request:', error);
    sendMetadataResponse(requestId, null, ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Get active tab
 * @returns {Promise<chrome.tabs.Tab|null>} Active tab or null
 */
async function getActiveTab() {
  try {
    // Try current window first
    const currentWindowTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    
    if (currentWindowTabs.length > 0) {
      return currentWindowTabs[0];
    }

    // Try all windows
    const allWindowTabs = await chrome.tabs.query({ active: true });
    
    if (allWindowTabs.length > 0) {
      return allWindowTabs[0];
    }

    return null;
  } catch (error) {
    console.error('[SimplifiedBackground] Error getting active tab:', error);
    return null;
  }
}

/**
 * Check if page is restricted
 * @param {string} url - Page URL
 * @returns {boolean} True if page is restricted
 */
function isRestrictedPage(url) {
  return BROWSER_CONTEXT_CONFIG.RESTRICTED_PROTOCOLS.some(protocol => 
    url.startsWith(protocol)
  );
}

/**
 * Check if content script is ready in the specified tab
 * @param {chrome.tabs.Tab} tab - Target tab
 * @returns {Promise<boolean>} True if content script is ready
 */
async function isContentScriptReady(tab) {
  try {
    console.log('[SimplifiedBackground] 🔍 Checking content script readiness in tab:', tab.id);
    
    // Try to execute a script to check if the content script is ready
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return typeof window !== 'undefined' &&
               typeof window.isSimplifiedContentScriptReady === 'function' &&
               window.isSimplifiedContentScriptReady();
      }
    });
    
    const isReady = results && results[0] && results[0].result;
    console.log('[SimplifiedBackground] 📊 Content script readiness check result:', isReady);
    
    return isReady;
  } catch (error) {
    console.error('[SimplifiedBackground] ❌ Error checking content script readiness:', error);
    return false;
  }
}

/**
 * Get browser context from content script
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Browser context data
 */
async function getBrowserContextFromContentScript(tab, options) {
  try {
    console.log('[SimplifiedBackground] 🚀 Attempting to get browser context from tab:', tab.id);
    console.log('[SimplifiedBackground] 📍 Tab URL:', tab.url);
    console.log('[SimplifiedBackground] 📋 Tab title:', tab.title);
    
    // First check if content script is ready
    console.log('[SimplifiedBackground] 🔍 Checking content script readiness before ping...');
    const scriptReady = await isContentScriptReady(tab);
    
    if (!scriptReady) {
      console.log('[SimplifiedBackground] ⚠️ Content script not ready, attempting to inject...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/simplified-content.js']
        });
        console.log('[SimplifiedBackground] ✅ Content script injection attempted');
        
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check readiness again
        const readyAfterInjection = await isContentScriptReady(tab);
        if (!readyAfterInjection) {
          console.log('[SimplifiedBackground] ❌ Content script still not ready after injection');
          throw new Error('Content script not ready after injection. Please refresh the page.');
        }
        console.log('[SimplifiedBackground] ✅ Content script ready after injection');
      } catch (injectError) {
        console.error('[SimplifiedBackground] ❌ Content script injection failed:', injectError);
        throw new Error(`Content script injection failed: ${injectError.message}`);
      }
    }
    
    // Check if content script is available (it should be injected automatically via manifest)
    try {
      console.log('[SimplifiedBackground] 🏓 Pinging content script...');
      console.log('[SimplifiedBackground] 📤 Sending PING message to tab:', tab.id);
      
      const pingResponse = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PING timeout after 3 seconds')), 3000)
        )
      ]);
      
      console.log('[SimplifiedBackground] ✅ Content script ping successful:', pingResponse);
      console.log('[SimplifiedBackground] 📊 Ping response details:', {
        hasResponse: !!pingResponse,
        responseType: pingResponse?.type,
        responseTimestamp: pingResponse?.timestamp,
        tabId: tab.id
      });
      
    } catch (pingError) {
      console.error('[SimplifiedBackground] ❌ Content script ping failed:', pingError.message);
      console.error('[SimplifiedBackground] 🔍 Ping error details:', {
        errorName: pingError.name,
        errorMessage: pingError.message,
        errorStack: pingError.stack,
        tabId: tab.id,
        tabUrl: tab.url
      });
      
      // Try to get more diagnostic information
      try {
        console.log('[SimplifiedBackground] 🔎 Attempting to inject content script manually...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/simplified-content.js']
        });
        console.log('[SimplifiedBackground] ✅ Content script injection attempted');
        
        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try ping again
        console.log('[SimplifiedBackground] 🔄 Retrying ping after injection...');
        const retryPingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        console.log('[SimplifiedBackground] ✅ Retry ping successful:', retryPingResponse);
        
      } catch (injectError) {
        console.error('[SimplifiedBackground] ❌ Content script injection failed:', injectError.message);
        throw new Error(`Content script not available. Injection failed: ${injectError.message}. Please refresh the page to ensure the content script is properly injected.`);
      }
    }

    // Send request to content script
    const request = {
      type: 'GET_SIMPLIFIED_CONTEXT',
      ...DEFAULT_REQUEST_OPTIONS,
      ...options
    };

    console.log('[SimplifiedBackground] 📤 Sending GET_SIMPLIFIED_CONTEXT request to content script:', request);
    console.log('[SimplifiedBackground] ⏱️ Request timeout set to:', BROWSER_CONTEXT_CONFIG.CONTENT_SCRIPT_TIMEOUT, 'ms');

    let timeoutId;
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, request).then(result => {
        clearTimeout(timeoutId);
        return result;
      }),
      new Promise((_, reject) => {
        console.log('[SimplifiedBackground] ⏳ Starting timeout timer for content script response...');
        timeoutId = setTimeout(() => {
          console.error('[SimplifiedBackground] ⏰ Content script response timeout reached');
          reject(new Error('Content script timeout'));
        }, BROWSER_CONTEXT_CONFIG.CONTENT_SCRIPT_TIMEOUT);
      })
    ]);

    console.log('[SimplifiedBackground] 📥 Received response from content script:', response);
    console.log('[SimplifiedBackground] 📊 Response analysis:', {
      hasResponse: !!response,
      isSuccess: response?.success,
      hasData: !!response?.data,
      hasError: !!response?.error,
      responseType: typeof response,
      responseKeys: response ? Object.keys(response) : [],
      tabId: tab.id
    });

    if (response && response.success) {
      console.log('[SimplifiedBackground] ✅ Successfully extracted browser context');
      return response.data;
    } else {
      console.error('[SimplifiedBackground] ❌ Failed to get browser context:', response?.error || 'Unknown error');
      throw new Error(response?.error || 'Failed to get browser context');
    }

  } catch (error) {
    console.error('[SimplifiedBackground] Error getting browser context:', error);
    throw error;
  }
}

/**
 * Get content from content script
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Content data
 */
async function getContentFromContentScript(tab, options) {
  const request = {
    type: 'GET_CONTENT',
    ...DEFAULT_REQUEST_OPTIONS,
    ...options
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

/**
 * Get links from content script
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Links data
 */
async function getLinksFromContentScript(tab, options) {
  const request = {
    type: 'GET_LINKS',
    ...DEFAULT_REQUEST_OPTIONS,
    ...options
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

/**
 * Get selection from content script
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Selection data
 */
async function getSelectionFromContentScript(tab, options) {
  const request = {
    type: 'GET_SELECTION',
    ...DEFAULT_REQUEST_OPTIONS,
    ...options
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

/**
 * Get metadata from content script
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Metadata data
 */
async function getMetadataFromContentScript(tab, options) {
  const request = {
    type: 'GET_METADATA',
    ...DEFAULT_REQUEST_OPTIONS,
    ...options
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

/**
 * Send request to content script with error handling
 * @param {chrome.tabs.Tab} tab - Target tab
 * @param {Object} request - Request object
 * @returns {Promise<Object>} Response data
 */
async function sendContentScriptRequest(tab, request) {
  try {
    console.log('[SimplifiedBackground] Attempting to send content script request to tab:', tab.id);
    
    // Check if content script is available (it should be injected automatically via manifest)
    try {
      console.log('[SimplifiedBackground] Pinging content script...');
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      console.log('[SimplifiedBackground] Content script ping successful:', pingResponse);
    } catch (pingError) {
      console.error('[SimplifiedBackground] Content script not available:', pingError.message);
      throw new Error('Content script not available. Please refresh the page to ensure the content script is properly injected.');
    }

    console.log('[SimplifiedBackground] Sending request to content script:', request);

    // Send request to content script
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Content script timeout')), BROWSER_CONTEXT_CONFIG.CONTENT_SCRIPT_TIMEOUT)
      )
    ]);

    console.log('[SimplifiedBackground] Received response from content script:', response);

    if (response && response.success) {
      return response;
    } else {
      throw new Error(response?.error || 'Failed to get data from content script');
    }

  } catch (error) {
    console.error('[SimplifiedBackground] Error sending content script request:', error);
    throw error;
  }
}

/**
 * Handle ping message
 * @param {Object} message - Ping message
 */
function handlePingMessage(message) {
  const response = {
    type: MESSAGE_TYPES.PONG,
    timestamp: Date.now()
  };
  
  sendWebSocketMessage(response);
}

/**
 * Send context response
 * @param {string} requestId - Request ID
 * @param {Object} data - Response data
 * @param {string} errorCode - Error code (if any)
 * @param {string} errorMessage - Error message (if any)
 */
function sendContextResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.CONTEXT_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || 'Unknown error'
    };
  }

  sendWebSocketMessage(response);
}

/**
 * Send content response
 * @param {string} requestId - Request ID
 * @param {Object} data - Response data
 * @param {string} errorCode - Error code (if any)
 * @param {string} errorMessage - Error message (if any)
 */
function sendContentResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.CONTENT_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || 'Unknown error'
    };
  }

  sendWebSocketMessage(response);
}

/**
 * Send links response
 * @param {string} requestId - Request ID
 * @param {Object} data - Response data
 * @param {string} errorCode - Error code (if any)
 * @param {string} errorMessage - Error message (if any)
 */
function sendLinksResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.LINKS_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || 'Unknown error'
    };
  }

  sendWebSocketMessage(response);
}

/**
 * Send selection response
 * @param {string} requestId - Request ID
 * @param {Object} data - Response data
 * @param {string} errorCode - Error code (if any)
 * @param {string} errorMessage - Error message (if any)
 */
function sendSelectionResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.SELECTION_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || 'Unknown error'
    };
  }

  sendWebSocketMessage(response);
}

/**
 * Send metadata response
 * @param {string} requestId - Request ID
 * @param {Object} data - Response data
 * @param {string} errorCode - Error code (if any)
 * @param {string} errorMessage - Error message (if any)
 */
function sendMetadataResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.METADATA_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || 'Unknown error'
    };
  }

  sendWebSocketMessage(response);
}

/**
 * Send error response
 * @param {string} type - Message type
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} [requestId] - Request ID (if applicable)
 */
function sendErrorResponse(type, code, message, requestId) {
  const response = {
    type: type,
    code: code,
    message: message,
    timestamp: new Date().toISOString()
  };

  if (requestId) {
    response.requestId = requestId;
  }

  sendWebSocketMessage(response);
}

/**
 * Send WebSocket message with queuing
 * @param {Object} message - Message to send
 */
async function sendWebSocketMessage(message) {
  if (!connectionManager || !connectionManager.isConnected) {
    console.log('[SimplifiedBackground] Connection manager not connected, queuing message');
    messageQueue.push(message);
    return;
  }

  try {
    await connectionManager.send(message);
    console.log('[SimplifiedBackground] 📤 Sending response via connection manager:', {
      type: message.type,
      requestId: message.requestId,
      hasData: !!message.data,
      hasError: !!message.error,
      timestamp: message.timestamp,
      dataSize: JSON.stringify(message).length
    });
  } catch (error) {
    messageQueue.push(message);
    console.error('[SimplifiedBackground] Failed to send message via connection manager:', error);
  }
}

/**
 * Keep connection alive with periodic pings
 */
function startPingInterval() {
  setInterval(() => {
    if (connectionManager && connectionManager.isConnected) {
      sendWebSocketMessage({
        type: MESSAGE_TYPES.PING,
        timestamp: Date.now()
      });
    }
  }, WEBSOCKET_CONFIG.PING_INTERVAL);
}

/**
 * Clean up resources
 */
function cleanup() {
  console.log('[SimplifiedBackground] Cleaning up resources');
  
  if (connectionManager) {
    connectionManager.destroy();
  }
  
  if (memoryManager) {
    memoryManager.destroy();
  }
}

// Initialize when script loads
initialize().catch(error => {
  console.error('[SimplifiedBackground] Failed to initialize:', error);
});

// Start ping interval
startPingInterval();

// Clean up when service worker is terminated
self.addEventListener('beforeunload', cleanup);

// Export for debugging
if (typeof self !== 'undefined') {
  self.getSimplifiedBackgroundStats = () => ({
    socketConnected: connectionManager && connectionManager.isConnected,
    messageQueueLength: messageQueue.length,
    isConnecting: connectionManager && connectionManager.isConnecting,
    environmentConfig: environmentConfig,
    timestamp: new Date().toISOString()
  });
}