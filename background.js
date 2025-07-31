let socket = null;
let isConnecting = false;
let messageQueue = [];
let requestHandlers = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Alice Browser Context extension installed");
});

// WebSocket connection management
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

    try {
      socket = new WebSocket("ws://localhost:5421");

      socket.addEventListener("open", () => {
        console.log("Connected to Alice WebSocket server");
        isConnecting = false;

        // Process any queued messages
        while (messageQueue.length > 0) {
          const message = messageQueue.shift();
          socket.send(JSON.stringify(message));
        }

        resolve(socket);
      });

      socket.addEventListener("message", (event) => {
        try {
          console.log("Received WebSocket message:", event.data);
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        console.error("WebSocket error details:", {
          readyState: socket.readyState,
          url: socket.url,
          error: error.message || error,
        });
        isConnecting = false;
        reject(error);
      });

      socket.addEventListener("close", () => {
        console.log("WebSocket connection closed");
        isConnecting = false;
        socket = null;

        // Clear request handlers on disconnect
        requestHandlers.clear();
      });
    } catch (error) {
      isConnecting = false;
      reject(error);
    }
  });
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(message) {
  console.log("[Background] Received WebSocket message:", message);

  if (message.type === "browser_context") {
    if (message.requestId) {
      console.log(
        "[Background] Processing browser_context request with requestId:",
        message.requestId
      );
      handleBrowserContextRequest(message);
    } else {
      console.error(
        "[Background] browser_context request missing requestId"
      );
      sendResponse("missing_request_id", { error: "Request ID is required" });
    }
  } else {
    console.log(
      "[Background] Ignoring non-browser_context message type:",
      message.type
    );
  }
}

// Handle browser context requests from Alice
async function handleBrowserContextRequest(message) {
  const { requestId, data } = message;
  console.log(
    "[Background] Handling browser context request:",
    requestId,
    data
  );

  try {
    // Get the active tab - try current window first, then all windows
    let activeTab = null;

    // First try to find active tab in current window
    const currentWindowTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentWindowTabs.length > 0) {
      activeTab = currentWindowTabs[0];
      console.log(
        "[Background] Found active tab in current window:",
        activeTab.id,
        activeTab.url
      );
    } else {
      // If no active tab in current window, look in all windows
      const allWindowTabs = await chrome.tabs.query({ active: true });
      if (allWindowTabs.length > 0) {
        activeTab = allWindowTabs[0];
        console.log(
          "[Background] Found active tab in all windows:",
          activeTab.id,
          activeTab.url
        );
      }
    }

    console.log(
      "[Background] Final active tab result:",
      activeTab ? activeTab.id : "none",
      activeTab ? activeTab.url : "none"
    );

    if (!activeTab) {
      console.error("[Background] No active tab found in any window");
      sendResponse(requestId, {
        error: "No active tab found in any browser window",
      });
      return;
    }

    // Check if this is a restricted page where content scripts can't run
    const restrictedProtocols = [
      "chrome:",
      "chrome-extension:",
      "about:",
      "edge:",
      "moz-extension:",
    ];
    const url = new URL(activeTab.url);
    if (
      restrictedProtocols.some((protocol) => activeTab.url.startsWith(protocol))
    ) {
      console.error(
        "[Background] Cannot access restricted page:",
        activeTab.url
      );
      sendResponse(requestId, {
        error: `Cannot access restricted page: ${url.protocol}//${url.hostname}`,
        restricted: true,
        url: activeTab.url,
      });
      return;
    }

    // Check if tab is ready
    if (activeTab.status !== "complete") {
      console.warn("[Background] Tab status:", activeTab.status);
    }

    console.log(
      "📤 [Background] Sending message to content script on tab:",
      activeTab.id
    );

    // Check if content script is available by trying to ping it first
    try {
      console.log("[Background] Checking if content script is ready...");

      // Try to inject content script if not already present
      try {
        await chrome.tabs.sendMessage(activeTab.id, { type: "PING" });
        console.log("[Background] Content script is responsive");
      } catch (pingError) {
        console.log(
          "[Background] Content script not responding, attempting to inject..."
        );
        console.log("[Background] Ping error details:", pingError);

        // Try to inject the content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["content.js"],
          });
          console.log("[Background] Content script injected successfully");

          // Wait a moment for the script to initialize
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (injectError) {
          console.error(
            "[Background] Failed to inject content script:",
            injectError
          );
          throw new Error(
            "Cannot access page content - content script injection failed"
          );
        }
      }

      // Send message to content script to collect browser context with timeout
      console.log(
        "📤 [Background] Sending GET_BROWSER_CONTEXT message with data:",
        data
      );
      const response = await Promise.race([
        chrome.tabs.sendMessage(activeTab.id, {
          type: "GET_BROWSER_CONTEXT",
          ...data,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Content script response timeout after 5 seconds")
              ),
            5000
          )
        ),
      ]).catch((error) => {
        console.error(
          "[Background] Error sending message to content script:",
          error
        );
        throw error;
      });

      console.log(
        "[Background] Received response from content script:",
        response
      );
      console.log("[Background] Response success:", response?.success);
      console.log("[Background] Response data:", response?.data);

      if (response && response.success) {
        console.log("[Background] Sending successful response to Alice");
        console.log(
          "[Background] Response data keys:",
          Object.keys(response.data)
        );
        sendResponse(requestId, response.data);
      } else {
        console.error(
          "[Background] Content script error:",
          response ? response.error : "No response"
        );
        sendResponse(requestId, {
          error: response
            ? response.error || "Failed to collect browser context"
            : "No response from content script",
        });
      }
    } catch (error) {
      console.error(
        "[Background] Failed to communicate with content script:",
        error
      );
      sendResponse(requestId, { error: error.message });
    }
  } catch (error) {
    console.error(
      "[Background] Error handling browser context request:",
      error
    );
    sendResponse(requestId, { error: error.message });
  }
}

// Send response back to Alice
function sendResponse(requestId, data) {
  const response = {
    type: "browser_context_response",
    requestId: requestId,
    data: data,
    timestamp: new Date().toISOString(),
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(response));
  } else {
    console.error("WebSocket not connected, cannot send response");
  }
}

// Send message via WebSocket with queuing support
async function sendWebSocketMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket not connected, queuing message:", message);
    messageQueue.push(message);
    return;
  }
  try {
    const ws = await connectWebSocket();
    ws.send(JSON.stringify(message));
  } catch (error) {
    // Queue message if connection fails
    messageQueue.push(message);
    console.error("Failed to send WebSocket message:", error);
  }
}

// Keep connection alive with periodic pings
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  }
}, 30000);

// Reconnect on startup
chrome.runtime.onStartup.addListener(() => {
  connectWebSocket().catch(console.error);
});

// Handle extension icon click for manual connection test
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async () => {
    try {
      await connectWebSocket();
      console.log("WebSocket connection test successful");
    } catch (error) {
      console.error("WebSocket connection test failed:", error);
    }
  });
} else {
  console.warn("chrome.action API not available");
}

// Legacy support for context menu (optional)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToAlice",
    title: "Send selection to Alice",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "sendToAlice" && info.selectionText) {
    try {
      await connectWebSocket();

      const message = {
        type: "legacy_selection",
        data: {
          text: info.selectionText,
          url: info.pageUrl,
        },
        timestamp: new Date().toISOString(),
      };

      await sendWebSocketMessage(message);
      console.log("Sent selection to Alice:", info.selectionText);
    } catch (error) {
      console.error("Failed to send selection:", error);
    }
  }
});

// Initialize connection on extension load
connectWebSocket().catch((error) => {
  console.error("Failed to initialize WebSocket connection:", error);
  console.error(
    "This is likely because the Alice Electron server is not running on ws://localhost:5421"
  );
});
