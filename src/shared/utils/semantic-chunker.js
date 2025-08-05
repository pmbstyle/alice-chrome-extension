export class SemanticChunker {
  constructor() {
    this.config = {
      minChunkSize: 100,
      maxChunkSize: 1000,
      targetChunkSize: 500,
      overlapSize: 50,
      sentenceBoundaryWeight: 3.0,
      paragraphBoundaryWeight: 2.5,
      headingBoundaryWeight: 2.0,
      listBoundaryWeight: 1.5,
      headingPatterns: [
        /^#{1,6}\s+/m,
        /^[A-Z][A-Z\s]+:$/m,
        /^[A-Z][a-zA-Z\s]{0,50}$/m
      ],
      listPatterns: [
        /^\s*[-*+]\s+/m,
        /^\s*\d+\.\s+/m,
        /^\s*[a-zA-Z]\.\s+/m
      ],
      minCoherenceScore: 0.3,
      maxCoherenceScore: 0.8,
      codeBlockPattern: /```[\s\S]*?```/g,
      inlineCodePattern: /`[^`]+`/g
    };
  }

  chunkText(text, options = {}) {
    const {
      maxSize = this.config.maxChunkSize,
      minSize = this.config.minChunkSize,
      targetSize = this.config.targetChunkSize,
      overlap = this.config.overlapSize,
      preserveStructure = true,
      includeMetadata = true
    } = options;

    if (!text || text.trim().length === 0) {
      return [];
    }

    if (text.length <= maxSize) {
      return [{
        text: text,
        startIndex: 0,
        endIndex: text.length,
        type: 'single',
        metadata: includeMetadata ? this.generateChunkMetadata(text, 'single') : null
      }];
    }

    const structure = this.analyzeTextStructure(text);
    let chunks = this.generateChunks(text, structure, {
      maxSize,
      minSize,
      targetSize,
      overlap,
      preserveStructure
    });

    if (overlap > 0 && chunks.length > 1) {
      chunks = this.addChunkOverlap(chunks, overlap);
    }

    if (includeMetadata) {
      chunks = chunks.map(chunk => ({
        ...chunk,
        metadata: this.generateChunkMetadata(chunk.text, chunk.type)
      }));
    }

    return chunks;
  }

  analyzeTextStructure(text) {
    const lines = text.split('\n');
    const boundaries = [];
    const sections = [];
    
    let currentSection = {
      type: 'paragraph',
      startIndex: 0,
      endIndex: 0,
      lines: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTrimmed = line.trim();
      
      const isHeading = this.config.headingPatterns.some(pattern =>
        pattern.test(lineTrimmed)
      );
      
      const isList = this.config.listPatterns.some(pattern =>
        pattern.test(line)
      );
      
      const isCodeBlock = lineTrimmed.startsWith('```') ||
                        (i > 0 && lines[i - 1].trim().startsWith('```'));
      
      let lineType = 'text';
      if (isHeading) {
        lineType = 'heading';
      } else if (isList) {
        lineType = 'list';
      } else if (isCodeBlock) {
        lineType = 'code';
      } else if (lineTrimmed === '') {
        lineType = 'empty';
      }
      
      if (currentSection.lines.length > 0 &&
          this.shouldCreateBoundary(currentSection.type, lineType)) {
        boundaries.push({
          position: currentSection.endIndex,
          type: this.getBoundaryType(currentSection.type, lineType),
          strength: this.getBoundaryStrength(currentSection.type, lineType)
        });
        
        sections.push(currentSection);
        currentSection = {
          type: lineType,
          startIndex: i,
          endIndex: i,
          lines: [line]
        };
      } else {
        currentSection.lines.push(line);
        currentSection.endIndex = i;
        currentSection.type = lineType;
      }
    }
    
    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
    
    const sentenceBoundaries = this.findSentenceBoundaries(text);
    
    return {
      boundaries: [...boundaries, ...sentenceBoundaries].sort((a, b) => a.position - b.position),
      sections,
      totalLength: text.length
    };
  }

  shouldCreateBoundary(currentType, nextType) {
    if (currentType === 'heading' && nextType !== 'heading') return true;
    if (currentType !== 'heading' && nextType === 'heading') return true;
    if (currentType === 'code' && nextType !== 'code') return true;
    if (currentType !== 'code' && nextType === 'code') return true;
    
    if ((currentType === 'text' || currentType === 'paragraph') && nextType === 'list') return true;
    if (currentType === 'list' && (nextType === 'text' || nextType === 'paragraph')) return true;
    
    return false;
  }

  getBoundaryType(currentType, nextType) {
    if (currentType === 'heading' || nextType === 'heading') return 'heading';
    if (currentType === 'code' || nextType === 'code') return 'code';
    if (currentType === 'list' || nextType === 'list') return 'list';
    return 'paragraph';
  }

  getBoundaryStrength(currentType, nextType) {
    if (currentType === 'heading' || nextType === 'heading') {
      return this.config.headingBoundaryWeight;
    }
    if (currentType === 'code' || nextType === 'code') {
      return this.config.paragraphBoundaryWeight;
    }
    if (currentType === 'list' || nextType === 'list') {
      return this.config.listBoundaryWeight;
    }
    return this.config.paragraphBoundaryWeight;
  }

  findSentenceBoundaries(text) {
    const boundaries = [];
    const sentenceRegex = /[.!?]+/g;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      boundaries.push({
        position: match.index + match[0].length,
        type: 'sentence',
        strength: this.config.sentenceBoundaryWeight
      });
    }
    
    return boundaries;
  }

  generateChunks(text, structure, options) {
    const { maxSize, minSize, targetSize, preserveStructure } = options;
    const chunks = [];
    
    if (preserveStructure && structure.sections.length > 0) {
      let currentChunk = {
        text: '',
        startIndex: 0,
        endIndex: 0,
        type: 'mixed',
        sections: []
      };
      
      for (const section of structure.sections) {
        const sectionText = section.lines.join('\n');
        
        if (currentChunk.text.length + sectionText.length > maxSize &&
            currentChunk.text.length >= minSize) {
          chunks.push(currentChunk);
          currentChunk = {
            text: sectionText,
            startIndex: section.startIndex,
            endIndex: section.endIndex,
            type: section.type,
            sections: [section]
          };
        } else {
          if (currentChunk.text.length > 0) {
            currentChunk.text += '\n' + sectionText;
          } else {
            currentChunk.text = sectionText;
            currentChunk.startIndex = section.startIndex;
          }
          currentChunk.endIndex = section.endIndex;
          currentChunk.sections.push(section);
          currentChunk.type = this.getDominantType(currentChunk.sections);
        }
      }
      
      if (currentChunk.text.length >= minSize) {
        chunks.push(currentChunk);
      }
    } else {
      chunks.push(...this.createBoundaryBasedChunks(text, structure.boundaries, options));
    }
    
    return chunks;
  }

  getDominantType(sections) {
    const typeCounts = {};
    sections.forEach(section => {
      typeCounts[section.type] = (typeCounts[section.type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  createBoundaryBasedChunks(text, boundaries, options) {
    const { maxSize, minSize, targetSize } = options;
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      let bestBoundary = null;
      let bestScore = -1;
      
      for (const boundary of boundaries) {
        if (boundary.position > startIndex + minSize &&
            boundary.position <= startIndex + maxSize) {
          
          const score = this.calculateBoundaryScore(boundary, startIndex, targetSize);
          if (score > bestScore) {
            bestScore = score;
            bestBoundary = boundary;
          }
        }
      }
      
      let endIndex;
      if (bestBoundary) {
        endIndex = bestBoundary.position;
      } else {
        endIndex = Math.min(startIndex + targetSize, text.length);
      }
      
      const chunkText = text.substring(startIndex, endIndex).trim();
      if (chunkText.length >= minSize) {
        chunks.push({
          text: chunkText,
          startIndex,
          endIndex,
          type: bestBoundary ? bestBoundary.type : 'text'
        });
      }
      
      startIndex = endIndex;
    }
    
    return chunks;
  }

  calculateBoundaryScore(boundary, startIndex, targetSize) {
    const distance = Math.abs(boundary.position - (startIndex + targetSize));
    const distanceScore = 1 - (distance / targetSize);
    
    return boundary.strength * distanceScore;
  }

  addChunkOverlap(chunks, overlapSize) {
    const overlappedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let overlappedChunk = { ...chunk };
      
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.text.slice(-overlapSize);
        overlappedChunk.text = overlapText + chunk.text;
        overlappedChunk.startIndex = prevChunk.endIndex - overlapSize;
      }
      
      overlappedChunks.push(overlappedChunk);
    }
    
    return overlappedChunks;
  }

  generateChunkMetadata(text, type) {
    return {
      type,
      length: text.length,
      wordCount: this.countWords(text),
      sentenceCount: this.countSentences(text),
      hasCode: this.containsCode(text),
      hasList: this.containsList(text),
      hasHeading: this.containsHeading(text),
      estimatedTokens: Math.ceil(text.length / 4),
      coherenceScore: this.calculateCoherenceScore(text)
    };
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  countSentences(text) {
    const sentences = text.match(/[.!?]+/g) || [];
    return sentences.length;
  }

  containsCode(text) {
    return this.config.codeBlockPattern.test(text) ||
           this.config.inlineCodePattern.test(text);
  }

  containsList(text) {
    return this.config.listPatterns.some(pattern => pattern.test(text));
  }

  containsHeading(text) {
    return this.config.headingPatterns.some(pattern => pattern.test(text));
  }

  calculateCoherenceScore(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthVariance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    const lengthScore = Math.max(0, 1 - (lengthVariance / 100));
    
    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'additionally',
                           'consequently', 'accordingly', 'thus', 'hence', 'otherwise'];
    const transitionCount = transitionWords.filter(word =>
      text.toLowerCase().includes(word)
    ).length;
    const transitionScore = Math.min(1, transitionCount / sentences.length);
    
    return (lengthScore + transitionScore) / 2;
  }
}

let chunkerInstance = null;

export function getSemanticChunker() {
  if (!chunkerInstance) {
    chunkerInstance = new SemanticChunker();
  }
  return chunkerInstance;
}