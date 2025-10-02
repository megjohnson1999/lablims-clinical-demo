const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const { idGenerationService } = require('../services/idGenerationService');
const logger = require('../utils/logger');
const { createErrorResponse, handleDatabaseError, withErrorHandling } = require('../utils/errorHandling');
const protocolExtractionService = require('../services/protocolExtractionService');
const aiReagentExtraction = require('../services/aiReagentExtraction');

// Configure multer for document uploads
// Use Railway Volume path if in production, local path otherwise
const getUploadPath = () => {
  // Check if running on Railway (volume mounted at /data)
  if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    return '/data/uploads/protocol-documents';
  }
  // Local development
  return path.join(__dirname, '../uploads/protocol-documents');
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadPath();
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp - handle spaces and special characters
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/\s+/g, '_')           // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9._-]/g, '') // Remove special characters except dots, underscores, and hyphens
      .replace(/_{2,}/g, '_')         // Replace multiple underscores with single
      .replace(/^_|_$/g, '');         // Remove leading/trailing underscores
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'application/octet-stream' // Generic binary type - we'll check extension
    ];
    
    // Check file extension for supported file types
    const isMarkdownFile = file.originalname.toLowerCase().endsWith('.md') || 
                          file.originalname.toLowerCase().endsWith('.markdown');
    const isPdfFile = file.originalname.toLowerCase().endsWith('.pdf');
    const isWordFile = file.originalname.toLowerCase().endsWith('.docx') || 
                      file.originalname.toLowerCase().endsWith('.doc');
    const isTextFile = file.originalname.toLowerCase().endsWith('.txt');
    
    const isSupportedFile = isMarkdownFile || isPdfFile || isWordFile || isTextFile;
    
    if (allowedMimes.includes(file.mimetype) || isSupportedFile) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word documents, text files, and markdown files are allowed.'));
    }
  }
});

// @route   GET api/protocols/extraction-config
// @desc    Get extraction configuration (check if LLM is available)
// @access  Private
router.get('/extraction-config', auth, (req, res) => {
  res.json({
    llm_extraction_available: protocolExtractionService.isLLMExtractionAvailable(),
    supported_methods: ['llm', 'rule-based', 'manual-csv'],
    default_method: protocolExtractionService.isLLMExtractionAvailable() ? 'llm' : 'manual-csv'
  });
});

// @route   GET api/protocols
// @desc    Get all protocols with pagination and filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    is_active = 'true',
    search 
  } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Build WHERE conditions
    let whereConditions = [];
    let queryParamsArray = [];
    let paramIndex = 1;
    
    // Active filter
    if (is_active !== 'all') {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParamsArray.push(is_active === 'true');
      paramIndex++;
    }
    
    // Search filter
    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParamsArray.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM protocols ${whereClause}`;
    const countResult = await db.query(countQuery, queryParamsArray);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Data query with pagination
    const dataQuery = `
      SELECT p.*, 
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM protocols p
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY COALESCE(p.updated_at, p.created_at) DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParamsArray.push(limit, offset);
    const result = await db.query(dataQuery, queryParamsArray);
    
    res.json({
      protocols: result.rows,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch protocols', 'protocol', null, req.query);
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/protocols/search
// @desc    Search protocols
// @access  Private
router.get('/search', auth, async (req, res) => {
  const { term } = req.query;
  
  if (!term) {
    return res.status(400).json({ msg: 'Search term is required' });
  }
  
  try {
    const query = `
      SELECT p.*, 
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM protocols p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.is_active = true AND (
        p.name ILIKE $1 OR
        p.description ILIKE $1 OR
        p.basic_steps ILIKE $1
      )
      ORDER BY p.name ASC
    `;
    
    const result = await db.query(query, [`%${term}%`]);
    res.json(result.rows);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'search protocols', 'protocol', null, { term });
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/protocols/usage-stats
// @desc    Get protocol usage statistics
// @access  Private
router.get('/usage-stats', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM protocol_usage_stats ORDER BY usage_count DESC');
    res.json(result.rows);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch protocol usage stats', 'protocol', null);
    res.status(500).json(errorResponse);
  }
});

//=============================================================================
// DOCUMENT MANAGEMENT ROUTES (General Documentation System)
// NOTE: These routes must be defined before parameterized routes to avoid conflicts
//=============================================================================

// @route   GET api/protocols/documents/categories
// @desc    Get available document categories
// @access  Private
router.get('/documents/categories', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT category 
       FROM protocol_documents 
       WHERE category IS NOT NULL 
       ORDER BY category`
    );
    
    const categories = result.rows.map(row => row.category);
    res.json(categories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/protocols/documents/upload
// @desc    Upload document for general documentation (no AI processing)
// @access  Private
router.post('/documents/upload', [auth], upload.single('document'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No document uploaded' });
    }

    const { protocol_id, category, description } = req.body;
    
    await client.query('BEGIN');
    
    // Store document information
    const documentResult = await client.query(
      `INSERT INTO protocol_documents 
       (protocol_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by, category, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        protocol_id || null,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user.id,
        category || null,
        description || null
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      document: documentResult.rows[0],
      message: 'Document uploaded successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('Error cleaning up file:', unlinkError);
      }
    }
    
    logger.error('Document upload failed:', error);
    res.status(500).json({ 
      msg: 'Failed to upload document',
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// @route   GET api/protocols/documents
// @desc    Get all documents with filtering and search
// @access  Private
router.get('/documents', auth, async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    protocol_id,
    category,
    search,
    mime_type
  } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Build WHERE conditions
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (protocol_id) {
      whereConditions.push(`pd.protocol_id = $${paramIndex}`);
      queryParams.push(protocol_id);
      paramIndex++;
    }
    
    if (category) {
      whereConditions.push(`pd.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }
    
    if (mime_type) {
      whereConditions.push(`pd.mime_type = $${paramIndex}`);
      queryParams.push(mime_type);
      paramIndex++;
    }
    
    if (search) {
      whereConditions.push(`(pd.original_filename ILIKE $${paramIndex} OR pd.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM protocol_documents pd 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Data query with joins
    const dataQuery = `
      SELECT 
        pd.*,
        u.username as uploaded_by_username,
        u.first_name as uploaded_by_first_name,
        u.last_name as uploaded_by_last_name,
        p.name as protocol_name,
        p.id as protocol_id
      FROM protocol_documents pd
      LEFT JOIN users u ON pd.uploaded_by = u.id
      LEFT JOIN protocols p ON pd.protocol_id = p.id
      ${whereClause}
      ORDER BY pd.upload_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const result = await db.query(dataQuery, queryParams);
    
    res.json({
      documents: result.rows,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/protocols/documents/:id
// @desc    Get document metadata by ID
// @access  Private
router.get('/documents/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        pd.*,
        u.username as uploaded_by_username,
        u.first_name as uploaded_by_first_name,
        u.last_name as uploaded_by_last_name,
        p.name as protocol_name
      FROM protocol_documents pd
      LEFT JOIN users u ON pd.uploaded_by = u.id
      LEFT JOIN protocols p ON pd.protocol_id = p.id
      WHERE pd.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Document not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching document:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/protocols/documents/:id/download
// @desc    Download document file
// @access  Private
router.get('/documents/:id/download', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT file_path, original_filename, mime_type FROM protocol_documents WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Document not found' });
    }
    
    const document = result.rows[0];
    
    // Check if file exists
    try {
      await fs.access(document.file_path);
    } catch (err) {
      logger.error('File not found on disk:', document.file_path);
      return res.status(404).json({ msg: 'File not found on server' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
    res.setHeader('Content-Type', document.mime_type);
    
    // Stream the file
    res.sendFile(path.resolve(document.file_path));
    
  } catch (error) {
    logger.error('Error downloading document:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE api/protocols/documents/:id
// @desc    Delete document and file
// @access  Private (user must own the document or be admin/editor)
router.delete('/documents/:id', [auth], async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get document info and check ownership
    const result = await client.query(
      'SELECT * FROM protocol_documents WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Document not found' });
    }
    
    const document = result.rows[0];
    
    // Check if user can delete (owner, admin, or editor)
    if (document.uploaded_by !== req.user.id && !['admin', 'editor'].includes(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ msg: 'Not authorized to delete this document' });
    }
    
    // Delete from database
    await client.query('DELETE FROM protocol_documents WHERE id = $1', [req.params.id]);
    
    await client.query('COMMIT');
    
    // Delete file from disk (async, don't block response)
    setImmediate(async () => {
      try {
        await fs.unlink(document.file_path);
        logger.info(`Deleted file: ${document.file_path}`);
      } catch (unlinkError) {
        logger.error('Error deleting file from disk:', unlinkError);
      }
    });
    
    res.json({ msg: 'Document deleted successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting document:', error);
    res.status(500).json({ msg: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// AI Reagent Extraction Routes (must be before /:id route)

// Check if AI extraction is available
router.get('/ai-extraction-status', auth, async (req, res) => {
  try {
    const isEnabled = aiReagentExtraction.isEnabled();
    res.json({
      enabled: isEnabled,
      message: isEnabled
        ? 'AI extraction is available'
        : 'AI extraction is not configured. Set LLM_EXTRACTION_ENABLED=true and ANTHROPIC_API_KEY in environment variables.'
    });
  } catch (err) {
    logger.error('Error checking AI extraction status:', err);
    res.status(500).json({
      enabled: false,
      msg: 'Error checking AI extraction status',
      error: err.message
    });
  }
});

// Extract reagents from uploaded protocol document using AI
router.post('/extract-reagents-ai', auth, upload.single('protocolFile'), async (req, res) => {
  try {
    // Check if AI extraction is enabled
    if (!aiReagentExtraction.isEnabled()) {
      return res.status(503).json({
        msg: 'AI extraction is not available',
        error: 'LLM_EXTRACTION_ENABLED is not set to true or ANTHROPIC_API_KEY is missing'
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    logger.info('AI extraction request:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      user: req.user.id
    });

    // Read file buffer
    const fileBuffer = await fs.readFile(req.file.path);

    // Extract reagents using AI
    const result = await aiReagentExtraction.extractReagentsFromProtocol(
      fileBuffer,
      req.file.mimetype,
      req.file.originalname
    );

    // Save document to database (without protocol_id, will be linked later)
    const documentResult = await db.query(
      `INSERT INTO protocol_documents
        (filename, original_filename, file_path, file_size, mime_type, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        'Protocol Document'
      ]
    );

    const savedDocument = {
      id: documentResult.rows[0].id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    };

    logger.info('AI extraction successful:', {
      reagentCount: result.reagents.length,
      withNumericQuantities: result.extractionQuality.withNumericQuantities,
      withStandardUnits: result.extractionQuality.withStandardUnits,
      inputTokens: result.metadata.inputTokens,
      outputTokens: result.metadata.outputTokens,
      documentSaved: savedDocument.filename,
      documentId: savedDocument.id
    });

    res.json({
      success: true,
      reagents: result.reagents,
      extractionQuality: result.extractionQuality,
      metadata: result.metadata,
      document: savedDocument,
      warnings: ['AI extraction complete. Please review all reagents carefully before saving.']
    });

  } catch (err) {
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    logger.error('AI reagent extraction error:', err);
    res.status(500).json({
      success: false,
      msg: 'AI extraction failed',
      error: err.message
    });
  }
});

// @route   GET api/protocols/:id
// @desc    Get protocol by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM protocols p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Protocol not found' });
    }

    // Fetch associated documents
    const documentsResult = await db.query(
      `SELECT id, filename, original_filename, file_path, file_size,
        mime_type, upload_date, category, description
      FROM protocol_documents
      WHERE protocol_id = $1
      ORDER BY upload_date DESC`,
      [req.params.id]
    );

    const protocol = result.rows[0];
    protocol.documents = documentsResult.rows;

    res.json(protocol);
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined
    });
  }
});

// @route   POST api/protocols/:id/calculate-reagents
// @desc    Calculate total reagent requirements for a protocol with given sample count
// @access  Private
router.post('/:id/calculate-reagents', [
  auth,
  [
    check('sample_count', 'Sample count is required and must be a positive number').isInt({ min: 1 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sample_count } = req.body;
  
  try {
    // Get protocol with required reagents
    const protocolResult = await db.query(
      'SELECT id, name, required_reagents FROM protocols WHERE id = $1 AND is_active = true',
      [req.params.id]
    );

    if (protocolResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Protocol not found or inactive' });
    }

    const protocol = protocolResult.rows[0];
    const requiredReagents = protocol.required_reagents || [];

    // Unit conversion helper function for volumes
    const convertToBaseUnit = (quantity, unit) => {
      const qty = parseFloat(quantity);
      if (isNaN(qty)) return 0;
      
      // Convert everything to microliters (µL) as base unit for volumes
      switch (unit?.toLowerCase()) {
        case 'ml':
        case 'milliliter':
        case 'milliliters':
          return qty * 1000; // 1 mL = 1000 µL
        case 'l':
        case 'liter':
        case 'liters':
          return qty * 1000000; // 1 L = 1,000,000 µL
        case 'µl':
        case 'ul':
        case 'microliter':
        case 'microliters':
          return qty; // Already in base unit
        default:
          // For non-volume units (pieces, g, etc.), return as-is
          return qty;
      }
    };

    // Calculate total reagent requirements and find matching inventory items
    const calculatedReagents = [];
    
    for (const reagent of requiredReagents) {
      // Handle "As needed" quantities
      const totalQuantity = typeof reagent.quantity_per_sample === 'number' 
        ? Math.round((reagent.quantity_per_sample * sample_count) * 1000) / 1000 // Round to 3 decimal places
        : reagent.quantity_per_sample; // Keep "As needed" as string
      
      // Convert required quantity to base unit for comparison
      const totalQuantityInBaseUnit = typeof totalQuantity === 'number' 
        ? convertToBaseUnit(totalQuantity, reagent.unit)
        : totalQuantity;
      
      // Find matching inventory items by name (prioritize by expiration date and quantity)
      const inventoryResult = await db.query(`
        SELECT i.*, 
               CASE 
                 WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
                 ELSE false
               END as is_low_stock,
               CASE 
                 WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
                 ELSE false
               END as is_expired
        FROM inventory i
        WHERE LOWER(i.name) LIKE LOWER($1)
          AND i.current_quantity > 0
        ORDER BY i.expiration_date ASC NULLS LAST, i.current_quantity DESC
      `, [`%${reagent.name}%`]);

      let availableQuantity = 0;
      let matchingItems = [];
      let warnings = [];

      // Calculate total available quantity from all matching items (with unit conversion)
      for (const item of inventoryResult.rows) {
        const convertedQuantity = convertToBaseUnit(item.current_quantity, item.unit_of_measure);
        availableQuantity += convertedQuantity;
        matchingItems.push({
          id: item.id,
          inventory_id: item.inventory_id,
          name: item.name,
          current_quantity: item.current_quantity,
          unit_of_measure: item.unit_of_measure,
          cost_per_unit: item.cost_per_unit,
          is_low_stock: item.is_low_stock,
          is_expired: item.is_expired,
          expiration_date: item.expiration_date,
          storage_location: item.storage_location
        });

        // Add warnings for problematic items
        if (item.is_expired) {
          warnings.push(`Item ${item.name} (ID: ${item.inventory_id}) is expired`);
        } else if (item.is_low_stock) {
          warnings.push(`Item ${item.name} (ID: ${item.inventory_id}) is low stock`);
        }
      }

      // Convert available quantity back to display unit for the UI
      const convertFromBaseUnit = (baseQuantity, targetUnit) => {
        if (typeof baseQuantity !== 'number') return baseQuantity;
        
        switch (targetUnit?.toLowerCase()) {
          case 'ml':
          case 'milliliter':
          case 'milliliters':
            return baseQuantity / 1000; // µL to mL
          case 'l':
          case 'liter':
          case 'liters':
            return baseQuantity / 1000000; // µL to L
          case 'µl':
          case 'ul':
          case 'microliter':
          case 'microliters':
            return baseQuantity; // Already in µL
          default:
            return baseQuantity; // Non-volume units
        }
      };

      const displayAvailableQuantity = convertFromBaseUnit(availableQuantity, reagent.unit);

      calculatedReagents.push({
        name: reagent.name,
        quantity_per_sample: reagent.quantity_per_sample,
        unit: reagent.unit,
        total_quantity_needed: totalQuantity,
        sample_count: sample_count,
        available_quantity: displayAvailableQuantity,
        is_available: typeof totalQuantityInBaseUnit === 'number' ? availableQuantity >= totalQuantityInBaseUnit : false,
        shortage: typeof totalQuantityInBaseUnit === 'number' && availableQuantity < totalQuantityInBaseUnit 
          ? convertFromBaseUnit(Math.round((totalQuantityInBaseUnit - availableQuantity) * 1000) / 1000, reagent.unit)
          : 0,
        matching_inventory_items: matchingItems,
        warnings: warnings
      });
    }

    res.json({
      protocol_id: protocol.id,
      protocol_name: protocol.name,
      sample_count: sample_count,
      calculated_reagents: calculatedReagents,
      total_unique_reagents: calculatedReagents.length,
      all_reagents_available: calculatedReagents.every(r => r.is_available)
    });

  } catch (err) {
    logger.error('Reagent calculation failed:', {
      error: err.message,
      protocolId: req.params.id,
      sampleCount: sample_count
    });
    res.status(500).json({ 
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined 
    });
  }
});

// @route   POST api/protocols
// @desc    Create a protocol
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('name', 'Protocol name is required').not().isEmpty(),
      check('required_reagents', 'Required reagents must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      version = '1.0',
      required_reagents = [],
      basic_steps,
      document_id
    } = req.body;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Validate required_reagents structure
      if (required_reagents.length > 0) {
        for (const reagent of required_reagents) {
          const isValidQuantity =
            typeof reagent.quantity_per_sample === 'number' ||
            reagent.quantity_per_sample === 'As needed';

          if (!reagent.name || !isValidQuantity || !reagent.unit) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              msg: 'Each reagent must have name, quantity_per_sample (number or "As needed"), and unit'
            });
          }
        }
      }

      // Get next protocol ID
      const nextIdResult = await client.query(
        "SELECT get_next_number($1) as next_number",
        ['protocol']
      );
      const protocol_id = nextIdResult.rows[0].next_number;

      // Create the protocol
      const result = await client.query(
        `INSERT INTO protocols
        (protocol_id, name, description, version, required_reagents, basic_steps, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          protocol_id,
          name,
          description,
          version,
          JSON.stringify(required_reagents),
          basic_steps,
          req.user.id
        ]
      );

      // Link the document if provided
      if (document_id) {
        logger.info('Linking document to protocol', {
          protocol_id: result.rows[0].id,
          document_id: document_id
        });
        const updateResult = await client.query(
          `UPDATE protocol_documents
          SET protocol_id = $1
          WHERE id = $2
          RETURNING *`,
          [result.rows[0].id, document_id]
        );
        logger.info('Document linked successfully', {
          updated_rows: updateResult.rowCount
        });
      } else {
        logger.info('No document_id provided in request body');
      }

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log
        (user_id, action, table_name, record_id, changed_fields)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'CREATE',
          'protocols',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      // Return with user details
      const protocolWithDetails = await client.query(
        `SELECT p.*, 
          u.username as created_by_username,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name
        FROM protocols p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = $1`,
        [result.rows[0].id]
      );
      
      await client.query('COMMIT');
      res.json(protocolWithDetails.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Protocol creation failed:', {
        error: err.message,
        userId: req.user?.id
      });
      res.status(500).json({ 
        msg: 'Failed to create protocol. Please check your input and try again.',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
      });
    } finally {
      client.release();
    }
  }
);

// @route   PUT api/protocols/:id
// @desc    Update a protocol
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('name', 'Protocol name is required').not().isEmpty(),
      check('required_reagents', 'Required reagents must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      version,
      required_reagents = [],
      basic_steps,
      is_active = true
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // First check if protocol exists
      const checkResult = await client.query(
        'SELECT * FROM protocols WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ msg: 'Protocol not found' });
      }

      const oldData = checkResult.rows[0];

      // Validate required_reagents structure
      if (required_reagents.length > 0) {
        for (const reagent of required_reagents) {
          const isValidQuantity = 
            typeof reagent.quantity_per_sample === 'number' || 
            reagent.quantity_per_sample === 'As needed';
            
          if (!reagent.name || !isValidQuantity || !reagent.unit) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              msg: 'Each reagent must have name, quantity_per_sample (number or "As needed"), and unit' 
            });
          }
        }
      }

      // Update the protocol
      const result = await client.query(
        `UPDATE protocols
        SET name = $1, description = $2, version = $3, required_reagents = $4, 
            basic_steps = $5, is_active = $6
        WHERE id = $7
        RETURNING *`,
        [
          name,
          description,
          version,
          JSON.stringify(required_reagents),
          basic_steps,
          is_active,
          req.params.id
        ]
      );

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'UPDATE',
          'protocols',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      // Return with user details
      const protocolWithDetails = await client.query(
        `SELECT p.*, 
          u.username as created_by_username,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name
        FROM protocols p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = $1`,
        [req.params.id]
      );
      
      await client.query('COMMIT');
      res.json(protocolWithDetails.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Protocol update failed:', {
        error: err.message,
        userId: req.user?.id,
        protocolId: req.params.id
      });
      res.status(500).json({ 
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined 
    });
    } finally {
      client.release();
    }
  }
);

// @route   DELETE api/protocols/:id
// @desc    Deactivate a protocol (soft delete)
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // First check if protocol exists
    const checkResult = await client.query(
      'SELECT * FROM protocols WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Protocol not found' });
    }

    const oldData = checkResult.rows[0];

    // Check if protocol is used in any experiments
    const experimentCheck = await client.query(
      'SELECT COUNT(*) as count FROM experiments WHERE protocol_id = $1',
      [req.params.id]
    );

    const experimentCount = parseInt(experimentCheck.rows[0].count);

    if (experimentCount > 0) {
      // Soft delete - just deactivate
      await client.query(
        'UPDATE protocols SET is_active = false WHERE id = $1',
        [req.params.id]
      );

      // Log the action
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'DEACTIVATE',
          'protocols',
          req.params.id,
          JSON.stringify({ 
            reason: `Protocol used in ${experimentCount} experiments`,
            old_data: oldData 
          })
        ]
      );
      
      await client.query('COMMIT');
      res.json({ 
        msg: 'Protocol deactivated (used in experiments)',
        experiments_count: experimentCount
      });
    } else {
      // Hard delete if no experiments use it
      await client.query('DELETE FROM protocols WHERE id = $1', [req.params.id]);

      // Log the action
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'DELETE',
          'protocols',
          req.params.id,
          JSON.stringify(oldData)
        ]
      );
      
      await client.query('COMMIT');
      res.json({ msg: 'Protocol deleted' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Protocol deletion failed:', {
      error: err.message,
      userId: req.user?.id,
      protocolId: req.params.id
    });
    res.status(500).json({ 
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined 
    });
  } finally {
    client.release();
  }
});

// @route   POST api/protocols/:id/duplicate
// @desc    Duplicate a protocol with new version
// @access  Private (admin/editor only)
router.post('/:id/duplicate', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  const { name } = req.body;
  
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get original protocol
    const originalResult = await client.query(
      'SELECT * FROM protocols WHERE id = $1',
      [req.params.id]
    );

    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Protocol not found' });
    }

    const original = originalResult.rows[0];

    // Get next protocol ID
    const nextIdResult = await client.query(
      "SELECT get_next_number('protocol') as protocol_number"
    );
    const protocol_id = nextIdResult.rows[0].protocol_number;

    // Create duplicate
    const result = await client.query(
      `INSERT INTO protocols 
      (protocol_id, name, description, required_reagents, basic_steps, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [
        protocol_id,
        name || `${original.name} (Copy)`,
        original.description,
        original.required_reagents,
        original.basic_steps,
        req.user.id
      ]
    );

    // Log the action
    await client.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DUPLICATE',
        'protocols',
        result.rows[0].id,
        JSON.stringify({
          original_protocol_id: req.params.id,
          duplicated_data: result.rows[0]
        })
      ]
    );

    // Return with user details
    const protocolWithDetails = await client.query(
      `SELECT p.*, 
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM protocols p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`,
      [result.rows[0].id]
    );
    
    await client.query('COMMIT');
    res.json(protocolWithDetails.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Protocol duplication failed:', {
      error: err.message,
      userId: req.user?.id,
      protocolId: req.params.id
    });
    res.status(500).json({ 
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined 
    });
  } finally {
    client.release();
  }
});

// @route   POST api/protocols/extract
// @desc    Upload document and extract protocol data
// @access  Private (admin/editor only)
router.post('/extract', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], upload.single('document'), async (req, res) => {
  const client = await db.getClient();

  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No document uploaded' });
    }

    // Get extraction method from request (default to 'llm' if available)
    const extractionMethod = req.body.method || (protocolExtractionService.isLLMExtractionAvailable() ? 'llm' : 'rule-based');
    const protocolName = req.body.protocol_name || req.file.originalname;

    await client.query('BEGIN');

    // Store document information
    const documentResult = await client.query(
      `INSERT INTO protocol_documents
       (filename, original_filename, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user.id
      ]
    );

    const document = documentResult.rows[0];

    // Generate extraction job
    const jobIdResult = await client.query('SELECT generate_extraction_job_id() as job_id');
    const jobId = jobIdResult.rows[0].job_id;

    // Create extraction job
    const jobResult = await client.query(
      `INSERT INTO extraction_jobs
       (job_id, document_id, initiated_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [jobId, document.id, req.user.id]
    );

    await client.query('COMMIT');

    // Start extraction process asynchronously with options
    setImmediate(async () => {
      try {
        await protocolExtractionService.processExtractionJob(jobId, {
          method: extractionMethod,
          protocolName: protocolName
        });
      } catch (error) {
        logger.error(`Extraction job ${jobId} failed:`, error);
      }
    });

    res.json({
      job_id: jobId,
      document: document,
      status: 'processing',
      extraction_method: extractionMethod,
      message: `Document uploaded successfully. ${extractionMethod === 'llm' ? 'AI' : 'Rule-based'} extraction started.`
    });

  } catch (error) {
    await client.query('ROLLBACK');

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('Error cleaning up file:', unlinkError);
      }
    }

    logger.error('Document upload/extraction failed:', error);
    res.status(500).json({
      msg: 'Failed to process document upload',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// @route   GET api/protocols/extraction-status/:jobId
// @desc    Check extraction job status
// @access  Private
router.get('/extraction-status/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const result = await db.query(
      `SELECT 
        ej.*,
        pd.original_filename,
        epd.overall_confidence,
        epd.manual_review_required,
        epd.extracted_data,
        epd.extraction_metadata
       FROM extraction_jobs ej
       LEFT JOIN protocol_documents pd ON ej.document_id = pd.id
       LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
       WHERE ej.job_id = $1`,
      [jobId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Extraction job not found' });
    }
    
    const job = result.rows[0];
    
    const response = {
      job_id: job.job_id,
      status: job.status,
      started_at: job.started_at,
      completed_at: job.completed_at,
      processing_time_ms: job.processing_time_ms,
      error_message: job.error_message,
      document_filename: job.original_filename
    };
    
    // Include extraction results if completed
    if (job.status === 'completed' && job.extracted_data) {
      response.extraction_results = {
        extracted_data: job.extracted_data,
        extraction_metadata: job.extraction_metadata,
        overall_confidence: job.overall_confidence,
        manual_review_required: job.manual_review_required
      };
    }
    
    res.json(response);
    
  } catch (error) {
    logger.error('Error fetching extraction status:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/protocols/from-extraction
// @desc    Create protocol from extraction results
// @access  Private (admin/editor only)
router.post('/from-extraction', [
  auth, 
  roleCheck(['admin', 'lab_manager', 'lab_technician']),
  [
    check('job_id', 'Extraction job ID is required').not().isEmpty(),
    check('name', 'Protocol name is required').not().isEmpty(),
    check('required_reagents', 'Required reagents must be an array').optional().isArray()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    job_id,
    name,
    description,
    version = '1.0',
    required_reagents = [],
    basic_steps,
    review_notes
  } = req.body;

  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get extraction job and data
    const extractionResult = await client.query(
      `SELECT ej.*, epd.id as extraction_data_id, pd.id as document_id
       FROM extraction_jobs ej
       LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
       LEFT JOIN protocol_documents pd ON ej.document_id = pd.id
       WHERE ej.job_id = $1`,
      [job_id]
    );
    
    if (extractionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Extraction job not found' });
    }
    
    const extractionJob = extractionResult.rows[0];
    
    if (extractionJob.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Extraction job is not completed' });
    }
    
    // Validate required_reagents structure
    if (required_reagents.length > 0) {
      for (const reagent of required_reagents) {
        if (!reagent.name || typeof reagent.quantity_per_sample !== 'number' || !reagent.unit) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            msg: 'Each reagent must have name, quantity_per_sample (number), and unit' 
          });
        }
      }
    }

    // Get next protocol ID
    const nextIdResult = await client.query(
      "SELECT get_next_number('protocol') as protocol_number"
    );
    const protocol_id = nextIdResult.rows[0].protocol_number;

    // Create the protocol
    const result = await client.query(
      `INSERT INTO protocols 
      (protocol_id, name, description, version, required_reagents, basic_steps, 
       created_by, extraction_job_id, source_document_id, manual_review_completed) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        protocol_id,
        name,
        description,
        version,
        JSON.stringify(required_reagents),
        basic_steps,
        req.user.id,
        extractionJob.id,
        extractionJob.document_id,
        true // Mark as manually reviewed
      ]
    );

    // Update protocol_documents to link to the created protocol
    await client.query(
      'UPDATE protocol_documents SET protocol_id = $1 WHERE id = $2',
      [result.rows[0].id, extractionJob.document_id]
    );
    
    // Mark extraction data as reviewed
    if (extractionJob.extraction_data_id) {
      await client.query(
        `UPDATE extracted_protocol_data 
         SET reviewed_by = $1, review_date = CURRENT_TIMESTAMP, review_notes = $2
         WHERE id = $3`,
        [req.user.id, review_notes, extractionJob.extraction_data_id]
      );
    }

    // Log the action in audit trail
    await client.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'CREATE_FROM_EXTRACTION',
        'protocols',
        result.rows[0].id,
        JSON.stringify({
          extraction_job_id: job_id,
          created_from_extraction: true,
          original_request: req.body
        })
      ]
    );

    // Return with user details
    const protocolWithDetails = await client.query(
      `SELECT p.*, 
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        pd.original_filename as source_document_name
      FROM protocols p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN protocol_documents pd ON p.source_document_id = pd.id
      WHERE p.id = $1`,
      [result.rows[0].id]
    );
    
    await client.query('COMMIT');
    res.json(protocolWithDetails.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Protocol creation from extraction failed:', {
      error: err.message,
      userId: req.user?.id,
      jobId: job_id
    });
    res.status(500).json({ 
      msg: 'Server error occurred. Please try again.',
      error: process.env.NODE_ENV === 'development' ? 'Server error' : undefined 
    });
  } finally {
    client.release();
  }
});

// @route   GET api/protocols/extraction-jobs
// @desc    Get extraction job history
// @access  Private
router.get('/extraction-jobs', auth, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Build WHERE conditions
    let whereConditions = [];
    let queryParams = [limit, offset];
    let paramIndex = 3;
    
    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const result = await db.query(
      `SELECT * FROM document_extraction_overview 
       ${whereClause}
       ORDER BY extraction_started DESC
       LIMIT $1 OFFSET $2`,
      queryParams
    );
    
    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM document_extraction_overview ${whereClause}`,
      queryParams.slice(2)
    );
    
    res.json({
      extraction_jobs: result.rows,
      totalCount: parseInt(countResult.rows[0].count),
      currentPage: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (error) {
    logger.error('Error fetching extraction jobs:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/protocols/:id/experiments
// @desc    Get all experiments (with specimen details) for a specific protocol
// @access  Private
router.get('/:id/experiments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // Check if protocol exists
    const protocolCheck = await db.query('SELECT id, protocol_id, name FROM protocols WHERE id = $1', [id]);
    if (protocolCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'Protocol not found' });
    }
    
    const protocol = protocolCheck.rows[0];
    
    // Get all experiments that used this protocol with specimen details
    const query = `
      SELECT 
        e.id,
        e.experiment_id,
        e.date_performed,
        e.status,
        e.notes,
        e.created_at,
        e.updated_at,
        u.username as performed_by,
        CONCAT(u.first_name, ' ', u.last_name) as performed_by_name,
        -- Get specimen details from the sample_ids array
        COALESCE(
          ARRAY(
            SELECT json_build_object(
              'id', s.id,
              'specimen_number', s.specimen_number,
              'tube_id', s.tube_id,
              'project_number', proj.project_number,
              'disease', proj.disease
            )
            FROM specimens s
            JOIN projects proj ON s.project_id = proj.id
            WHERE s.id = ANY(SELECT jsonb_array_elements_text(e.sample_ids)::uuid)
          ),
          '{}'::json[]
        ) as specimens
      FROM experiments e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.protocol_id = $1
      ORDER BY e.date_performed DESC NULLS LAST, e.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [id, limit, offset]);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM experiments 
      WHERE protocol_id = $1
    `;
    const countResult = await db.query(countQuery, [id]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      protocol: {
        id: protocol.id,
        protocol_id: protocol.protocol_id,
        name: protocol.name
      },
      experiments: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    });
    
  } catch (err) {
    logger.error('Error fetching protocol experiments:', err);
    res.status(500).json({
      msg: 'Server error',
      error: err.message
    });
  }
});

module.exports = router;