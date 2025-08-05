export class MetadataEnricher {
  constructor() {
    this.config = {
      qualityThresholds: {
        high: 0.8,
        medium: 0.5,
        low: 0.2
      },
      contentTypePatterns: {
        article: {
          patterns: [
            /article|post|story|blog|news/i,
            /by\s+[a-z\s]+$/i,
            /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i
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
      readingLevelMetrics: {
        avgWordsPerSentence: { target: 15, weight: 0.3 },
        avgSyllablesPerWord: { target: 1.5, weight: 0.4 },
        complexWordsRatio: { target: 0.1, weight: 0.3 }
      },
      structureIndicators: {
        hasHeadings: { weight: 0.2 },
        hasLists: { weight: 0.15 },
        hasLinks: { weight: 0.1 },
        hasImages: { weight: 0.05 },
        hasCode: { weight: 0.15 },
        hasTables: { weight: 0.1 }
      },
      qualitySignals: {
        lengthScore: { optimal: 500, weight: 0.2 },
        readabilityScore: { weight: 0.3 },
        structureScore: { weight: 0.2 },
        relevanceScore: { weight: 0.3 }
      }
    };
  }

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

    enrichedContent.metadata = {
      ...enrichedContent.metadata,
      ...customMetadata,
      enrichmentTimestamp: new Date().toISOString()
    };

    return enrichedContent;
  }

  assessContentQuality(content) {
    const text = content.text || '';
    const scores = {};
    let totalScore = 0;
    let totalWeight = 0;

    const length = text.length;
    const lengthScore = this.calculateLengthScore(length);
    scores.length = lengthScore.score;
    totalScore += lengthScore.score * this.config.qualitySignals.lengthScore.weight;
    totalWeight += this.config.qualitySignals.lengthScore.weight;

    const readabilityScore = this.calculateReadabilityScore(text);
    scores.readability = readabilityScore.score;
    totalScore += readabilityScore.score * this.config.qualitySignals.readabilityScore.weight;
    totalWeight += this.config.qualitySignals.readabilityScore.weight;

    const structureScore = this.calculateStructureScore(content);
    scores.structure = structureScore.score;
    totalScore += structureScore.score * this.config.qualitySignals.structureScore.weight;
    totalWeight += this.config.qualitySignals.structureScore.weight;

    const relevanceScore = this.calculateRelevanceScore(content);
    scores.relevance = relevanceScore.score;
    totalScore += relevanceScore.score * this.config.qualitySignals.relevanceScore.weight;
    totalWeight += this.config.qualitySignals.relevanceScore.weight;

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      overall: Math.min(1, Math.max(0, overallScore)),
      breakdown: scores,
      level: this.getQualityLevel(overallScore),
      confidence: this.calculateQualityConfidence(scores),
      recommendations: this.generateQualityRecommendations(scores)
    };
  }

  calculateLengthScore(length) {
    const optimal = this.config.qualitySignals.lengthScore.optimal;
    const score = Math.min(1, length / (optimal * 2));
    return { score, length };
  }

  calculateReadabilityScore(text) {
    if (!text || text.trim().length === 0) {
      return { score: 0 };
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { score: 0 };
    }

    const avgWordsPerSentence = words.length / sentences.length;
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);
    const complexWordsRatio = complexWords.length / words.length;
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    const avgSyllablesPerWord = totalSyllables / words.length;
    
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

  calculateStructureScore(content) {
    const indicators = this.config.structureIndicators;
    let totalScore = 0;
    let totalWeight = 0;
    const details = {};

    if (content.structuredContent && content.structuredContent.headings) {
      const hasHeadings = content.structuredContent.headings.length > 0;
      details.hasHeadings = hasHeadings;
      totalScore += (hasHeadings ? 1 : 0) * indicators.hasHeadings.weight;
      totalWeight += indicators.hasHeadings.weight;
    }

    if (content.structuredContent && content.structuredContent.lists) {
      const hasLists = content.structuredContent.lists.length > 0;
      details.hasLists = hasLists;
      totalScore += (hasLists ? 1 : 0) * indicators.hasLists.weight;
      totalWeight += indicators.hasLists.weight;
    }

    if (content.links) {
      const hasLinks = content.links.length > 0;
      details.hasLinks = hasLinks;
      totalScore += (hasLinks ? 1 : 0) * indicators.hasLinks.weight;
      totalWeight += indicators.hasLinks.weight;
    }

    const hasCode = this.containsCode(content.text || '');
    details.hasCode = hasCode;
    totalScore += (hasCode ? 1 : 0) * indicators.hasCode.weight;
    totalWeight += indicators.hasCode.weight;

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    return { score, details };
  }

  calculateRelevanceScore(content) {
    const text = content.text || '';
    const contentStats = content.contentStats || {};
    
    const densityScore = contentStats.extractionMethod === 'structured' ? 0.8 : 0.5;
    
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
    const coherenceScore = this.calculateCoherenceScore(text);
    
    const score = (densityScore + keywordScore + coherenceScore) / 3;
    
    return { score, details: { density: densityScore, keywords: keywordScore, coherence: coherenceScore } };
  }

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

  analyzeReadingLevel(text) {
    if (!text || text.trim().length === 0) {
      return { level: 'unknown', score: 0 };
    }

    const readability = this.calculateReadabilityScore(text);
    const metrics = readability.metrics;
    
    const avgWordsPerSentence = metrics.avgWordsPerSentence;
    const avgSyllablesPerWord = metrics.avgSyllablesPerWord;
    
    const fkScore = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    
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
      estimatedReadingTime: Math.ceil(text.length / 200)
    };
  }

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

    if (content.structuredContent) {
      const sc = content.structuredContent;
      
      structure.hasHeadings = sc.headings && sc.headings.length > 0;
      structure.hasSubheadings = sc.headings && sc.headings.some(h => h.level > 1);
      structure.hasLists = sc.lists && sc.lists.length > 0;
      
      if (sc.headings) {
        structure.headingHierarchy = sc.headings.map(h => h.level);
      }
      
      if (sc.lists) {
        structure.listTypes = [...new Set(sc.lists.map(l => l.type))];
      }
    }

    if (content.links) {
      structure.hasLinks = content.links.length > 0;
      structure.linkCount = content.links.length;
    }

    structure.hasCode = this.containsCode(content.text || '');
    structure.codeBlockCount = (content.text || '').match(/```[\s\S]*?```/g) || [];

    return structure;
  }

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

  calculateQualityConfidence(scores) {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.max(0, 1 - (standardDeviation / mean));
  }

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

  countSyllables(word) {
    if (!word) return 0;
    
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]e|ed|es)$/, '');
    
    const syllables = word.match(/[aeiouy]{1,2}/g);
    
    return syllables ? syllables.length : 1;
  }

  containsCode(text) {
    if (!text) return false;
    
    const codePatterns = [
      /```[\s\S]*?```/g,
      /`[^`]+`/g,
      /\b(function|class|var|let|const|if|else|for|while|return)\b/g,
      /\b(console\.|document\.|window\.)\w+/g
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
  }

  calculateCoherenceScore(text) {
    if (!text || text.trim().length === 0) return 0;
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0.5;
    
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    return Math.max(0, 1 - (variance / 100));
  }
}

let metadataEnricherInstance = null;

export function getMetadataEnricher() {
  if (!metadataEnricherInstance) {
    metadataEnricherInstance = new MetadataEnricher();
  }
  return metadataEnricherInstance;
}