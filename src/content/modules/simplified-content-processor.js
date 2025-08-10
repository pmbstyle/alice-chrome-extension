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
        '.form', '.input', '.search', '.filter', '.sort',
        '.overlay', '.popup-overlay', '.notification', '.toast',
        '.loading', '.spinner', '.progress', '.error', '.warning',
        '.skip-link', '.screen-reader-only', '.visually-hidden',
        '.print-only', '.no-print', '.hidden', '.collapsed',
        '.accordion-trigger', '.tab-list', '.tab-panel',
        '[role="button"]', '[role="tab"]', '[role="tablist"]',
        '[aria-hidden="true"]', '[style*="display: none"]',
        '.code-toolbar', '.code-copy', '.line-numbers',
        '.social', '.share-buttons', '.like-button', '.follow-button'
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

        /^(login|signin|register|signup|account|profile)$/i,
        /^(cart|checkout|order|payment|billing)$/i,
        /^(search|filter|sort|view all|show all)$/i,
        /^(home|homepage|main page|back to top)$/i,
        

        /^(click here|here|more|read more|continue|next|prev|previous)$/i,
        /^(download|install|get|try|start|begin)$/i,
        /^(edit|delete|remove|add|create|new)$/i,
        

        /^(share|like|follow|subscribe|join|newsletter)$/i,
        /^(facebook|twitter|instagram|linkedin|youtube|tiktok)$/i,
        /^(contact|about|help|support|faq|terms|privacy|policy)$/i,
        

        /^(loading|error|retry|refresh|reload)$/i,
        /^[\d\s]*$/,
        /^[^\w]*$/,
        /^\s*$/,
        
        /(javascript:|#$|mailto:|tel:)/i,
        /\.(pdf|doc|docx|xls|xlsx|zip|rar|exe)$/i
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
    
    // Smart selection: avoid redundant content
    const selectedElements = this.selectNonOverlappingElements(contentElements.slice(0, 10));
    
    let text = '';
    const elements = [];
    let totalScore = 0;
    
    for (const { element, score } of selectedElements) {
      const elementText = this.extractElementText(element);
      if (elementText.trim().length > 0) {
        const separator = this.getElementSeparator(element, elements.length);
        text += elementText + separator;
        elements.push(element);
        totalScore += score;
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
    } else {
      score -= (this.config.minTextDensity - textDensity) * 30;
    }
    
    const linkDensity = this.calculateLinkDensity(element);
    if (linkDensity > this.config.maxLinkDensity) {
      const excessDensity = linkDensity - this.config.maxLinkDensity;
      score -= Math.min(60, excessDensity * excessDensity * 300);
    }
    
    if (textLength >= 200 && textLength <= 2000) {
      score += 20;
    } else if (textLength > 100) {
      score += 10;
    }
    
    const paragraphs = element.querySelectorAll('p').length;
    if (paragraphs > 0 && textLength > 500) {
      const paragraphRatio = Math.min(textLength / paragraphs / 100, 1);
      score += paragraphRatio * 15;
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
    
    const descriptiveBonus = this.calculateLinkDescriptiveness(text);
    score += descriptiveBonus * 40;
    
    if (text.length >= 15 && text.length <= 40) {
      score += 35;
    } else if (text.length >= 8 && text.length <= 60) {
      score += 25;
    } else {
      score += 10;
    }
    
    const contextScore = this.calculateLinkContext(link);
    score += contextScore;
    
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 6) {
      score += 25;
    } else if (words.length >= 1 && words.length <= 10) {
      score += 15;
    } else {
      score += 5;
    }
    
    const urlScore = this.calculateUrlQuality(href);
    score += urlScore;
    
    if (/^\d+$/.test(text) || text.toLowerCase() === 'link') {
      score -= 30;
    }
    
    return Math.max(0, score);
  }
  
  calculateLinkDescriptiveness(text) {
    const lowerText = text.toLowerCase();
    let descriptiveness = 0;
    
    if (/\b(article|guide|tutorial|review|analysis|study|report|blog|post|news)\b/.test(lowerText)) {
      descriptiveness += 0.4;
    }
    
    if (/\b(detailed|comprehensive|complete|ultimate|essential|important|key|main|primary)\b/.test(lowerText)) {
      descriptiveness += 0.2;
    }
    
    const words = text.split(/\s+/);
    const properNouns = words.filter(word => /^[A-Z][a-z]+/.test(word)).length;
    descriptiveness += Math.min(0.3, properNouns * 0.1);
    
    if (/\b(click|here|more|link|page|site|website|this|that)\b/.test(lowerText)) {
      descriptiveness -= 0.3;
    }
    
    return Math.max(0, Math.min(1, descriptiveness));
  }
  
  calculateLinkContext(link) {
    let contextScore = 0;
    const parent = link.parentElement;
    
    if (!parent) return 0;
    
    const parentTag = parent.tagName.toLowerCase();
    const parentClass = parent.className || '';
    const parentId = parent.id || '';
    
    if (parentTag === 'p' || parentTag === 'article' || parentTag === 'main') {
      contextScore += 50;
    } else if (parentTag === 'section' || parentTag === 'div') {
      if (/content|article|post|story|entry/.test(parentClass) || /content|article/.test(parentId)) {
        contextScore += 45;
      } else {
        contextScore += 25;
      }
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(parentTag)) {
      contextScore += 35;
    } else if (['ul', 'ol', 'li'].includes(parentTag)) {
      contextScore += 30;
    }
    
    if (/nav|menu|sidebar|footer|header|toolbar/.test(parentClass) ||
        /nav|menu|sidebar|footer|header|toolbar/.test(parentId)) {
      contextScore -= 40;
    }
    let current = parent;
    while (current && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const className = current.className || '';
      const id = current.id || '';
      
      if (tag === 'main' || tag === 'article' ||
          /main|content|article|post/.test(className) ||
          /main|content|article|post/.test(id)) {
        contextScore += 20;
        break;
      }
      current = current.parentElement;
    }
    
    return contextScore;
  }
  
  calculateUrlQuality(href) {
    let score = 0;
    
    try {
      const url = new URL(href);
      
      if (url.hostname === window.location.hostname) {
        score -= 5;
      } else {
        score += 10;
      }
      
      const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
      if (pathSegments.length >= 1 && pathSegments.length <= 4) {
        score += 10;
      }
      
      if (url.protocol === 'https:') {
        score += 5;
      }
      
      if (url.search.length > 100 || url.pathname.length > 200) {
        score -= 15;
      }
      
      if (/\.(edu|gov|org)$/.test(url.hostname)) {
        score += 15;
      }
      
    } catch (e) {
      score -= 20;
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
    const { text, wordCount, elements } = content;
    let qualityScore = 0;
    const maxScore = 100;
    
    if (wordCount >= 300) {
      qualityScore += 25;
    } else if (wordCount >= 150) {
      qualityScore += 20;
    } else if (wordCount >= 75) {
      qualityScore += 15;
    } else if (wordCount >= 25) {
      qualityScore += 10;
    }
    
    if (elements && elements.length > 0) {
      const avgScore = elements.reduce((sum, el) => sum + (el.score || 0), 0) / elements.length;
      qualityScore += Math.min(25, avgScore / 4);
    }
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 3) {
      qualityScore += 10;
      
      const avgSentenceLength = wordCount / sentences.length;
      if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
        qualityScore += 10;
      } else if (avgSentenceLength >= 5) {
        qualityScore += 5;
      }
    }
    
    const coherenceScore = this.calculateTextCoherence(text);
    qualityScore += coherenceScore * 15;
    
    const infoScore = this.calculateInformationDensity(text);
    qualityScore += infoScore * 15;
    
    const qualityRatio = qualityScore / maxScore;
    if (qualityRatio >= 0.8) {
      return 'excellent';
    } else if (qualityRatio >= 0.65) {
      return 'high';
    } else if (qualityRatio >= 0.4) {
      return 'medium';
    } else if (qualityRatio >= 0.2) {
      return 'low';
    } else {
      return 'poor';
    }
  }
  
  calculateTextCoherence(text) {
    if (!text || text.length < 100) return 0;
    
    const transitionWords = [
      'however', 'therefore', 'moreover', 'furthermore', 'additionally',
      'consequently', 'thus', 'hence', 'meanwhile', 'similarly',
      'in contrast', 'on the other hand', 'for example', 'specifically',
      'in particular', 'as a result', 'due to', 'because of'
    ];
    
    const lowerText = text.toLowerCase();
    const foundTransitions = transitionWords.filter(word => lowerText.includes(word)).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
    
    return Math.min(1, foundTransitions / Math.max(sentences * 0.2, 1));
  }
  
  calculateInformationDensity(text) {
    if (!text || text.length < 50) return 0;
    
    let infoElements = 0;
    
    infoElements += (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length * 0.5;
    
    const words = text.split(/\s+/);
    let properNouns = 0;
    for (let i = 1; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      if (word.length > 2 && word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
        properNouns++;
      }
    }
    infoElements += properNouns * 0.3;
    
    const longWords = words.filter(word => word.length > 6).length;
    infoElements += longWords * 0.2;
    
    infoElements += (text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi) || []).length;
    
    return Math.min(1, infoElements / Math.max(words.length * 0.1, 1));
  }
  
  selectNonOverlappingElements(candidates) {
    if (candidates.length <= 1) return candidates;
    
    const selected = [];
    const maxElements = 5;
    
    for (const candidate of candidates) {
      if (selected.length >= maxElements) break;
      
      const hasOverlap = selected.some(selected => 
        this.elementsOverlap(candidate.element, selected.element)
      );
      
      if (!hasOverlap) {
        selected.push(candidate);
      }
    }
    
    return selected.length > 0 ? selected : candidates.slice(0, 1);
  }
  
  elementsOverlap(element1, element2) {
    if (element1.contains(element2) || element2.contains(element1)) {
      return true;
    }
    
    const text1 = element1.textContent.trim();
    const text2 = element2.textContent.trim();
    
    if (text1.length < 50 || text2.length < 50) return false;
    
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length >= text2.length ? text1 : text2;
    
    const sampleLength = Math.min(shorter.length, 200);
    const sample = shorter.substring(0, sampleLength);
    
    return longer.includes(sample);
  }
  
  getElementSeparator(element, elementIndex) {
    const tagName = element.tagName.toLowerCase();
    
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      return '\n\n';
    } else if (tagName === 'article' || tagName === 'section') {
      return '\n\n---\n\n';
    } else if (tagName === 'p' || tagName === 'div') {
      return '\n\n';
    } else if (['ul', 'ol', 'dl'].includes(tagName)) {
      return '\n\n';
    } else {
      return elementIndex === 0 ? '' : '\n\n';
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