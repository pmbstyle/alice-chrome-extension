/**
 * Simplified configuration constants for LLM-optimized Chrome Extension
 * Reduces complexity to essential settings only
 */

// Essential WebSocket configuration
export const WEBSOCKET_CONFIG = {
  URL: 'ws://localhost:5421',
  RECONNECT_INTERVAL: 5000,
  CONNECTION_TIMEOUT: 15000,  // Increased from 10000ms to 15000ms
  PING_INTERVAL: 30000,
  AUTO_RECONNECT: true
};

// Essential content filtering configuration (LLM-optimized)
export const CONTENT_CONFIG = {
  // Aggressive filtering for LLM token reduction
  MIN_TEXT_DENSITY: 0.4,        // Increased for better content quality
  MAX_LINK_DENSITY: 0.2,        // Decreased to reduce navigation noise
  MIN_TEXT_LENGTH: 100,         // Increased to filter out small elements
  MAX_TOKENS: 2000,             // Default token limit for LLM context
  MAX_LINKS: 10,                // Reduced to most relevant links only
  
  // Essential excluded elements
  EXCLUDED_SELECTORS: [
    'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
    '.menu', '.nav', '.navbar', '.breadcrumb', '.pagination',
    '.ads', '.advertisement', '.social-share', '.comments',
    '.related', '.recommended', '.newsletter', '.subscribe',
    '.cookie-notice', '.popup', '.modal', '.banner', '.widget',
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas'
  ],
  
  // Essential content selectors
  CONTENT_SELECTORS: [
    'article', 'main', '[role="main"]', '.content', '.main-content',
    '.article', '.post', '.story', '.entry', '.text-content'
  ],
  
  // Essential link filtering
  EXCLUDED_LINK_PATTERNS: [
    /login/i, /signin/i, /register/i, /signup/i, /account/i,
    /cart/i, /checkout/i, /search/i, /home/i, /back to top/i,
    /privacy/i, /terms/i, /contact/i, /about/i, /help/i,
    /support/i, /faq/i, /rss/i, /feed/i, /newsletter/i,
    /subscribe/i, /follow/i, /like/i, /share/i, /tweet/i,
    /facebook/i, /twitter/i, /instagram/i, /linkedin/i
  ]
};

// Essential browser context configuration
export const BROWSER_CONTEXT_CONFIG = {
  CONTENT_SCRIPT_TIMEOUT: 10000,  // Increased from 5000ms to 10000ms
  TAB_QUERY_TIMEOUT: 5000,        // Increased from 3000ms to 5000ms
  CONTENT_SCRIPT_INIT_DELAY: 200, // Increased from 100ms to 200ms
  RESTRICTED_PROTOCOLS: [
    'chrome:', 'chrome-extension:', 'about:', 'edge:', 'moz-extension:'
  ],
  CACHE_TIMEOUT: 60000  // Increased from 30000ms to 60000ms (60 seconds)
};

// Essential logging configuration
export const LOGGING_CONFIG = {
  LEVEL: 'warn',  // Reduced logging for production
  ENABLE_CONSOLE_LOGGING: false,
  MAX_LOG_ENTRIES: 100
};

// Simplified message types (LLM-optimized)
export const MESSAGE_TYPES = {
  GET_CONTEXT: 'get_context',
  GET_CONTENT: 'get_content',
  GET_LINKS: 'get_links',
  GET_SELECTION: 'get_selection',
  GET_METADATA: 'get_metadata',
  CONTEXT_RESPONSE: 'context_response',
  CONTENT_RESPONSE: 'content_response',
  LINKS_RESPONSE: 'links_response',
  SELECTION_RESPONSE: 'selection_response',
  METADATA_RESPONSE: 'metadata_response',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error'
};

// Content format options
export const CONTENT_FORMATS = {
  TEXT: 'text',           // Plain text only (most token-efficient)
  STRUCTURED: 'structured', // With headings and structure
  BOTH: 'both'            // Both text and structured
};

// Content quality levels
export const CONTENT_QUALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

// Essential error codes
export const ERROR_CODES = {
  // WebSocket errors
  WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  WS_CONNECTION_TIMEOUT: 'WS_CONNECTION_TIMEOUT',
  WS_MESSAGE_PARSE_ERROR: 'WS_MESSAGE_PARSE_ERROR',
  
  // Browser context errors
  BC_NO_ACTIVE_TAB: 'BC_NO_ACTIVE_TAB',
  BC_RESTRICTED_PAGE: 'BC_RESTRICTED_PAGE',
  BC_CONTENT_SCRIPT_TIMEOUT: 'BC_CONTENT_SCRIPT_TIMEOUT',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST'
};

// Log levels (simplified)
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Default request options (LLM-optimized)
export const DEFAULT_REQUEST_OPTIONS = {
  format: CONTENT_FORMATS.TEXT,
  maxTokens: 2000,
  includeLinks: true,
  includeSelection: true
};

// Simplified configuration - always use localhost
export function getCurrentEnvironmentConfig() {
  const config = {
    websocket: { url: 'ws://localhost:5421' },
    logging: { level: 'info', enableConsoleLogging: true }
  };
  
  console.log('[Config] Using simplified localhost configuration');
  console.log('[Config] WebSocket URL:', config.websocket.url);
  
  return config;
}