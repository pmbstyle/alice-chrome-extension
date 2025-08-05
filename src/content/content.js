/**
 * Refactored content script for the Alice Browser Context extension
 * This script uses modular components for better organization and maintainability
 */

// Import shared constants
import { CONTENT_FILTER_DEFAULTS } from '../shared/constants/default-config.js';
import { MESSAGE_TYPES } from '../shared/constants/default-config.js';

// Content script modules
import { ContentFilter } from './modules/content-filter.js';
import { LinkExtractor } from './modules/link-extractor.js';
import { SelectionManager } from './modules/selection-manager.js';
import { MessageHandler } from './modules/message-handler.js';

/**
 * Main content script class
 */
class ContentScript {
  constructor() {
    this.contentFilter = new ContentFilter(CONTENT_FILTER_DEFAULTS);
    this.linkExtractor = new LinkExtractor(CONTENT_FILTER_DEFAULTS);
    this.selectionManager = new SelectionManager();
    this.messageHandler = new MessageHandler();
    
    this.initialized = false;
  }

  /**
   * Initialize the content script
   */
  async init() {
    try {
      // Initialize modules
      await this.contentFilter.init();
      await this.linkExtractor.init();
      await this.selectionManager.init();
      await this.messageHandler.init();
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Expose functions globally for debugging
      this.exposeDebugFunctions();
      
      this.initialized = true;
      console.log('[Content] Content script initialized successfully');
      
    } catch (error) {
      console.error('[Content] Failed to initialize content script:', error);
    }
  }

  /**
   * Set up message handlers for communication with background script
   */
  setupMessageHandlers() {
    // Handle PING messages
    this.messageHandler.onMessage(MESSAGE_TYPES.PING, this.handlePing.bind(this));
    
    // Handle browser context requests
    this.messageHandler.onMessage(MESSAGE_TYPES.GET_BROWSER_CONTEXT, this.handleGetBrowserContext.bind(this));
  }

  /**
   * Handle PING message from background script
   * @param {Object} message - The PING message
   * @param {Object} sender - Message sender information
   * @param {Function} sendResponse - Function to send response
   */
  handlePing(message, sender, sendResponse) {
    console.log('[Content] Received PING, responding with PONG');
    sendResponse({ 
      type: MESSAGE_TYPES.PONG, 
      timestamp: new Date().toISOString() 
    });
  }

  /**
   * Handle GET_BROWSER_CONTEXT message from background script
   * @param {Object} message - The GET_BROWSER_CONTEXT message
   * @param {Object} sender - Message sender information
   * @param {Function} sendResponse - Function to send response
   */
  async handleGetBrowserContext(message, sender, sendResponse) {
    console.log('[Content] Processing GET_BROWSER_CONTEXT request...');
    
    try {
      // Extract request parameters
      const {
        includeUrl = true,
        includeText = true,
        includeLinks = true,
        includeSelection = true,
        includeContext = true,
        maxContextLength = 2000,
        contentFilterOptions = {}
      } = message;
      
      console.log('[Content] Request parameters:', {
        includeUrl,
        includeText,
        includeLinks,
        includeSelection,
        includeContext,
        maxContextLength,
        contentFilterOptions
      });
      
      // Update content filter configuration with options
      this.updateContentFilterConfig(contentFilterOptions);
      
      // Collect browser context data
      const context = await this.collectBrowserContext(
        includeUrl,
        includeText,
        includeLinks,
        includeSelection,
        includeContext,
        maxContextLength
      );
      
      console.log('[Content] Successfully collected browser context:', {
        url: context.url,
        title: context.title,
        textLength: context.visibleText.length,
        linksCount: context.links.length,
        hasSelection: context.hasSelection,
        contentStats: context.contentStats,
        hasStructuredContent: !!context.structuredContent
      });
      
      if (context.links.length > 0) {
        console.log('[Content] First few links:', context.links.slice(0, 3).map(link => ({
          text: link.text.substring(0, 30),
          href: link.href.substring(0, 50),
          score: link.score
        })));
      }
      
      if (context.structuredContent) {
        console.log('[Content] Structured content summary:', {
          headings: context.structuredContent.headings.length,
          paragraphs: context.structuredContent.paragraphs.length,
          lists: context.structuredContent.lists.length
        });
      }
      
      console.log('[Content] Sending success response with data keys:', Object.keys(context));
      sendResponse({ success: true, data: context });
      
    } catch (error) {
      console.error('[Content] Error collecting browser context:', error);
      console.error('[Content] Error stack:', error.stack);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Update content filter configuration with options
   * @param {Object} options - Content filter options
   */
  updateContentFilterConfig(options) {
    if (options.aggressiveMode !== undefined) {
      this.contentFilter.setAggressiveMode(options.aggressiveMode);
    }
    
    if (options.preserveStructure !== undefined) {
      this.contentFilter.setPreserveStructure(options.preserveStructure);
    }
    
    if (options.maxLinks !== undefined) {
      this.linkExtractor.setMaxLinks(options.maxLinks);
    }
    
    if (options.minContentScore !== undefined) {
      this.contentFilter.setMinContentScore(options.minContentScore);
    }
  }

  /**
   * Collect browser context data
   * @param {boolean} includeUrl - Whether to include URL
   * @param {boolean} includeText - Whether to include text
   * @param {boolean} includeLinks - Whether to include links
   * @param {boolean} includeSelection - Whether to include selection
   * @param {boolean} includeContext - Whether to include context
   * @param {number} maxContextLength - Maximum context length
   * @returns {Promise<Object>} Promise that resolves to the browser context data
   */
  async collectBrowserContext(includeUrl, includeText, includeLinks, includeSelection, includeContext, maxContextLength) {
    const mainContentElements = this.contentFilter.findMainContentElements();
    const structuredContent = this.contentFilter.getPreserveStructure() && mainContentElements.length > 0
      ? this.contentFilter.extractStructuredContent(mainContentElements)
      : null;
    
    const context = {
      url: includeUrl ? window.location.href : '',
      title: document.title || '',
      visibleText: includeText ? this.contentFilter.extractVisibleText() : '',
      structuredContent: structuredContent || null,
      links: includeLinks ? this.linkExtractor.extractLinks() : [],
      selection: '',
      surroundingContext: '',
      hasSelection: false,
      contentStats: {
        totalElementsFound: mainContentElements.length,
        topElementScore: mainContentElements.length > 0 ? mainContentElements[0].score : 0,
        extractionMethod: structuredContent ? 'structured' : 'fallback'
      },
      timestamp: new Date().toISOString()
    };

    if (includeSelection || includeContext) {
      const selectionData = this.selectionManager.getSelectionContext(maxContextLength);
      if (includeSelection) {
        context.selection = selectionData.selection;
      }
      if (includeContext) {
        context.surroundingContext = selectionData.context;
      }
      context.hasSelection = selectionData.hasSelection;
    }

    return context;
  }

  /**
   * Expose functions globally for debugging
   */
  exposeDebugFunctions() {
    // Expose the main collectBrowserContext function
    window.collectBrowserContext = (includeUrl = true, includeText = true, includeLinks = true,
                                   includeSelection = true, includeContext = true, maxContextLength = 2000,
                                   contentFilterOptions = {}) => {
      return this.collectBrowserContext(
        includeUrl,
        includeText,
        includeLinks,
        includeSelection,
        includeContext,
        maxContextLength,
        contentFilterOptions
      );
    };
    
    // Expose individual modules for debugging
    window.aliceContentFilter = this.contentFilter;
    window.aliceLinkExtractor = this.linkExtractor;
    window.aliceSelectionManager = this.selectionManager;
    
    // Expose initialization status
    window.aliceExtensionLoaded = true;
    
    console.log('[Content] Debug functions exposed globally');
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.contentFilter) {
      this.contentFilter.destroy();
    }
    
    if (this.linkExtractor) {
      this.linkExtractor.destroy();
    }
    
    if (this.selectionManager) {
      this.selectionManager.destroy();
    }
    
    if (this.messageHandler) {
      this.messageHandler.destroy();
    }
    
    this.initialized = false;
  }
}

// Create and initialize the content script
const contentScript = new ContentScript();
contentScript.init().catch(error => {
  console.error('[Content] Failed to initialize content script:', error);
});

// Clean up when the page is unloaded
window.addEventListener('beforeunload', () => {
  contentScript.destroy();
});