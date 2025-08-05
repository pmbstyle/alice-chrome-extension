/**
 * Simplified message types for LLM-optimized Chrome Extension communication
 */

/**
 * @typedef {Object} SimplifiedContextRequest
 * @property {'get_context'} type - Simplified message type
 * @property {string} requestId - Unique request identifier
 * @property {SimplifiedContextOptions} options - Request options
 */

/**
 * @typedef {Object} SimplifiedContextOptions
 * @property {'structured'|'text'|'both'} [format='text'] - Response format
 * @property {number} [maxTokens=2000] - Maximum tokens for content
 * @property {boolean} [includeLinks=true] - Whether to include links
 * @property {boolean} [includeSelection=true] - Whether to include selection
 */

/**
 * @typedef {Object} SimplifiedContextResponse
 * @property {'context_response'} type - Response type
 * @property {string} requestId - Matching request identifier
 * @property {SimplifiedContextData} data - Response data
 */

/**
 * @typedef {Object} SimplifiedContextData
 * @property {string} url - The current page URL
 * @property {string} title - The page title
 * @property {string} content - Filtered main content text
 * @property {Array<SimplifiedLinkData>} [links] - Relevant links (if requested)
 * @property {string} [selection] - Selected text (if requested)
 * @property {SimplifiedContentMetadata} metadata - Content metadata
 */

/**
 * @typedef {Object} SimplifiedLinkData
 * @property {string} text - Link text
 * @property {string} href - Link URL
 */

/**
 * @typedef {Object} SimplifiedContentMetadata
 * @property {number} wordCount - Word count of content
 * @property {string} readingTime - Estimated reading time
 * @property {'low'|'medium'|'high'} contentQuality - Content quality assessment
 * @property {string} format - Content format used
 */

/**
 * @typedef {Object} SimplifiedPingMessage
 * @property {'ping'} type - Ping message type
 * @property {number} timestamp - Unix timestamp
 */

/**
 * @typedef {Object} SimplifiedPongMessage
 * @property {'pong'} type - Pong message type
 * @property {number} timestamp - Unix timestamp
 */

/**
 * @typedef {Object} SimplifiedErrorMessage
 * @property {'error'} type - Error message type
 * @property {string} requestId - Request identifier (if applicable)
 * @property {string} message - Error message
 * @property {string} code - Error code
 */