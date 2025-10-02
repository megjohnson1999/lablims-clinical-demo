const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const LLM_ENABLED = process.env.LLM_EXTRACTION_ENABLED === 'true';
const API_KEY = process.env.ANTHROPIC_API_KEY;

const EXTRACTION_PROMPT = `You are a laboratory protocol analyst. Extract reagents from the provided protocol document and return them in CSV format.

CRITICAL REQUIREMENTS:
1. Return ONLY a CSV table with these exact columns: reagent_name,quantity_per_sample,unit
2. Include the header row
3. Calculate per-sample quantities (divide master mix volumes by number of samples)
4. Use standard units: µL, mL, L, µg, mg, g, kg, mM, µM, U
5. For unspecified quantities, use "As needed"

INCLUDE these reagents:
- All buffers and solutions (RT Buffer, PCR Buffer, SM Buffer, EDTA, etc.)
- All enzymes (DNA polymerase, RT enzyme, Sequenase, DNase, Lysozyme, etc.)
- Nucleotides and primers (dNTP mix, primers, controls)
- Chemical reagents and biological materials
- Water (nuclease-free H2O)

EXCLUDE these consumables:
- Tubes, tips, plates, containers, adaptors
- Pipette tips, syringes, filters
- Equipment, instruments, timers
- Safety supplies (gloves, lab coats, waste containers)
- General lab supplies (markers, ice, racks)

IMPORTANT: Analyze the ENTIRE protocol including all steps and rounds. Return ONLY the CSV data with no explanatory text.

Example output format:
reagent_name,quantity_per_sample,unit
5X RT Buffer,4,µL
12.5mM dNTP mix,0.8,µL
RT enzyme Promega,2,µL
Nuclease-free H2O,3.2,µL
10X PCR Buffer,10,µL
SM buffer,1200,µL
Lysozyme 10mg/ml,80,µL
TurboDNaseI 2U/µL,20,µL`;

class AIReagentExtractionService {
  constructor() {
    this.client = null;
    if (LLM_ENABLED && API_KEY) {
      this.client = new Anthropic({ apiKey: API_KEY });
    }
  }

  isEnabled() {
    return LLM_ENABLED && this.client !== null;
  }

  async extractTextFromFile(buffer, mimetype, filename) {
    try {
      // PDF files
      if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
        const data = await pdfParse(buffer);
        return data.text;
      }

      // Word documents
      if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }

      // Plain text, markdown, CSV
      if (
        mimetype.startsWith('text/') ||
        filename.endsWith('.txt') ||
        filename.endsWith('.md') ||
        filename.endsWith('.csv')
      ) {
        return buffer.toString('utf-8');
      }

      throw new Error(`Unsupported file type: ${mimetype}`);
    } catch (error) {
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  parseCSVResponse(csvText) {
    const lines = csvText.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('AI response did not contain enough data');
    }

    // Find header row (might not be the first line if AI added explanation)
    let headerIndex = lines.findIndex(line =>
      line.toLowerCase().includes('reagent') &&
      line.toLowerCase().includes('quantity') &&
      line.toLowerCase().includes('unit')
    );

    if (headerIndex === -1) {
      throw new Error('Could not find CSV header in AI response');
    }

    const headers = lines[headerIndex].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('reagent') || h.includes('name'));
    const qtyIdx = headers.findIndex(h => h.includes('quantity'));
    const unitIdx = headers.findIndex(h => h.includes('unit'));

    if (nameIdx === -1 || qtyIdx === -1 || unitIdx === -1) {
      throw new Error('CSV headers are missing required columns');
    }

    const reagents = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length > Math.max(nameIdx, qtyIdx, unitIdx) && values[nameIdx]) {
        let quantity = values[qtyIdx] || 'As needed';
        const numericValue = parseFloat(quantity);
        if (!isNaN(numericValue) && isFinite(numericValue)) {
          quantity = numericValue;
        } else if (quantity.toLowerCase() === 'as needed') {
          quantity = 'As needed';
        }

        reagents.push({
          name: values[nameIdx],
          quantity_per_sample: quantity,
          unit: values[unitIdx] || ''
        });
      }
    }

    return reagents;
  }

  async extractReagentsFromProtocol(fileBuffer, mimetype, filename) {
    if (!this.isEnabled()) {
      throw new Error('AI extraction is not enabled. Check environment variables.');
    }

    try {
      // Extract text from file
      const protocolText = await this.extractTextFromFile(fileBuffer, mimetype, filename);

      if (!protocolText || protocolText.trim().length < 50) {
        throw new Error('Protocol document appears to be empty or too short');
      }

      // Call Claude API
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\nPROTOCOL DOCUMENT:\n\n${protocolText}`
          }
        ]
      });

      const csvText = response.content[0].text;

      // Parse CSV response
      const reagents = this.parseCSVResponse(csvText);

      if (reagents.length === 0) {
        throw new Error('No reagents were extracted from the protocol');
      }

      // Count extraction quality indicators
      const numericCount = reagents.filter(r => typeof r.quantity_per_sample === 'number').length;
      const standardUnits = ['µL', 'mL', 'L', 'µg', 'mg', 'g', 'kg', 'mM', 'µM', 'U', 'nM', 'pM'];
      const validUnitCount = reagents.filter(r =>
        standardUnits.some(unit => r.unit.includes(unit))
      ).length;

      return {
        reagents,
        extractionQuality: {
          reagentsFound: reagents.length,
          withNumericQuantities: numericCount,
          withStandardUnits: validUnitCount,
          reviewRequired: true // Always require manual review
        },
        rawResponse: csvText,
        metadata: {
          extractedCount: reagents.length,
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('AI reagent extraction error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

}

module.exports = new AIReagentExtractionService();
