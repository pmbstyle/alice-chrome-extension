/**
 * Text summarization utility for LLM-optimized Chrome Extension
 * Provides automatic text summarization for long content
 */

/**
 * Text summarizer class for condensing long content
 */
export class TextSummarizer {
  /**
   * Create a new TextSummarizer
   */
  constructor() {
    this.config = {
      // Summary length targets
      minSummaryLength: 100,
      maxSummaryLength: 500,
      targetSummaryRatio: 0.3, // Target 30% of original length
      
      // Scoring thresholds
      minSentenceScore: 0.1,
      maxSentences: 5,
      
      // Importance factors
      titleWeight: 3.0,
      headingWeight: 2.5,
      firstSentenceWeight: 1.5,
      lastSentenceWeight: 1.2,
      keywordWeight: 1.0,
      
      // Content quality indicators
      minWordsPerSentence: 5,
      maxWordsPerSentence: 50,
      
      // Common stop words to filter out
      stopWords: new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'were', 'will', 'with', 'i', 'you', 'your', 'they',
        'this', 'that', 'these', 'those', 'am', 'been', 'being', 'have',
        'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would',
        'may', 'might', 'must', 'shall', 'here', 'there', 'when', 'where',
        'why', 'how', 'what', 'which', 'who', 'whom', 'whose'
      ])
    };
  }

  /**
   * Summarize text content
   * @param {string} text - Text to summarize
   * @param {Object} options - Summarization options
   * @returns {Object} Summary result
   */
  summarize(text, options = {}) {
    const {
      maxLength = this.config.maxSummaryLength,
      minLength = this.config.minSummaryLength,
      ratio = this.config.targetSummaryRatio,
      preserveStructure = true
    } = options;

    if (!text || text.trim().length === 0) {
      return {
        summary: '',
        originalLength: 0,
        summaryLength: 0,
        reductionRatio: 0,
        sentences: [],
        method: 'empty'
      };
    }

    // If text is already short, return as-is
    if (text.length <= maxLength) {
      return {
        summary: text,
        originalLength: text.length,
        summaryLength: text.length,
        reductionRatio: 0,
        sentences: this.extractSentences(text),
        method: 'no_summary_needed'
      };
    }

    // Extract sentences
    const sentences = this.extractSentences(text);
    
    if (sentences.length === 0) {
      return {
        summary: text.substring(0, maxLength),
        originalLength: text.length,
        summaryLength: Math.min(maxLength, text.length),
        reductionRatio: 1 - (Math.min(maxLength, text.length) / text.length),
        sentences: [],
        method: 'truncated'
      };
    }

    // Score sentences
    const scoredSentences = this.scoreSentences(sentences, text);

    // Select top sentences
    const selectedSentences = this.selectTopSentences(scoredSentences, {
      maxLength,
      minLength,
      ratio,
      preserveStructure
    });

    // Generate summary
    const summary = this.generateSummary(selectedSentences, preserveStructure);

    return {
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      reductionRatio: 1 - (summary.length / text.length),
      sentences: selectedSentences,
      method: 'extractive'
    };
  }

  /**
   * Extract sentences from text
   * @param {string} text - Input text
   * @returns {Array} Array of sentence objects
   */
  extractSentences(text) {
    // Simple sentence detection using punctuation
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const matches = text.match(sentenceRegex) || [];
    
    return matches.map((sentence, index) => ({
      text: sentence.trim(),
      index,
      position: index / matches.length, // Relative position in text
      wordCount: this.countWords(sentence),
      charCount: sentence.length
    })).filter(s => s.wordCount >= this.config.minWordsPerSentence);
  }

  /**
   * Score sentences based on importance
   * @param {Array} sentences - Array of sentence objects
   * @param {string} fullText - Full original text
   * @returns {Array} Array of scored sentences
   */
  scoreSentences(sentences, fullText) {
    // Extract keywords from full text
    const keywords = this.extractKeywords(fullText);
    
    // Get title and headings if available
    const title = this.extractTitle(fullText);
    const headings = this.extractHeadings(fullText);
    
    return sentences.map(sentence => {
      let score = 0;
      
      // Position-based scoring
      if (sentence.position < 0.1) {
        score += this.config.firstSentenceWeight;
      } else if (sentence.position > 0.9) {
        score += this.config.lastSentenceWeight;
      }
      
      // Length-based scoring (prefer medium-length sentences)
      if (sentence.wordCount >= 10 && sentence.wordCount <= 25) {
        score += 1.0;
      }
      
      // Keyword matching
      const sentenceWords = new Set(
        sentence.text.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
      
      const keywordMatches = Array.from(sentenceWords).filter(word => 
        keywords.has(word)
      ).length;
      
      score += (keywordMatches / Math.max(1, sentenceWords.size)) * this.config.keywordWeight;
      
      // Title and heading matching
      if (title && this.similarity(sentence.text, title) > 0.3) {
        score += this.config.titleWeight;
      }
      
      for (const heading of headings) {
        if (this.similarity(sentence.text, heading) > 0.3) {
          score += this.config.headingWeight;
          break;
        }
      }
      
      // Proper noun density (simple heuristic)
      const properNouns = sentence.text.match(/\b[A-Z][a-z]+\b/g) || [];
      if (properNouns.length > 0) {
        score += Math.min(1.0, properNouns.length / 5);
      }
      
      // Numerical data presence
      if (sentence.text.match(/\b\d+\b/)) {
        score += 0.5;
      }
      
      return {
        ...sentence,
        score,
        keywordMatches
      };
    }).filter(s => s.score >= this.config.minSentenceScore);
  }

  /**
   * Extract keywords from text
   * @param {string} text - Input text
   * @returns {Set} Set of keywords
   */
  extractKeywords(text) {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !this.config.stopWords.has(word)
      );
    
    // Count word frequencies
    const wordFreq = new Map();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Select top keywords (appearing at least twice)
    const keywords = new Set();
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Top 20 keywords
    
    sortedWords.forEach(([word, freq]) => {
      if (freq >= 2) {
        keywords.add(word);
      }
    });
    
    return keywords;
  }

  /**
   * Extract title from text (simple heuristic)
   * @param {string} text - Input text
   * @returns {string} Extracted title
   */
  extractTitle(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Check if it looks like a title (shorter than 100 chars, no ending punctuation)
      if (firstLine.length < 100 && !firstLine.match(/[.!?]$/)) {
        return firstLine;
      }
    }
    return '';
  }

  /**
   * Extract headings from text (simple heuristic)
   * @param {string} text - Input text
   * @returns {Array} Array of heading texts
   */
  extractHeadings(text) {
    const lines = text.split('\n');
    const headings = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Simple heading detection: short lines, all caps, or ending with colon
      if (trimmed.length > 0 && trimmed.length < 80 && 
          (trimmed === trimmed.toUpperCase() || trimmed.endsWith(':'))) {
        headings.push(trimmed);
      }
    }
    
    return headings;
  }

  /**
   * Select top sentences for summary
   * @param {Array} scoredSentences - Array of scored sentences
   * @param {Object} options - Selection options
   * @returns {Array} Selected sentences
   */
  selectTopSentences(scoredSentences, options) {
    const { maxLength, minLength, ratio, preserveStructure } = options;
    
    // Sort by score
    const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Calculate target length
    const targetLength = Math.min(
      maxLength,
      Math.max(minLength, Math.floor(sorted.reduce((sum, s) => sum + s.charCount, 0) * ratio))
    );
    
    let selected = [];
    let currentLength = 0;
    
    if (preserveStructure) {
      // Preserve original order while selecting high-scoring sentences
      const byIndex = [...scoredSentences].sort((a, b) => a.index - b.index);
      const used = new Set();
      
      // First pass: select highest scoring sentences
      for (const sentence of sorted) {
        if (currentLength + sentence.charCount <= targetLength && !used.has(sentence.index)) {
          selected.push(sentence);
          used.add(sentence.index);
          currentLength += sentence.charCount;
        }
      }
      
      // Second pass: fill gaps to maintain flow
      for (const sentence of byIndex) {
        if (!used.has(sentence.index) && currentLength + sentence.charCount <= targetLength) {
          selected.push(sentence);
          used.add(sentence.index);
          currentLength += sentence.charCount;
        }
      }
      
      // Sort by original position
      selected.sort((a, b) => a.index - b.index);
    } else {
      // Simple greedy selection
      for (const sentence of sorted) {
        if (currentLength + sentence.charCount <= targetLength) {
          selected.push(sentence);
          currentLength += sentence.charCount;
        }
      }
      
      // Sort by original position
      selected.sort((a, b) => a.index - b.index);
    }
    
    return selected.slice(0, this.config.maxSentences);
  }

  /**
   * Generate summary from selected sentences
   * @param {Array} selectedSentences - Selected sentences
   * @param {boolean} preserveStructure - Whether to preserve original structure
   * @returns {string} Generated summary
   */
  generateSummary(selectedSentences, preserveStructure) {
    if (selectedSentences.length === 0) {
      return '';
    }
    
    if (preserveStructure) {
      return selectedSentences.map(s => s.text).join(' ');
    } else {
      // Simple concatenation with proper spacing
      return selectedSentences
        .map(s => s.text.trim())
        .filter(text => text.length > 0)
        .join(' ');
    }
  }

  /**
   * Calculate similarity between two strings (simple)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  similarity(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Count words in text
   * @param {string} text - Input text
   * @returns {number} Word count
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Create a singleton instance
let summarizerInstance = null;

/**
 * Get the singleton summarizer instance
 * @returns {TextSummarizer} The summarizer instance
 */
export function getTextSummarizer() {
  if (!summarizerInstance) {
    summarizerInstance = new TextSummarizer();
  }
  return summarizerInstance;
}