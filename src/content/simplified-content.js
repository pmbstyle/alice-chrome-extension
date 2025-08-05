let contentProcessor = null;
let isContentScriptReady = false;
let moduleLoadError = null;

if (typeof window !== 'undefined') {
  window.isSimplifiedContentScriptReady = function() {
    return isContentScriptReady;
  };
}

async function loadModules() {
  try {
    const module = await import('./modules/simplified-content-processor.js');
    contentProcessor = module.getSimplifiedContentProcessor();
    return true;
  } catch (error) {
    moduleLoadError = error;
    return false;
  }
}

async function initializeSimplifiedContentScript() {
  
  try {
    const modulesLoaded = await loadModules();
    
    if (modulesLoaded && contentProcessor) {
      contentProcessor.init();
    } else {
    }
    
    setupMessageListener();
    
    
    isContentScriptReady = true;
    
    window.dispatchEvent(new CustomEvent('simplifiedContentReady'));
    
  } catch (error) {
    
    try {
      setupMessageListener();
      
      isContentScriptReady = true;
    } catch (fallbackError) {
    }
  }
}

function setupMessageListener() {
  
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      
      if (request.type === 'PING') {
        const pongResponse = { type: 'PONG', timestamp: new Date().toISOString() };
        sendResponse(pongResponse);
        return false;
      }
      
      if (request.type === 'GET_CONTENT') {
        handleContentRequest(request, sendResponse);
        return true;
      }
      
      if (request.type === 'GET_LINKS') {
        handleLinksRequest(request, sendResponse);
        return true;
      }
      
      if (request.type === 'GET_SELECTION') {
        handleSelectionRequest(request, sendResponse);
        return true;
      }
      
      if (request.type === 'GET_METADATA') {
        handleMetadataRequest(request, sendResponse);
        return true;
      }
      
      if (request.type === 'GET_SIMPLIFIED_CONTEXT') {
        handleSimplifiedContextRequest(request, sendResponse);
        return true;
      }
      
      if (request.type === 'GET_BROWSER_CONTEXT') {
        handleLegacyContextRequest(request, sendResponse);
        return true;
      }
      
    });
    
  } catch (error) {
  }
}

function extractFallbackContext(options = {}) {
  
  try {
    const url = window.location.href;
    const title = document.title;
    
    let content = '';
    if (options.includeLinks !== false) {
      content = document.body.innerText || document.body.textContent || '';
    } else {
      const contentElements = document.querySelectorAll('main, article, .content, .main-content, [role="main"]');
      content = Array.from(contentElements).map(el => el.innerText || el.textContent || '').join('\n\n');
    }
    
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
    
    let selection = '';
    if (options.includeSelection !== false) {
      const userSelection = window.getSelection();
      selection = userSelection.toString().trim();
    }
    
    const maxTokens = options.maxTokens || 2000;
    if (content.length > maxTokens) {
      content = content.substring(0, maxTokens) + '...';
    }
    
    const context = {
      url,
      title,
      content: content.trim(),
      links: links.slice(0, 10),
      selection,
      hasSelection: !!selection,
      metadata: {
        extractionMethod: 'fallback',
        timestamp: new Date().toISOString()
      }
    };
    
    
    return context;
  } catch (error) {
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

async function handleSimplifiedContextRequest(request, sendResponse) {
  try {
    
    const options = {
      format: request.format || 'text',
      maxTokens: request.maxTokens || 2000,
      includeLinks: request.includeLinks !== false,
      includeSelection: request.includeSelection !== false
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    
    sendResponse({
      success: true,
      data: context
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleLegacyContextRequest(request, sendResponse) {
  try {
    
    const options = {
      format: request.contentFilterOptions?.preserveStructure ? 'structured' : 'text',
      maxTokens: request.maxContextLength || 2000,
      includeLinks: request.includeLinks !== false,
      includeSelection: request.includeSelection !== false
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    const legacyContext = {
      url: context.url,
      title: context.title,
      visibleText: context.content,
      structuredContent: options.format === 'structured' ? {
        title: context.title,
        headings: [],
        paragraphs: context.content.split('\n\n').filter(p => p.trim()),
        lists: [],
        text: context.content
      } : null,
      links: context.links.map(link => ({
        text: link.text,
        href: link.href,
        title: '',
        score: 0,
      })),
      selection: context.selection,
      surroundingContext: context.selection, // Simplified for now
      hasSelection: !!context.selection,
      contentStats: {
        totalElementsFound: 0,
        topElementScore: 0,
        extractionMethod: 'simplified'
      },
      timestamp: new Date().toISOString()
    };
    
    
    sendResponse({
      success: true,
      data: legacyContext
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleContentRequest(request, sendResponse) {
  try {
    
    const options = {
      format: request.format || 'text',
      maxTokens: request.maxTokens || 2000,
      includeLinks: false,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    
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
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleLinksRequest(request, sendResponse) {
  try {
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: true,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        links: context.links
      }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleSelectionRequest(request, sendResponse) {
  try {
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: false,
      includeSelection: true
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        selection: context.selection,
        hasSelection: !!context.selection
      }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleMetadataRequest(request, sendResponse) {
  try {
    
    const options = {
      format: 'text',
      maxTokens: 2000,
      includeLinks: false,
      includeSelection: false
    };
    
    let context;
    if (contentProcessor) {
      context = contentProcessor.extractContext(options);
    } else {
      context = extractFallbackContext(options);
    }
    
    
    sendResponse({
      success: true,
      data: {
        url: context.url,
        title: context.title,
        metadata: context.metadata
      }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function cleanup() {
  if (contentProcessor) {
    contentProcessor.destroy();
    contentProcessor = null;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeSimplifiedContentScript();
  });
} else {
  initializeSimplifiedContentScript();
}

window.addEventListener('beforeunload', cleanup);

if (typeof window !== 'undefined') {
  window.getSimplifiedContentProcessor = function() {
    return contentProcessor;
  };
  window.cleanupSimplifiedContentScript = cleanup;
  window.isSimplifiedContentScriptReady = function() {
    return isContentScriptReady;
  };
}