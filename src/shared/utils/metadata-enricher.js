/**
 * Metadata enrichment utility for LLM-optimized Chrome Extension
 * Provides content quality assessment and metadata enrichment
 */

/**
 * Metadata enricher class for content quality assessment
 */
export class MetadataEnricher {
  /**
   * Create a new MetadataEnricher
   */
  constructor() {
    this.config = {
      // Quality assessment thresholds
      qualityThresholds: {
        high: 0.8,
        medium: 0.5,
        low: 0.2
      },
      
      // Content type detection patterns
      contentTypePatterns: {
        article: {
          patterns: [
            /article|post|story|blog|news/i,
            /by\s+[a-z\s]+$/i,  // Author byline
            /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i  // Date
          ],
          weight: 3.0
        },
        documentation: {
          patterns: [
            /documentation|docs|guide|tutorial|manual|reference/i,
            /install|setup|config|usage|example/i,
            /api|function|method|class|interface/i
          ],
          weight: 2.5
        },
        ecommerce: {
          patterns: [
            /price|cart|checkout|order|buy|purchase/i,
            /\$\d+|\d+\s+usd|\d+\s+eur/i,
            /add to cart|buy now|shop/i
          ],
          weight: 1.5
        },
        social: {
          patterns: [
            /facebook|twitter|instagram|linkedin|social/i,
            /like|share|follow|comment|post/i,
            /profile|timeline|feed|notification/i
          ],
          weight: 1.0
        }
      },
      
      // Reading level assessment
      readingLevelMetrics: {
        avgWordsPerSentence: { target: 15, weight: 0.3 },
        avgSyllablesPerWord: { target: 1.5, weight: 0.4 },
        complexWordsRatio: { target: 0.1, weight: 0.3 }
      },
      
      // Content structure indicators
      structureIndicators: {
        hasHeadings: { weight: 0.2 },
        hasLists: { weight: 0.15 },
        hasLinks: { weight: 0.1 },
        hasImages: { weight: 0.05 },
        hasCode: { weight: 0.15 },
        hasTables: { weight: 0.1 }
      },
      
      // Quality signals
      qualitySignals: {
        lengthScore: { optimal: 500, weight: 0.2 },
        readabilityScore: { weight: 0.3 },
        structureScore: { weight: 0.2 },
        relevanceScore: { weight: 0.3 }
      }
    };
  }

  /**
   * Enrich content with metadata
   * @param {Object} content - Content object
   * @param {Object} options - Enrichment options
   * @returns {Object} Enriched content with metadata
   */
  enrichContent(content, options = {}) {
    const {
      enableQualityAssessment = true,
      enableContentTypeDetection = true,
      enableReadingLevelAnalysis = true,
      enableStructureAnalysis = true,
      customMetadata = {}
    } = options;

    const enrichedContent = { ...content };
    enrichedContent.metadata = enrichedContent.metadata || {};

    if (enableQualityAssessment) {
      enrichedContent.metadata.quality = this.assessContentQuality(content);
    }

    if (enableContentTypeDetection) {
      enrichedContent.metadata.contentType = this.detectContentType(content);
    }

    if (enableReadingLevelAnalysis) {
      enrichedContent.metadata.readingLevel = this.analyzeReadingLevel(content.text || '');
    }

    if (enableStructureAnalysis) {
      enrichedContent.metadata.structure = this.analyzeContentStructure(content);
    }

    // Add custom metadata
    enrichedContent.metadata = {
      ...enrichedContent.metadata,
      ...customMetadata,
      enrichmentTimestamp: new Date().toISOString()
    };

    return enrichedContent;
  }

  /**
   * Assess content quality
   * @param {Object} content - Content object
   * @returns {Object} Quality assessment
   */
  assessContentQuality(content) {
    const text = content.text || '';
    const scores = {};
    let totalScore = 0;
    let totalWeight = 0;

    // Length score
    const length = text.length;
    const lengthScore = this.calculateLengthScore(length);
    scores.length = lengthScore.score;
    totalScore += lengthScore.score * this.config.qualitySignals.lengthScore.weight;
    totalWeight += this.config.qualitySignals.lengthScore.weight;

    // Readability score
    const readabilityScore = this.calculateReadabilityScore(text);
    scores.readability = readabilityScore.score;
    totalScore += readabilityScore.score * this.config.qualitySignals.readabilityScore.weight;
    totalWeight += this.config.qualitySignals.readabilityScore.weight;

    // Structure score
    const structureScore = this.calculateStructureScore(content);
    scores.structure = structureScore.score;
    totalScore += structureScore.score * this.config.qualitySignals.structureScore.weight;
    totalWeight += this.config.qualitySignals.structureScore.weight;

    // Relevance score (based on content density and filtering)
    const relevanceScore = this.calculateRelevanceScore(content);
    scores.relevance = relevanceScore.score;
    totalScore += relevanceScore.score * this.config.qualitySignals.relevanceScore.weight;
    totalWeight += this.config.qualitySignals.relevanceScore.weight;

    // Calculate overall quality score
    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      overall: Math.min(1, Math.max(0, overallScore)),
      breakdown: scores,
      level: this.getQualityLevel(overallScore),
      confidence: this.calculateQualityConfidence(scores),
      recommendations: this.generateQualityRecommendations(scores)
    };
  }

  /**
   * Calculate length score
   * @param {number} length - Text length
   * @returns {Object} Length score
   */
  calculateLengthScore(length) {
    const optimal = this.config.qualitySignals.lengthScore.optimal;
    const score = Math.min(1, length / (optimal * 2));
    return { score, length };
  }

  /**
   * Calculate readability score
   * @param {string} text - Text content
   * @returns {Object} Readability score
   */
  calculateReadabilityScore(text) {
    if (!text || text.trim().length === 0) {
      return { score: 0 };
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { score: 0 };
    }

    // Calculate average words per sentence
    const avgWordsPerSentence = words.length / sentences.length;
    
    // Calculate complex words ratio (words with 3+ syllables)
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);
    const complexWordsRatio = complexWords.length / words.length;
    
    // Calculate average syllables per word
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    const avgSyllablesPerWord = totalSyllables / words.length;
    
    // Calculate readability score (0-1, higher is better)
    const sentenceScore = Math.max(0, 1 - Math.abs(avgWordsPerSentence - 15) / 15);
    const complexityScore = Math.max(0, 1 - complexWordsRatio * 5);
    const syllableScore = Math.max(0, 1 - Math.abs(avgSyllablesPerWord - 1.5) / 1.5);
    
    const score = (sentenceScore + complexityScore + syllableScore) / 3;
    
    return {
      score,
      metrics: {
        avgWordsPerSentence,
        complexWordsRatio,
        avgSyllablesPerWord
      }
    };
  }

  /**
   * Calculate structure score
   * @param {Object} content - Content object
   * @returns {Object} Structure score
   */
  calculateStructureScore(content) {
    const indicators = this.config.structureIndicators;
    let totalScore = 0;
    let totalWeight = 0;
    const details = {};

    // Check for headings
    if (content.structuredContent && content.structuredContent.headings) {
      const hasHeadings = content.structuredContent.headings.length > 0;
      details.hasHeadings = hasHeadings;
      totalScore += (hasHeadings ? 1 : 0) * indicators.hasHeadings.weight;
      totalWeight += indicators.hasHeadings.weight;
    }

    // Check for lists
    if (content.structuredContent && content.structuredContent.lists) {
      const hasLists = content.structuredContent.lists.length > 0;
      details.hasLists = hasLists;
      totalScore += (hasLists ? 1 : 0) * indicators.hasLists.weight;
      totalWeight += indicators.hasLists.weight;
    }

    // Check for links
    if (content.links) {
      const hasLinks = content.links.length > 0;
      details.hasLinks = hasLinks;
      totalScore += (hasLinks ? 1 : 0) * indicators.hasLinks.weight;
      totalWeight += indicators.hasLinks.weight;
    }

    // Check for code
    const hasCode = this.containsCode(content.text || '');
    details.hasCode = hasCode;
    totalScore += (hasCode ? 1 : 0) * indicators.hasCode.weight;
    totalWeight += indicators.hasCode.weight;

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    return { score, details };
  }

  /**
   * Calculate relevance score
   * @param {Object} content - Content object
   * @returns {Object} Relevance score
   */
  calculateRelevanceScore(content) {
    const text = content.text || '';
    const contentStats = content.contentStats || {};
    
    // Calculate content density (text vs total elements)
    const densityScore = contentStats.extractionMethod === 'structured' ? 0.8 : 0.5;
    
    // Calculate keyword relevance (simple heuristic)
    const relevantKeywords = [
      'important', 'key', 'main', 'essential', 'critical', 'primary',
      'summary', 'overview', 'introduction', 'conclusion', 'analysis'
    ];
    
    const keywordCount = relevantKeywords.reduce((count, keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    const keywordScore = Math.min(1, keywordCount / 10);
    
    // Calculate coherence score
    const coherenceScore = this.calculateCoherenceScore(text);
    
    const score = (densityScore + keywordScore + coherenceScore) / 3;
    
    return { score, details: { density: densityScore, keywords: keywordScore, coherence: coherenceScore } };
  }

  /**
   * Detect content type
   * @param {Object} content - Content object
   * @returns {Object} Content type detection
   */
  detectContentType(content) {
    const text = content.text || '';
    const title = content.title || '';
    const url = content.url || '';
    const fullText = `${title} ${text} ${url}`.toLowerCase();
    
    const typeScores = {};
    let maxScore = 0;
    let detectedType = 'general';
    
    for (const [type, config] of Object.entries(this.config.contentTypePatterns)) {
      let score = 0;
      
      for (const pattern of config.patterns) {
        const matches = fullText.match(pattern);
        if (matches) {
          score += matches.length;
        }
      }
      
      // Apply weight
      score *= config.weight;
      typeScores[type] = score;
      
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }
    
    return {
      primary: detectedType,
      confidence: Math.min(1, maxScore / 5),
      scores: typeScores
    };
  }

  /**
   * Analyze reading level
   * @param {string} text - Text content
   * @returns {Object} Reading level analysis
   */
  analyzeReadingLevel(text) {
    if (!text || text.trim().length === 0) {
      return { level: 'unknown', score: 0 };
    }

    const readability = this.calculateReadabilityScore(text);
    const metrics = readability.metrics;
    
    // Calculate Flesch-Kincaid Grade Level approximation
    const avgWordsPerSentence = metrics.avgWordsPerSentence;
    const avgSyllablesPerWord = metrics.avgSyllablesPerWord;
    
    const fkScore = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    
    // Determine reading level
    let level;
    if (fkScore <= 8) {
      level = 'elementary';
    } else if (fkScore <= 12) {
      level = 'high_school';
    } else if (fkScore <= 16) {
      level = 'college';
    } else {
      level = 'graduate';
    }
    
    return {
      level,
      fkScore: Math.max(0, fkScore),
      metrics,
      estimatedReadingTime: Math.ceil(text.length / 200) // Rough estimate
    };
  }

  /**
   * Analyze content structure
   * @param {Object} content - Content object
   * @returns {Object} Structure analysis
   */
  analyzeContentStructure(content) {
    const structure = {
      hasHeadings: false,
      hasSubheadings: false,
      hasLists: false,
      hasLinks: false,
      hasCode: false,
      hasImages: false,
      hasTables: false,
      headingHierarchy: [],
      listTypes: [],
      linkCount: 0,
      codeBlockCount: 0
    };

    // Analyze structured content
    if (content.structuredContent) {
      const sc = content.structuredContent;
      
      structure.hasHeadings = sc.headings && sc.headings.length > 0;
      structure.hasSubheadings = sc.headings && sc.headings.some(h => h.level > 1);
      structure.hasLists = sc.lists && sc.lists.length > 0;
      
      // Build heading hierarchy
      if (sc.headings) {
        structure.headingHierarchy = sc.headings.map(h => h.level);
      }
      
      // Identify list types
      if (sc.lists) {
        structure.listTypes = [...new Set(sc.lists.map(l => l.type))];
      }
    }

    // Analyze links
    if (content.links) {
      structure.hasLinks = content.links.length > 0;
      structure.linkCount = content.links.length;
    }

    // Check for code
    structure.hasCode = this.containsCode(content.text || '');
    structure.codeBlockCount = (content.text || '').match(/```[\s\S]*?```/g) || [];

    return structure;
  }

  /**
   * Get quality level from score
   * @param {number} score - Quality score
   * @returns {string} Quality level
   */
  getQualityLevel(score) {
    const thresholds = this.config.qualityThresholds;
    
    if (score >= thresholds.high) {
      return 'high';
    } else if (score >= thresholds.medium) {
      return 'medium';
    } else if (score >= thresholds.low) {
      return 'low';
    } else {
      return 'very_low';
    }
  }

  /**
   * Calculate quality confidence
   * @param {Object} scores - Quality scores
   * @returns {number} Confidence score
   */
  calculateQualityConfidence(scores) {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    return Math.max(0, 1 - (standardDeviation / mean));
  }

  /**
   * Generate quality recommendations
   * @param {Object} scores - Quality scores
   * @returns {Array} Recommendations
   */
  generateQualityRecommendations(scores) {
    const recommendations = [];
    
    if (scores.length < 0.3) {
      recommendations.push('Content is too short for meaningful analysis');
    }
    
    if (scores.readability < 0.4) {
      recommendations.push('Content readability could be improved');
    }
    
    if (scores.structure < 0.3) {
      recommendations.push('Adding headings and lists would improve content structure');
    }
    
    if (scores.relevance < 0.4) {
      recommendations.push('Content could be more focused on key topics');
    }
    
    return recommendations;
  }

  /**
   * Count syllables in a word
   * @param {string} word - Word to analyze
   * @returns {number} Syllable count
   */
  countSyllables(word) {
    if (!word) return 0;
    
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Remove silent 'e'
    word = word.replace(/(?:[^laeiouy]e|ed|es)$/, '');
    
    // Count vowel groups
    const syllables = word.match(/[aeiouy]{1,2}/g);
    
    return syllables ? syllables.length : 1;
  }

  /**
   * Check if text contains code
   * @param {string} text - Text to check
   * @returns {boolean} Whether text contains code
   */
  containsCode(text) {
    if (!text) return false;
    
    const codePatterns = [
      /```[\s\S]*?```/g,  // Code blocks
      /`[^`]+`/g,          // Inline code
      /\b(function|class|var|let|const|if|else|for|while|return)\b/g,  // Keywords
      /\b(console\.|document\.|window\.)\w+/g  // API calls
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Calculate coherence score
   * @param {string} text - Text to analyze
   * @returns {number} Coherence score
   */
  calculateCoherenceScore(text) {
    if (!text || text.trim().length === 0) return 0;
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0.5;
    
    // Simple coherence based on sentence length consistency
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    // Lower variance = higher coherence
    return Math.max(0, 1 - (variance / 100));
  }
}

// Create a singleton instance
let metadataEnricherInstance = null;

/**
 * Get the singleton metadata enricher instance
 * @returns {MetadataEnricher} The metadata enricher instance
 */
export function getMetadataEnricher() {
  if (!metadataEnricherInstance) {
    metadataEnricherInstance = new MetadataEnricher();
  }
  return metadataEnricherInstance;
}