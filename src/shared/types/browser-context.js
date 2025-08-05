/**
 * Type definitions for browser context data
 */

/**
 * @typedef {Object} BrowserContextData
 * @property {string} url - The current page URL
 * @property {string} title - The page title
 * @property {string} visibleText - Filtered main content text
 * @property {StructuredContent|null} structuredContent - Structured content with hierarchy
 * @property {Array<LinkData>} links - Filtered and scored links
 * @property {string} selection - User-selected text
 * @property {string} surroundingContext - Text surrounding the selection
 * @property {boolean} hasSelection - Whether there is a user selection
 * @property {ContentStats} contentStats - Statistics about content extraction
 * @property {string} timestamp - ISO timestamp of when the context was collected
 */

/**
 * @typedef {Object} StructuredContent
 * @property {string} title - Content title
 * @property {Array<HeadingData>} headings - Heading elements with levels
 * @property {Array<string>} paragraphs - Paragraph text content
 * @property {Array<ListData>} lists - List elements with items
 * @property {string} text - Combined text content
 */

/**
 * @typedef {Object} HeadingData
 * @property {number} level - Heading level (1-6)
 * @property {string} text - Heading text content
 */

/**
 * @typedef {Object} ListData
 * @property {string} type - List type ('ordered' or 'unordered')
 * @property {Array<string>} items - List items
 */

/**
 * @typedef {Object} LinkData
 * @property {string} text - Link text
 * @property {string} href - Link URL
 * @property {string} title - Link title attribute
 * @property {number} score - Link relevance score
 */

/**
 * @typedef {Object} ContentStats
 * @property {number} totalElementsFound - Number of content elements found
 * @property {number} topElementScore - Score of the highest-ranked element
 * @property {string} extractionMethod - Method used for extraction ('structured' or 'fallback')
 */

/**
 * @typedef {Object} ContentFilterOptions
 * @property {boolean} aggressiveMode - More aggressive filtering for maximum token reduction
 * @property {boolean} preserveStructure - Maintain content structure for better LLM comprehension
 * @property {number} maxLinks - Maximum number of links to extract
 * @property {number} minContentScore - Minimum score threshold for content elements
 */

/**
 * @typedef {Object} BrowserContextRequest
 * @property {boolean} includeUrl - Whether to include URL in response
 * @property {boolean} includeText - Whether to include visible text in response
 * @property {boolean} includeLinks - Whether to include links in response
 * @property {boolean} includeSelection - Whether to include user selection in response
 * @property {boolean} includeContext - Whether to include surrounding context in response
 * @property {number} maxContextLength - Maximum length of surrounding context
 * @property {ContentFilterOptions} contentFilterOptions - Options for content filtering
 */