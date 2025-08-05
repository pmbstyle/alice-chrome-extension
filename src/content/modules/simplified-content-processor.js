import { getMemoryManager, createMemoryEfficientScanner } from '../../shared/utils/memory-manager.js';
import { getTextSummarizer } from '../../shared/utils/text-summarizer.js';
import { getSemanticChunker } from '../../shared/utils/semantic-chunker.js';
import { getMetadataEnricher } from '../../shared/utils/metadata-enricher.js';

export class SimplifiedContentProcessor {
  constructor() {
    this.config = {
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
      
      contentSelectors: [
        'article', 'main', '[role="main"]', '.content', '.main-content',
        '.article', '.post', '.story', '.entry', '.text-content',
        '.prose', '.markdown', '.documentation', '.guide', '.content-body'
      ],
      
      minTextDensity: 0.4,
      maxLinkDensity: 0.2,
      minTextLength: 100,
      
      maxLinks: 10,
      minLinkTextLength: 5,
      maxLinkTextLength: 80,
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
    
    this.memoryManager = getMemoryManager();
    
    this.textSummarizer = getTextSummarizer();
    
    this.semanticChunker = getSemanticChunker();
    
    this.metadataEnricher = getMetadataEnricher();
    
    this.cacheTimeout = 30000;
  }

  init() {
    this.setupMutationObserver();
  }

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
      
      this.memoryManager.registerObserver(this.observer);
    }
  }

  extractContext(options = {}) {
    const {
      format = 'text',
      maxTokens = 2000,
      includeLinks = true,
      includeSelection = true
    } = options;

    const cacheKey = this.getCacheKey(options);
    const cached = this.memoryManager.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

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

    const mainContent = this.extractMainContent(maxTokens);
    context.content = mainContent.text;
    context.metadata.wordCount = mainContent.wordCount;
    context.metadata.readingTime = this.calculateReadingTime(mainContent.wordCount);
    context.metadata.contentQuality = this.assessContentQuality(mainContent);

    if (includeLinks) {
      context.links = this.extractRelevantLinks();
    }

    if (includeSelection) {
      context.selection = this.extractSelection();
    }

    this.memoryManager.cacheData(cacheKey, context, this.cacheTimeout);

    return context;
  }

  extractMainContent(maxTokens) {
    const contentElements = this.findContentElements();
    
    if (contentElements.length === 0) {
      return {
        text: '',
        wordCount: 0,
        elements: []
      };
    }

    contentElements.sort((a, b) => b.score - a.score);
    const topElements = contentElements.slice(0, 5);

    let text = '';
    const elements = [];
    
    for (const { element } of topElements) {
      const elementText = this.extractElementText(element);
      if (elementText.trim().length > 0) {
        text += elementText + '\n\n';
        elements.push(element);
      }
    }

    const maxChars = maxTokens * 4;
    if (text.length > maxChars) {
      const summaryResult = this.textSummarizer.summarize(text, {
        maxLength: maxChars,
        ratio: 0.3,
        preserveStructure: true
      });
      
      text = summaryResult.summary;
      
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
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

  findContentElements() {
    const candidates = [];

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

    if (candidates.length === 0) {
      const majorElements = document.querySelectorAll('div, section, article, main, p, h1, h2, h3, h4, h5, h6');
      majorElements.forEach(element => {
        if (!this.isExcludedElement(element)) {
          const score = this.scoreContentElement(element);
          if (score > 50) {
            candidates.push({ element, score });
          }
        }
      });
    }

    return candidates;
  }

  isExcludedElement(element) {
    if (!element || !element.parentElement) return true;
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    for (const selector of this.config.excludedSelectors) {
      if (element.matches(selector) ||
          element.parentElement.matches(selector) ||
          className.includes(selector.replace('.', '')) ||
          id.includes(selector.replace('#', ''))) {
        return true;
      }
    }
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        parseFloat(style.fontSize) < 10) {
      return true;
    }
    
    return false;
  }

  scoreContentElement(element) {
    let score = 0;
    const text = element.textContent || '';
    const textLength = text.trim().length;
    
    if (textLength < this.config.minTextLength) {
      return 0;
    }
    
    const textDensity = this.calculateTextDensity(element);
    if (textDensity >= this.config.minTextDensity) {
      score += Math.min(50, textDensity * 100);
    }
    
    const linkDensity = this.calculateLinkDensity(element);
    if (linkDensity > this.config.maxLinkDensity) {
      score -= Math.min(40, (linkDensity - this.config.maxLinkDensity) * 200);
    }
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
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
    
    else if (tagName === 'main' ||
             tagName === 'section' ||
             className.includes('text') ||
             className.includes('body') ||
             className.includes('story')) {
      score += 20;
    }
    
    else if (tagName === 'div' || tagName === 'span') {
      score += 10;
    }
    
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      score += 20;
    }
    
    if (tagName === 'p') {
      score += 15;
    }
    
    if (tagName === 'ul' || tagName === 'ol' || tagName === 'dl') {
      score += 12;
    }
    
    return Math.max(0, score);
  }

  calculateTextDensity(element) {
    const text = element.textContent || '';
    const textLength = text.trim().length;
    const totalLength = element.innerHTML.length;
    
    return totalLength > 0 ? textLength / totalLength : 0;
  }

  calculateLinkDensity(element) {
    const text = element.textContent || '';
    const links = element.querySelectorAll('a');
    let linkTextLength = 0;
    
    links.forEach(link => {
      linkTextLength += link.textContent.length;
    });
    
    return text.length > 0 ? linkTextLength / text.length : 0;
  }

  extractElementText(element) {
    let text = '';
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
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
    
    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks.slice(0, this.config.maxLinks).map(item => ({
      text: item.text,
      href: item.href
    }));
  }

  scoreLink(link) {
    let score = 0;
    const text = link.textContent.trim();
    const href = link.href;
    
    if (text.length < this.config.minLinkTextLength ||
        text.length > this.config.maxLinkTextLength) {
      return 0;
    }
    
    for (const pattern of this.config.excludedLinkPatterns) {
      if (pattern.test(text) || pattern.test(href)) {
        return 0;
      }
    }
    
    if (text.length >= 10 && text.length <= 50) {
      score += 30;
    } else if (text.length >= 5 && text.length <= 80) {
      score += 20;
    } else {
      score += 10;
    }
    
    const parent = link.parentElement;
    if (parent) {
      const parentTag = parent.tagName.toLowerCase();
      const parentClass = parent.className || '';
      
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
    
    if (text.length > 0) {
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

  extractSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return '';
    }
    
    return selection.toString().trim();
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

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

  getCacheKey(options) {
    return JSON.stringify({
      url: window.location.href,
      options: options
    });
  }

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

  invalidateCache() {
    this.memoryManager.clearAllCache();
  }

  getContentWithMetadata(options = {}) {
    const {
      maxTokens = 2000,
      enableQualityAssessment = true,
      enableContentTypeDetection = true,
      enableReadingLevelAnalysis = true,
      enableStructureAnalysis = true,
      customMetadata = {}
    } = options;

    const content = this.extractMainContent(maxTokens);
    
    const enrichedContent = this.metadataEnricher.enrichContent(content, {
      enableQualityAssessment,
      enableContentTypeDetection,
      enableReadingLevelAnalysis,
      enableStructureAnalysis,
      customMetadata
    });
    
    return enrichedContent;
  }

  getContentQualityAssessment(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.assessContentQuality(content);
  }

  getContentTypeDetection(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.detectContentType(content);
  }

  getReadingLevelAnalysis(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.analyzeReadingLevel(content.text || '');
  }

  getContentStructureAnalysis(options = {}) {
    const { maxTokens = 2000 } = options;
    const content = this.extractMainContent(maxTokens);
    
    return this.metadataEnricher.analyzeContentStructure(content);
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.invalidateCache();
  }
}

let contentProcessorInstance = null;

export function getSimplifiedContentProcessor() {
  if (!contentProcessorInstance) {
    contentProcessorInstance = new SimplifiedContentProcessor();
  }
  return contentProcessorInstance;
}