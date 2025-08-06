/**
 * Alice WebSocket Extension Popup JavaScript
 * Handles WebSocket connection monitoring and configuration management
 */

document.addEventListener('DOMContentLoaded', function() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const reconnectAttempts = document.getElementById('reconnect-attempts');
    const queueLength = document.getElementById('queue-length');
    const lastConnection = document.getElementById('last-connection');
    const websocketHost = document.getElementById('websocket-host');
    const websocketPort = document.getElementById('websocket-port');
    const saveConfigBtn = document.getElementById('save-config');
    const reconnectBtn = document.getElementById('reconnect-btn');
    const errorMessage = document.getElementById('error-message');
    
    let currentStatus = 'disconnected';
    let lastConnectionTime = null;
    let port = null;
    
    /**
     * Initialize the popup
     */
    async function initialize() {
        try {
            // Load configuration from storage
            await loadConfiguration();
            
            // Set up event listeners
            setupEventListeners();
            
            // Establish connection with background script
            connectToBackgroundScript();
            
            // Get initial connection status
            await updateConnectionStatus();
        } catch (error) {
            showError('Failed to initialize popup: ' + error.message);
        }
    }
    
    /**
     * Set up event listeners for UI elements
     */
    function setupEventListeners() {
        saveConfigBtn.addEventListener('click', saveConfiguration);
        reconnectBtn.addEventListener('click', triggerReconnect);
    }
    
    /**
     * Connect to the background script for real-time updates
     */
    function connectToBackgroundScript() {
        try {
            port = chrome.runtime.connect({ name: 'websocket-popup' });
            
            port.onMessage.addListener(function(message) {
                if (message.type === 'status-update') {
                    updateUIWithStatus(message.status);
                } else if (message.type === 'error') {
                    showError(message.message);
                }
            });
            
            port.onDisconnect.addListener(function() {
                if (chrome.runtime.lastError) {
                }
                setTimeout(connectToBackgroundScript, 1000);
            });
            
            port.postMessage({ type: 'get-status' });
        } catch (error) {
            console.error('Failed to connect to background script:', error);
        }
    }
    
    /**
     * Load configuration from chrome.storage
     */
    async function loadConfiguration() {
        try {
            const result = await chrome.storage.sync.get(['websocketHost', 'websocketPort']);
            
            const host = result.websocketHost || 'localhost';
            const port = result.websocketPort || '5421';
            
            websocketHost.value = host;
            websocketPort.value = port;
        } catch (error) {
            showError('Failed to load configuration: ' + error.message);
        }
    }
    
    /**
     * Save configuration to chrome.storage
     */
    async function saveConfiguration() {
        try {
            const host = websocketHost.value.trim();
            const port = websocketPort.value.trim();
            
            if (!host) {
                showError('WebSocket host is required');
                return;
            }
            
            if (!port || isNaN(port) || port < 1 || port > 65535) {
                showError('WebSocket port must be a valid number between 1 and 65535');
                return;
            }
            
            await chrome.storage.sync.set({
                websocketHost: host,
                websocketPort: port
            });
            
            await updateBackgroundConfig(host, port);
            
            clearError();
            
            saveConfigBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveConfigBtn.textContent = 'Save Configuration';
            }, 2000);
            
        } catch (error) {
            showError('Failed to save configuration: ' + error.message);
        }
    }
    
    /**
     * Update WebSocket configuration in the background script
     */
    async function updateBackgroundConfig(host, port) {
        try {
            const websocketUrl = `ws://${host}:${port}`;
            
            // Send message to background script to update configuration
            const response = await sendMessageToBackground({
                type: 'update-config',
                config: {
                    url: websocketUrl,
                    host: host,
                    port: port
                }
            });
            
            if (response && response.success) {
                // Configuration updated successfully
            } else {
                throw new Error(response?.error || 'Failed to update configuration');
            }
        } catch (error) {
            showError('Failed to update configuration: ' + error.message);
            throw error;
        }
    }
    
    /**
     * Trigger manual reconnection
     */
    async function triggerReconnect() {
        try {
            reconnectBtn.disabled = true;
            reconnectBtn.textContent = 'Reconnecting...';
            
            const response = await sendMessageToBackground({
                type: 'reconnect',
                skipAutoReconnect: true
            });
            
            if (response && response.success) {
            } else {
                throw new Error(response?.error || 'Failed to initiate reconnection');
            }
            
            updateUIWithStatus('connecting');
            
        } catch (error) {
            showError('Failed to reconnect: ' + error.message);
        } finally {
            setTimeout(() => {
                reconnectBtn.disabled = false;
                reconnectBtn.textContent = 'Reconnect';
            }, 2000);
        }
    }
    
    /**
     * Update connection status from background script
     */
    async function updateConnectionStatus() {
        try {
            const response = await sendMessageToBackground({
                type: 'get-stats'
            });
            
            if (response && response.stats) {
                updateUIWithStats(response.stats);
            } else {
                throw new Error('Failed to get connection stats');
            }
        } catch (error) {
            showError('Failed to update connection status: ' + error.message);
        }
    }
    
    /**
     * Update UI with connection statistics
     */
    function updateUIWithStats(stats) {
        // Update status
        let status = 'disconnected';
        if (stats.isConnecting) {
            status = 'connecting';
        } else if (stats.socketConnected) {
            status = 'connected';
        }
        
        updateUIWithStatus(status);
        
        reconnectAttempts.textContent = stats.reconnectAttempts || 0;
        queueLength.textContent = stats.messageQueueLength || 0;
        
        if (stats.lastConnectionTime) {
            lastConnectionTime = new Date(stats.lastConnectionTime);
            lastConnection.textContent = formatDateTime(lastConnectionTime);
        }
    }
    
    /**
     * Update UI with connection status
     */
    function updateUIWithStatus(status) {
        currentStatus = status;
        
        statusIndicator.className = 'status-indicator';
        statusIndicator.classList.add(`status-${status}`);
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
            default:
                statusText.textContent = 'Disconnected';
                break;
        }
        
        if (status === 'connected' && !lastConnectionTime) {
            lastConnectionTime = new Date();
            lastConnection.textContent = formatDateTime(lastConnectionTime);
        }
    }
    
    /**
     * Send a message to the background script
     */
    function sendMessageToBackground(message) {
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
     * Show an error message
     */
    function showError(message) {
        
        let errorMessageText = '';
        
        if (message) {
            // If message is an object with a message property
            if (typeof message === 'object' && message.message) {
                errorMessageText = message.message;
            }
            // If message is an object without a message property, stringify it
            else if (typeof message === 'object') {
                errorMessageText = JSON.stringify(message);
            }
            // If message is a string
            else if (typeof message === 'string') {
                errorMessageText = message;
            }
        }
        
        errorMessageText = errorMessageText ? errorMessageText.trim() : '';
        
        if (!errorMessageText) {
            errorMessageText = 'An unknown error occurred';
        }
        
        
        errorMessage.textContent = errorMessageText;
        errorMessage.removeAttribute('hidden');
        
        setTimeout(clearError, 5000);
    }
    
    /**
     * Clear error message
     */
    function clearError() {
        errorMessage.textContent = '';
        errorMessage.setAttribute('hidden', '');
    }
    
    /**
     * Format date/time for display
     */
    function formatDateTime(date) {
        if (!date) return 'Never';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleTimeString();
        }
    }
    
    // Initialize the popup when DOM is loaded
    initialize();
});