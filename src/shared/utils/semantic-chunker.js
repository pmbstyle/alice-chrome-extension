/**
 * Semantic chunking utility for LLM-optimized Chrome Extension
 * Provides intelligent text segmentation for better LLM comprehension
 */

/**
 * Semantic chunker class for intelligent text segmentation
 */
export class SemanticChunker {
  /**
   * Create a new SemanticChunker
   */
  constructor() {
    this.config = {
      // Chunk size parameters
      minChunkSize: 100,
      maxChunkSize: 1000,
      targetChunkSize: 500,
      overlapSize: 50,
      
      // Semantic boundaries
      sentenceBoundaryWeight: 3.0,
      paragraphBoundaryWeight: 2.5,
      headingBoundaryWeight: 2.0,
      listBoundaryWeight: 1.5,
      
      // Content type detection
      headingPatterns: [
        /^#{1,6}\s+/m,  // Markdown headings
        /^[A-Z][A-Z\s]+:$/m,  // ALL CAPS headings
        /^[A-Z][a-zA-Z\s]{0,50}$/m  // Short title-like lines
      ],
      
      listPatterns: [
        /^\s*[-*+]\s+/m,  // Bullet points
        /^\s*\d+\.\s+/m,  // Numbered lists
        /^\s*[a-zA-Z]\.\s+/m  // Letter lists
      ],
      
      // Semantic coherence thresholds
      minCoherenceScore: 0.3,
      maxCoherenceScore: 0.8,
      
      // Special handling for code and structured content
      codeBlockPattern: /```[\s\S]*?```/g,
      inlineCodePattern: /`[^`]+`/g
    };
  }

  /**
   * Chunk text semantically
   * @param {string} text - Text to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks with metadata
   */
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

    // If text is small enough, return as single chunk
    if (text.length <= maxSize) {
      return [{
        text: text,
        startIndex: 0,
        endIndex: text.length,
        type: 'single',
        metadata: includeMetadata ? this.generateChunkMetadata(text, 'single') : null
      }];
    }

    // Pre-process text to identify structural elements
    const structure = this.analyzeTextStructure(text);
    
    // Generate chunks based on structure
    let chunks = this.generateChunks(text, structure, {
      maxSize,
      minSize,
      targetSize,
      overlap,
      preserveStructure
    });

    // Add overlap between chunks if requested
    if (overlap > 0 && chunks.length > 1) {
      chunks = this.addChunkOverlap(chunks, overlap);
    }

    // Add metadata if requested
    if (includeMetadata) {
      chunks = chunks.map(chunk => ({
        ...chunk,
        metadata: this.generateChunkMetadata(chunk.text, chunk.type)
      }));
    }

    return chunks;
  }

  /**
   * Analyze text structure to identify semantic boundaries
   * @param {string} text - Input text
   * @returns {Object} Structure analysis
   */
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
      
      // Check for heading patterns
      const isHeading = this.config.headingPatterns.some(pattern => 
        pattern.test(lineTrimmed)
      );
      
      // Check for list patterns
      const isList = this.config.listPatterns.some(pattern => 
        pattern.test(line)
      );
      
      // Check for code blocks
      const isCodeBlock = lineTrimmed.startsWith('```') || 
                        (i > 0 && lines[i - 1].trim().startsWith('```'));
      
      // Determine line type
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
      
      // If line type changes significantly, create a boundary
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
        currentSection.type = lineType; // Update type if needed
      }
    }
    
    // Add final section
    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
    
    // Add sentence boundaries within sections
    const sentenceBoundaries = this.findSentenceBoundaries(text);
    
    return {
      boundaries: [...boundaries, ...sentenceBoundaries].sort((a, b) => a.position - b.position),
      sections,
      totalLength: text.length
    };
  }

  /**
   * Determine if a boundary should be created between sections
   * @param {string} currentType - Current section type
   * @param {string} nextType - Next section type
   * @returns {boolean} Whether to create a boundary
   */
  shouldCreateBoundary(currentType, nextType) {
    // Always create boundary for major structural changes
    if (currentType === 'heading' && nextType !== 'heading') return true;
    if (currentType !== 'heading' && nextType === 'heading') return true;
    if (currentType === 'code' && nextType !== 'code') return true;
    if (currentType !== 'code' && nextType === 'code') return true;
    
    // Create boundary between text and lists
    if ((currentType === 'text' || currentType === 'paragraph') && nextType === 'list') return true;
    if (currentType === 'list' && (nextType === 'text' || nextType === 'paragraph')) return true;
    
    return false;
  }

  /**
   * Get boundary type between sections
   * @param {string} currentType - Current section type
   * @param {string} nextType - Next section type
   * @returns {string} Boundary type
   */
  getBoundaryType(currentType, nextType) {
    if (currentType === 'heading' || nextType === 'heading') return 'heading';
    if (currentType === 'code' || nextType === 'code') return 'code';
    if (currentType === 'list' || nextType === 'list') return 'list';
    return 'paragraph';
  }

  /**
   * Get boundary strength between sections
   * @param {string} currentType - Current section type
   * @param {string} nextType - Next section type
   * @returns {number} Boundary strength
   */
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

  /**
   * Find sentence boundaries in text
   * @param {string} text - Input text
   * @returns {Array} Array of sentence boundaries
   */
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

  /**
   * Generate chunks based on structure analysis
   * @param {string} text - Original text
   * @param {Object} structure - Structure analysis
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  generateChunks(text, structure, options) {
    const { maxSize, minSize, targetSize, preserveStructure } = options;
    const chunks = [];
    
    if (preserveStructure && structure.sections.length > 0) {
      // Structure-preserving chunking
      let currentChunk = {
        text: '',
        startIndex: 0,
        endIndex: 0,
        type: 'mixed',
        sections: []
      };
      
      for (const section of structure.sections) {
        const sectionText = section.lines.join('\n');
        
        // If adding this section would exceed max size, finalize current chunk
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
          // Add section to current chunk
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
      
      // Add final chunk if it has content
      if (currentChunk.text.length >= minSize) {
        chunks.push(currentChunk);
      }
    } else {
      // Boundary-based chunking
      chunks.push(...this.createBoundaryBasedChunks(text, structure.boundaries, options));
    }
    
    return chunks;
  }

  /**
   * Get dominant type from sections
   * @param {Array} sections - Array of sections
   * @returns {string} Dominant type
   */
  getDominantType(sections) {
    const typeCounts = {};
    sections.forEach(section => {
      typeCounts[section.type] = (typeCounts[section.type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Create chunks based on boundaries
   * @param {string} text - Original text
   * @param {Array} boundaries - Array of boundaries
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks
   */
  createBoundaryBasedChunks(text, boundaries, options) {
    const { maxSize, minSize, targetSize } = options;
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      // Find the best boundary for chunking
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
        // No suitable boundary found, use target size
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

  /**
   * Calculate boundary score for chunking
   * @param {Object} boundary - Boundary object
   * @param {number} startIndex - Chunk start index
   * @param {number} targetSize - Target chunk size
   * @returns {number} Boundary score
   */
  calculateBoundaryScore(boundary, startIndex, targetSize) {
    const distance = Math.abs(boundary.position - (startIndex + targetSize));
    const distanceScore = 1 - (distance / targetSize);
    
    return boundary.strength * distanceScore;
  }

  /**
   * Add overlap between chunks
   * @param {Array} chunks - Array of chunks
   * @param {number} overlapSize - Overlap size
   * @returns {Array} Chunks with overlap
   */
  addChunkOverlap(chunks, overlapSize) {
    const overlappedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let overlappedChunk = { ...chunk };
      
      if (i > 0) {
        // Add overlap from previous chunk
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.text.slice(-overlapSize);
        overlappedChunk.text = overlapText + chunk.text;
        overlappedChunk.startIndex = prevChunk.endIndex - overlapSize;
      }
      
      overlappedChunks.push(overlappedChunk);
    }
    
    return overlappedChunks;
  }

  /**
   * Generate metadata for a chunk
   * @param {string} text - Chunk text
   * @param {string} type - Chunk type
   * @returns {Object} Chunk metadata
   */
  generateChunkMetadata(text, type) {
    return {
      type,
      length: text.length,
      wordCount: this.countWords(text),
      sentenceCount: this.countSentences(text),
      hasCode: this.containsCode(text),
      hasList: this.containsList(text),
      hasHeading: this.containsHeading(text),
      estimatedTokens: Math.ceil(text.length / 4), // Rough estimate
      coherenceScore: this.calculateCoherenceScore(text)
    };
  }

  /**
   * Count words in text
   * @param {string} text - Input text
   * @returns {number} Word count
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in text
   * @param {string} text - Input text
   * @returns {number} Sentence count
   */
  countSentences(text) {
    const sentences = text.match(/[.!?]+/g) || [];
    return sentences.length;
  }

  /**
   * Check if text contains code
   * @param {string} text - Input text
   * @returns {boolean} Whether text contains code
   */
  containsCode(text) {
    return this.config.codeBlockPattern.test(text) || 
           this.config.inlineCodePattern.test(text);
  }

  /**
   * Check if text contains list
   * @param {string} text - Input text
   * @returns {boolean} Whether text contains list
   */
  containsList(text) {
    return this.config.listPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if text contains heading
   * @param {string} text - Input text
   * @returns {boolean} Whether text contains heading
   */
  containsHeading(text) {
    return this.config.headingPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Calculate coherence score for text
   * @param {string} text - Input text
   * @returns {number} Coherence score (0-1)
   */
  calculateCoherenceScore(text) {
    // Simple coherence based on sentence structure and flow
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    // Check for consistent sentence length
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthVariance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    // Normalize variance to 0-1 scale (lower variance = higher coherence)
    const lengthScore = Math.max(0, 1 - (lengthVariance / 100));
    
    // Check for transition words
    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 
                           'consequently', 'accordingly', 'thus', 'hence', 'otherwise'];
    const transitionCount = transitionWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    const transitionScore = Math.min(1, transitionCount / sentences.length);
    
    return (lengthScore + transitionScore) / 2;
  }
}

// Create a singleton instance
let chunkerInstance = null;

/**
 * Get the singleton chunker instance
 * @returns {SemanticChunker} The chunker instance
 */
export function getSemanticChunker() {
  if (!chunkerInstance) {
    chunkerInstance = new SemanticChunker();
  }
  return chunkerInstance;
}