const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { FILE_UPLOAD } = require('../config/constants');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');
const { 
  handleDatabaseError, 
  handleFileUploadError, 
  handleImportError, 
  asyncHandler 
} = require('../utils/errorHandler');
const idGenerationService = require('../services/idGenerationService');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    // Also check file extension as fallback when MIME type is generic
    const fileName = file.originalname.toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    
    if (allowedMimes.includes(file.mimetype) || hasValidExtension) {
      cb(null, true);
    } else {
      const error = new Error(`Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed. Received: ${file.mimetype} for file: ${file.originalname}`);
      error.code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  }
});

// Define field mapping groups with priority order
const FIELD_MAPPINGS = {
  'tube_id': [
    'tube_id', 'specimen_id', 'sample_id', 'Sample_ID', 'Specimen_ID', 'Tube_ID',
    'Sample ID', 'Specimen ID', 'Tube ID', 'sample id', 'specimen id', 'tube id',
    'TubeID', 'SampleID', 'SpecimenID', 'ID', 'id', 'identifier', 'Identifier'
  ],
  'date_collected': [
    'date_collected', 'collection_date', 'Collection_Date', 'Collection Date',
    'Date Collected', 'date collected', 'collection date', 'CollectionDate',
    'date', 'Date', 'sample_date', 'Sample Date', 'collection', 'Collection'
  ],
  'position_freezer': [
    'position_freezer', 'freezer', 'Location', 'location', 'Storage_Location',
    'Storage Location', 'storage location', 'storage_location', 'Freezer',
    'freezer_location', 'Freezer Location', 'storage', 'Storage'
  ],
  'position_rack': [
    'position_rack', 'rack', 'Rack', 'rack_position', 'Rack Position',
    'RackPosition', 'shelf', 'Shelf'
  ],
  'position_box': [
    'position_box', 'box', 'Box', 'container', 'Container', 'box_position',
    'Box Position', 'BoxPosition'
  ],
  'position_dimension_one': [
    'position_dimension_one', 'dimension_one', 'Dimension One',
    'position1', 'Position 1', 'pos1', 'Pos1', 'row', 'Row'
  ],
  'position_dimension_two': [
    'position_dimension_two', 'dimension_two', 'Dimension Two', 
    'position2', 'Position 2', 'pos2', 'Pos2', 'column', 'Column', 'col', 'Col'
  ],
  'specimen_site': [
    'specimen_site', 'site', 'Sample_Type', 'sample_type', 'Type', 'type',
    'specimen type', 'sample type', 'Site', 'SpecimenSite', 'specimen_source',
    'source', 'Source', 'body_site', 'Body Site'
  ],
  'activity_status': [
    'activity_status', 'status', 'Status', 'Sample_Status', 'sample_status',
    'sample status', 'ActivityStatus', 'activity', 'Activity', 'state', 'State'
  ],
  'comments': [
    'comments', 'specimen_comments', 'notes', 'Notes', 'Note', 'note',
    'specimen comments', 'specimen_comments', 'Comments', 'description',
    'Description', 'remarks', 'Remarks', 'observations', 'Observations'
  ],
  'initial_quantity': [
    'initial_quantity', 'quantity', 'Quantity', 'Initial Quantity', 'initial quantity',
    'InitialQuantity', 'volume', 'Volume', 'amount', 'Amount'
  ],
  'extracted': [
    'extracted', 'Extracted', 'is_extracted', 'Is Extracted', 'extraction_status',
    'Extraction Status', 'extracted_status', 'Extracted Status'
  ],
  'used_up': [
    'used_up', 'Used_Up', 'used up', 'Used Up', 'UsedUp'
  ],
  'specimen_number': [
    'specimen_number', 'Specimen Number', 'specimen number', 'Specimen_Number',
    'spec_number', 'Spec Number', 'sample_number', 'Sample Number'
  ],
  'run_number': [
    'run_number', 'Run Number', 'run number', 'Run_Number',
    'run', 'Run', 'sequencing_run', 'Sequencing Run'
  ],
  // Note: These sequencing columns are recognized but NOT supported in current database schema
  // They will be mapped and warned about but not saved to database
  'sequencing_run_id': [
    'sequencing_run_id', 'Sequencing Run ID', 'sequencing run id', 'Sequencing_Run_ID',
    'run_id', 'Run ID', 'seq_run_id', 'Seq Run ID'
  ],
  'fastq_location': [
    'fastq_location', 'FASTQ Location', 'fastq location', 'FASTQ_Location',
    'fastq_path', 'FASTQ Path', 'sequence_location', 'Sequence Location'
  ],
  'analysis_status': [
    'analysis_status', 'Analysis Status', 'analysis status', 'Analysis_Status',
    'seq_status', 'Sequencing Status', 'processing_status', 'Processing Status'
  ],
  'results_location': [
    'results_location', 'Results Location', 'results location', 'Results_Location',
    'results_path', 'Results Path', 'output_location', 'Output Location'
  ],
  'sequencing_notes': [
    'sequencing_notes', 'Sequencing Notes', 'sequencing notes', 'Sequencing_Notes',
    'seq_notes', 'Seq Notes', 'processing_notes', 'Processing Notes'
  ]
};

/**
 * Unified column mapping function with conflict detection and feedback
 */
function mapColumns(headers) {
  const mapping = {};
  const conflicts = {};
  const unmatched = [];
  const feedback = {
    mapped: {},
    conflicts: [],
    unmatched: [],
    warnings: []
  };
  
  // First pass: identify all possible mappings
  headers.forEach((header, index) => {
    const trimmedHeader = header.trim();
    let foundMapping = false;

    // Check each field mapping group
    Object.entries(FIELD_MAPPINGS).forEach(([dbField, alternatives]) => {
      // Check if this header matches any alternative for this field
      const matchedAlternative = alternatives.find(alternative => 
        trimmedHeader === alternative || 
        trimmedHeader.toLowerCase() === alternative.toLowerCase()
      );
      
      if (matchedAlternative) {
        if (!conflicts[dbField]) {
          conflicts[dbField] = [];
        }
        
        // Only add if not already added (prevent duplicates)
        if (!conflicts[dbField].some(match => match.header === trimmedHeader)) {
          conflicts[dbField].push({
            header: trimmedHeader,
            index: index,
            alternative: matchedAlternative
          });
        }
        foundMapping = true;
      }
    });

    if (!foundMapping) {
      unmatched.push(trimmedHeader);
    }
  });

  // Second pass: resolve conflicts using priority order
  Object.entries(conflicts).forEach(([dbField, matches]) => {
    if (matches.length > 1) {
      // Sort by priority (order in FIELD_MAPPINGS array)
      matches.sort((a, b) => {
        const aIndex = FIELD_MAPPINGS[dbField].indexOf(a.alternative);
        const bIndex = FIELD_MAPPINGS[dbField].indexOf(b.alternative);
        return aIndex - bIndex;
      });

      // Use highest priority match
      const chosen = matches[0];
      mapping[chosen.index] = dbField;
      feedback.mapped[chosen.header] = dbField;

      // Report conflict
      const conflictHeaders = matches.map(m => m.header).join(', ');
      feedback.conflicts.push({
        field: dbField,
        headers: conflictHeaders,
        chosen: chosen.header,
        message: `Multiple columns found for ${dbField}: ${conflictHeaders}. Using "${chosen.header}".`
      });
    } else if (matches.length === 1) {
      // Single match - no conflict
      const match = matches[0];
      mapping[match.index] = dbField;
      feedback.mapped[match.header] = dbField;
    }
  });

  // Report unmatched columns (will be ignored but warn user)
  feedback.unmatched = unmatched;
  if (unmatched.length > 0) {
    feedback.warnings.push({
      type: 'unmatched_columns',
      message: `These columns will be ignored during import: ${unmatched.join(', ')}`,
      columns: unmatched,
      severity: 'info' // This is just informational, not an error
    });
  }
  
  // Check for columns that are mapped but don't exist in database schema
  // This is more dynamic and will automatically adapt when schema changes
  const potentiallyUnsupportedFields = Object.entries(feedback.mapped)
    .map(([header, field]) => ({ header, field }));
    
  // TODO: Make this truly dynamic by querying database schema at runtime:
  // const unsupportedFields = await checkColumnsExistInTable('specimens', Object.values(feedback.mapped));
  // For now, we'll check against known unsupported fields
  const knownUnsupportedFields = ['sequencing_run_id', 'fastq_location', 'analysis_status', 'results_location', 'sequencing_notes'];
  const foundUnsupportedFields = potentiallyUnsupportedFields
    .filter(({ field }) => knownUnsupportedFields.includes(field))
    .map(({ header }) => header);
    
  if (foundUnsupportedFields.length > 0) {
    feedback.warnings.push({
      type: 'unsupported_columns',
      message: `These columns are recognized but not yet supported in the database: ${foundUnsupportedFields.join(', ')}. Data in these columns will be ignored.`,
      columns: foundUnsupportedFields,
      severity: 'warning'
    });
  }
  
  // Create user-friendly summary for display
  const mappedColumns = Object.keys(feedback.mapped);
  feedback.summary = {
    mappedCount: mappedColumns.length,
    unmappedCount: unmatched.length,
    totalColumns: mappedColumns.length + unmatched.length,
    mappedColumns: Object.entries(feedback.mapped).map(([header, field]) => ({
      originalColumn: header,
      mapsTo: field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    })),
    ignoredColumns: unmatched
  };

  return { mapping, feedback };
}

/**
 * Parse Excel/CSV file and extract specimen data
 */
function parseSpecimenFile(fileBuffer, mimetype) {
  try {
    let workbook;
    
    // Parse file based on type
    if (mimetype.includes('csv')) {
      const csvData = fileBuffer.toString('utf8');
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('CSV file is empty or contains no readable text');
      }
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Excel file is empty or corrupted');
      }
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    }
    
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No readable sheets found in file');
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' could not be read`);
    }
    
    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length === 0) {
      throw new Error('No data found in file - file may be empty or corrupted');
    }
    
    if (rawData.length < 2) {
      throw new Error('File contains headers but no data rows');
    }
    
    const headers = rawData[0];
    if (!headers || headers.length === 0) {
      throw new Error('No column headers found in first row');
    }
    
    // Filter out empty headers
    const validHeaders = headers.filter(h => h && h.toString().trim() !== '');
    if (validHeaders.length === 0) {
      throw new Error('No valid column headers found');
    }
    
    const dataRows = rawData.slice(1);
    
    // Map headers using unified mapping system
    const { mapping: headerMapping, feedback: mappingFeedback } = mapColumns(headers);
    
    // Convert rows to specimen objects
    const specimens = dataRows.map((row, rowIndex) => {
      const specimen = {};
      
      headers.forEach((header, colIndex) => {
        const fieldName = headerMapping[colIndex];
        if (fieldName && row[colIndex] !== undefined && row[colIndex] !== null && String(row[colIndex]).trim() !== '') {
          specimen[fieldName] = String(row[colIndex]).trim();
        }
      });
      
      specimen._rowNumber = rowIndex + 2; // +2 because we skipped header and arrays are 0-indexed
      return specimen;
    }).filter(row => {
      // Only require tube_id to be present and non-empty
      const hasValidTubeId = row.tube_id && row.tube_id.toString().trim() !== '';
      return hasValidTubeId;
    });
    
    if (specimens.length === 0) {
      throw new Error('No valid specimen data found. Check that your data rows contain tube_id values (required field).');
    }
    
    return {
      specimens,
      headers,
      mappingFeedback,
      totalRows: specimens.length
    };
    
  } catch (error) {
    if (error.message.includes('Failed to parse file')) {
      throw error; // Re-throw if already properly formatted
    }
    
    // Add context to generic errors
    let errorMessage = `Failed to parse file: ${error.message}`;
    
    if (error.message.includes('Invalid file signature')) {
      errorMessage = 'File appears to be corrupted or is not a valid Excel/CSV file';
    } else if (error.message.includes('ZIP')) {
      errorMessage = 'Excel file may be corrupted or password-protected';
    } else if (error.message.includes('encoding')) {
      errorMessage = 'File encoding is not supported - try saving as UTF-8 CSV';
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Convert Excel date format to proper date
 */
function convertExcelDate(dateValue) {
  // Handle Excel date format (numeric values like 45305.75)
  if (dateValue && !isNaN(dateValue) && dateValue > 25569) {
    // Excel date: days since 1900-01-01 (with 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + (dateValue * 24 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } else if (dateValue && !isNaN(Date.parse(dateValue))) {
    return new Date(dateValue).toISOString().split('T')[0];
  }
  return null;
}

/**
 * Validate specimen data
 */
async function validateSpecimen(specimen, rowNumber) {
  const errors = [];
  
  // Only require tube_id as specimen identifier
  if (!specimen.tube_id || specimen.tube_id.toString().trim() === '') {
    errors.push(`Row ${rowNumber}: Missing tube_id (specimen identifier)`);
  }
  
  // Date validation with Excel date conversion
  if (specimen.date_collected) {
    const convertedDate = convertExcelDate(specimen.date_collected);
    if (!convertedDate) {
      errors.push(`Row ${rowNumber}: Invalid date format for Date Collected: '${specimen.date_collected}'`);
    } else {
      // Update the specimen with converted date
      specimen.date_collected = convertedDate;
    }
  }
  
  // More forgiving boolean validation
  if (specimen.extracted && specimen.extracted !== '') {
    const extractedStr = String(specimen.extracted).toLowerCase().trim();
    if (!['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'].includes(extractedStr)) {
      // Don't fail - just warn and default
    }
  }
  
  if (specimen.used_up && specimen.used_up !== '') {
    const usedUpStr = String(specimen.used_up).toLowerCase().trim();
    if (!['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'].includes(usedUpStr)) {
      // Don't fail - just warn and default
    }
  }
  
  // Dynamic validation using system options
  try {
    // Use static validation for activity_status and analysis_status
    // Database queries should be done within transaction context during import
    const validActivityStatus = ['active', 'inactive', 'qc_failed', 'on_hold', 'Active', 'Inactive', 'QC Failed', 'On Hold'];
    const validAnalysisStatus = ['pending', 'in_progress', 'completed', 'failed'];
    
    if (specimen.activity_status && !validActivityStatus.includes(specimen.activity_status)) {
      errors.push(`Row ${rowNumber}: Invalid activity status '${specimen.activity_status}'. Valid options: ${validActivityStatus.join(', ')}`);
    }
    
    if (specimen.analysis_status && !validAnalysisStatus.includes(specimen.analysis_status)) {
      errors.push(`Row ${rowNumber}: Invalid analysis status '${specimen.analysis_status}'. Valid options: ${validAnalysisStatus.join(', ')}`);
    }
  } catch (dbError) {
    // Fall back to original validation if database query fails
    const validActivityStatus = ['active', 'inactive', 'qc_failed', 'on_hold'];
    const validAnalysisStatus = ['pending', 'in_progress', 'completed', 'failed'];
    
    if (specimen.activity_status && !validActivityStatus.includes(specimen.activity_status)) {
      errors.push(`Row ${rowNumber}: Invalid activity status '${specimen.activity_status}'`);
    }
    
    if (specimen.analysis_status && !validAnalysisStatus.includes(specimen.analysis_status)) {
      errors.push(`Row ${rowNumber}: Invalid analysis status '${specimen.analysis_status}'`);
    }
  }
  
  return errors;
}

/**
 * Parse location string into components
 */
function parseLocation(locationString) {
  if (!locationString) return {};
  
  const parts = locationString.split(' / ').map(part => part.trim());
  return {
    position_freezer: parts[0] || null,
    position_rack: parts[1] || null,
    position_box: parts[2] || null,
    position_dimension_one: parts[3] || null,
    position_dimension_two: parts[4] || null
  };
}

/**
 * Convert boolean-like values to actual booleans - more forgiving
 */
function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  const stringValue = String(value).toLowerCase().trim();
  
  // Accept more variations of "true" values
  const trueValues = ['yes', 'true', '1', 'y', 't', 'on', 'enabled', 'active'];
  const falseValues = ['no', 'false', '0', 'n', 'f', 'off', 'disabled', 'inactive'];
  
  if (trueValues.includes(stringValue)) return true;
  if (falseValues.includes(stringValue)) return false;
  
  // Default to false for unrecognized values
  return false;
}

// @route   GET api/specimens/import/template/:projectId
// @desc    Download CSV template for specimen import
// @access  Private (editor/admin only)
router.get('/template/:projectId', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get project details
    const projectQuery = `
      SELECT p.*, c.pi_name, c.pi_institute, c.pi_email
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      WHERE p.id = $1
    `;
    const projectResult = await db.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Create CSV template with project info pre-filled (include run_number, exclude missing sequencing columns)
    const csvHeaders = [
      'tube_id',
      'date_collected',
      'specimen_site',
      'activity_status',
      'extracted',
      'used_up',
      'initial_quantity',
      'position_freezer',
      'position_rack',
      'position_box',
      'position_dimension_one',
      'position_dimension_two',
      'run_number',
      'comments'
    ];
    
    // Sample data row with project information (include run_number, exclude missing sequencing columns)
    const sampleRow = [
      'TUBE_001',
      '2024-01-15',
      project.specimen_type || 'blood',
      'active',
      'false',
      'false',
      '1.0',
      'Freezer_A',
      'Rack_1',
      'Box_A1',
      'A1',
      'B2',
      '',  // run_number
      'Sample specimen entry'
    ];
    
    // Generate CSV content
    const csvContent = [
      csvHeaders.join(','),
      sampleRow.join(',')
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="specimen_import_template_${project.project_number || project.id}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    // Log error for server monitoring without exposing sensitive details
    logger.error('Template generation failed', { error: error.name, message: error.message });
    res.status(500).json({ msg: 'Failed to generate template' });
  }
});

// @route   POST api/specimens/import/preview
// @desc    Preview specimen import data
// @access  Private (editor/admin only)
router.post('/preview', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      details: {
        suggestion: 'Please select a file to upload'
      }
    });
  }
  
  const { importType, projectId } = req.body;
  
  try {
    // Parse the file
    const parseResult = parseSpecimenFile(req.file.buffer, req.file.mimetype);
    
    if (!parseResult.specimens || parseResult.specimens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in file',
        details: {
          suggestion: 'Check that your file contains data rows below the header row',
          mappingFeedback: parseResult.mappingFeedback
        }
      });
    }
    
    // Validate specimens and generate preview WUIDs
    const validationErrors = [];
    let validRows = 0;
    let errorRows = 0;
    
    // Get the next WUID that would be assigned (for preview purposes)
    // Use the ID service to peek without consuming sequence numbers
    let nextWUID;
    try {
      nextWUID = await idGenerationService.peekNextId('specimen');
    } catch (err) {
      logger.warn('Could not fetch next WUID for preview', { error: err.message });
      nextWUID = null;
    }
    
    const previewData = [];
    for (let i = 0; i < Math.min(parseResult.specimens.length, 20); i++) {
      const specimen = parseResult.specimens[i];
      const errors = await validateSpecimen(specimen, specimen._rowNumber);
      
      // Calculate what the WUID would be for this specimen
      const previewWUID = nextWUID ? nextWUID + i : null;
      
      if (errors.length > 0) {
        errorRows++;
        validationErrors.push(...errors);
        previewData.push({
          ...specimen,
          preview_wuid: previewWUID,
          status: 'Error',
          issues: errors.join('; ')
        });
      } else {
        validRows++;
        previewData.push({
          ...specimen,
          preview_wuid: previewWUID,
          status: 'Valid'
        });
      }
    }
    
    // Note: Duplicate checking should be done within transaction context during import
    // For preview, we'll skip duplicate checking to avoid race conditions
    const duplicateRows = 0; // Will be checked during actual import within transaction
    
    res.json({
      success: true,
      message: `Preview generated for ${parseResult.totalRows} specimens`,
      preview: previewData,
      totalRows: parseResult.totalRows,
      validRows: validRows,
      errorRows: errorRows,
      duplicateRows: duplicateRows,
      errors: validationErrors.slice(0, 50),
      hasMoreErrors: validationErrors.length > 50,
      mappingFeedback: parseResult.mappingFeedback,
      warnings: validationErrors.length > 0 ? ['Validation errors found - please review before importing'] : []
    });
    
  } catch (error) {
    // Handle specific parsing errors
    if (error.message.includes('parse') || error.message.includes('read')) {
      const errorResponse = handleImportError(error, 'preview');
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
    
    // Re-throw for general error handler
    throw error;
  }
}));

// @route   POST api/specimens/import/execute
// @desc    Execute specimen import
// @access  Private (editor/admin only)
router.post('/execute', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const { 
      importType, 
      projectId,
      skipDuplicates = false,
      updateDuplicates = true,
      batchSize = 500,
      createMissingEntities = true
    } = req.body;
    
    // Debug logging
    logger.info('Specimen import request started', {
      importType,
      projectId,
      skipDuplicates,
      updateDuplicates,
      batchSize,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
    
    // Parse the file
    const parseResult = parseSpecimenFile(req.file.buffer, req.file.mimetype);
    
    logger.info('CSV parse completed', {
      specimenCount: parseResult.specimens.length,
      firstSpecimen: parseResult.specimens[0],
      headers: parseResult.headers
    });
    
    // Validate all specimens
    const validationErrors = [];
    
    for (const specimen of parseResult.specimens) {
      const errors = await validateSpecimen(specimen, specimen._rowNumber);
      if (errors.length > 0) {
        validationErrors.push(...errors);
      }
    }
    
    logger.info('Validation completed', { errorCount: validationErrors.length });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        msg: 'Validation errors found',
        errors: validationErrors.slice(0, 100),
        totalErrors: validationErrors.length
      });
    }
    
    
    // Process specimens in batches
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      duplicatesSkipped: 0
    };
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const specimen of parseResult.specimens) {
        logger.debug('Processing specimen', { 
          rowNumber: specimen._rowNumber, 
          tube_id: specimen.tube_id,
          specimen_id: specimen.specimen_id,
          sample_id: specimen.sample_id,
          hasProjectId: !!projectId
        });
        
        try {
          // Parse location from individual fields or combined location string
          const location = {
            position_freezer: specimen.position_freezer || null,
            position_rack: specimen.position_rack || null, 
            position_box: specimen.position_box || null,
            position_dimension_one: specimen.position_dimension_one || null,
            position_dimension_two: specimen.position_dimension_two || null
          };
          
          // If there's a combined location string, parse it
          if (specimen.location) {
            const parsedLocation = parseLocation(specimen.location);
            Object.assign(location, parsedLocation);
          }
          
          // Use the required project ID (must be provided in project import)
          const targetProjectId = projectId;
          
          if (!targetProjectId) {
            throw new Error('Project ID is required for project import');
          }
          
          // Use tube_id as specimen identifier (required field)
          const specimenId = specimen.tube_id;
          
          // Check if specimen with same tube_id exists in same project (optional duplicate handling)
          const existingQuery = `SELECT id FROM specimens WHERE tube_id = $1 AND project_id = $2`;
          const existingResult = await client.query(existingQuery, [specimenId, targetProjectId]);
          
          if (existingResult.rows.length > 0) {
            if (skipDuplicates) {
              results.duplicatesSkipped++;
              continue;
            }
            
            if (updateDuplicates) {
              // Update existing specimen (include run_number, exclude missing sequencing columns)
              const updateQuery = `
                UPDATE specimens SET 
                  date_collected = $2, activity_status = $3,
                  extracted = $4, used_up = $5, initial_quantity = $6,
                  specimen_site = $7, position_freezer = $8, position_rack = $9,
                  position_box = $10, position_dimension_one = $11, position_dimension_two = $12,
                  run_number = $13, comments = $14, updated_at = NOW()
                WHERE id = $1
              `;
              
              await client.query(updateQuery, [
                existingResult.rows[0].id,
                specimen.date_collected ? new Date(specimen.date_collected) : null,
                specimen.activity_status || 'active',
                parseBoolean(specimen.extracted),
                parseBoolean(specimen.used_up),
                specimen.initial_quantity ? parseFloat(specimen.initial_quantity) : null,
                specimen.specimen_site,
                location.position_freezer,
                location.position_rack,
                location.position_box,
                location.position_dimension_one,
                location.position_dimension_two,
                specimen.run_number,
                specimen.comments
              ]);
              
              // Log update in audit trail
              await client.query(
                `INSERT INTO audit_log 
                (user_id, action, table_name, record_id, changed_fields) 
                VALUES ($1, $2, $3, $4, $5)`,
                [
                  req.user.id,
                  'UPDATE_IMPORT',
                  'specimens',
                  existingResult.rows[0].id,
                  JSON.stringify({ updated_from_project_import: true, tube_id: specimenId })
                ]
              );
              
              results.updated++;
            }
          } else {
            // Generate global sequential specimen number (WUID)
            // Note: Using direct query within transaction for consistency
            const getIdQuery = `SELECT get_next_number('specimen') as new_id`;
            const idResult = await client.query(getIdQuery);
            const specimenNumber = idResult.rows[0].new_id;
            
            // Create new specimen (no patient_id - remains NULL)
            // Include run_number (present in schema), exclude missing sequencing columns
            const insertQuery = `
              INSERT INTO specimens (
                tube_id, project_id, specimen_number, patient_id,
                date_collected, specimen_site, activity_status,
                extracted, used_up, initial_quantity,
                position_freezer, position_rack, position_box, 
                position_dimension_one, position_dimension_two,
                run_number, comments, created_at, updated_at
              ) VALUES (
                $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
              )
              RETURNING id
            `;
            
            const insertResult = await client.query(insertQuery, [
              specimenId, // tube_id
              targetProjectId, // project_id
              specimenNumber, // specimen_number (WUID)
              // patient_id is NULL (index 4)
              specimen.date_collected ? new Date(specimen.date_collected) : null,
              specimen.specimen_site,
              specimen.activity_status || 'active',
              parseBoolean(specimen.extracted),
              parseBoolean(specimen.used_up),
              specimen.initial_quantity ? parseFloat(specimen.initial_quantity) : null,
              location.position_freezer,
              location.position_rack,
              location.position_box,
              location.position_dimension_one,
              location.position_dimension_two,
              specimen.run_number,
              specimen.comments
            ]);
            
            // Log creation in audit trail
            await client.query(
              `INSERT INTO audit_log 
              (user_id, action, table_name, record_id, changed_fields) 
              VALUES ($1, $2, $3, $4, $5)`,
              [
                req.user.id,
                'CREATE_PROJECT_IMPORT',
                'specimens',
                insertResult.rows[0].id,
                JSON.stringify({ 
                  created_from_project_import: true, 
                  tube_id: specimenId,
                  specimen_number: specimenNumber,
                  project_id: targetProjectId
                })
              ]
            );
            
            results.created++;
          }
          
          results.processed++;
        } catch (error) {
          results.errors++;
          logger.error('Specimen import error', {
            error: error.message,
            specimenId: specimen.tube_id || specimen.specimen_id,
            rowNumber: specimen._rowNumber
          });
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Specimen import batch failed', {
        error: error.message,
        userId: req.user?.id,
        totalSpecimens: parseResult.specimens.length
      });
      throw error;
    } finally {
      client.release();
    }
    
    logger.info('Import completed', { results });
    
    // ✅ CRITICAL: Implement proper success validation to prevent silent failures
    if (results.processed === 0 && parseResult.specimens.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Import failed: No records were processed despite having valid data',
        details: {
          expectedRecords: parseResult.specimens.length,
          actuallyProcessed: results.processed,
          errors: results.errors,
          suggestion: 'Check database schema and import logs for detailed error information'
        },
        results
      });
    }
    
    // ✅ CRITICAL: Check for high error rates that indicate systematic problems
    const errorRate = results.errors / (results.processed + results.errors);
    if (errorRate > 0.5 && results.errors > 0) {
      return res.status(400).json({
        success: false,
        message: `Import failed: High error rate (${Math.round(errorRate * 100)}% failed)`,
        details: {
          totalSpecimens: parseResult.specimens.length,
          processed: results.processed,
          errors: results.errors,
          errorRate: Math.round(errorRate * 100) + '%',
          suggestion: 'Review import logs and fix data format issues before retrying'
        },
        results
      });
    }
    
    res.json({
      success: true,
      message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.errors} errors`,
      results
    });
    
  } catch (error) {
    // Log error for server monitoring without exposing sensitive details
    logger.error('Specimen import failed', { error: error.name, message: error.message });
    res.status(500).json({ 
      msg: 'Failed to import specimens',
      error: error.message 
    });
  }
});

module.exports = router;