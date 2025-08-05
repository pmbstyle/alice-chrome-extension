(function() {
  'use strict';

  // Configuration for content filtering
  const contentFilterConfig = {
    // Elements to exclude from content extraction
    excludedSelectors: [
      'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
      '.menu', '.nav', '.navbar', '.breadcrumb', '.pagination',
      '.ads', '.advertisement', '.social-share', '.comments',
      '.related', '.recommended', '.newsletter', '.subscribe',
      '.cookie-notice', '.popup', '.modal', '.banner', '.widget',
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas'
    ],
    
    // Elements that likely contain main content
    contentSelectors: [
      'article', 'main', '[role="main"]', '.content', '.main-content',
      '.article', '.post', '.story', '.entry', '.text-content',
      '.prose', '.markdown', '.documentation', '.guide'
    ],
    
    // Minimum text density for content elements (ratio of text to total element length)
    minTextDensity: 0.25,
    
    // Maximum link density for content elements (ratio of link text to total text)
    maxLinkDensity: 0.3,
    
    // Minimum text length for content elements
    minTextLength: 50,
    
    // Link scoring thresholds
    minLinkTextLength: 3,
    maxLinkTextLength: 100,
    excludedLinkPatterns: [
      /login/i, /signin/i, /register/i, /signup/i, /account/i,
      /cart/i, /checkout/i, /search/i, /home/i, /back to top/i,
      /privacy/i, /terms/i, /contact/i, /about/i, /help/i,
      /support/i, /faq/i, /rss/i, /feed/i, /newsletter/i,
      /subscribe/i, /follow/i, /like/i, /share/i, /tweet/i,
      /facebook/i, /twitter/i, /instagram/i, /linkedin/i
    ]
  };

  // Function to check if an element should be excluded
  function isExcludedElement(element) {
    if (!element || !element.parentElement) return true;
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    // Check excluded selectors
    for (const selector of contentFilterConfig.excludedSelectors) {
      if (element.matches(selector) ||
          element.parentElement.matches(selector) ||
          className.includes(selector.replace('.', '')) ||
          id.includes(selector.replace('#', ''))) {
        return true;
      }
    }
    
    // Check computed style
    const style = window.getComputedStyle(element);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        parseFloat(style.fontSize) < 8) {
      return true;
    }
    
    return false;
  }

  // Function to calculate text density of an element
  function calculateTextDensity(element) {
    const text = element.textContent || '';
    const textLength = text.trim().length;
    const totalLength = element.innerHTML.length;
    
    return totalLength > 0 ? textLength / totalLength : 0;
  }

  // Function to calculate link density of an element
  function calculateLinkDensity(element) {
    const text = element.textContent || '';
    const links = element.querySelectorAll('a');
    let linkTextLength = 0;
    
    links.forEach(link => {
      linkTextLength += link.textContent.length;
    });
    
    return text.length > 0 ? linkTextLength / text.length : 0;
  }

  // Function to score content elements
  function scoreContentElement(element) {
    let score = 0;
    const text = element.textContent || '';
    const textLength = text.trim().length;
    
    // Skip if text is too short
    if (textLength < contentFilterConfig.minTextLength) {
      return 0;
    }
    
    // Text density score (0-50 points)
    const textDensity = calculateTextDensity(element);
    if (textDensity >= contentFilterConfig.minTextDensity) {
      score += Math.min(50, textDensity * 100);
    }
    
    // Link density penalty (0-30 points)
    const linkDensity = calculateLinkDensity(element);
    if (linkDensity > contentFilterConfig.maxLinkDensity) {
      score -= Math.min(30, (linkDensity - contentFilterConfig.maxLinkDensity) * 100);
    }
    
    // Element type score (0-20 points)
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    // High-value content elements
    if (tagName === 'article' ||
        element.matches('[role="main"]') ||
        className.includes('content') ||
        className.includes('article') ||
        className.includes('post') ||
        className.includes('entry') ||
        id.includes('content') ||
        id.includes('article') ||
        id.includes('main')) {
      score += 20;
    }
    
    // Medium-value content elements
    else if (tagName === 'main' ||
             tagName === 'section' ||
             className.includes('text') ||
             className.includes('body') ||
             className.includes('story')) {
      score += 10;
    }
    
    // Low-value elements
    else if (tagName === 'div' || tagName === 'span') {
      score += 5;
    }
    
    // Heading bonus
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      score += 15;
    }
    
    // Paragraph bonus
    if (tagName === 'p') {
      score += 10;
    }
    
    // List bonus
    if (tagName === 'ul' || tagName === 'ol' || tagName === 'dl') {
      score += 8;
    }
    
    return Math.max(0, score);
  }

  // Function to find main content elements
  function findMainContentElements() {
    const candidates = [];
    
    // Start with content selectors
    for (const selector of contentFilterConfig.contentSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (!isExcludedElement(element)) {
          const score = scoreContentElement(element);
          if (score > 0) {
            candidates.push({ element, score });
          }
        }
      });
    }
    
    // If no content selectors found, scan all major elements
    if (candidates.length === 0) {
      const majorElements = document.querySelectorAll('div, section, article, main, p, h1, h2, h3, h4, h5, h6');
      majorElements.forEach(element => {
        if (!isExcludedElement(element)) {
          const score = scoreContentElement(element);
          if (score > 30) { // Higher threshold for general scanning
            candidates.push({ element, score });
          }
        }
      });
    }
    
    // Sort by score and return top elements
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10); // Top 10 candidates
  }

  // Function to extract structured content from elements
  function extractStructuredContent(elements) {
    const content = {
      title: '',
      headings: [],
      paragraphs: [],
      lists: [],
      text: ''
    };
    
    elements.forEach(({ element }) => {
      const tagName = element.tagName.toLowerCase();
      
      // Skip excluded elements
      if (isExcludedElement(element)) {
        return;
      }
      
      // Skip style, script, and noscript elements
      if (tagName === 'style' || tagName === 'script' || tagName === 'noscript') {
        return;
      }
      
      // Extract text content, filtering out excluded child elements
      const cleanText = extractCleanText(element);
      
      if (!cleanText) return;
      
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          content.headings.push({
            level: parseInt(tagName[1]),
            text: cleanText
          });
          content.text += cleanText + '\n\n';
          break;
          
        case 'p':
          content.paragraphs.push(cleanText);
          content.text += cleanText + '\n\n';
          break;
          
        case 'ul':
        case 'ol':
          const items = Array.from(element.querySelectorAll('li'))
            .filter(li => !isExcludedElement(li))
            .map(li => extractCleanText(li).trim())
            .filter(text => text.length > 0);
          if (items.length > 0) {
            content.lists.push({
              type: tagName === 'ul' ? 'unordered' : 'ordered',
              items: items
            });
            content.text += items.map(item => '• ' + item).join('\n') + '\n\n';
          }
          break;
          
        default:
          // For other elements, just add the text
          content.text += cleanText + '\n\n';
          break;
      }
    });
    
    return content;
  }
  
  // Helper function to extract clean text from an element, excluding excluded children
  function extractCleanText(element) {
    let text = '';
    
    // Create a tree walker that only accepts text nodes and non-excluded elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Check if parent is excluded
          if (isExcludedElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check for style, script, and noscript tags
          const parentTag = parent.tagName.toLowerCase();
          if (parentTag === 'style' || parentTag === 'script' || parentTag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check if any ancestor is an excluded element
          let ancestor = parent;
          while (ancestor && ancestor !== element) {
            if (isExcludedElement(ancestor)) {
              return NodeFilter.FILTER_REJECT;
            }
            const ancestorTag = ancestor.tagName.toLowerCase();
            if (ancestorTag === 'style' || ancestorTag === 'script' || ancestorTag === 'noscript') {
              return NodeFilter.FILTER_REJECT;
            }
            ancestor = ancestor.parentElement;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent.trim();
      if (textContent.length > 0) {
        text += textContent + ' ';
      }
    }
    
    return text.trim();
  }

  // Function to extract visible text from the page (improved)
  function extractVisibleText() {
    const mainContentElements = findMainContentElements();
    
    if (mainContentElements.length === 0) {
      // Fallback to original method if no content found
      return extractVisibleTextFallback();
    }
    
    const structuredContent = extractStructuredContent(mainContentElements);
    return structuredContent.text.trim();
  }

  // Fallback function for text extraction
  function extractVisibleTextFallback() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Check if parent is excluded
          if (isExcludedElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Additional check for style and script tags that might have been missed
          const parentTag = parent.tagName.toLowerCase();
          if (parentTag === 'style' || parentTag === 'script' || parentTag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check if any ancestor is an excluded element
          let ancestor = parent.parentElement;
          while (ancestor) {
            if (isExcludedElement(ancestor)) {
              return NodeFilter.FILTER_REJECT;
            }
            const ancestorTag = ancestor.tagName.toLowerCase();
            if (ancestorTag === 'style' || ancestorTag === 'script' || ancestorTag === 'noscript') {
              return NodeFilter.FILTER_REJECT;
            }
            ancestor = ancestor.parentElement;
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

  // Function to score links for relevance
  function scoreLink(link) {
    let score = 0;
    const text = link.textContent.trim();
    const href = link.href;
    const title = link.title || '';
    
    // Skip if text is too short or too long
    if (text.length < contentFilterConfig.minLinkTextLength ||
        text.length > contentFilterConfig.maxLinkTextLength) {
      return 0;
    }
    
    // Check excluded patterns
    for (const pattern of contentFilterConfig.excludedLinkPatterns) {
      if (pattern.test(text) || pattern.test(href) || pattern.test(title)) {
        return 0;
      }
    }
    
    // Text length score (0-30 points)
    if (text.length >= 10 && text.length <= 50) {
      score += 30;
    } else if (text.length >= 5 && text.length <= 80) {
      score += 20;
    } else {
      score += 10;
    }
    
    // Context relevance score (0-40 points)
    const parent = link.parentElement;
    if (parent) {
      const parentTag = parent.tagName.toLowerCase();
      const parentClass = parent.className || '';
      
      // Links in content areas are more valuable
      if (parentTag === 'p' || parentTag === 'article' || parentTag === 'main') {
        score += 40;
      } else if (parentTag === 'section' || parentTag === 'div') {
        if (parentClass.includes('content') || parentClass.includes('article')) {
          score += 30;
        } else {
          score += 15;
        }
      }
    }
    
    // Link text quality (0-20 points)
    if (text.length > 0) {
      // Descriptive text is better
      const words = text.split(' ');
      if (words.length >= 2 && words.length <= 8) {
        score += 20;
      } else if (words.length >= 1 && words.length <= 12) {
        score += 15;
      } else {
        score += 5;
      }
    }
    
    // URL quality (0-10 points)
    if (href && !href.includes('javascript:') && !href.includes('#')) {
      score += 10;
    }
    
    return score;
  }

  // Function to extract links with improved filtering
  function extractLinks(maxLinks = 20) {
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const scoredLinks = [];
    
    allLinks.forEach(link => {
      if (!isExcludedElement(link)) {
        const score = scoreLink(link);
        if (score > 0) {
          scoredLinks.push({
            link: link,
            score: score,
            text: link.textContent.trim(),
            href: link.href,
            title: link.title || ''
          });
        }
      }
    });
    
    // Sort by score and return top links
    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks.slice(0, maxLinks).map(item => ({
      text: item.text,
      href: item.href,
      title: item.title,
      score: item.score
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
                                includeSelection = true, includeContext = true, maxContextLength = 2000,
                                contentFilterOptions = {}) {
    // Merge default config with provided options
    const options = {
      aggressiveMode: false,
      preserveStructure: true,
      maxLinks: 20,
      minContentScore: 30,
      ...contentFilterOptions
    };
    
    // Update config with options
    if (options.aggressiveMode) {
      contentFilterConfig.minTextDensity = 0.15;
      contentFilterConfig.maxLinkDensity = 0.2;
      contentFilterConfig.minTextLength = 30;
    }
    
    const mainContentElements = findMainContentElements();
    const structuredContent = options.preserveStructure && mainContentElements.length > 0
      ? extractStructuredContent(mainContentElements)
      : null;
    
    const context = {
      url: includeUrl ? window.location.href : '',
      title: document.title || '',
      visibleText: includeText ? extractVisibleText() : '',
      structuredContent: structuredContent || null,
      links: includeLinks ? extractLinks(options.maxLinks) : [],
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
        maxContextLength: request.maxContextLength,
        contentFilterOptions: request.contentFilterOptions || {}
      });
      
      try {
        const context = collectBrowserContext(
          request.includeUrl,
          request.includeText,
          request.includeLinks,
          request.includeSelection,
          request.includeContext,
          request.maxContextLength,
          request.contentFilterOptions || {}
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
      
      // Return true to indicate async response
      return true;
    }
    
    console.log('[Content] Unhandled message type:', request.type);
  });

  // Expose function globally for debugging
  window.collectBrowserContext = collectBrowserContext;
})();