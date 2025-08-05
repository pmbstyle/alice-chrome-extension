/**
 * Simplified content processor for LLM-optimized browser context extraction
 * Consolidates content filtering, link extraction, and selection management
 */

import { getMemoryManager, createMemoryEfficientScanner } from '../../shared/utils/memory-manager.js';
import { getTextSummarizer } from '../../shared/utils/text-summarizer.js';
import { getSemanticChunker } from '../../shared/utils/semantic-chunker.js';
import { getMetadataEnricher } from '../../shared/utils/metadata-enricher.js';

/**
 * Simplified content processor class
 */
export class SimplifiedContentProcessor {
  /**
   * Create a new SimplifiedContentProcessor
   */
  constructor() {
    // Aggressive filtering configuration for LLM optimization
    this.config = {
      // Elements to exclude from content extraction
      excludedSelectors: [
        'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
        '.menu', '.nav', '.navbar', '.breadcrumb', '.pagination',
        '.ads', '.advertisement', '.social-share', '.comments',
        '.related', '.recommended', '.newsletter', '.subscribe',
        '.cookie-notice', '.popup', '.modal', '.banner', '.widget',
        'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
        '.toolbar', '.toolbar-item', '.button', '.btn', '.action',
        '.form', '.input', '.search', '.filter', '.sort'
      ],
      
      // Elements that likely contain main content
      contentSelectors: [
        'article', 'main', '[role="main"]', '.content', '.main-content',
        '.article', '.post', '.story', '.entry', '.text-content',
        '.prose', '.markdown', '.documentation', '.guide', '.content-body'
      ],
      
      // Aggressive filtering thresholds for LLM optimization
      minTextDensity: 0.4,  // Increased from 0.25
      maxLinkDensity: 0.2,  // Decreased from 0.3
      minTextLength: 100,   // Increased from 50
      
      // Link filtering
      maxLinks: 10,         // Reduced from 20
      minLinkTextLength: 5, // Increased from 3
      maxLinkTextLength: 80, // Decreased from 100
      excludedLinkPatterns: [
        /login/i, /signin/i, /register/i, /signup/i, /account/i,
        /cart/i, /checkout/i, /search/i, /home/i, /back to top/i,
        /privacy/i, /terms/i, /contact/i, /about/i, /help/i,
        /support/i, /faq/i, /rss/i, /feed/i, /newsletter/i,
        /subscribe/i, /follow/i, /like/i, /share/i, /tweet/i,
        /facebook/i, /twitter/i, /instagram/i, /linkedin/i,
        /click/i, /here/i, /more/i, /read more/i, /continue/i
      ]
    };
    
    // Get memory manager instance
    this.memoryManager = getMemoryManager();
    
    // Get text summarizer instance
    this.textSummarizer = getTextSummarizer();
    
    // Get semantic chunker instance
    this.semanticChunker = getSemanticChunker();
    
    // Get metadata enricher instance
    this.metadataEnricher = getMetadataEnricher();
    
    // Cache for processed content (using memory manager)
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Initialize the content processor
   */
  init() {
    // Set up mutation observer for cache invalidation
    this.setupMutationObserver();
  }

  /**
   * Set up mutation observer to invalidate cache when DOM changes
   */
  setupMutationObserver() {
    if (typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(() => {
        this.invalidateCache();
      });
      
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      
      // Register observer with memory manager
      this.memoryManager.registerObserver(this.observer);
    }
  }

  /**
   * Extract simplified browser context
   * @param {Object} options - Extraction options
   * @returns {Object} Simplified browser context
   */
  extractContext(options = {}) {
    const {
      format = 'text',        // 'text', 'structured', or 'both'
      maxTokens = 2000,       // Maximum tokens for content
      includeLinks = true,    // Whether to include links
      includeSelection = true // Whether to include selection
    } = options;

    // Check cache first using memory manager
    const cacheKey = this.getCacheKey(options);
    const cached = this.memoryManager.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // Extract content
    const context = {
      url: window.location.href,
      title: document.title || '',
      content: '',
      links: [],
      selection: '',
      metadata: {
        wordCount: 0,
        readingTime: '',
        contentQuality: 'medium',
        format: format
      }
    };

    // Extract main content
    const mainContent = this.extractMainContent(maxTokens);
    context.content = mainContent.text;
    context.metadata.wordCount = mainContent.wordCount;
    context.metadata.readingTime = this.calculateReadingTime(mainContent.wordCount);
    context.metadata.contentQuality = this.assessContentQuality(mainContent);

    // Extract links if requested
    if (includeLinks) {
      context.links = this.extractRelevantLinks();
    }

    // Extract selection if requested
    if (includeSelection) {
      context.selection = this.extractSelection();
    }

    // Cache the result using memory manager
    this.memoryManager.cacheData(cacheKey, context, this.cacheTimeout);

    return context;
  }

  /**
   * Extract main content with aggressive filtering
   * @param {number} maxTokens - Maximum tokens for content
   * @returns {Object} Extracted content with metadata
   */
  extractMainContent(maxTokens) {
    const contentElements = this.findContentElements();
    
    if (contentElements.length === 0) {
      return {
        text: '',
        wordCount: 0,
        elements: []
      };
    }

    // Sort by score and take top elements
    contentElements.sort((a, b) => b.score - a.score);
    const topElements = contentElements.slice(0, 5); // Reduced from 10

    // Extract and concatenate text
    let text = '';
    const elements = [];
    
    for (const { element } of topElements) {
      const elementText = this.extractElementText(element);
      if (elementText.trim().length > 0) {
        text += elementText + '\n\n';
        elements.push(element);
      }
    }

    // Trim to max tokens (approximate: 1 token ≈ 4 characters)
    const maxChars = maxTokens * 4;
    if (text.length > maxChars) {
      // Use text summarizer for long content
      const summaryResult = this.textSummarizer.summarize(text, {
        maxLength: maxChars,
        ratio: 0.3, // Target 30% of original length
        preserveStructure: true
      });
      
      text = summaryResult.summary;
      
      // If summary is still too long, truncate
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
        // Try to end at a sentence boundary
        const lastSentenceEnd = Math.max(
          text.lastIndexOf('.'),
          text.lastIndexOf('!'),
          text.lastIndexOf('?')
        );
        if (lastSentenceEnd > maxChars * 0.8) {
          text = text.substring(0, lastSentenceEnd + 1);
        }
      }
    }

    return {
      text: text.trim(),
      wordCount: this.countWords(text),
      elements: elements,
      summary: text.length < maxChars ? null : {
        originalLength: text.length,
        summaryLength: text.length,
        reductionRatio: 1 - (text.length / maxChars),
        method: 'extractive'
      }
    };
  }

  /**
   * Find content elements with scoring
   * @returns {Array} Scored content elements
   */
  findContentElements() {
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

    // If no content selectors found, scan major elements with higher threshold
    if (candidates.length === 0) {
      const majorElements = document.querySelectorAll('div, section, article, main, p, h1, h2, h3, h4, h5, h6');
      majorElements.forEach(element => {
        if (!this.isExcludedElement(element)) {
          const score = this.scoreContentElement(element);
          if (score > 50) { // Higher threshold for general scanning
            candidates.push({ element, score });
          }
        }
      });
    }

    return candidates;
  }

  /**
   * Check if an element should be excluded
   * @param {Element} element - Element to check
   * @returns {boolean} True if element should be excluded
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
        parseFloat(style.fontSize) < 10) { // Increased from 8
      return true;
    }
    
    return false;
  }

  /**
   * Score a content element
   * @param {Element} element - Element to score
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
    
    // Link density penalty (0-40 points)
    const linkDensity = this.calculateLinkDensity(element);
    if (linkDensity > this.config.maxLinkDensity) {
      score -= Math.min(40, (linkDensity - this.config.maxLinkDensity) * 200);
    }
    
    // Element type score (0-30 points)
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
      score += 30;
    }
    
    // Medium-value content elements
    else if (tagName === 'main' ||
             tagName === 'section' ||
             className.includes('text') ||
             className.includes('body') ||
             className.includes('story')) {
      score += 20;
    }
    
    // Low-value elements
    else if (tagName === 'div' || tagName === 'span') {
      score += 10;
    }
    
    // Heading bonus
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      score += 20;
    }
    
    // Paragraph bonus
    if (tagName === 'p') {
      score += 15;
    }
    
    // List bonus
    if (tagName === 'ul' || tagName === 'ol' || tagName === 'dl') {
      score += 12;
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate text density of an element
   * @param {Element} element - Element to analyze
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
   * @param {Element} element - Element to analyze
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
   * Extract clean text from an element
   * @param {Element} element - Element to extract text from
   * @returns {string} Clean text
   */
  extractElementText(element) {
    let text = '';
    
    // Create a tree walker that only accepts text nodes and non-excluded elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip if parent is an excluded element
          if (parent.tagName.toLowerCase() === 'script' ||
              parent.tagName.toLowerCase() === 'style' ||
              parent.tagName.toLowerCase() === 'noscript') {
            return NodeFilter.FILTER_REJECT;
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

  /**
   * Extract relevant links
   * @returns {Array} Relevant links
   */
  extractRelevantLinks() {
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
            href: link.href
          });
        }
      }
    });
    
    // Sort by score and return top links
    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks.slice(0, this.config.maxLinks).map(item => ({
      text: item.text,
      href: item.href
    }));
  }

  /**
   * Score a link for relevance
   * @param {Element} link - Link element to score
   * @returns {number} Link score
   */
  scoreLink(link) {
    let score = 0;
    const text = link.textContent.trim();
    const href = link.href;
    
    // Skip if text is too short or too long
    if (text.length < this.config.minLinkTextLength ||
        text.length > this.config.maxLinkTextLength) {
      return 0;
    }
    
    // Check excluded patterns
    for (const pattern of this.config.excludedLinkPatterns) {
      if (pattern.test(text) || pattern.test(href)) {
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
    
    // Context relevance score (0-50 points)
    const parent = link.parentElement;
    if (parent) {
      const parentTag = parent.tagName.toLowerCase();
      const parentClass = parent.className || '';
      
      // Links in content areas are more valuable
      if (parentTag === 'p' || parentTag === 'article' || parentTag === 'main') {
        score += 50;
      } else if (parentTag === 'section' || parentTag === 'div') {
        if (parentClass.includes('content') || parentClass.includes('article')) {
          score += 40;
        } else {
          score += 20;
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
    
    return score;
  }

  /**
   * Extract user selection
   * @returns {string} Selected text
   */
  extractSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return '';
    }
    
    return selection.toString().trim();
  }

  /**
   * Count words in text
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate reading time
   * @param {number} wordCount - Word count
   * @returns {string} Reading time estimate
   */
  calculateReadingTime(wordCount) {
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    
    if (minutes < 1) {
      return '< 1 min';
    } else if (minutes === 1) {
      return '1 min';
    } else {
      return `${minutes} min`;
    }
  }

  /**
   * Assess content quality
   * @param {Object} content - Extracted content
   * @returns {string} Quality assessment
   */
  assessContentQuality(content) {
    const { wordCount, elements } = content;
    
    if (wordCount < 50) {
      return 'low';
    } else if (wordCount < 200) {
      return 'medium';
    } else if (elements.length > 0 && elements[0].score > 80) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  /**
   * Generate cache key for options
   * @param {Object} options - Extraction options
   * @returns {string} Cache key
   */
  getCacheKey(options) {
    return JSON.stringify({
      url: window.location.href,
      options: options
    });
  }

  /**
   * Get semantically chunked content
   * @param {string} text - Text to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks with metadata
   */
  getSemanticChunks(text, options = {}) {
    const {
      maxChunkSize = 1000,
      minChunkSize = 100,
      overlapSize = 50,
      preserveStructure = true
    } = options;

    return this.semanticChunker.chunkText(text, {
      maxSize: maxChunkSize,
      minSize: minChunkSize,
      overlap: overlapSize,
      preserveStructure: preserveStructure,
      includeMetadata: true
    });
  }

  /**
   * Get content with semantic chunks
   * @param {Object} options - Processing options
   * @returns {Object} Content with semantic chunks
   */
  getContentWithSemanticChunks(options = {}) {
    const {
      maxTokens = 2000,
      enableChunking = true,
      chunkOptions = {}
    } = options;

    const content = this.extractMainContent(maxTokens);
    
    if (!enableChunking || content.text.length <= 1000) {
      return {
        ...content,
        chunks: []
      };
    }

    const chunks = this.getSemanticChunks(content.text, chunkOptions);
    
    return {
      ...content,
      chunks,
      chunkingInfo: {
        totalChunks: chunks.length,
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length,
        totalTokens: chunks.reduce((sum, chunk) => sum + (chunk.metadata?.estimatedTokens || 0), 0),
        overlapSize: chunkOptions.overlapSize || 0
      }
    };
  }

  /**
   * Invalidate content cache
   */
  invalidateCache() {
    this.memoryManager.clearAllCache();
  }

  /**
   * Get content with enriched metadata
   * @param {Object} options - Processing options
   * @returns {Object} Content with enriched metadata
   */
  getContentWithMetadata(options = {}) {
    const {
      maxTokens = 2000,
      enableQualityAssessment = true,
      enableContentTypeDetection = true,
      enableReadingLevelAnalysis = true,
      enableStructureAnalysis = true,
      customMetadata = {}
    } = options;

    // Get base content
    const content = this.extractMainContent(maxTokens);
    
    // Enrich with metadata
    const enrichedContent = this.metadataEnricher.enrichContent(content, {
      enableQualityAssessment,
      enableContentTypeDetection,
      enableReadingLevelAnalysis,
      enableStructureAnalysis,
      customMetadata
    });
    
    return enrichedContent;
  }

  /**
   * Get content quality assessment only
   * @param {Object} options - Processing options
   * @returns {Object} Quality assessment
   */
  getContentQualityAssessment(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.assessContentQuality(content);
  }

  /**
   * Get content type detection only
   * @param {Object} options - Processing options
   * @returns {Object} Content type detection
   */
  getContentTypeDetection(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.detectContentType(content);
  }

  /**
   * Get reading level analysis only
   * @param {Object} options - Processing options
   * @returns {Object} Reading level analysis
   */
  getReadingLevelAnalysis(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.analyzeReadingLevel(content.text || '');
  }

  /**
   * Get content structure analysis only
   * @param {Object} options - Processing options
   * @returns {Object} Structure analysis
   */
  getContentStructureAnalysis(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.analyzeContentStructure(content);
  }

  /**
   * Destroy the content processor and clean up resources
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.invalidateCache();
  }
}

// Create a singleton instance
let contentProcessorInstance = null;

/**
 * Get the singleton content processor instance
 * @returns {SimplifiedContentProcessor} The content processor instance
 */
export function getSimplifiedContentProcessor() {
  if (!contentProcessorInstance) {
    contentProcessorInstance = new SimplifiedContentProcessor();
  }
  return contentProcessorInstance;
}