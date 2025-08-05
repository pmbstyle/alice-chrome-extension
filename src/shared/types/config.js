/**
 * Type definitions for configuration
 */

/**
 * @typedef {Object} ExtensionConfig
 * @property {WebSocketConfig} websocket - WebSocket connection configuration
 * @property {ContentFilterConfig} contentFilter - Content filtering configuration
 * @property {LoggingConfig} logging - Logging configuration
 * @property {BrowserContextConfig} browserContext - Browser context collection configuration
 * @property {EnvironmentConfig} environment - Environment-specific configuration
 */

/**
 * @typedef {Object} WebSocketConfig
 * @property {string} url - WebSocket server URL
 * @property {number} reconnectInterval - Interval between reconnection attempts (ms)
 * @property {number} connectionTimeout - Connection timeout (ms)
 * @property {number} pingInterval - Interval between ping messages (ms)
 * @property {boolean} autoReconnect - Whether to automatically reconnect on disconnection
 * @property {number} maxReconnectAttempts - Maximum number of reconnection attempts
 */

/**
 * @typedef {Object} ContentFilterConfig
 * @property {Array<string>} excludedSelectors - CSS selectors for excluded elements
 * @property {Array<string>} contentSelectors - CSS selectors for content elements
 * @property {number} minTextDensity - Minimum text density for content elements
 * @property {number} maxLinkDensity - Maximum link density for content elements
 * @property {number} minTextLength - Minimum text length for content elements
 * @property {number} minLinkTextLength - Minimum link text length
 * @property {number} maxLinkTextLength - Maximum link text length
 * @property {Array<RegExp>} excludedLinkPatterns - Patterns for excluded links
 * @property {boolean} aggressiveMode - More aggressive filtering for maximum token reduction
 * @property {boolean} preserveStructure - Maintain content structure for better LLM comprehension
 * @property {number} maxLinks - Maximum number of links to extract
 * @property {number} minContentScore - Minimum score threshold for content elements
 */

/**
 * @typedef {Object} LoggingConfig
 * @property {'debug' | 'info' | 'warn' | 'error' | 'none'} level - Minimum log level
 * @property {boolean} enableConsoleLogging - Whether to enable console logging
 * @property {boolean} enableFileLogging - Whether to enable file logging (if supported)
 * @property {number} maxLogEntries - Maximum number of log entries to keep
 * @property {boolean} includeTimestamps - Whether to include timestamps in logs
 * @property {boolean} includeContext - Whether to include context information in logs
 */

/**
 * @typedef {Object} BrowserContextConfig
 * @property {number} defaultMaxContextLength - Default maximum context length
 * @property {number} contentScriptTimeout - Timeout for content script responses (ms)
 * @property {number} tabQueryTimeout - Timeout for tab queries (ms)
 * @property {Array<string>} restrictedProtocols - Protocols that cannot be accessed
 * @property {boolean} autoInjectContentScript - Whether to automatically inject content script
 * @property {number} contentScriptInitDelay - Delay after content script injection (ms)
 */

/**
 * @typedef {Object} EnvironmentConfig
 * @property {'development' | 'staging' | 'production'} environment - Current environment
 * @property {boolean} debugMode - Whether debug mode is enabled
 * @property {boolean} enableDevTools - Whether to enable developer tools
 * @property {Object} envSpecific - Environment-specific configuration overrides
 */

/**
 * @typedef {Object} EnvironmentSpecificConfig
 * @property {Partial<WebSocketConfig>} [websocket] - WebSocket overrides
 * @property {Partial<ContentFilterConfig>} [contentFilter] - Content filter overrides
 * @property {Partial<LoggingConfig>} [logging] - Logging overrides
 * @property {Partial<BrowserContextConfig>} [browserContext] - Browser context overrides
 */