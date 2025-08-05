/**
 * Simplified content script for LLM-optimized browser context extraction
 * Uses the simplified content processor for efficient data extraction
 */

// Global variables
let contentProcessor = null;
let isContentScriptReady = false;
let moduleLoadError = null;

// Expose readiness status to background script
if (typeof window !== 'undefined') {
  window.isSimplifiedContentScriptReady = function() {
    return isContentScriptReady;
  };
}

// Try to import modules with error handling
async function loadModules() {
  try {
    console.log('[SimplifiedContent] 📦 Attempting to load content processor module...');
    const module = await import('./modules/simplified-content-processor.js');
    contentProcessor = module.getSimplifiedContentProcessor();
    console.log('[SimplifiedContent] ✅ Content processor module loaded successfully');
    return true;
  } catch (error) {
    console.error('[SimplifiedContent] ❌ Failed to load content processor module:', error);
    moduleLoadError = error;
    console.error('[SimplifiedContent] Module load error details:', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    });
    return false;
  }
}

/**
 * Initialize the simplified content script
 */
async function initializeSimplifiedContentScript() {
  console.log('[SimplifiedContent] Starting initialization...');
  
  try {
    // Test basic functionality first
    console.log('[SimplifiedContent] Testing basic script execution...');
    console.log('[SimplifiedContent] Document readyState:', document.readyState);
    console.log('[SimplifiedContent] Window location:', window.location.href);
    
    // Try to load modules asynchronously
    const modulesLoaded = await loadModules();
    
    if (modulesLoaded && contentProcessor) {
      console.log('[SimplifiedContent] Attempting to initialize content processor...');
      contentProcessor.init();
      console.log('[SimplifiedContent] Content processor initialized successfully');
    } else {
      console.log('[SimplifiedContent] ⚠️ Content processor not available, will use fallback functionality');
    }
    
    // Set up message listener (this should always work)
    console.log('[SimplifiedContent] Setting up message listener...');
    setupMessageListener();
    console.log('[SimplifiedContent] Message listener set up successfully');
    
    console.log('[SimplifiedContent] ✅ Simplified content script initialized successfully');
    
    // Set readiness flag
    isContentScriptReady = true;
    console.log('[SimplifiedContent] 🟢 Content script readiness flag set to:', isContentScriptReady);
    
    // Signal that content script is ready
    window.dispatchEvent(new CustomEvent('simplifiedContentReady'));
    
  } catch (error) {
    console.error('[SimplifiedContent] ❌ Failed to initialize:', error);
    console.error('[SimplifiedContent] Error stack:', error.stack);
    
    // Try to set up basic message listener even if everything else fails
    try {
      console.log('[SimplifiedContent] Attempting to set up fallback message listener...');
      setupMessageListener();
      console.log('[SimplifiedContent] Fallback message listener set up');
      
      // Set readiness flag even in fallback mode
      isContentScriptReady = true;
      console.log('[SimplifiedContent] 🟡 Content script ready in fallback mode');
    } catch (fallbackError) {
      console.error('[SimplifiedContent] ❌ Fallback message listener also failed:', fallbackError);
    }
  }
}

/**
 * Set up message listener for communication with background script
 */
function setupMessageListener() {
  console.log('[SimplifiedContent] Setting up chrome.runtime.onMessage listener...');
  
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[SimplifiedContent] 📨 Received message:', request);
      console.log('[SimplifiedContent] Message sender:', sender);
      
      // Handle ping
      if (request.type === 'PING') {
        console.log('[SimplifiedContent] 🏓 Received PING, sending PONG response...');
        const pongResponse = { type: 'PONG', timestamp: new Date().toISOString() };
        console.log('[SimplifiedContent] PONG response:', pongResponse);
        sendResponse(pongResponse);
        console.log('[SimplifiedContent] ✅ PONG response sent successfully');
        return false;
      }
      
      // Handle content request (used by background script)
      if (request.type === 'GET_CONTENT') {
        handleContentRequest(request, sendResponse);
        return true; // Async response
      }
      
      // Handle links request (used by background script)
      if (request.type === 'GET_LINKS') {
        handleLinksRequest(request, sendResponse);
        return true; // Async response
      }
      
      // Handle selection request (used by background script)
      if (request.type === 'GET_SELECTION') {
        handleSelectionRequest(request, sendResponse);
        return true; // Async response
      }
      
      // Handle metadata request (used by background script)
      if (request.type === 'GET_METADATA') {
        handleMetadataRequest(request, sendResponse);
        return true; // Async response
      }
      
      // Handle simplified context request
      if (request.type === 'GET_SIMPLIFIED_CONTEXT') {
        handleSimplifiedContextRequest(request, sendResponse);
        return true; // Async response
      }
      
      // Handle legacy context request (for backward compatibility)
      if (request.type === 'GET_BROWSER_CONTEXT') {
        handleLegacyContextRequest(request, sendResponse);
        return true; // Async response
      }
      
      console.log('[SimplifiedContent] Unhandled message type:', request.type);
    });
    
    console.log('[SimplifiedContent] ✅ Message listener set up successfully');
  } catch (error) {
    console.error('[SimplifiedContent] ❌ Failed to set up message listener:', error);
    console.error('[SimplifiedContent] Error stack:', error.stack);
  }
}

/**
 * Fallback context extraction when content processor is not available
 * @param {Object} options - Extraction options
 * @returns {Object} Basic context data
 */
function extractFallbackContext(options = {}) {
  console.log('[SimplifiedContent] Using fallback context extraction');
  
  try {
    const url = window.location.href;
    const title = document.title;
    
    // Basic text extraction
    let content = '';
    if (options.includeLinks !== false) {
      // Get all text content
      content = document.body.innerText || document.body.textContent || '';
    } else {
      // Get text from main content areas only
      const contentElements = document.querySelectorAll('main, article, .content, .main-content, [role="main"]');
      content = Array.from(contentElements).map(el => el.innerText || el.textContent || '').join('\n\n');
    }
    
    // Basic link extraction
    const links = [];
    if (options.includeLinks !== false) {
      const linkElements = document.querySelectorAll('a[href]');
      Array.from(linkElements).forEach(link => {
        const href = link.href;
        const text = link.innerText || link.textContent || '';
        if (href && text && href.startsWith('http')) {
          links.push({ text: text.trim(), href });
        }
      });
    }
    
    // Basic selection extraction
    let selection = '';
    if (options.includeSelection !== false) {
      const userSelection = window.getSelection();
      selection = userSelection.toString().trim();
    }
    
    // Limit content length
    const maxTokens = options.maxTokens || 2000;
    if (content.length > maxTokens) {
      content = content.substring(0, maxTokens) + '...';
    }
    
    const context = {
      url,
      title,
      content: content.trim(),
      links: links.slice(0, 10), // Limit to 10 links
      selection,
      hasSelection: !!selection,
      metadata: {
        extractionMethod: 'fallback',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('[SimplifiedContent] Fallback context extracted:', {
      url: context.url,
      title: context.title,
      contentLength: context.content.length,
      linksCount: context.links.length,
      hasSelection: context.hasSelection
    });
    
    return context;
  } catch (error) {
    console.error('[SimplifiedContent] Error in fallback context extraction:', error);
    return {
      url: window.location.href,
      title: document.title,
      content: '',
      links: [],
      selection: '',
      hasSelection: false,
      metadata: {
        extractionMethod: 'fallback-error',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle simplified context request
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleSimplifiedContextRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing simplified context request');
    
    const options = {
      format: request.format || 'text',
      maxTokens: request.maxTokens || 2000,
      includeLinks: request.includeLinks !== false,
      includeSelection: request.includeSelection !== false
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for context extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback context extraction');
      context = extractFallbackContext(options);
    }
    
    console.log('[SimplifiedContent] Extracted simplified context:', {
      url: context.url,
      title: context.title,
      contentLength: context.content.length,
      linksCount: context.links.length,
      hasSelection: !!context.selection,
      metadata: context.metadata
    });
    
    sendResponse({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing simplified context request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle legacy context request (for backward compatibility)
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleLegacyContextRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing legacy context request');
    
    // Map legacy options to simplified options
    const options = {
      format: request.contentFilterOptions?.preserveStructure ? 'structured' : 'text',
      maxTokens: request.maxContextLength || 2000,
      includeLinks: request.includeLinks !== false,
      includeSelection: request.includeSelection !== false
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for legacy context extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback context extraction for legacy request');
      context = extractFallbackContext(options);
    }
    
    // Map simplified context back to legacy format
    const legacyContext = {
      url: context.url,
      title: context.title,
      visibleText: context.content,
      structuredContent: options.format === 'structured' ? {
        title: context.title,
        headings: [], // TODO: Extract headings if needed
        paragraphs: context.content.split('\n\n').filter(p => p.trim()),
        lists: [],
        text: context.content
      } : null,
      links: context.links.map(link => ({
        text: link.text,
        href: link.href,
        title: '',
        score: 0 // TODO: Calculate score if needed
      })),
      selection: context.selection,
      surroundingContext: context.selection, // Simplified for now
      hasSelection: !!context.selection,
      contentStats: {
        totalElementsFound: 0, // TODO: Track if needed
        topElementScore: 0, // TODO: Calculate if needed
        extractionMethod: 'simplified'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('[SimplifiedContent] Extracted legacy context:', {
      url: legacyContext.url,
      title: legacyContext.title,
      textLength: legacyContext.visibleText.length,
      linksCount: legacyContext.links.length,
      hasSelection: legacyContext.hasSelection
    });
    
    sendResponse({
      success: true,
      data: legacyContext
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing legacy context request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle content request
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleContentRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing content request');
    
    const options = {
      format: request.format || 'text',
      maxTokens: request.maxTokens || 2000,
      includeLinks: false,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for content extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback content extraction');
      context = extractFallbackContext(options);
    }
    
    console.log('[SimplifiedContent] Extracted content:', {
      url: context.url,
      title: context.title,
      contentLength: context.content.length,
      metadata: context.metadata
    });
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        title: context.title,
        content: context.content,
        metadata: context.metadata
      }
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing content request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle links request
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleLinksRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing links request');
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: true,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for links extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback links extraction');
      context = extractFallbackContext(options);
    }
    
    console.log('[SimplifiedContent] Extracted links:', {
      url: context.url,
      linksCount: context.links.length
    });
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        links: context.links
      }
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing links request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle selection request
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleSelectionRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing selection request');
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: false,
      includeSelection: true
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for selection extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback selection extraction');
      context = extractFallbackContext(options);
    }
    
    console.log('[SimplifiedContent] Extracted selection:', {
      url: context.url,
      hasSelection: !!context.selection,
      selectionLength: context.selection.length
    });
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        selection: context.selection,
        hasSelection: !!context.selection
      }
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing selection request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle metadata request
 * @param {Object} request - Request message
 * @param {Function} sendResponse - Response callback
 */
async function handleMetadataRequest(request, sendResponse) {
  try {
    console.log('[SimplifiedContent] Processing metadata request');
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: false,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      console.log('[SimplifiedContent] Using content processor for metadata extraction');
      context = contentProcessor.extractContext(options);
    } else {
      console.log('[SimplifiedContent] Using fallback metadata extraction');
      context = extractFallbackContext(options);
    }
    
    console.log('[SimplifiedContent] Extracted metadata:', {
      url: context.url,
      title: context.title,
      metadata: context.metadata
    });
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        title: context.title,
        metadata: context.metadata
      }
    });
  } catch (error) {
    console.error('[SimplifiedContent] Error processing metadata request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Clean up resources
 */
function cleanup() {
  if (contentProcessor) {
    contentProcessor.destroy();
    contentProcessor = null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[SimplifiedContent] DOM loaded, initializing...');
    initializeSimplifiedContentScript();
  });
} else {
  console.log('[SimplifiedContent] DOM already loaded, initializing immediately...');
  initializeSimplifiedContentScript();
}

// Clean up when page unloads
window.addEventListener('beforeunload', cleanup);

// Export for debugging
if (typeof window !== 'undefined') {
  window.getSimplifiedContentProcessor = function() {
    return contentProcessor;
  };
  window.cleanupSimplifiedContentScript = cleanup;
  window.isSimplifiedContentScriptReady = function() {
    return isContentScriptReady;
  };
}