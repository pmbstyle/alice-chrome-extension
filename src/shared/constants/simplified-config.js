export const WEBSOCKET_CONFIG = {
  URL: 'ws://localhost:5421',
  RECONNECT_INTERVAL: 5000,
  CONNECTION_TIMEOUT: 15000,
  PING_INTERVAL: 30000,
  AUTO_RECONNECT: true
};

export const CONTENT_CONFIG = {
  MIN_TEXT_DENSITY: 0.4,
  MAX_LINK_DENSITY: 0.2,
  MIN_TEXT_LENGTH: 100,
  MAX_TOKENS: 2000,
  MAX_LINKS: 10,
  
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
    '.article', '.post', '.story', '.entry', '.text-content'
  ],
  
  EXCLUDED_LINK_PATTERNS: [
    /login/i, /signin/i, /register/i, /signup/i, /account/i,
    /cart/i, /checkout/i, /search/i, /home/i, /back to top/i,
    /privacy/i, /terms/i, /contact/i, /about/i, /help/i,
    /support/i, /faq/i, /rss/i, /feed/i, /newsletter/i,
    /subscribe/i, /follow/i, /like/i, /share/i, /tweet/i,
    /facebook/i, /twitter/i, /instagram/i, /linkedin/i
  ]
};

export const BROWSER_CONTEXT_CONFIG = {
  CONTENT_SCRIPT_TIMEOUT: 10000,
  TAB_QUERY_TIMEOUT: 5000,
  CONTENT_SCRIPT_INIT_DELAY: 200,
  RESTRICTED_PROTOCOLS: [
    'chrome:', 'chrome-extension:', 'about:', 'edge:', 'moz-extension:'
  ],
  CACHE_TIMEOUT: 60000,
};

export const LOGGING_CONFIG = {
  LEVEL: 'warn',
  ENABLE_CONSOLE_LOGGING: false,
  MAX_LOG_ENTRIES: 100
};

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

export const CONTENT_FORMATS = {
  TEXT: 'text',
  STRUCTURED: 'structured',
  BOTH: 'both',
};

export const CONTENT_QUALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const ERROR_CODES = {
  WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  WS_CONNECTION_TIMEOUT: 'WS_CONNECTION_TIMEOUT',
  WS_MESSAGE_PARSE_ERROR: 'WS_MESSAGE_PARSE_ERROR',
  
  BC_NO_ACTIVE_TAB: 'BC_NO_ACTIVE_TAB',
  BC_RESTRICTED_PAGE: 'BC_RESTRICTED_PAGE',
  BC_CONTENT_SCRIPT_TIMEOUT: 'BC_CONTENT_SCRIPT_TIMEOUT',
  
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST'
};

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

export const DEFAULT_REQUEST_OPTIONS = {
  format: CONTENT_FORMATS.TEXT,
  maxTokens: 2000,
  includeLinks: true,
  includeSelection: true
};

export function getCurrentEnvironmentConfig() {
  const config = {
    websocket: { url: 'ws://localhost:5421' },
    logging: { level: 'info', enableConsoleLogging: true }
  };
  
  
  return config;
}