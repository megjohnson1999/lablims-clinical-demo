/**
 * Unified Import Routes
 * Demonstrates how both migration and project imports work identically
 * Both result in the same database structure
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { FILE_UPLOAD } = require('../config/constants');
const {
  parseEntityData,
  importEntities,
  validateEntity,
  findDuplicateNumbers,
  MIGRATION_MAPPINGS
} = require('../utils/unifiedImportLogic');
const logger = require('../utils/logger');

// Configure file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 
      'text/csv'
    ];
    cb(null, allowedMimes.includes(file.mimetype));
  }
});

// ================================================================================
// MIGRATION IMPORT ROUTE
// ================================================================================

/**
 * @route   POST /api/unified-import/migration/:entityType
 * @desc    Import data from legacy system CSV (preserves original IDs)
 * @access  Private (admin only)
 */
router.post('/migration/:entityType', [auth, roleCheck(['admin']), upload.single('file')], async (req, res) => {
  try {
    const { entityType } = req.params;
    
    if (!['collaborators', 'projects', 'specimens', 'patients'].includes(entityType)) {
      return res.status(400).json({ msg: 'Invalid entity type' });
    }
    
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    // Parse CSV data
    const csvData = parseFileData(req.file.buffer, req.file.mimetype);
    
    // Parse using migration mappings (preserves CSV IDs)
    const parseResult = parseEntityData(csvData.data, entityType, true);
    
    // Validate data
    const validationErrors = [];
    const duplicates = findDuplicateNumbers(parseResult.entities, `${entityType.slice(0, -1)}_number`);
    
    parseResult.entities.forEach(entity => {
      const errors = validateEntity(entity, entityType);
      if (errors.length > 0) {
        validationErrors.push({
          row: entity._rowNumber,
          errors
        });
      }
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        msg: 'Validation errors found',
        errors: validationErrors,
        duplicates
      });
    }
    
    // Import entities (preserving original IDs)
    const importResults = await importEntities(parseResult.entities, entityType, {
      batchSize: 1000,
      onProgress: (progress) => {
        logger.info('Migration import progress', { processed: progress.processed, total: progress.total });
      }
    });
    
    res.json({
      success: true,
      message: `Migration import completed for ${entityType}`,
      importType: 'migration',
      results: {
        ...importResults,
        totalRows: parseResult.totalRows,
        unmatchedHeaders: parseResult.unmatchedHeaders,
        preservedIds: true
      }
    });
    
  } catch (error) {
    logger.error('Migration import failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      msg: 'Migration import failed',
      error: error.message
    });
  }
});

// ================================================================================
// PROJECT IMPORT ROUTE  
// ================================================================================

/**
 * @route   POST /api/unified-import/project/:entityType
 * @desc    Import new project data (generates sequential IDs)
 * @access  Private (admin/editor)
 */
router.post('/project/:entityType', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    const { entityType } = req.params;
    
    if (!['collaborators', 'projects', 'specimens', 'patients'].includes(entityType)) {
      return res.status(400).json({ msg: 'Invalid entity type' });
    }
    
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    // Parse CSV data
    const csvData = parseFileData(req.file.buffer, req.file.mimetype);
    
    // Parse using project mappings (ignores CSV IDs, will generate new ones)
    const parseResult = parseEntityData(csvData.data, entityType, false);
    
    // Validate data
    const validationErrors = [];
    
    parseResult.entities.forEach(entity => {
      const errors = validateEntity(entity, entityType);
      if (errors.length > 0) {
        validationErrors.push({
          row: entity._rowNumber,
          errors
        });
      }
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        msg: 'Validation errors found', 
        errors: validationErrors
      });
    }
    
    // Import entities (generating new sequential IDs)
    const importResults = await importEntities(parseResult.entities, entityType, {
      batchSize: 1000,
      onProgress: (progress) => {
        logger.info('Project import progress', { processed: progress.processed, total: progress.total });
      }
    });
    
    res.json({
      success: true,
      message: `Project import completed for ${entityType}`,
      importType: 'project',
      results: {
        ...importResults,
        totalRows: parseResult.totalRows,
        unmatchedHeaders: parseResult.unmatchedHeaders,
        generatedNewIds: true
      }
    });
    
  } catch (error) {
    console.error('Project import error:', error);
    res.status(500).json({
      msg: 'Project import failed',
      error: error.message
    });
  }
});

// ================================================================================
// VALIDATION/PREVIEW ROUTES
// ================================================================================

/**
 * @route   POST /api/unified-import/validate/:entityType
 * @desc    Validate import data without saving
 * @access  Private (admin/editor)
 */
router.post('/validate/:entityType', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    const { entityType } = req.params;
    const { importType = 'project' } = req.body; // default to project
    
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const csvData = parseFileData(req.file.buffer, req.file.mimetype);
    const parseResult = parseEntityData(csvData.data, entityType, importType === 'migration');
    
    // Validate first 50 rows for preview
    const previewData = parseResult.entities.slice(0, 50);
    const validationErrors = [];
    const duplicates = findDuplicateNumbers(parseResult.entities, `${entityType.slice(0, -1)}_number`);
    
    previewData.forEach(entity => {
      const errors = validateEntity(entity, entityType);
      if (errors.length > 0) {
        validationErrors.push({
          row: entity._rowNumber,
          errors
        });
      }
    });
    
    res.json({
      success: true,
      preview: previewData,
      validation: {
        totalRows: parseResult.totalRows,
        previewRows: previewData.length,
        errors: validationErrors,
        duplicates,
        unmatchedHeaders: parseResult.unmatchedHeaders
      },
      importType,
      entityType
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      msg: 'Validation failed',
      error: error.message
    });
  }
});

// ================================================================================
// INFO ROUTES
// ================================================================================

/**
 * @route   GET /api/unified-import/mappings/:entityType
 * @desc    Get column mappings for entity type
 * @access  Private
 */
router.get('/mappings/:entityType', [auth], async (req, res) => {
  try {
    const { entityType } = req.params;
    
    if (!MIGRATION_MAPPINGS[entityType]) {
      return res.status(400).json({ msg: 'Invalid entity type' });
    }
    
    res.json({
      success: true,
      entityType,
      mappings: MIGRATION_MAPPINGS[entityType],
      description: {
        migration: 'CSV ID column maps to database number column (preserves original IDs)',
        project: 'CSV ID column ignored, new sequential numbers generated'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      msg: 'Failed to get mappings',
      error: error.message
    });
  }
});

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Parse file buffer into structured data
 */
function parseFileData(fileBuffer, mimetype) {
  let workbook;
  
  if (mimetype.includes('csv')) {
    const csvData = fileBuffer.toString('utf8');
    workbook = XLSX.read(csvData, { type: 'string' });
  } else {
    workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  }
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length === 0) {
    throw new Error('File appears to be empty');
  }
  
  return { data };
}

module.exports = router;