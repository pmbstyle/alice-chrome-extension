(function() {
  'use strict';

  // Function to extract visible text from the page
  function extractVisibleText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || 
              style.visibility === 'hidden' || 
              style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent.trim();
      if (textContent.length > 0) {
        text += textContent + ' ';
      }
    }
    
    return text.trim();
  }

  // Function to extract links with a limit
  function extractLinks(maxLinks = 20) {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.slice(0, maxLinks).map(link => ({
      text: link.textContent.trim(),
      href: link.href,
      title: link.title || ''
    }));
  }

  // Function to get user selection and surrounding context
  function getSelectionContext(maxLength = 2000) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return {
        selection: '',
        context: '',
        hasSelection: false
      };
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      return {
        selection: '',
        context: '',
        hasSelection: false
      };
    }

    // Get surrounding context
    const container = range.commonAncestorContainer;
    const contextElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;

    let context = '';
    if (contextElement) {
      context = contextElement.textContent || '';
      
      // Find the selection within the context
      const selectionIndex = context.indexOf(selectedText);
      if (selectionIndex !== -1) {
        const start = Math.max(0, selectionIndex - Math.floor(maxLength / 2));
        const end = Math.min(context.length, selectionIndex + selectedText.length + Math.floor(maxLength / 2));
        context = context.substring(start, end);
      }
    }

    return {
      selection: selectedText,
      context: context.trim(),
      hasSelection: true
    };
  }

  // Main function to collect all browser context data
  function collectBrowserContext(includeUrl = true, includeText = true, includeLinks = true,
                                includeSelection = true, includeContext = true, maxContextLength = 2000) {
    const context = {
      url: includeUrl ? window.location.href : '',
      title: document.title || '',
      visibleText: includeText ? extractVisibleText() : '',
      links: includeLinks ? extractLinks(20) : [], // Limit to 20 links
      selection: '',
      surroundingContext: '',
      hasSelection: false,
      timestamp: new Date().toISOString()
    };

    if (includeSelection || includeContext) {
      const selectionData = getSelectionContext(maxContextLength);
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

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] Received message from background:', request);
    console.log('[Content] Message type:', request.type);
    console.log('[Content] Message keys:', Object.keys(request));
    
    if (request.type === 'PING') {
      console.log('[Content] Received PING, responding with PONG');
      sendResponse({ type: 'PONG', timestamp: new Date().toISOString() });
      return false; // Synchronous response
    }
    
    if (request.type === 'GET_BROWSER_CONTEXT') {
      console.log('[Content] Processing GET_BROWSER_CONTEXT request...');
      console.log('[Content] Request parameters:', {
        includeUrl: request.includeUrl,
        includeText: request.includeText,
        includeLinks: request.includeLinks,
        includeSelection: request.includeSelection,
        includeContext: request.includeContext,
        maxContextLength: request.maxContextLength
      });
      
      try {
        const context = collectBrowserContext(
          request.includeUrl,
          request.includeText,
          request.includeLinks,
          request.includeSelection,
          request.includeContext,
          request.maxContextLength
        );
        
        console.log('[Content] Successfully collected browser context:', {
          url: context.url,
          title: context.title,
          textLength: context.visibleText.length,
          linksCount: context.links.length,
          hasSelection: context.hasSelection
        });
        
        if (context.links.length > 0) {
          console.log('[Content] First few links:', context.links.slice(0, 3).map(link => ({ text: link.text.substring(0, 30), href: link.href.substring(0, 50) })));
        }
        
        console.log('[Content] Sending success response with data keys:', Object.keys(context));
        sendResponse({ success: true, data: context });
      } catch (error) {
        console.error('[Content] Error collecting browser context:', error);
        console.error('[Content] Error stack:', error.stack);
        sendResponse({ success: false, error: error.message });
      }
      
      // Return true to indicate async response
      return true;
    }
    
    console.log('[Content] Unhandled message type:', request.type);
  });

  // Expose function globally for debugging
  window.collectBrowserContext = collectBrowserContext;
})();