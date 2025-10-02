const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const db = require('../db');
const logger = require('../utils/logger');
const llmExtractionService = require('./llmExtractionService');

/**
 * AI-Powered Protocol Extraction Service
 * Extracts structured protocol data from uploaded documents
 * Supports both LLM-based (Claude API) and rule-based extraction
 */
class ProtocolExtractionService {
  constructor() {
    this.supportedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'text/markdown', // .md
      'text/x-markdown' // .md (alternative MIME type)
    ];

    // Common lab units and patterns
    this.unitPatterns = {
      volume: ['μL', 'uL', 'ul', 'mL', 'ml', 'L', 'l'],
      concentration: ['μM', 'uM', 'mM', 'M', 'ng/μL', 'ng/uL', 'mg/mL', 'mg/ml', '%'],
      mass: ['μg', 'ug', 'mg', 'g', 'ng'],
      other: ['units', 'U', 'cycles', 'min', 'sec', 'h', 'hr', 'pieces', 'each']
    };

    // Common reagent name patterns
    this.reagentPatterns = [
      /\b(?:PCR|pcr)\s+(?:master\s+)?mix\b/i,
      /\b(?:DNA|dna)\s+(?:polymerase|pol)\b/i,
      /\b(?:Taq|taq)(?:\s+polymerase)?\b/i,
      /\b(?:dNTP|dntp)s?\s*(?:mix)?\b/i,
      /\b(?:primer|forward|reverse)\s+primer\b/i,
      /\b(?:buffer|reaction\s+buffer)\b/i,
      /\b(?:MgCl2|magnesium\s+chloride)\b/i,
      /\b(?:agarose|gel)\b/i,
      /\b(?:ladder|marker)\b/i,
      /\b(?:extraction\s+kit|kit)\b/i
    ];

    // Protocol section headers
    this.sectionHeaders = {
      title: [/^(?:protocol|procedure|method):\s*(.*)/i, /^title:\s*(.*)/i, /^(.*protocol.*)/i],
      description: [/^(?:description|purpose|objective|summary):\s*(.*)/i, /^(?:aim|goal):\s*(.*)/i],
      materials: [/^(?:materials|reagents|components|supplies):/i, /^(?:what\s+you\s+need):/i],
      procedure: [/^(?:procedure|protocol|method|steps):/i, /^(?:how\s+to):/i],
      notes: [/^(?:notes|comments|troubleshooting):/i]
    };
  }

  /**
   * Check if LLM extraction is available
   */
  isLLMExtractionAvailable() {
    return llmExtractionService.isAvailable();
  }

  /**
   * Extract text content from uploaded document
   */
  async extractTextFromDocument(filePath, mimeType) {
    try {
      // Check if it's a markdown file by extension (since many systems detect .md as text/plain)
      const isMarkdownFile = filePath.toLowerCase().endsWith('.md') || 
                            filePath.toLowerCase().endsWith('.markdown');
      
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(filePath);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromDocx(filePath);
        
        case 'text/plain':
          // If it's a markdown file by extension, treat it as markdown
          if (isMarkdownFile) {
            return await this.extractFromMarkdown(filePath);
          }
          return await this.extractFromText(filePath);
        
        case 'text/markdown':
        case 'text/x-markdown':
          return await this.extractFromMarkdown(filePath);
        
        case 'application/octet-stream':
          // Generic binary type - determine by file extension
          if (isMarkdownFile) {
            return await this.extractFromMarkdown(filePath);
          } else if (filePath.toLowerCase().endsWith('.pdf')) {
            return await this.extractFromPDF(filePath);
          } else if (filePath.toLowerCase().endsWith('.docx') || filePath.toLowerCase().endsWith('.doc')) {
            return await this.extractFromDocx(filePath);
          } else if (filePath.toLowerCase().endsWith('.txt')) {
            return await this.extractFromText(filePath);
          } else {
            throw new Error(`Unsupported file type: ${mimeType} with unknown extension`);
          }
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      logger.error('Error extracting text from document', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async extractFromPDF(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info
      }
    };
  }

  async extractFromDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      metadata: {
        messages: result.messages
      }
    };
  }

  async extractFromText(filePath) {
    const text = await fs.readFile(filePath, 'utf8');
    return {
      text: text,
      metadata: {}
    };
  }

  async extractFromMarkdown(filePath) {
    const text = await fs.readFile(filePath, 'utf8');
    return {
      text: text,
      metadata: {
        format: 'markdown',
        structured: true // Markdown is inherently structured
      }
    };
  }

  /**
   * Main extraction function - processes document and extracts protocol data
   * @param {string} documentPath - Path to the uploaded document
   * @param {string} mimeType - MIME type of the document
   * @param {string} documentId - UUID of the document
   * @param {Object} options - Extraction options
   * @param {string} options.method - 'llm' or 'rule-based' (default: 'llm' if available)
   * @param {string} options.protocolName - Optional protocol name for context
   */
  async extractProtocolData(documentPath, mimeType, documentId, options = {}) {
    try {
      // Extract raw text from document
      const { text, metadata: docMetadata } = await this.extractTextFromDocument(documentPath, mimeType);

      // Determine extraction method
      const method = options.method || (llmExtractionService.isAvailable() ? 'llm' : 'rule-based');

      let extractedData, confidenceScores, extractionMetadata;

      if (method === 'llm' && llmExtractionService.isAvailable()) {
        // Use LLM-based extraction (Claude API)
        logger.info('Using LLM extraction method');
        const llmResult = await llmExtractionService.extractReagents(text, options.protocolName);

        if (!llmResult.success) {
          // LLM extraction failed, fall back to rule-based
          logger.warn('LLM extraction failed, falling back to rule-based extraction:', llmResult.error);
          return await this.extractWithRuleBasedMethod(text, documentId, docMetadata);
        }

        // Transform LLM result to match expected format
        extractedData = {
          name: options.protocolName || null,
          description: null,
          reagents: llmResult.reagents,
          steps: [],
          notes: null,
          sample_requirements: null,
          time_estimates: []
        };

        confidenceScores = {
          name: options.protocolName ? 0.9 : 0,
          description: 0,
          reagents: llmResult.confidence,
          steps: 0,
          overall: llmResult.confidence,
          warnings: llmResult.metadata.warnings || [],
          notes: [`LLM extraction completed in ${llmResult.metadata.processing_time_ms}ms using ${llmResult.metadata.model}`]
        };

        extractionMetadata = {
          document_id: documentId,
          extraction_timestamp: new Date().toISOString(),
          extraction_method: 'llm',
          overall_confidence: llmResult.confidence,
          text_length: text.length,
          document_metadata: docMetadata,
          llm_metadata: llmResult.metadata,
          warnings: llmResult.metadata.warnings || [],
          parsing_notes: confidenceScores.notes
        };

      } else {
        // Use rule-based extraction (original method)
        logger.info('Using rule-based extraction method');
        return await this.extractWithRuleBasedMethod(text, documentId, docMetadata);
      }

      // Add confidence to each field
      const dataWithConfidence = this.addConfidenceScores(extractedData, confidenceScores);

      // Sanitize all data before returning to prevent Unicode/JSON errors
      const sanitizedData = this.sanitizeExtractedData(dataWithConfidence);
      const sanitizedMetadata = this.sanitizeExtractedData(extractionMetadata);

      return {
        extracted_data: sanitizedData,
        extraction_metadata: sanitizedMetadata,
        overall_confidence: confidenceScores.overall,
        manual_review_required: confidenceScores.overall < 0.7 || confidenceScores.warnings.length > 0
      };

    } catch (error) {
      logger.error('Error in protocol extraction', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Rule-based extraction method (original implementation)
   * Used as fallback when LLM is unavailable or fails
   */
  async extractWithRuleBasedMethod(text, documentId, docMetadata) {
    // Parse text into structured data
    const extractedData = await this.parseProtocolText(text);

    // Calculate confidence scores
    const confidenceScores = this.calculateConfidenceScores(extractedData, text);

    // Add confidence to each field
    const dataWithConfidence = this.addConfidenceScores(extractedData, confidenceScores);

    // Generate extraction metadata
    const extractionMetadata = {
      document_id: documentId,
      extraction_timestamp: new Date().toISOString(),
      extraction_method: 'rule-based',
      overall_confidence: confidenceScores.overall,
      text_length: text.length,
      document_metadata: docMetadata,
      warnings: confidenceScores.warnings,
      parsing_notes: confidenceScores.notes
    };

    // Sanitize all data before returning to prevent Unicode/JSON errors
    const sanitizedData = this.sanitizeExtractedData(dataWithConfidence);
    const sanitizedMetadata = this.sanitizeExtractedData(extractionMetadata);

    return {
      extracted_data: sanitizedData,
      extraction_metadata: sanitizedMetadata,
      overall_confidence: confidenceScores.overall,
      manual_review_required: confidenceScores.overall < 0.7 || confidenceScores.warnings.length > 0
    };
  }

  /**
   * Parse raw text into structured protocol data
   */
  async parseProtocolText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const extracted = {
      name: null,
      description: null,
      reagents: [],
      steps: [],
      notes: null,
      sample_requirements: null,
      time_estimates: []
    };

    let currentSection = null;
    let stepCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

      // Detect protocol title (usually first significant line or after "Protocol:")
      if (!extracted.name && this.looksLikeTitle(line)) {
        // Clean markdown formatting from title
        let title = line.replace(/^#{1,6}\s+/, '').trim();
        extracted.name = this.cleanText(title);
        continue;
      }

      // Detect section headers
      const sectionType = this.detectSectionHeader(line);
      if (sectionType) {
        currentSection = sectionType;
        
        // Extract inline content after header
        const headerMatch = this.extractAfterHeader(line);
        if (headerMatch && sectionType === 'description') {
          extracted.description = this.cleanText(headerMatch);
        }
        continue;
      }

      // Process content based on current section
      switch (currentSection) {
        case 'materials':
          const reagent = this.extractReagentInfo(line);
          if (reagent) {
            extracted.reagents.push(reagent);
          }
          break;

        case 'procedure':
          const step = this.extractStep(line, stepCounter);
          if (step) {
            extracted.steps.push(step);
            stepCounter++;
          }
          break;

        case 'description':
          if (!extracted.description && line.length > 20) {
            extracted.description = this.cleanText(line);
          }
          break;

        case 'notes':
          if (!extracted.notes) {
            extracted.notes = this.cleanText(line);
          }
          break;

        default:
          // Try to extract reagents from any line that looks like it contains reagent info
          if (this.looksLikeReagentLine(line)) {
            const reagent = this.extractReagentInfo(line);
            if (reagent) {
              extracted.reagents.push(reagent);
            }
          }
          
          // Try to extract steps from numbered/bulleted lines
          if (this.looksLikeStep(line)) {
            const step = this.extractStep(line, stepCounter);
            if (step) {
              extracted.steps.push(step);
              stepCounter++;
            }
          }
      }
    }

    // Post-processing cleanup
    extracted.reagents = this.deduplicateReagents(extracted.reagents);
    extracted.steps = this.cleanSteps(extracted.steps);

    return extracted;
  }

  /**
   * Detect if a line looks like a protocol title
   */
  looksLikeTitle(line) {
    // Check for markdown headers (# ## ###)
    if (/^#{1,3}\s+(.+)/.test(line)) {
      const title = line.replace(/^#{1,3}\s+/, '').trim();
      if (title.toLowerCase().includes('protocol') || 
          title.toLowerCase().includes('procedure') ||
          title.toLowerCase().includes('method')) {
        return true;
      }
    }
    
    // Check for title patterns
    for (const pattern of this.sectionHeaders.title) {
      if (pattern.test(line)) return true;
    }
    
    // Check if it's a short line (likely title) at the beginning
    return line.length < 100 && 
           (line.toLowerCase().includes('protocol') || 
            line.toLowerCase().includes('procedure') ||
            line.toLowerCase().includes('method'));
  }

  /**
   * Detect section headers in the text
   */
  detectSectionHeader(line) {
    // Check for markdown headers first
    const markdownHeader = /^#{2,6}\s+(.+)/.exec(line);
    if (markdownHeader) {
      const headerText = markdownHeader[1].toLowerCase();
      if (headerText.includes('reagent') || headerText.includes('material') || headerText.includes('component')) {
        return 'materials';
      }
      if (headerText.includes('step') || headerText.includes('procedure') || headerText.includes('protocol') || headerText.includes('method')) {
        return 'procedure';
      }
      if (headerText.includes('description') || headerText.includes('summary') || headerText.includes('overview')) {
        return 'description';
      }
      if (headerText.includes('note') || headerText.includes('comment') || headerText.includes('troubleshoot')) {
        return 'notes';
      }
    }
    
    // Check regular patterns
    for (const [section, patterns] of Object.entries(this.sectionHeaders)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return section;
        }
      }
    }
    return null;
  }

  /**
   * Extract content that appears after a section header on the same line
   */
  extractAfterHeader(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1 && colonIndex < line.length - 1) {
      return line.substring(colonIndex + 1).trim();
    }
    return null;
  }

  /**
   * Check if a line looks like it contains reagent information
   */
  looksLikeReagentLine(line) {
    // Check for markdown list items
    if (/^[\s]*[-\*\+]\s+/.test(line)) {
      return true;
    }
    
    // Check for reagent name patterns
    for (const pattern of this.reagentPatterns) {
      if (pattern.test(line)) return true;
    }
    
    // Check for quantity + unit patterns
    const quantityPattern = /\d+\.?\d*\s*(?:μL|uL|ul|mL|ml|L|l|μM|uM|mM|M|ng|μg|ug|mg|g|units|U|%)/i;
    return quantityPattern.test(line);
  }

  /**
   * Extract reagent information from a line
   */
  extractReagentInfo(line) {
    // Skip lines that are too short or look like fragments
    if (line.length < 3) {
      return null;
    }
    
    // Skip lines that are just numbers or very short fragments
    if (/^\d+[\s\)\.]?\s*$/.test(line) || line.length < 5) {
      return null;
    }
    
    // Pattern to match: name + quantity + unit (more flexible, including markdown lists)
    const reagentPattern = /^[\s\-\*\•\+]*(.+?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*([μumMnglLU%]+(?:\/[μumMnglLU%]+)?)\s*(?:per\s+sample|\/sample|each)?/i;
    
    const match = line.match(reagentPattern);
    if (match) {
      const [, name, quantity, unit] = match;
      const cleanedName = this.cleanText(name);
      
      // Filter out obvious junk names
      if (!cleanedName || cleanedName.length < 3 || /^\d+$/.test(cleanedName) || 
          cleanedName.includes('Program') || cleanedName.includes('Heat') ||
          cleanedName.includes('Add') || cleanedName.includes('Transfer')) {
        return null;
      }
      
      return {
        name: cleanedName,
        quantity_per_sample: parseFloat(quantity),
        unit: this.normalizeUnit(unit)
      };
    }

    // Enhanced pattern for common reagent formats
    const commonReagentPatterns = [
      /(?:^|\s)((?:PCR|RT|Taq|DNA|RNA|dNTP|Buffer|MgCl2|Primer|Polymerase|Mix)\s*[\w\s]*)\s*(\d+(?:\.\d+)?)\s*([μumMnglLU%]+)/i,
      /(?:^|\s)(\d+X?\s*(?:PCR|RT|Buffer|Mix)[\w\s]*)/i,
      /(?:^|\s)((?:Forward|Reverse|Random)\s*Primer[\w\s]*)/i
    ];
    
    for (const pattern of commonReagentPatterns) {
      const match = line.match(pattern);
      if (match) {
        let name = match[1];
        let quantity = match[2] ? parseFloat(match[2]) : null;
        let unit = match[3] || null;
        
        const cleanedName = this.cleanText(name);
        
        if (cleanedName && cleanedName.length > 2 && this.looksLikeReagentName(cleanedName)) {
          return {
            name: cleanedName,
            quantity_per_sample: quantity,
            unit: unit ? this.normalizeUnit(unit) : null
          };
        }
      }
    }

    // Try simpler pattern - just name (but be more selective, including markdown lists)
    const simplePattern = /^[\s\-\*\•\+]*(.*?)(?:\s*[:\-]\s*)?$/;
    const simpleMatch = line.match(simplePattern);
    
    if (simpleMatch && this.looksLikeReagentName(simpleMatch[1])) {
      const cleanedName = this.cleanText(simpleMatch[1]);
      
      // More strict filtering for simple pattern
      if (!cleanedName || cleanedName.length < 5 || 
          /^\d+[\s\)\.]/.test(cleanedName) ||
          cleanedName.includes('Get') || cleanedName.includes('Add') ||
          cleanedName.includes('Heat') || cleanedName.includes('Program') ||
          cleanedName.includes('Transfer') || cleanedName.includes('Perform')) {
        return null;
      }
      
      return {
        name: cleanedName,
        quantity_per_sample: null, // To be filled manually
        unit: null
      };
    }

    return null;
  }

  /**
   * Check if text looks like a reagent name
   */
  looksLikeReagentName(text) {
    for (const pattern of this.reagentPatterns) {
      if (pattern.test(text)) return true;
    }
    
    // Additional heuristics
    const commonWords = ['buffer', 'mix', 'solution', 'primer', 'polymerase', 'enzyme', 'kit'];
    const lowercaseText = text.toLowerCase();
    
    return commonWords.some(word => lowercaseText.includes(word));
  }

  /**
   * Check if a line looks like a protocol step
   */
  looksLikeStep(line) {
    // Check for numbered steps
    if (/^\d+\.?\s+/.test(line)) return true;
    
    // Check for bullet points
    if (/^[\s\-\*\•]\s+/.test(line)) return true;
    
    // Check for action words
    const actionWords = ['add', 'incubate', 'mix', 'centrifuge', 'heat', 'cool', 'transfer', 'pipette', 'vortex'];
    const lowercaseLine = line.toLowerCase();
    
    return actionWords.some(word => lowercaseLine.includes(word));
  }

  /**
   * Extract step information from a line
   */
  extractStep(line, stepNumber) {
    // Remove numbering and bullet points
    const cleanLine = line.replace(/^\d+\.?\s+/, '').replace(/^[\s\-\*\•]+/, '').trim();
    
    if (cleanLine.length < 10) return null; // Too short to be a meaningful step
    
    return {
      step_number: stepNumber + 1,
      instruction: this.cleanText(cleanLine),
      time_estimate: this.extractTimeFromStep(cleanLine)
    };
  }

  /**
   * Extract time information from a step
   */
  extractTimeFromStep(text) {
    const timePatterns = [
      /(\d+)\s*(?:min|minutes?)/i,
      /(\d+)\s*(?:sec|seconds?)/i,
      /(\d+)\s*(?:hr|hours?)/i,
      /(\d+)\s*h\b/i
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          duration: parseInt(match[1]),
          unit: match[0].toLowerCase().includes('sec') ? 'seconds' :
                match[0].toLowerCase().includes('min') ? 'minutes' : 'hours'
        };
      }
    }

    return null;
  }

  /**
   * Normalize units to standard formats
   */
  normalizeUnit(unit) {
    const unitMap = {
      'ul': 'μL',
      'uL': 'μL',
      'ml': 'mL',
      'uM': 'μM',
      'ug': 'μg'
    };

    return unitMap[unit] || unit;
  }

  /**
   * Remove duplicate reagents based on name similarity
   */
  deduplicateReagents(reagents) {
    const unique = [];
    
    for (const reagent of reagents) {
      // Skip reagents with null or empty names
      if (!reagent.name || typeof reagent.name !== 'string') {
        continue;
      }
      
      const existing = unique.find(r => 
        r.name && typeof r.name === 'string' &&
        this.stringSimilarity(r.name.toLowerCase(), reagent.name.toLowerCase()) > 0.8
      );
      
      if (!existing) {
        unique.push(reagent);
      } else if (reagent.quantity_per_sample && !existing.quantity_per_sample) {
        // Replace with more complete version
        Object.assign(existing, reagent);
      }
    }
    
    return unique;
  }

  /**
   * Clean up extracted steps
   */
  cleanSteps(steps) {
    return steps
      .filter(step => step.instruction.length > 10) // Filter out too-short steps
      .map((step, index) => ({
        ...step,
        step_number: index + 1 // Renumber sequentially
      }));
  }

  /**
   * Calculate confidence scores for extracted data
   */
  calculateConfidenceScores(extractedData, originalText) {
    const scores = {
      name: this.calculateNameConfidence(extractedData.name, originalText),
      description: this.calculateDescriptionConfidence(extractedData.description, originalText),
      reagents: this.calculateReagentsConfidence(extractedData.reagents, originalText),
      steps: this.calculateStepsConfidence(extractedData.steps, originalText),
      overall: 0,
      warnings: [],
      notes: []
    };

    // Calculate overall confidence
    const weights = { name: 0.2, description: 0.15, reagents: 0.4, steps: 0.25 };
    scores.overall = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (scores[key] * weight);
    }, 0);

    // Add warnings based on confidence scores
    if (scores.name < 0.5) scores.warnings.push('Low confidence in protocol name extraction');
    if (scores.reagents < 0.6) scores.warnings.push('Reagent list may be incomplete or inaccurate');
    if (scores.steps < 0.6) scores.warnings.push('Protocol steps may need manual review');
    if (extractedData.reagents.length === 0) scores.warnings.push('No reagents detected');
    if (extractedData.steps.length === 0) scores.warnings.push('No protocol steps detected');

    // Round scores to 2 decimal places
    Object.keys(scores).forEach(key => {
      if (typeof scores[key] === 'number') {
        scores[key] = Math.round(scores[key] * 100) / 100;
      }
    });

    return scores;
  }

  calculateNameConfidence(name, text) {
    if (!name) return 0;
    
    // Higher confidence if name appears in first few lines
    const firstLines = text.split('\n').slice(0, 5).join(' ');
    if (firstLines.toLowerCase().includes(name.toLowerCase())) return 0.9;
    
    // Medium confidence if it contains protocol-related keywords
    const protocolKeywords = ['protocol', 'procedure', 'method', 'pcr', 'extraction'];
    const hasKeywords = protocolKeywords.some(keyword => 
      name.toLowerCase().includes(keyword)
    );
    
    return hasKeywords ? 0.7 : 0.5;
  }

  calculateDescriptionConfidence(description, text) {
    if (!description) return 0;
    
    // Higher confidence for longer, more detailed descriptions
    if (description.length > 50) return 0.8;
    if (description.length > 20) return 0.6;
    
    return 0.4;
  }

  calculateReagentsConfidence(reagents, text) {
    if (reagents.length === 0) return 0;
    
    let totalConfidence = 0;
    let reagentsWithQuantities = 0;
    
    for (const reagent of reagents) {
      let reagentConfidence = 0.5; // Base confidence
      
      // Higher confidence if quantity and unit are present
      if (reagent.quantity_per_sample && reagent.unit) {
        reagentConfidence = 0.9;
        reagentsWithQuantities++;
      }
      
      // Higher confidence if reagent name matches common patterns
      const matchesPattern = this.reagentPatterns.some(pattern => 
        pattern.test(reagent.name)
      );
      if (matchesPattern) reagentConfidence += 0.1;
      
      totalConfidence += Math.min(reagentConfidence, 1.0);
    }
    
    const avgConfidence = totalConfidence / reagents.length;
    
    // Bonus for having quantities on most reagents
    const quantityBonus = reagentsWithQuantities / reagents.length * 0.2;
    
    return Math.min(avgConfidence + quantityBonus, 1.0);
  }

  calculateStepsConfidence(steps, text) {
    if (steps.length === 0) return 0;
    
    // Base confidence increases with number of steps
    let confidence = Math.min(steps.length * 0.1, 0.6);
    
    // Higher confidence if steps are numbered or well-structured
    const numberedSteps = steps.filter(step => 
      /^\d+\.?\s/.test(step.instruction) || step.step_number
    ).length;
    
    const structureBonus = (numberedSteps / steps.length) * 0.3;
    confidence += structureBonus;
    
    // Higher confidence if steps contain action words
    const actionWords = ['add', 'incubate', 'mix', 'centrifuge', 'heat', 'cool'];
    const stepsWithActions = steps.filter(step =>
      actionWords.some(word => step.instruction.toLowerCase().includes(word))
    ).length;
    
    const actionBonus = (stepsWithActions / steps.length) * 0.2;
    confidence += actionBonus;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Add confidence scores to extracted data structure
   */
  addConfidenceScores(extractedData, confidenceScores) {
    return {
      name: {
        value: extractedData.name,
        confidence: confidenceScores.name
      },
      description: {
        value: extractedData.description,
        confidence: confidenceScores.description
      },
      reagents: extractedData.reagents.map(reagent => ({
        name: {
          value: reagent.name,
          confidence: reagent.quantity_per_sample ? 0.9 : 0.6
        },
        quantity_per_sample: {
          value: reagent.quantity_per_sample,
          confidence: reagent.quantity_per_sample ? 0.9 : 0
        },
        unit: {
          value: reagent.unit,
          confidence: reagent.unit ? 0.9 : 0
        }
      })),
      steps: {
        value: extractedData.steps.map(step => step.instruction),
        confidence: confidenceScores.steps
      },
      notes: {
        value: extractedData.notes,
        confidence: extractedData.notes ? 0.7 : 0
      }
    };
  }

  /**
   * Utility function to calculate string similarity
   */
  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Clean text by removing extra whitespace and formatting
   */
  cleanText(text) {
    if (!text) return null;
    
    return text
      .replace(/\u0000/g, '') // Remove null bytes that cause Unicode errors
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/[\r\n]/g, '') // Remove line breaks
      .trim();
  }

  /**
   * Sanitize extracted data to remove problematic characters for JSON storage
   */
  sanitizeExtractedData(data) {
    if (typeof data === 'string') {
      return this.cleanText(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeExtractedData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeExtractedData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Process extraction job
   * @param {string} jobId - The extraction job ID
   * @param {Object} options - Extraction options
   */
  async processExtractionJob(jobId, options = {}) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get job details
      const jobResult = await client.query(
        'SELECT ej.*, pd.file_path, pd.mime_type, pd.original_filename FROM extraction_jobs ej JOIN protocol_documents pd ON ej.document_id = pd.id WHERE ej.job_id = $1',
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        throw new Error(`Extraction job ${jobId} not found`);
      }

      const job = jobResult.rows[0];

      // Update status to processing
      await client.query(
        'UPDATE extraction_jobs SET status = $1 WHERE job_id = $2',
        ['processing', jobId]
      );

      await client.query('COMMIT');

      // Perform extraction with options
      const extractionResult = await this.extractProtocolData(
        job.file_path,
        job.mime_type,
        job.document_id,
        {
          method: options.method,
          protocolName: options.protocolName || job.original_filename
        }
      );
      
      // Save extraction results
      await client.query('BEGIN');
      
      await client.query(
        `INSERT INTO extracted_protocol_data 
         (extraction_job_id, document_id, extracted_data, extraction_metadata, 
          overall_confidence, manual_review_required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          job.id,
          job.document_id,
          JSON.stringify(extractionResult.extracted_data),
          JSON.stringify(extractionResult.extraction_metadata),
          extractionResult.overall_confidence,
          extractionResult.manual_review_required
        ]
      );
      
      // Update job status to completed
      await client.query(
        'UPDATE extraction_jobs SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE job_id = $2',
        ['completed', jobId]
      );
      
      await client.query('COMMIT');
      
      return extractionResult;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update job status to failed
      await client.query(
        'UPDATE extraction_jobs SET status = $1, completed_at = CURRENT_TIMESTAMP, error_message = $2 WHERE job_id = $3',
        ['failed', error.message, jobId]
      );
      
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new ProtocolExtractionService();