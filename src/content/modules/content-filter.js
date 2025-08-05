/**
 * Content filter module for the content script
 * Handles intelligent content filtering and extraction
 */

/**
 * Content filter class
 */
export class ContentFilter {
  /**
   * Create a new ContentFilter
   * @param {Object} config - Content filter configuration
   */
  constructor(config = {}) {
    this.config = {
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
      ],
      
      // Options
      aggressiveMode: false,
      preserveStructure: true,
      minContentScore: 30,
      
      ...config
    };
    
    this.originalConfig = { ...this.config };
  }

  /**
   * Initialize the content filter
   */
  init() {
    // Nothing to initialize for now
  }

  /**
   * Check if an element should be excluded
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element should be excluded
   */
  isExcludedElement(element) {
    if (!element || !element.parentElement) return true;
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    // Check excluded selectors
    for (const selector of this.config.excludedSelectors) {
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

  /**
   * Calculate text density of an element
   * @param {Element} element - The element to analyze
   * @returns {number} Text density ratio
   */
  calculateTextDensity(element) {
    const text = element.textContent || '';
    const textLength = text.trim().length;
    const totalLength = element.innerHTML.length;
    
    return totalLength > 0 ? textLength / totalLength : 0;
  }

  /**
   * Calculate link density of an element
   * @param {Element} element - The element to analyze
   * @returns {number} Link density ratio
   */
  calculateLinkDensity(element) {
    const text = element.textContent || '';
    const links = element.querySelectorAll('a');
    let linkTextLength = 0;
    
    links.forEach(link => {
      linkTextLength += link.textContent.length;
    });
    
    return text.length > 0 ? linkTextLength / text.length : 0;
  }

  /**
   * Score content elements based on various criteria
   * @param {Element} element - The element to score
   * @returns {number} Content score
   */
  scoreContentElement(element) {
    let score = 0;
    const text = element.textContent || '';
    const textLength = text.trim().length;
    
    // Skip if text is too short
    if (textLength < this.config.minTextLength) {
      return 0;
    }
    
    // Text density score (0-50 points)
    const textDensity = this.calculateTextDensity(element);
    if (textDensity >= this.config.minTextDensity) {
      score += Math.min(50, textDensity * 100);
    }
    
    // Link density penalty (0-30 points)
    const linkDensity = this.calculateLinkDensity(element);
    if (linkDensity > this.config.maxLinkDensity) {
      score -= Math.min(30, (linkDensity - this.config.maxLinkDensity) * 100);
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

  /**
   * Find main content elements on the page
   * @returns {Array} Array of scored content elements
   */
  findMainContentElements() {
    const candidates = [];
    
    // Start with content selectors
    for (const selector of this.config.contentSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (!this.isExcludedElement(element)) {
          const score = this.scoreContentElement(element);
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
        if (!this.isExcludedElement(element)) {
          const score = this.scoreContentElement(element);
          if (score > this.config.minContentScore) { // Higher threshold for general scanning
            candidates.push({ element, score });
          }
        }
      });
    }
    
    // Sort by score and return top elements
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10); // Top 10 candidates
  }

  /**
   * Extract structured content from elements
   * @param {Array} elements - Array of scored elements
   * @returns {Object} Structured content object
   */
  extractStructuredContent(elements) {
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
      if (this.isExcludedElement(element)) {
        return;
      }
      
      // Skip style, script, and noscript elements
      if (tagName === 'style' || tagName === 'script' || tagName === 'noscript') {
        return;
      }
      
      // Extract text content, filtering out excluded child elements
      const cleanText = this.extractCleanText(element);
      
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
            .filter(li => !this.isExcludedElement(li))
            .map(li => this.extractCleanText(li).trim())
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

  /**
   * Extract clean text from an element, excluding excluded children
   * @param {Element} element - The element to extract text from
   * @returns {string} Clean text content
   */
  extractCleanText(element) {
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
          if (this.isExcludedElement(parent)) {
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
            if (this.isExcludedElement(ancestor)) {
              return NodeFilter.FILTER_REJECT;
            }
            const ancestorTag = ancestor.tagName.toLowerCase();
            if (ancestorTag === 'style' || ancestorTag === 'script' || ancestorTag === 'noscript') {
              return NodeFilter.FILTER_REJECT;
            }
            ancestor = ancestor.parentElement;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }.bind(this)
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

  /**
   * Extract visible text from the page
   * @returns {string} Extracted text content
   */
  extractVisibleText() {
    const mainContentElements = this.findMainContentElements();
    
    if (mainContentElements.length === 0) {
      // Fallback to original method if no content found
      return this.extractVisibleTextFallback();
    }
    
    const structuredContent = this.extractStructuredContent(mainContentElements);
    return structuredContent.text.trim();
  }

  /**
   * Fallback function for text extraction
   * @returns {string} Extracted text content
   */
  extractVisibleTextFallback() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Check if parent is excluded
          if (this.isExcludedElement(parent)) {
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
            if (this.isExcludedElement(ancestor)) {
              return NodeFilter.FILTER_REJECT;
            }
            const ancestorTag = ancestor.tagName.toLowerCase();
            if (ancestorTag === 'style' || ancestorTag === 'script' || ancestorTag === 'noscript') {
              return NodeFilter.FILTER_REJECT;
            }
            ancestor = ancestor.parentElement;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }.bind(this)
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

  /**
   * Set aggressive mode
   * @param {boolean} enabled - Whether to enable aggressive mode
   */
  setAggressiveMode(enabled) {
    this.config.aggressiveMode = enabled;
    
    if (enabled) {
      this.config.minTextDensity = 0.15;
      this.config.maxLinkDensity = 0.2;
      this.config.minTextLength = 30;
    } else {
      this.config.minTextDensity = this.originalConfig.minTextDensity;
      this.config.maxLinkDensity = this.originalConfig.maxLinkDensity;
      this.config.minTextLength = this.originalConfig.minTextLength;
    }
  }

  /**
   * Set preserve structure option
   * @param {boolean} preserve - Whether to preserve structure
   */
  setPreserveStructure(preserve) {
    this.config.preserveStructure = preserve;
  }

  /**
   * Set minimum content score
   * @param {number} score - Minimum content score
   */
  setMinContentScore(score) {
    this.config.minContentScore = score;
  }

  /**
   * Get preserve structure option
   * @returns {boolean} Whether structure preservation is enabled
   */
  getPreserveStructure() {
    return this.config.preserveStructure;
  }

  /**
   * Get content filter statistics
   * @returns {Object} Content filter statistics
   */
  getStats() {
    return {
      config: this.config,
      aggressiveMode: this.config.aggressiveMode,
      preserveStructure: this.config.preserveStructure,
      minContentScore: this.config.minContentScore
    };
  }

  /**
   * Destroy the content filter and clean up resources
   */
  destroy() {
    // Nothing to clean up for now
  }
}