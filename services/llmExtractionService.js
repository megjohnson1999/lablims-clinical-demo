const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * LLM-Powered Protocol Extraction Service
 * Uses Claude API to extract structured reagent data from protocol text
 */
class LLMExtractionService {
  constructor() {
    this.enabled = process.env.LLM_EXTRACTION_ENABLED === 'true';
    this.apiKey = process.env.ANTHROPIC_API_KEY;

    if (this.enabled && !this.apiKey) {
      logger.warn('LLM extraction enabled but ANTHROPIC_API_KEY not set. Feature will be disabled.');
      this.enabled = false;
    }

    if (this.enabled) {
      this.anthropic = new Anthropic({
        apiKey: this.apiKey,
      });
      logger.info('LLM extraction service initialized successfully');
    } else {
      logger.info('LLM extraction service disabled (feature flag off or API key missing)');
    }
  }

  /**
   * Check if LLM extraction is available
   */
  isAvailable() {
    return this.enabled && this.apiKey;
  }

  /**
   * Generate structured prompt for reagent extraction
   */
  generateExtractionPrompt(protocolText, protocolName = 'Unknown Protocol') {
    return `You are a laboratory protocol analysis assistant. Extract all reagents from the following protocol and return them as a CSV.

PROTOCOL NAME: ${protocolName}

REQUIREMENTS:
- Extract ONLY reagents, chemicals, buffers, enzymes, and biological materials
- Calculate per-sample quantities (divide by number of samples if needed)
- Use standard lab units: µL, mL, L, µg, mg, g, mM, µM, U, etc.
- Include stock concentrations in reagent names when relevant (e.g., "5X RT Buffer", "10mg/ml Lysozyme")
- Use "As needed" for quantities that vary or aren't specified

EXCLUDE:
- Tubes, tips, plates, containers, consumables
- Equipment and instruments
- Safety supplies
- General lab supplies

FORMAT:
Return ONLY a CSV with these exact columns (no explanatory text):
reagent_name,quantity_per_sample,unit

EXAMPLES:
5X RT Buffer,4,µL
12.5mM dNTP mix,0.8,µL
RT enzyme Promega,2,µL
Nuclease-free H2O,3.2,µL
10X PCR Buffer,10,µL
SM buffer,1200,µL
Lysozyme 10mg/ml,80,µL
TurboDNaseI 2U/µL,20,µL

PROTOCOL TEXT TO ANALYZE:
${protocolText}

Return only the CSV data:`;
  }

  /**
   * Parse CSV response from Claude into reagent objects
   */
  parseCSVResponse(csvText) {
    try {
      const lines = csvText.trim().split('\n');

      if (lines.length < 2) {
        throw new Error('Response too short - expected CSV with header and data rows');
      }

      // Find header row (should contain reagent_name, quantity_per_sample, unit)
      let headerIndex = 0;
      let headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

      // If first line doesn't look like a header, try to find it
      if (!headers.includes('reagent_name') && !headers.some(h => h.includes('reagent'))) {
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          const testHeaders = lines[i].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          if (testHeaders.includes('reagent_name') || testHeaders.some(h => h.includes('reagent'))) {
            headerIndex = i;
            headers = testHeaders;
            break;
          }
        }
      }

      // Find column indices
      const nameIndex = headers.findIndex(h =>
        h === 'reagent_name' || h.includes('reagent') || h.includes('name')
      );
      const quantityIndex = headers.findIndex(h =>
        h === 'quantity_per_sample' || h.includes('quantity')
      );
      const unitIndex = headers.findIndex(h =>
        h === 'unit' || h === 'units'
      );

      if (nameIndex === -1 || quantityIndex === -1 || unitIndex === -1) {
        throw new Error(`Invalid CSV structure. Expected columns: reagent_name, quantity_per_sample, unit. Got: ${headers.join(', ')}`);
      }

      const reagents = [];

      // Parse data rows (start after header)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));

        // Skip if not enough columns
        if (values.length <= Math.max(nameIndex, quantityIndex, unitIndex)) {
          logger.debug(`Skipping incomplete row ${i}: ${line}`);
          continue;
        }

        const name = values[nameIndex];
        if (!name || name.length < 2) {
          logger.debug(`Skipping row ${i} - invalid name: ${line}`);
          continue;
        }

        const quantityStr = values[quantityIndex] || 'As needed';
        let quantity = quantityStr;

        // Try to parse as number
        if (quantityStr.toLowerCase() !== 'as needed') {
          const numericValue = parseFloat(quantityStr);
          if (!isNaN(numericValue) && isFinite(numericValue)) {
            quantity = numericValue;
          }
        }

        reagents.push({
          name: name,
          quantity_per_sample: quantity,
          unit: values[unitIndex] || ''
        });
      }

      return reagents;
    } catch (error) {
      logger.error('Error parsing CSV response:', error);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Extract reagents from protocol text using Claude API
   * @param {string} protocolText - The full protocol text
   * @param {string} protocolName - Optional protocol name for context
   * @returns {Promise<Object>} - Extraction result with reagents, confidence, and metadata
   */
  async extractReagents(protocolText, protocolName = 'Unknown Protocol') {
    if (!this.isAvailable()) {
      throw new Error('LLM extraction is not available. Check feature flag and API key configuration.');
    }

    const startTime = Date.now();

    try {
      logger.info(`Starting LLM extraction for protocol: ${protocolName}`);

      const prompt = this.generateExtractionPrompt(protocolText, protocolName);

      // Call Claude API
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0, // Deterministic output for consistency
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = message.content[0].text;
      logger.debug('LLM response received:', { length: responseText.length, usage: message.usage });

      // Parse the CSV response
      const reagents = this.parseCSVResponse(responseText);

      const processingTime = Date.now() - startTime;

      // Calculate confidence score
      const confidence = this.calculateConfidence(reagents, protocolText, message);

      logger.info(`LLM extraction completed: ${reagents.length} reagents extracted in ${processingTime}ms`);

      return {
        success: true,
        reagents: reagents,
        confidence: confidence,
        metadata: {
          model: message.model,
          processing_time_ms: processingTime,
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          reagent_count: reagents.length,
          warnings: this.generateWarnings(reagents, confidence)
        },
        raw_response: responseText
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('LLM extraction failed:', {
        error: error.message,
        stack: error.stack,
        protocolName,
        processingTime
      });

      // Categorize error for better user messaging
      let errorType = 'unknown';
      let userMessage = 'Failed to extract reagents using AI';

      if (error.status === 401) {
        errorType = 'authentication';
        userMessage = 'Invalid API key. Please check your Anthropic API configuration.';
      } else if (error.status === 429) {
        errorType = 'rate_limit';
        userMessage = 'API rate limit exceeded. Please try again in a few moments or use manual CSV upload.';
      } else if (error.message && error.message.includes('parse')) {
        errorType = 'parsing';
        userMessage = 'Failed to parse AI response. Please try again or use manual CSV upload.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorType = 'network';
        userMessage = 'Network error connecting to AI service. Please check your connection.';
      }

      return {
        success: false,
        error: userMessage,
        errorType: errorType,
        metadata: {
          processing_time_ms: processingTime,
          error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      };
    }
  }

  /**
   * Calculate confidence score based on extraction quality
   */
  calculateConfidence(reagents, protocolText, message) {
    let confidence = 0.5; // Base confidence

    // Factor 1: Number of reagents (expect 5-30 for typical protocols)
    if (reagents.length >= 5 && reagents.length <= 30) {
      confidence += 0.2;
    } else if (reagents.length > 0) {
      confidence += 0.1;
    }

    // Factor 2: Percentage with quantities
    const withQuantities = reagents.filter(r =>
      typeof r.quantity_per_sample === 'number' || r.quantity_per_sample === 'As needed'
    ).length;
    const quantityRatio = reagents.length > 0 ? withQuantities / reagents.length : 0;
    confidence += quantityRatio * 0.2;

    // Factor 3: All reagents have units
    const withUnits = reagents.filter(r => r.unit && r.unit.length > 0).length;
    const unitRatio = reagents.length > 0 ? withUnits / reagents.length : 0;
    confidence += unitRatio * 0.1;

    // Normalize to 0-1 range
    confidence = Math.min(Math.max(confidence, 0), 1);

    // Round to 2 decimal places
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Generate warnings based on extraction results
   */
  generateWarnings(reagents, confidence) {
    const warnings = [];

    if (reagents.length === 0) {
      warnings.push('No reagents detected. Please verify the protocol text or use manual CSV upload.');
    }

    if (reagents.length > 50) {
      warnings.push('Large number of reagents detected. Please review for potential duplicates or consumables.');
    }

    if (confidence < 0.5) {
      warnings.push('Low confidence extraction. Manual review strongly recommended.');
    } else if (confidence < 0.7) {
      warnings.push('Medium confidence extraction. Please review reagent list carefully.');
    }

    const missingQuantities = reagents.filter(r =>
      !r.quantity_per_sample || (typeof r.quantity_per_sample !== 'number' && r.quantity_per_sample !== 'As needed')
    ).length;

    if (missingQuantities > reagents.length * 0.3) {
      warnings.push(`${missingQuantities} reagents missing quantities. Please add quantities manually.`);
    }

    const missingUnits = reagents.filter(r => !r.unit || r.unit.length === 0).length;
    if (missingUnits > 0) {
      warnings.push(`${missingUnits} reagents missing units. Please add units manually.`);
    }

    return warnings;
  }
}

module.exports = new LLMExtractionService();
