/**
 * Default configuration constants for the Alice Browser Context extension
 */

// WebSocket configuration defaults
export const WEBSOCKET_DEFAULTS = {
  URL: 'ws://localhost:5421',
  RECONNECT_INTERVAL: 5000,
  CONNECTION_TIMEOUT: 10000,
  PING_INTERVAL: 30000,
  AUTO_RECONNECT: true,
  MAX_RECONNECT_ATTEMPTS: 10
};

// Content filter configuration defaults
export const CONTENT_FILTER_DEFAULTS = {
  EXCLUDED_SELECTORS: [
    'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
    '.menu', '.nav', '.navbar', '.breadcrumb', '.pagination',
    '.ads', '.advertisement', '.social-share', '.comments',
    '.related', '.recommended', '.newsletter', '.subscribe',
    '.cookie-notice', '.popup', '.modal', '.banner', '.widget',
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas'
  ],
  CONTENT_SELECTORS: [
    'article', 'main', '[role="main"]', '.content', '.main-content',
    '.article', '.post', '.story', '.entry', '.text-content',
    '.prose', '.markdown', '.documentation', '.guide'
  ],
  MIN_TEXT_DENSITY: 0.25,
  MAX_LINK_DENSITY: 0.3,
  MIN_TEXT_LENGTH: 50,
  MIN_LINK_TEXT_LENGTH: 3,
  MAX_LINK_TEXT_LENGTH: 100,
  EXCLUDED_LINK_PATTERNS: [
    /login/i, /signin/i, /register/i, /signup/i, /account/i,
    /cart/i, /checkout/i, /search/i, /home/i, /back to top/i,
    /privacy/i, /terms/i, /contact/i, /about/i, /help/i,
    /support/i, /faq/i, /rss/i, /feed/i, /newsletter/i,
    /subscribe/i, /follow/i, /like/i, /share/i, /tweet/i,
    /facebook/i, /twitter/i, /instagram/i, /linkedin/i
  ],
  AGGRESSIVE_MODE: false,
  PRESERVE_STRUCTURE: true,
  MAX_LINKS: 20,
  MIN_CONTENT_SCORE: 30
};

// Logging configuration defaults
export const LOGGING_DEFAULTS = {
  LEVEL: 'info',
  ENABLE_CONSOLE_LOGGING: true,
  ENABLE_FILE_LOGGING: false,
  MAX_LOG_ENTRIES: 1000,
  INCLUDE_TIMESTAMPS: true,
  INCLUDE_CONTEXT: true
};

// Browser context configuration defaults
export const BROWSER_CONTEXT_DEFAULTS = {
  DEFAULT_MAX_CONTEXT_LENGTH: 2000,
  CONTENT_SCRIPT_TIMEOUT: 5000,
  TAB_QUERY_TIMEOUT: 3000,
  RESTRICTED_PROTOCOLS: [
    'chrome:',
    'chrome-extension:',
    'about:',
    'edge:',
    'moz-extension:'
  ],
  AUTO_INJECT_CONTENT_SCRIPT: true,
  CONTENT_SCRIPT_INIT_DELAY: 100
};

// Environment configuration defaults
export const ENVIRONMENT_DEFAULTS = {
  ENVIRONMENT: 'production',
  DEBUG_MODE: false,
  ENABLE_DEV_TOOLS: false,
  ENV_SPECIFIC: {
    development: {
      websocket: {
        url: 'ws://localhost:5421'
      },
      logging: {
        level: 'debug',
        enableConsoleLogging: true,
        debugMode: true
      }
    },
    staging: {
      websocket: {
        url: 'ws://staging.example.com:5421'
      },
      logging: {
        level: 'info',
        enableConsoleLogging: true
      }
    },
    production: {
      websocket: {
        url: 'ws://localhost:5421'
      },
      logging: {
        level: 'warn',
        enableConsoleLogging: false
      }
    }
  }
};

// Error codes
export const ERROR_CODES = {
  // WebSocket errors
  WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  WS_CONNECTION_TIMEOUT: 'WS_CONNECTION_TIMEOUT',
  WS_MESSAGE_PARSE_ERROR: 'WS_MESSAGE_PARSE_ERROR',
  WS_INVALID_MESSAGE_TYPE: 'WS_INVALID_MESSAGE_TYPE',
  WS_MISSING_REQUEST_ID: 'WS_MISSING_REQUEST_ID',
  
  // Browser context errors
  BC_NO_ACTIVE_TAB: 'BC_NO_ACTIVE_TAB',
  BC_RESTRICTED_PAGE: 'BC_RESTRICTED_PAGE',
  BC_CONTENT_SCRIPT_INJECTION_FAILED: 'BC_CONTENT_SCRIPT_INJECTION_FAILED',
  BC_CONTENT_SCRIPT_TIMEOUT: 'BC_CONTENT_SCRIPT_TIMEOUT',
  BC_CONTENT_SCRIPT_ERROR: 'BC_CONTENT_SCRIPT_ERROR',
  
  // Configuration errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING_REQUIRED: 'CONFIG_MISSING_REQUIRED',
  CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  OPERATION_FAILED: 'OPERATION_FAILED'
};

// Message types
export const MESSAGE_TYPES = {
  // WebSocket message types
  BROWSER_CONTEXT: 'browser_context',
  BROWSER_CONTEXT_RESPONSE: 'browser_context_response',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  
  // Content script message types
  PING: 'PING',
  PONG: 'PONG',
  GET_BROWSER_CONTEXT: 'GET_BROWSER_CONTEXT'
};

// Simplified message types (LLM-optimized)
export const SIMPLIFIED_MESSAGE_TYPES = {
  GET_CONTEXT: 'get_context',
  CONTEXT_RESPONSE: 'context_response',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error'
};

// Log levels
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};