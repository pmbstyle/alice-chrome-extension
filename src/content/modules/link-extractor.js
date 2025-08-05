/**
 * Link extractor module for the content script
 * Handles intelligent link extraction and scoring
 */

/**
 * Link extractor class
 */
export class LinkExtractor {
  /**
   * Create a new LinkExtractor
   * @param {Object} config - Link extractor configuration
   */
  constructor(config = {}) {
    this.config = {
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
      
      // Elements to exclude from link extraction
      excludedSelectors: [
        'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
        '.menu', '.nav', '.navbar', '.breadcrumb', '.pagination',
        '.ads', '.advertisement', '.social-share', '.comments',
        '.related', '.recommended', '.newsletter', '.subscribe',
        '.cookie-notice', '.popup', '.modal', '.banner', '.widget'
      ],
      
      // Maximum number of links to extract
      maxLinks: 20,
      
      ...config
    };
    
    this.originalConfig = { ...this.config };
  }

  /**
   * Initialize the link extractor
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
   * Score a link for relevance
   * @param {HTMLAnchorElement} link - The link to score
   * @returns {number} Link score
   */
  scoreLink(link) {
    let score = 0;
    const text = link.textContent.trim();
    const href = link.href;
    const title = link.title || '';
    
    // Skip if text is too short or too long
    if (text.length < this.config.minLinkTextLength ||
        text.length > this.config.maxLinkTextLength) {
      return 0;
    }
    
    // Check excluded patterns
    for (const pattern of this.config.excludedLinkPatterns) {
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

  /**
   * Extract links with improved filtering
   * @param {number} [maxLinks] - Maximum number of links to extract (uses config default if not provided)
   * @returns {Array} Array of scored and filtered links
   */
  extractLinks(maxLinks) {
    const limit = maxLinks !== undefined ? maxLinks : this.config.maxLinks;
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const scoredLinks = [];
    
    allLinks.forEach(link => {
      if (!this.isExcludedElement(link)) {
        const score = this.scoreLink(link);
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
    return scoredLinks.slice(0, limit).map(item => ({
      text: item.text,
      href: item.href,
      title: item.title,
      score: item.score
    }));
  }

  /**
   * Set maximum number of links to extract
   * @param {number} maxLinks - Maximum number of links
   */
  setMaxLinks(maxLinks) {
    this.config.maxLinks = maxLinks;
  }

  /**
   * Get link extractor statistics
   * @returns {Object} Link extractor statistics
   */
  getStats() {
    return {
      config: this.config,
      maxLinks: this.config.maxLinks
    };
  }

  /**
   * Destroy the link extractor and clean up resources
   */
  destroy() {
    // Nothing to clean up for now
  }
}