import {
  WEBSOCKET_CONFIG,
  BROWSER_CONTEXT_CONFIG,
  LOGGING_CONFIG,
  MESSAGE_TYPES,
  ERROR_CODES,
  DEFAULT_REQUEST_OPTIONS,
  getCurrentEnvironmentConfig,
} from "../shared/constants/simplified-config.js";

import { getSimplifiedConnectionManager } from "./websocket/simplified-connection-manager.js";
import { getMemoryManager } from "../shared/utils/memory-manager.js";

let connectionManager = null;
let memoryManager = null;
let environmentConfig = null;
let socket = null;
let isConnecting = false;
let messageQueue = [];

let lastErrorLogTime = 0;
let errorLogThrottle = 5000;
let recentErrors = new Map();
let maxErrorHistory = 10;
let debugMode = false;

async function initialize() {
  try {
    environmentConfig = getCurrentEnvironmentConfig();

    try {
      const result = await chrome.storage.sync.get([
        "websocketHost",
        "websocketPort",
      ]);
      if (result.websocketHost && result.websocketPort) {
        const websocketUrl = `ws://${result.websocketHost}:${result.websocketPort}`;
        environmentConfig.websocket.url = websocketUrl;
      }
    } catch (error) {}

    memoryManager = getMemoryManager();
    connectionManager = getSimplifiedConnectionManager(
      environmentConfig.websocket
    );

    connectionManager.on("connected", (socketInstance) => {
      socket = socketInstance;
      lastConnectionTime = new Date();
      notifyPopupPortsOfStatusChange();
    });

    connectionManager.on("message", (message) => {
      handleWebSocketMessage(message);
    });

    connectionManager.on("error", (error) => {
      if (error && error.isProcessedError) {
        return;
      }

      let errorMessage = "An unknown error occurred in the connection manager";
      if (error) {
        if (typeof error === "object" && error.message) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }
      }

      const errorHash = createErrorHash(errorMessage);
      const now = Date.now();

      if (shouldLogError(errorHash, now)) {
        console.warn("Background script connection issue:", errorMessage);

        lastErrorLogTime = now;
        recentErrors.set(errorHash, now);

        if (recentErrors.size > maxErrorHistory) {
          const oldestKey = recentErrors.keys().next().value;
          recentErrors.delete(oldestKey);
        }
      }
    });

    connectionManager.on("disconnected", () => {
      notifyPopupPortsOfStatusChange();
    });

    setupEventListeners();
    await connectionManager.connect();
  } catch (error) {
    console.warn("Failed to initialize background script:", error.message);
  }
}

function setupEventListeners() {
  chrome.runtime.onInstalled.addListener(handleExtensionInstalled);
  chrome.runtime.onStartup.addListener(handleExtensionStartup);

  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener(handleActionClick);
  }

  chrome.runtime.onMessage.addListener(handleMessageFromPopup);

  chrome.runtime.onConnect.addListener(handleConnectionFromPopup);
}

function handleExtensionInstalled(details) {}

async function handleExtensionStartup() {
  await connectionManager.connect();
}

async function handleActionClick(tab) {
  try {
    await connectionManager.connect();
  } catch (error) {}
}

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

      socket.addEventListener("open", () => {
        isConnecting = false;
        while (messageQueue.length > 0) {
          const message = messageQueue.shift();
          socket.send(JSON.stringify(message));
        }
        resolve(socket);
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {}
      });

      socket.addEventListener("error", (error) => {
        isConnecting = false;
        reject(error);
      });

      socket.addEventListener("close", () => {
        isConnecting = false;
        socket = null;
      });
    } catch (error) {
      isConnecting = false;
      reject(error);
    }
  });
}

async function handleWebSocketMessage(message) {
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
  }
}

async function handleGetContextRequest(message) {
  const { requestId, options = {} } = message;

  if (!requestId) {
    sendErrorResponse(
      MESSAGE_TYPES.ERROR,
      ERROR_CODES.INVALID_REQUEST,
      "Request ID is required"
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();

    if (!activeTab) {
      sendContextResponse(
        requestId,
        null,
        ERROR_CODES.BC_NO_ACTIVE_TAB,
        "No active tab found"
      );
      return;
    }

    if (isRestrictedPage(activeTab.url)) {
      sendContextResponse(
        requestId,
        null,
        ERROR_CODES.BC_RESTRICTED_PAGE,
        "Cannot access restricted page"
      );
      return;
    }

    const context = await getBrowserContextFromContentScript(
      activeTab,
      options
    );

    sendContextResponse(requestId, context);
  } catch (error) {
    sendContextResponse(
      requestId,
      null,
      ERROR_CODES.UNKNOWN_ERROR,
      error.message
    );
  }
}

async function handleGetContentRequest(message) {
  const { requestId, options = {} } = message;

  if (!requestId) {
    sendErrorResponse(
      MESSAGE_TYPES.ERROR,
      ERROR_CODES.INVALID_REQUEST,
      "Request ID is required"
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();

    if (!activeTab) {
      sendContentResponse(
        requestId,
        null,
        ERROR_CODES.BC_NO_ACTIVE_TAB,
        "No active tab found"
      );
      return;
    }

    if (isRestrictedPage(activeTab.url)) {
      sendContentResponse(
        requestId,
        null,
        ERROR_CODES.BC_RESTRICTED_PAGE,
        "Cannot access restricted page"
      );
      return;
    }

    const content = await getContentFromContentScript(activeTab, options);

    sendContentResponse(requestId, content);
  } catch (error) {
    sendContentResponse(
      requestId,
      null,
      ERROR_CODES.UNKNOWN_ERROR,
      error.message
    );
  }
}

async function handleGetLinksRequest(message) {
  const { requestId, options = {} } = message;

  if (!requestId) {
    sendErrorResponse(
      MESSAGE_TYPES.ERROR,
      ERROR_CODES.INVALID_REQUEST,
      "Request ID is required"
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();

    if (!activeTab) {
      sendLinksResponse(
        requestId,
        null,
        ERROR_CODES.BC_NO_ACTIVE_TAB,
        "No active tab found"
      );
      return;
    }

    if (isRestrictedPage(activeTab.url)) {
      sendLinksResponse(
        requestId,
        null,
        ERROR_CODES.BC_RESTRICTED_PAGE,
        "Cannot access restricted page"
      );
      return;
    }

    const links = await getLinksFromContentScript(activeTab, options);

    sendLinksResponse(requestId, links);
  } catch (error) {
    sendLinksResponse(
      requestId,
      null,
      ERROR_CODES.UNKNOWN_ERROR,
      error.message
    );
  }
}

async function handleGetSelectionRequest(message) {
  const { requestId, options = {} } = message;

  if (!requestId) {
    sendErrorResponse(
      MESSAGE_TYPES.ERROR,
      ERROR_CODES.INVALID_REQUEST,
      "Request ID is required"
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();

    if (!activeTab) {
      sendSelectionResponse(
        requestId,
        null,
        ERROR_CODES.BC_NO_ACTIVE_TAB,
        "No active tab found"
      );
      return;
    }

    if (isRestrictedPage(activeTab.url)) {
      sendSelectionResponse(
        requestId,
        null,
        ERROR_CODES.BC_RESTRICTED_PAGE,
        "Cannot access restricted page"
      );
      return;
    }

    const selection = await getSelectionFromContentScript(activeTab, options);

    sendSelectionResponse(requestId, selection);
  } catch (error) {
    sendSelectionResponse(
      requestId,
      null,
      ERROR_CODES.UNKNOWN_ERROR,
      error.message
    );
  }
}

async function handleGetMetadataRequest(message) {
  const { requestId, options = {} } = message;

  if (!requestId) {
    sendErrorResponse(
      MESSAGE_TYPES.ERROR,
      ERROR_CODES.INVALID_REQUEST,
      "Request ID is required"
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();

    if (!activeTab) {
      sendMetadataResponse(
        requestId,
        null,
        ERROR_CODES.BC_NO_ACTIVE_TAB,
        "No active tab found"
      );
      return;
    }

    const metadata = await getMetadataFromContentScript(activeTab, options);

    sendMetadataResponse(requestId, metadata);
  } catch (error) {
    sendMetadataResponse(
      requestId,
      null,
      ERROR_CODES.UNKNOWN_ERROR,
      error.message
    );
  }
}

async function getActiveTab() {
  try {
    const currentWindowTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (currentWindowTabs.length > 0) {
      return currentWindowTabs[0];
    }

    const allWindowTabs = await chrome.tabs.query({ active: true });

    if (allWindowTabs.length > 0) {
      return allWindowTabs[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

function isRestrictedPage(url) {
  return BROWSER_CONTEXT_CONFIG.RESTRICTED_PROTOCOLS.some((protocol) =>
    url.startsWith(protocol)
  );
}

async function isContentScriptReady(tab) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return (
          typeof window !== "undefined" &&
          typeof window.isSimplifiedContentScriptReady === "function" &&
          window.isSimplifiedContentScriptReady()
        );
      },
    });

    return results && results[0] && results[0].result;
  } catch (error) {
    return false;
  }
}

async function getBrowserContextFromContentScript(tab, options) {
  try {
    const scriptReady = await isContentScriptReady(tab);

    if (!scriptReady) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/content/simplified-content.js"],
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const readyAfterInjection = await isContentScriptReady(tab);
        if (!readyAfterInjection) {
          throw new Error(
            "Content script not ready after injection. Please refresh the page."
          );
        }
      } catch (injectError) {
        throw new Error(
          `Content script injection failed: ${injectError.message}`
        );
      }
    }

    try {
      await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: "PING" }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("PING timeout after 3 seconds")),
            3000
          )
        ),
      ]);
    } catch (pingError) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/content/simplified-content.js"],
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        await chrome.tabs.sendMessage(tab.id, { type: "PING" });
      } catch (injectError) {
        throw new Error(
          `Content script not available. Injection failed: ${injectError.message}. Please refresh the page to ensure the content script is properly injected.`
        );
      }
    }

    const request = {
      type: "GET_SIMPLIFIED_CONTEXT",
      ...DEFAULT_REQUEST_OPTIONS,
      ...options,
    };

    let timeoutId;
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, request).then((result) => {
        clearTimeout(timeoutId);
        return result;
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Content script timeout"));
        }, BROWSER_CONTEXT_CONFIG.CONTENT_SCRIPT_TIMEOUT);
      }),
    ]);

    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response?.error || "Failed to get browser context");
    }
  } catch (error) {
    throw error;
  }
}

async function getContentFromContentScript(tab, options) {
  const request = {
    type: "GET_CONTENT",
    ...DEFAULT_REQUEST_OPTIONS,
    ...options,
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

async function getLinksFromContentScript(tab, options) {
  const request = {
    type: "GET_LINKS",
    ...DEFAULT_REQUEST_OPTIONS,
    ...options,
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

async function getSelectionFromContentScript(tab, options) {
  const request = {
    type: "GET_SELECTION",
    ...DEFAULT_REQUEST_OPTIONS,
    ...options,
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

async function getMetadataFromContentScript(tab, options) {
  const request = {
    type: "GET_METADATA",
    ...DEFAULT_REQUEST_OPTIONS,
    ...options,
  };

  const response = await sendContentScriptRequest(tab, request);
  return response.data;
}

async function sendContentScriptRequest(tab, request) {
  try {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "PING" });
    } catch (pingError) {
      throw new Error(
        "Content script not available. Please refresh the page to ensure the content script is properly injected."
      );
    }

    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, request),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Content script timeout")),
          BROWSER_CONTEXT_CONFIG.CONTENT_SCRIPT_TIMEOUT
        )
      ),
    ]);

    if (response && response.success) {
      return response;
    } else {
      throw new Error(
        response?.error || "Failed to get data from content script"
      );
    }
  } catch (error) {
    throw error;
  }
}

function handlePingMessage(message) {
  const response = {
    type: MESSAGE_TYPES.PONG,
    timestamp: Date.now(),
  };

  sendWebSocketMessage(response);
}

function sendContextResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.CONTEXT_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || "Unknown error",
    };
  }

  sendWebSocketMessage(response);
}

function sendContentResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.CONTENT_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || "Unknown error",
    };
  }

  sendWebSocketMessage(response);
}

function sendLinksResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.LINKS_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || "Unknown error",
    };
  }

  sendWebSocketMessage(response);
}

function sendSelectionResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.SELECTION_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || "Unknown error",
    };
  }

  sendWebSocketMessage(response);
}

function sendMetadataResponse(requestId, data, errorCode, errorMessage) {
  const response = {
    type: MESSAGE_TYPES.METADATA_RESPONSE,
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (errorCode || errorMessage) {
    response.error = {
      code: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      message: errorMessage || "Unknown error",
    };
  }

  sendWebSocketMessage(response);
}

function sendErrorResponse(type, code, message, requestId) {
  const response = {
    type: type,
    code: code,
    message: message,
    timestamp: new Date().toISOString(),
  };

  if (requestId) {
    response.requestId = requestId;
  }

  sendWebSocketMessage(response);
}

async function sendWebSocketMessage(message) {
  if (!connectionManager || !connectionManager.isConnected) {
    messageQueue.push(message);
    return;
  }

  try {
    await connectionManager.send(message);
  } catch (error) {
    messageQueue.push(message);
  }
}

function startPingInterval() {
  setInterval(() => {
    if (connectionManager && connectionManager.isConnected) {
      sendWebSocketMessage({
        type: MESSAGE_TYPES.PING,
        timestamp: Date.now(),
      });
    }
  }, WEBSOCKET_CONFIG.PING_INTERVAL);
}

function cleanup() {
  if (connectionManager) {
    connectionManager.destroy();
  }

  if (memoryManager) {
    memoryManager.destroy();
  }
}

initialize().catch((error) => {
  console.warn("Failed to initialize background script:", error.message);
});

startPingInterval();

self.addEventListener("beforeunload", cleanup);

if (typeof self !== "undefined") {
  self.getSimplifiedBackgroundStats = () => ({
    socketConnected: connectionManager && connectionManager.isConnected,
    messageQueueLength: messageQueue.length,
    isConnecting: connectionManager && connectionManager.isConnecting,
    environmentConfig: environmentConfig,
    timestamp: new Date().toISOString(),
  });
}

let lastConnectionTime = null;

const popupPorts = new Set();

/**
 * Handle messages from popup
 */
async function handleMessageFromPopup(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case "get-stats":
        const stats = getSimplifiedBackgroundStats();
        stats.lastConnectionTime = lastConnectionTime;
        sendResponse({ success: true, stats: stats });
        break;

      case "update-config":
        await handleConfigUpdate(message.config);
        sendResponse({ success: true });
        break;

      case "reconnect":
        await handleManualReconnect(message.skipAutoReconnect);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (error) {
    let errorMessage = "An unknown error occurred";
    if (error) {
      if (typeof error === "object" && error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
    }
    sendResponse({ success: false, error: errorMessage });
  }

  return true;
}

/**
 * Handle long-lived connections from popup
 */
function handleConnectionFromPopup(port) {
  if (port.name !== "websocket-popup") {
    return;
  }

  popupPorts.add(port);

  port.onMessage.addListener(async (message) => {
    try {
      switch (message.type) {
        case "get-status":
          const stats = getSimplifiedBackgroundStats();
          stats.lastConnectionTime = lastConnectionTime;
          port.postMessage({
            type: "status-update",
            status: stats.socketConnected
              ? "connected"
              : stats.isConnecting
              ? "connecting"
              : "disconnected",
            stats: stats,
          });
          break;

        case "get-stats":
          const fullStats = getSimplifiedBackgroundStats();
          fullStats.lastConnectionTime = lastConnectionTime;
          port.postMessage({ type: "stats", stats: fullStats });
          break;

        case "update-config":
          await handleConfigUpdate(message.config);
          port.postMessage({ type: "config-updated", success: true });
          break;

        case "reconnect":
          await handleManualReconnect(message.skipAutoReconnect);
          port.postMessage({ type: "reconnect-initiated", success: true });
          break;
      }
    } catch (error) {
      let errorMessage = "An unknown error occurred";
      if (error) {
        if (typeof error === "object" && error.message) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }
      }
      port.postMessage({
        type: "error",
        message: errorMessage,
      });
    }
  });

  port.onDisconnect.addListener(() => {
    popupPorts.delete(port);
  });

  const stats = getSimplifiedBackgroundStats();
  stats.lastConnectionTime = lastConnectionTime;
  port.postMessage({
    type: "status-update",
    status: stats.socketConnected
      ? "connected"
      : stats.isConnecting
      ? "connecting"
      : "disconnected",
    stats: stats,
  });
}

/**
 * Handle configuration update from popup
 */
async function handleConfigUpdate(config) {
  if (!config || !config.url || !config.host || !config.port) {
    throw new Error("Invalid configuration");
  }

  environmentConfig.websocket.url = config.url;

  try {
    await chrome.storage.sync.set({
      websocketHost: config.host,
      websocketPort: config.port,
    });
  } catch (error) {}

  if (connectionManager) {
    connectionManager.config.url = config.url;

    connectionManager.disconnect();

    connectionManager.reconnectAttempts = 0;

    await connectionManager.connect();
  }
}

/**
 * Handle manual reconnection request from popup
 */
async function handleManualReconnect(skipAutoReconnect = false) {
  if (!connectionManager) {
    throw new Error("Connection manager not available");
  }

  connectionManager.disconnect();

  connectionManager.reconnectAttempts = 0;

  const originalAutoReconnect = connectionManager.config.autoReconnect;
  if (skipAutoReconnect) {
    connectionManager.config.autoReconnect = false;
  }

  try {
    await connectionManager.connect();

    lastConnectionTime = new Date();

    notifyPopupPortsOfStatusChange();
  } finally {
    if (skipAutoReconnect) {
      connectionManager.config.autoReconnect = originalAutoReconnect;
    }
  }
}

/**
 * Notify all connected popup ports of status change
 */
function notifyPopupPortsOfStatusChange() {
  const stats = getSimplifiedBackgroundStats();
  stats.lastConnectionTime = lastConnectionTime;

  const status = stats.socketConnected
    ? "connected"
    : stats.isConnecting
    ? "connecting"
    : "disconnected";

  popupPorts.forEach((port) => {
    try {
      port.postMessage({
        type: "status-update",
        status: status,
        stats: stats,
      });
    } catch (error) {
      popupPorts.delete(port);
    }
  });
}

/**
 * Create a hash from error message for duplicate detection
 */
function createErrorHash(errorMessage) {
  let hash = 0;
  for (let i = 0; i < errorMessage.length; i++) {
    const char = errorMessage.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Determine if an error should be logged based on throttling and duplicate detection
 */
function shouldLogError(errorHash, now) {
  if (now - lastErrorLogTime < errorLogThrottle) {
    return false;
  }

  if (recentErrors.has(errorHash)) {
    const lastSeen = recentErrors.get(errorHash);
    if (now - lastSeen < 300000) {
      return false;
    }
  }

  return true;
}
