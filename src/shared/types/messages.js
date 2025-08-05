/**
 * Type definitions for WebSocket messages
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} type - Message type identifier
 * @property {string} [requestId] - Unique request identifier for request/response pairs
 * @property {any} [data] - Message payload data
 * @property {string} [timestamp] - ISO timestamp of when the message was created
 */

/**
 * @typedef {Object} BrowserContextRequestMessage
 * @property {'browser_context'} type - Message type
 * @property {string} requestId - Unique request identifier
 * @property {BrowserContextRequestData} data - Request data
 */

/**
 * @typedef {Object} BrowserContextRequestData
 * @property {boolean} [includeUrl=true] - Whether to include URL in response
 * @property {boolean} [includeText=true] - Whether to include visible text in response
 * @property {boolean} [includeLinks=true] - Whether to include links in response
 * @property {boolean} [includeSelection=true] - Whether to include user selection in response
 * @property {boolean} [includeContext=true] - Whether to include surrounding context in response
 * @property {number} [maxContextLength=2000] - Maximum length of surrounding context
 * @property {ContentFilterOptions} [contentFilterOptions] - Options for content filtering
 */

/**
 * @typedef {Object} BrowserContextResponseMessage
 * @property {'browser_context_response'} type - Message type
 * @property {string} requestId - Matching request identifier
 * @property {BrowserContextResponseData} data - Response data
 * @property {string} timestamp - ISO timestamp of when the response was created
 */

/**
 * @typedef {Object} BrowserContextResponseData
 * @property {string} [url] - The current page URL (if requested)
 * @property {string} [title] - The page title (if requested)
 * @property {string} [visibleText] - Filtered main content text (if requested)
 * @property {StructuredContent|null} [structuredContent] - Structured content (if requested)
 * @property {Array<LinkData>} [links] - Filtered and scored links (if requested)
 * @property {string} [selection] - User-selected text (if requested)
 * @property {string} [surroundingContext] - Text surrounding the selection (if requested)
 * @property {boolean} [hasSelection] - Whether there is a user selection (if requested)
 * @property {ContentStats} [contentStats] - Statistics about content extraction
 * @property {string} timestamp - ISO timestamp of when the context was collected
 * @property {string} [error] - Error message if the request failed
 */

/**
 * @typedef {Object} PingMessage
 * @property {'ping'} type - Message type
 * @property {number} timestamp - Unix timestamp
 */

/**
 * @typedef {Object} PongMessage
 * @property {'pong'} type - Message type
 * @property {number} timestamp - Unix timestamp
 */


/**
 * @typedef {Object} ErrorMessage
 * @property {'error'} type - Message type
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {any} [details] - Additional error details
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} ContentScriptMessage
 * @property {string} type - Message type ('PING' | 'GET_BROWSER_CONTEXT')
 * @property {boolean} [includeUrl] - Whether to include URL in response
 * @property {boolean} [includeText] - Whether to include visible text in response
 * @property {boolean} [includeLinks] - Whether to include links in response
 * @property {boolean} [includeSelection] - Whether to include user selection in response
 * @property {boolean} [includeContext] - Whether to include surrounding context in response
 * @property {number} [maxContextLength] - Maximum length of surrounding context
 * @property {ContentFilterOptions} [contentFilterOptions] - Options for content filtering
 */

/**
 * @typedef {Object} ContentScriptResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {BrowserContextData} [data] - Response data (if successful)
 * @property {string} [error] - Error message (if failed)
 */