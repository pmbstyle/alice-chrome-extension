export class TextSummarizer {
  constructor() {
    this.config = {
      minSummaryLength: 100,
      maxSummaryLength: 500,
      targetSummaryRatio: 0.3,
      minSentenceScore: 0.1,
      maxSentences: 5,
      titleWeight: 3.0,
      headingWeight: 2.5,
      firstSentenceWeight: 1.5,
      lastSentenceWeight: 1.2,
      keywordWeight: 1.0,
      minWordsPerSentence: 5,
      maxWordsPerSentence: 50,
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

    const scoredSentences = this.scoreSentences(sentences, text);
    const selectedSentences = this.selectTopSentences(scoredSentences, {
      maxLength,
      minLength,
      ratio,
      preserveStructure
    });
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

  extractSentences(text) {
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const matches = text.match(sentenceRegex) || [];
    
    return matches.map((sentence, index) => ({
      text: sentence.trim(),
      index,
      position: index / matches.length,
      wordCount: this.countWords(sentence),
      charCount: sentence.length
    })).filter(s => s.wordCount >= this.config.minWordsPerSentence);
  }

  scoreSentences(sentences, fullText) {
    const keywords = this.extractKeywords(fullText);
    const title = this.extractTitle(fullText);
    const headings = this.extractHeadings(fullText);
    
    return sentences.map(sentence => {
      let score = 0;
      
      if (sentence.position < 0.1) {
        score += this.config.firstSentenceWeight;
      } else if (sentence.position > 0.9) {
        score += this.config.lastSentenceWeight;
      }
      
      if (sentence.wordCount >= 10 && sentence.wordCount <= 25) {
        score += 1.0;
      }
      
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
      
      if (title && this.similarity(sentence.text, title) > 0.3) {
        score += this.config.titleWeight;
      }
      
      for (const heading of headings) {
        if (this.similarity(sentence.text, heading) > 0.3) {
          score += this.config.headingWeight;
          break;
        }
      }
      
      const properNouns = sentence.text.match(/\b[A-Z][a-z]+\b/g) || [];
      if (properNouns.length > 0) {
        score += Math.min(1.0, properNouns.length / 5);
      }
      
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

  extractKeywords(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 3 &&
        !this.config.stopWords.has(word)
      );
    
    const wordFreq = new Map();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    const keywords = new Set();
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    sortedWords.forEach(([word, freq]) => {
      if (freq >= 2) {
        keywords.add(word);
      }
    });
    
    return keywords;
  }

  extractTitle(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 100 && !firstLine.match(/[.!?]$/)) {
        return firstLine;
      }
    }
    return '';
  }

  extractHeadings(text) {
    const lines = text.split('\n');
    const headings = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 80 &&
          (trimmed === trimmed.toUpperCase() || trimmed.endsWith(':'))) {
        headings.push(trimmed);
      }
    }
    
    return headings;
  }

  selectTopSentences(scoredSentences, options) {
    const { maxLength, minLength, ratio, preserveStructure } = options;
    
    const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    const targetLength = Math.min(
      maxLength,
      Math.max(minLength, Math.floor(sorted.reduce((sum, s) => sum + s.charCount, 0) * ratio))
    );
    
    let selected = [];
    let currentLength = 0;
    
    if (preserveStructure) {
      const byIndex = [...scoredSentences].sort((a, b) => a.index - b.index);
      const used = new Set();
      
      for (const sentence of sorted) {
        if (currentLength + sentence.charCount <= targetLength && !used.has(sentence.index)) {
          selected.push(sentence);
          used.add(sentence.index);
          currentLength += sentence.charCount;
        }
      }
      
      for (const sentence of byIndex) {
        if (!used.has(sentence.index) && currentLength + sentence.charCount <= targetLength) {
          selected.push(sentence);
          used.add(sentence.index);
          currentLength += sentence.charCount;
        }
      }
      
      selected.sort((a, b) => a.index - b.index);
    } else {
      for (const sentence of sorted) {
        if (currentLength + sentence.charCount <= targetLength) {
          selected.push(sentence);
          currentLength += sentence.charCount;
        }
      }
      
      selected.sort((a, b) => a.index - b.index);
    }
    
    return selected.slice(0, this.config.maxSentences);
  }

  generateSummary(selectedSentences, preserveStructure) {
    if (selectedSentences.length === 0) {
      return '';
    }
    
    if (preserveStructure) {
      return selectedSentences.map(s => s.text).join(' ');
    } else {
      return selectedSentences
        .map(s => s.text.trim())
        .filter(text => text.length > 0)
        .join(' ');
    }
  }

  similarity(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

let summarizerInstance = null;

export function getTextSummarizer() {
  if (!summarizerInstance) {
    summarizerInstance = new TextSummarizer();
  }
  return summarizerInstance;
}