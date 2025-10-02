const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');
const { FILE_UPLOAD } = require('../config/constants');

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
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// Expected column headers that match our export format
const EXPECTED_HEADERS = {
  // Standard export format
  'Specimen ID': 'specimen_id',
  'Tube ID': 'tube_id', 
  'PI Name': 'pi_name',
  'PI Institute': 'pi_institute',
  'Disease': 'disease',
  'Specimen Type': 'specimen_type',
  'Patient ID': 'patient_external_id',
  'Patient Name': 'patient_name',
  'Date of Birth': 'date_of_birth',
  'Date Collected': 'date_collected',
  'Location': 'location',
  'Activity Status': 'activity_status',
  'Extracted': 'extracted',
  'Used Up': 'used_up',
  'Initial Quantity': 'initial_quantity',
  'Specimen Site': 'specimen_site',
  'Project Source': 'project_source',
  'Date Received': 'date_received',
  'Feedback Date': 'feedback_date',
  'Diagnosis': 'diagnosis',
  'IRB ID': 'irb_id',
  'PI Email': 'pi_email',
  'PI Phone': 'pi_phone',
  'Internal Contact': 'internal_contact',
  'Specimen Comments': 'specimen_comments',
  'Project Comments': 'project_comments',
  'Sequencing Run ID': 'sequencing_run_id',
  'FASTQ Location': 'fastq_location',
  'Analysis Status': 'analysis_status',
  'Results Location': 'results_location',
  'Sequencing Notes': 'sequencing_notes',
  
  // Hierarchical format (collaborator:field_name)
  'collaborator:ID': 'collaborator_id',
  'collaborator:PI_Name': 'pi_name',
  'collaborator:PI_Institute': 'pi_institute',
  'collaborator:PI_Email': 'pi_email',
  'collaborator:PI_Phone': 'pi_phone',
  
  // Project format (project:field_name)
  'project:ID': 'project_id',
  'project:Disease': 'disease',
  'project:Specimen_Type': 'specimen_type',
  'project:IRB_ID': 'irb_id',
  'project:Internal_Contact': 'internal_contact',
  'project:Project_Source': 'project_source',
  'project:Comments': 'project_comments',
  
  // Specimen format (specimen:field_name)
  'specimen:ID': 'specimen_id',
  'specimen:Tube_ID': 'tube_id',
  'specimen:Patient_ID': 'patient_external_id',
  'specimen:Patient_Name': 'patient_name',
  'specimen:Date_of_Birth': 'date_of_birth',
  'specimen:Date_Collected': 'date_collected',
  'specimen:Date_Received': 'date_received',
  'specimen:Feedback_Date': 'feedback_date',
  'specimen:Location': 'location',
  'specimen:Activity_Status': 'activity_status',
  'specimen:Extracted': 'extracted',
  'specimen:Used_Up': 'used_up',
  'specimen:Initial_Quantity': 'initial_quantity',
  'specimen:Specimen_Site': 'specimen_site',
  'specimen:Diagnosis': 'diagnosis',
  'specimen:Comments': 'specimen_comments',
  'specimen:Sequencing_Run_ID': 'sequencing_run_id',
  'specimen:FASTQ_Location': 'fastq_location',
  'specimen:Analysis_Status': 'analysis_status',
  'specimen:Results_Location': 'results_location',
  'specimen:Sequencing_Notes': 'sequencing_notes'
};

// Valid enum values
const VALID_ANALYSIS_STATUS = ['pending', 'in_progress', 'completed', 'failed'];
const VALID_ACTIVITY_STATUS = ['Active', 'Inactive', 'QC Failed', 'On Hold'];

/**
 * Parse Excel/CSV file and extract data
 */
function parseFileData(fileBuffer, mimetype) {
  try {
    let workbook;
    
    if (mimetype.includes('csv')) {
      // Handle CSV files
      const csvData = fileBuffer.toString('utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      // Handle Excel files (.xlsx and .xls)
      try {
        workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
      } catch (xlsError) {
        // If parsing fails, try with different options for older Excel files
        logger.warn('Excel parsing failed, trying alternative method', { error: xlsError.message });
        workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, bookVBA: true });
      }
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length === 0) {
      throw new Error('File appears to be empty');
    }
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    // Map headers to our expected format
    const headerMapping = {};
    const unmatchedHeaders = [];
    
    headers.forEach((header, index) => {
      if (EXPECTED_HEADERS[header]) {
        headerMapping[index] = EXPECTED_HEADERS[header];
      } else {
        unmatchedHeaders.push(header);
      }
    });
    
    // Convert rows to objects
    const parsedData = dataRows.map((row, rowIndex) => {
      const specimen = {};
      
      headers.forEach((header, colIndex) => {
        const fieldName = headerMapping[colIndex];
        if (fieldName && row[colIndex] !== undefined && row[colIndex] !== '') {
          specimen[fieldName] = row[colIndex];
        }
      });
      
      specimen._rowNumber = rowIndex + 2; // +2 because we skipped header and arrays are 0-indexed
      return specimen;
    }).filter(row => Object.keys(row).length > 1); // Filter out empty rows
    
    return {
      data: parsedData,
      headers: headers,
      unmatchedHeaders,
      totalRows: parsedData.length
    };
    
  } catch (error) {
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

/**
 * Validate specimen data
 */
function validateSpecimenData(specimen, rowNumber) {
  const errors = [];
  
  // Required fields validation
  if (!specimen.tube_id && !specimen.specimen_id) {
    errors.push(`Row ${rowNumber}: Missing required Specimen ID or Tube ID`);
  }
  
  if (!specimen.pi_name) {
    errors.push(`Row ${rowNumber}: Missing required PI Name`);
  }
  
  if (!specimen.pi_institute) {
    errors.push(`Row ${rowNumber}: Missing required PI Institute`);
  }
  
  // Enum validation
  if (specimen.analysis_status && !VALID_ANALYSIS_STATUS.includes(specimen.analysis_status)) {
    errors.push(`Row ${rowNumber}: Invalid analysis status '${specimen.analysis_status}'. Must be: ${VALID_ANALYSIS_STATUS.join(', ')}`);
  }
  
  if (specimen.activity_status && !VALID_ACTIVITY_STATUS.includes(specimen.activity_status)) {
    errors.push(`Row ${rowNumber}: Invalid activity status '${specimen.activity_status}'. Must be: ${VALID_ACTIVITY_STATUS.join(', ')}`);
  }
  
  // Date validation
  if (specimen.date_collected && isNaN(Date.parse(specimen.date_collected))) {
    errors.push(`Row ${rowNumber}: Invalid date format for Date Collected: '${specimen.date_collected}'`);
  }
  
  if (specimen.date_received && isNaN(Date.parse(specimen.date_received))) {
    errors.push(`Row ${rowNumber}: Invalid date format for Date Received: '${specimen.date_received}'`);
  }
  
  // Boolean validation
  if (specimen.extracted && !['Yes', 'No', 'true', 'false', '1', '0'].includes(String(specimen.extracted))) {
    errors.push(`Row ${rowNumber}: Invalid boolean value for Extracted: '${specimen.extracted}'. Use Yes/No, true/false, or 1/0`);
  }
  
  if (specimen.used_up && !['Yes', 'No', 'true', 'false', '1', '0'].includes(String(specimen.used_up))) {
    errors.push(`Row ${rowNumber}: Invalid boolean value for Used Up: '${specimen.used_up}'. Use Yes/No, true/false, or 1/0`);
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
 * Convert boolean-like values to actual booleans
 */
function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  const stringValue = String(value).toLowerCase();
  return ['yes', 'true', '1'].includes(stringValue);
}

/**
 * Check for duplicate specimen IDs
 */
async function checkDuplicates(specimens) {
  const tubeIds = specimens.map(s => s.tube_id || s.specimen_id).filter(Boolean);
  
  if (tubeIds.length === 0) return { duplicates: [], existing: [] };
  
  const placeholders = tubeIds.map((_, i) => `$${i + 1}`).join(',');
  const query = `SELECT tube_id FROM specimens WHERE tube_id IN (${placeholders})`;
  
  const result = await db.query(query, tubeIds);
  const existing = result.rows.map(row => row.tube_id);
  
  const duplicates = specimens.filter(s => existing.includes(s.tube_id || s.specimen_id));
  
  return { duplicates, existing };
}

// @route   POST api/import/preview
// @desc    Preview import data without saving
// @access  Private (admin/editor only)
router.post('/preview', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    // Parse the file
    const parseResult = parseFileData(req.file.buffer, req.file.mimetype);
    
    // Validate first 20 rows for preview
    const previewData = parseResult.data.slice(0, 20);
    const validationErrors = [];
    
    previewData.forEach(specimen => {
      const errors = validateSpecimenData(specimen, specimen._rowNumber);
      validationErrors.push(...errors);
    });
    
    // Check for duplicates in preview data
    const { duplicates } = await checkDuplicates(previewData);
    
    res.json({
      success: true,
      preview: previewData,
      totalRows: parseResult.totalRows,
      previewRows: previewData.length,
      headers: parseResult.headers,
      unmatchedHeaders: parseResult.unmatchedHeaders,
      validationErrors: validationErrors.slice(0, 50), // Limit errors shown
      duplicates: duplicates.map(d => d.tube_id || d.specimen_id),
      hasMoreErrors: validationErrors.length > 50
    });
    
  } catch (error) {
    logger.error('Preview generation failed', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      msg: 'Failed to preview import data',
      error: error.message 
    });
  }
});

/**
 * Find or create collaborator within transaction
 */
async function findOrCreateCollaborator(client, piName, piInstitute, piEmail = null, piPhone = null) {
  // First try to find existing collaborator
  const findQuery = `
    SELECT id FROM collaborators 
    WHERE pi_name = $1 AND pi_institute = $2
  `;
  
  const findResult = await client.query(findQuery, [piName, piInstitute]);
  
  if (findResult.rows.length > 0) {
    return findResult.rows[0].id;
  }
  
  // Create new collaborator
  const createQuery = `
    INSERT INTO collaborators (pi_name, pi_institute, pi_email, pi_phone, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id
  `;
  
  const createResult = await client.query(createQuery, [piName, piInstitute, piEmail, piPhone]);
  return createResult.rows[0].id;
}

/**
 * Find or create project within transaction
 */
async function findOrCreateProject(client, collaboratorId, projectData) {
  // If project ID is provided, try to find existing project by project_number first
  if (projectData.project_id) {
    const findByNumberQuery = `SELECT id FROM projects WHERE project_number = $1`;
    const findByNumberResult = await client.query(findByNumberQuery, [projectData.project_id]);
    
    if (findByNumberResult.rows.length > 0) {
      return findByNumberResult.rows[0].id;
    }
  }
  
  const disease = projectData.disease || 'unknown';
  const source = projectData.project_source || `${disease} Study`;
  
  // Try to find existing project by collaborator, disease and source
  const findQuery = `
    SELECT id FROM projects 
    WHERE collaborator_id = $1 AND disease = $2 AND source = $3
    LIMIT 1
  `;
  
  const findResult = await client.query(findQuery, [collaboratorId, disease, source]);
  
  if (findResult.rows.length > 0) {
    return findResult.rows[0].id;
  }
  
  // Create new project with project_number
  const createQuery = `
    INSERT INTO projects (
      collaborator_id, disease, source, project_number,
      comments, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id
  `;
  
  const createResult = await client.query(createQuery, [
    collaboratorId,
    disease,
    source,
    projectData.project_id, // Store the lab's project number
    projectData.project_comments
  ]);
  
  return createResult.rows[0].id;
}

/**
 * Find or create patient within transaction
 */
async function findOrCreatePatient(client, patientData) {
  if (!patientData.patient_external_id && !patientData.patient_name) {
    return null; // No patient data provided
  }
  
  // Try to find existing patient by external ID
  if (patientData.patient_external_id) {
    const findQuery = `SELECT id FROM patients WHERE external_id = $1`;
    const findResult = await client.query(findQuery, [patientData.patient_external_id]);
    
    if (findResult.rows.length > 0) {
      return findResult.rows[0].id;
    }
  }
  
  // Create new patient
  const createQuery = `
    INSERT INTO patients (external_id, name, date_of_birth, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id
  `;
  
  const dob = patientData.date_of_birth ? new Date(patientData.date_of_birth) : null;
  
  const createResult = await client.query(createQuery, [
    patientData.patient_external_id,
    patientData.patient_name,
    dob
  ]);
  
  return createResult.rows[0].id;
}

/**
 * Process specimens in batches
 */
async function processBatch(specimens, batchSize = 1000) {
  const results = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: []
  };
  
  for (let i = 0; i < specimens.length; i += batchSize) {
    const batch = specimens.slice(i, i + batchSize);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const specimen of batch) {
        try {
          // Find/create collaborator
          const collaboratorId = await findOrCreateCollaborator(
            client,
            specimen.pi_name, 
            specimen.pi_institute,
            specimen.pi_email,
            specimen.pi_phone
          );
          
          // Find/create project
          const projectId = await findOrCreateProject(client, collaboratorId, specimen);
          
          // Find/create patient
          const patientId = await findOrCreatePatient(client, specimen);
          
          // Parse location
          const location = parseLocation(specimen.location);
          
          // Check if specimen exists
          const existingQuery = `SELECT id FROM specimens WHERE tube_id = $1`;
          const existingResult = await client.query(existingQuery, [specimen.tube_id || specimen.specimen_id]);
          
          if (existingResult.rows.length > 0) {
            // Update existing specimen
            const updateQuery = `
              UPDATE specimens SET 
                project_id = $2, patient_id = $3, date_collected = $4,
                activity_status = $5, extracted = $6, initial_quantity = $7, 
                specimen_site = $8, position_freezer = $9, position_rack = $10, 
                position_box = $11, position_dimension_one = $12, position_dimension_two = $13,
                comments = $14, sequencing_run_id = $15, fastq_location = $16,
                analysis_status = $17, results_location = $18, sequencing_notes = $19,
                updated_at = NOW()
              WHERE id = $1
            `;
            
            await client.query(updateQuery, [
              existingResult.rows[0].id, projectId, patientId,
              specimen.date_collected ? new Date(specimen.date_collected) : null,
              specimen.activity_status || 'Active',
              parseBoolean(specimen.extracted),
              specimen.initial_quantity,
              specimen.specimen_site,
              location.position_freezer,
              location.position_rack,
              location.position_box,
              location.position_dimension_one,
              location.position_dimension_two,
              specimen.specimen_comments,
              specimen.sequencing_run_id,
              specimen.fastq_location,
              specimen.analysis_status,
              specimen.results_location,
              specimen.sequencing_notes
            ]);
            
            results.updated++;
          } else {
            // Generate auto-incremented specimen number for new specimens
            const getIdQuery = `SELECT get_next_number('specimen') as new_id`;
            const idResult = await client.query(getIdQuery);
            const specimenNumber = idResult.rows[0].new_id;
            
            // Create new specimen with auto-generated specimen_number
            const insertQuery = `
              INSERT INTO specimens (
                specimen_number, tube_id, project_id, patient_id, date_collected,
                activity_status, extracted, initial_quantity, specimen_site,
                position_freezer, position_rack, position_box, position_dimension_one, 
                position_dimension_two, comments, sequencing_run_id, fastq_location, 
                analysis_status, results_location, sequencing_notes, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
              )
            `;
            
            await client.query(insertQuery, [
              specimenNumber,
              specimen.tube_id || specimen.specimen_id, projectId, patientId,
              specimen.date_collected ? new Date(specimen.date_collected) : null,
              specimen.activity_status || 'Active',
              parseBoolean(specimen.extracted),
              specimen.initial_quantity,
              specimen.specimen_site,
              location.position_freezer,
              location.position_rack,
              location.position_box,
              location.position_dimension_one,
              location.position_dimension_two,
              specimen.specimen_comments,
              specimen.sequencing_run_id,
              specimen.fastq_location,
              specimen.analysis_status,
              specimen.results_location,
              specimen.sequencing_notes
            ]);
            
            results.created++;
          }
          
          results.processed++;
        } catch (error) {
          results.errors.push({
            row: specimen._rowNumber,
            tube_id: specimen.tube_id || specimen.specimen_id,
            error: error.message
          });
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Inventory batch processing failed', {
        error: error.message,
        itemsProcessed: results.successful + results.failed
      });
      throw error;
    } finally {
      client.release();
    }
  }
  
  return results;
}

// @route   POST api/import/execute
// @desc    Execute import with optional deduplication
// @access  Private (admin/editor only)
router.post('/execute', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const { 
      skipDuplicates = false, 
      updateDuplicates = true,
      batchSize = 1000 
    } = req.body;
    
    // Parse the file
    const parseResult = parseFileData(req.file.buffer, req.file.mimetype);
    
    // Validate all data
    const validationErrors = [];
    parseResult.data.forEach(specimen => {
      const errors = validateSpecimenData(specimen, specimen._rowNumber);
      validationErrors.push(...errors);
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        msg: 'Validation errors found',
        errors: validationErrors.slice(0, 100),
        hasMoreErrors: validationErrors.length > 100
      });
    }
    
    // Check for duplicates
    const { duplicates, existing } = await checkDuplicates(parseResult.data);
    
    let dataToProcess = parseResult.data;
    
    if (duplicates.length > 0 && skipDuplicates) {
      // Remove duplicates from processing
      dataToProcess = parseResult.data.filter(s => 
        !existing.includes(s.tube_id || s.specimen_id)
      );
    } else if (duplicates.length > 0 && !updateDuplicates) {
      return res.status(400).json({
        msg: 'Duplicate specimens found and updates not allowed',
        duplicates: duplicates.map(d => d.tube_id || d.specimen_id)
      });
    }
    
    // Process in batches
    const results = await processBatch(dataToProcess, parseInt(batchSize));
    
    res.json({
      success: true,
      message: 'Import completed successfully',
      results: {
        ...results,
        duplicatesSkipped: skipDuplicates ? duplicates.length : 0,
        totalRows: parseResult.totalRows,
        processedRows: dataToProcess.length
      }
    });
    
  } catch (error) {
    logger.error('Import operation failed', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      msg: 'Failed to import data',
      error: error.message 
    });
  }
});

// @route   POST api/import/batch-status
// @desc    Get batch processing status (for future real-time updates)
// @access  Private (admin/editor only)
router.get('/batch-status/:batchId', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  // This endpoint can be enhanced later for real-time batch processing status
  res.json({
    success: true,
    status: 'completed',
    message: 'Batch processing status endpoint - to be enhanced for real-time updates'
  });
});

// Expected inventory column headers
const INVENTORY_EXPECTED_HEADERS = {
  'Inventory ID': 'inventory_id',
  'Barcode': 'barcode',
  'Name': 'name',
  'Category': 'category',
  'Description': 'description',
  'Supplier': 'supplier',
  'Catalog Number': 'catalog_number',
  'Lot Number': 'lot_number',
  'Current Quantity': 'current_quantity',
  'Unit': 'unit_of_measure',
  'Unit of Measure': 'unit_of_measure',
  'Min Stock Level': 'minimum_stock_level',
  'Minimum Stock Level': 'minimum_stock_level',
  'Cost per Unit': 'cost_per_unit',
  'Expiration Date': 'expiration_date',
  'Storage Location': 'storage_location',
  'Storage Conditions': 'storage_conditions',
  'Notes': 'notes'
};

// Valid inventory categories
const VALID_INVENTORY_CATEGORIES = [
  'reagents', 'enzymes', 'kits', 'consumables', 
  'antibodies', 'primers', 'media', 'other'
];

/**
 * Parse inventory file data
 */
function parseInventoryFileData(fileBuffer, mimetype) {
  try {
    let workbook;
    
    if (mimetype.includes('csv')) {
      const csvData = fileBuffer.toString('utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length === 0) {
      throw new Error('File appears to be empty');
    }
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    // Map headers to our expected format
    const headerMapping = {};
    const unmatchedHeaders = [];
    
    headers.forEach((header, index) => {
      if (INVENTORY_EXPECTED_HEADERS[header]) {
        headerMapping[index] = INVENTORY_EXPECTED_HEADERS[header];
      } else {
        // Try fuzzy matching
        const fuzzyMatch = Object.keys(INVENTORY_EXPECTED_HEADERS).find(expectedHeader =>
          expectedHeader.toLowerCase().includes(header.toLowerCase()) ||
          header.toLowerCase().includes(expectedHeader.toLowerCase())
        );
        
        if (fuzzyMatch) {
          headerMapping[index] = INVENTORY_EXPECTED_HEADERS[fuzzyMatch];
        } else {
          unmatchedHeaders.push({ index, header });
        }
      }
    });
    
    // Check for required headers
    const requiredFields = ['name', 'category', 'current_quantity'];
    const mappedFields = Object.values(headerMapping);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
    }
    
    // Transform data rows
    const data = dataRows
      .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
      .map((row, rowIndex) => {
        const item = {};
        
        Object.entries(headerMapping).forEach(([colIndex, fieldName]) => {
          let value = row[parseInt(colIndex)];
          
          // Handle date fields
          if (['expiration_date'].includes(fieldName) && value) {
            if (value instanceof Date) {
              item[fieldName] = value.toISOString().split('T')[0];
            } else if (typeof value === 'string') {
              const parsed = new Date(value);
              if (!isNaN(parsed.getTime())) {
                item[fieldName] = parsed.toISOString().split('T')[0];
              }
            }
          }
          // Handle numeric fields
          else if (['current_quantity', 'minimum_stock_level', 'cost_per_unit'].includes(fieldName) && value) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              item[fieldName] = numValue;
            }
          }
          // Handle boolean fields (if any in future)
          else if (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
            item[fieldName] = value.toLowerCase() === 'true';
          }
          // Handle regular fields
          else if (value !== null && value !== undefined && value !== '') {
            item[fieldName] = String(value).trim();
          }
        });
        
        // Add row number for error reporting
        item._rowNumber = rowIndex + 2; // +2 because we skip header and arrays are 0-indexed
        
        return item;
      });
    
    return {
      success: true,
      data,
      totalRows: dataRows.length,
      processedRows: data.length,
      unmatchedHeaders,
      headerMapping
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate inventory item data
 */
function validateInventoryItem(item) {
  const errors = [];
  
  // Required fields
  if (!item.name || !item.name.trim()) {
    errors.push('Name is required');
  }
  
  if (!item.category || !item.category.trim()) {
    errors.push('Category is required');
  } else if (!VALID_INVENTORY_CATEGORIES.includes(item.category.toLowerCase())) {
    errors.push(`Invalid category. Must be one of: ${VALID_INVENTORY_CATEGORIES.join(', ')}`);
  }
  
  if (item.current_quantity === undefined || item.current_quantity === null || item.current_quantity === '') {
    errors.push('Current quantity is required');
  } else if (isNaN(parseFloat(item.current_quantity)) || parseFloat(item.current_quantity) < 0) {
    errors.push('Current quantity must be a non-negative number');
  }
  
  // Optional field validations
  if (item.minimum_stock_level !== undefined && item.minimum_stock_level !== null && item.minimum_stock_level !== '') {
    if (isNaN(parseFloat(item.minimum_stock_level)) || parseFloat(item.minimum_stock_level) < 0) {
      errors.push('Minimum stock level must be a non-negative number');
    }
  }
  
  if (item.cost_per_unit !== undefined && item.cost_per_unit !== null && item.cost_per_unit !== '') {
    if (isNaN(parseFloat(item.cost_per_unit)) || parseFloat(item.cost_per_unit) < 0) {
      errors.push('Cost per unit must be a non-negative number');
    }
  }
  
  if (item.expiration_date && item.expiration_date !== '') {
    const date = new Date(item.expiration_date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid expiration date format');
    }
  }
  
  return errors;
}

/**
 * Process inventory batch import
 */
async function processInventoryBatch(items) {
  const results = {
    successful: 0,
    failed: 0,
    errors: [],
    warnings: []
  };
  
  // Begin transaction
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        // Validate item
        const validationErrors = validateInventoryItem(item);
        if (validationErrors.length > 0) {
          results.failed++;
          results.errors.push({
            row: item._rowNumber,
            errors: validationErrors
          });
          continue;
        }
        
        // Get next inventory ID
        const idResult = await client.query('SELECT get_next_number($1) as inventory_number', ['inventory']);
        const inventory_id = idResult.rows[0].inventory_number;
        
        // Generate barcode
        const barcode = `INV-${inventory_id.toString().padStart(3, '0')}`;
        
        // Prepare data for insertion
        const insertData = {
          inventory_id,
          name: item.name.trim(),
          category: item.category.toLowerCase().trim(),
          description: item.description?.trim() || null,
          supplier: item.supplier?.trim() || null,
          catalog_number: item.catalog_number?.trim() || null,
          current_quantity: parseFloat(item.current_quantity),
          unit_of_measure: item.unit_of_measure?.trim() || null,
          lot_number: item.lot_number?.trim() || null,
          expiration_date: item.expiration_date || null,
          storage_location: item.storage_location?.trim() || null,
          storage_conditions: item.storage_conditions?.trim() || null,
          minimum_stock_level: item.minimum_stock_level ? parseFloat(item.minimum_stock_level) : 0,
          cost_per_unit: item.cost_per_unit ? parseFloat(item.cost_per_unit) : null,
          barcode,
          notes: item.notes?.trim() || null
        };
        
        // Insert inventory item
        const insertResult = await client.query(
          `INSERT INTO inventory 
          (inventory_id, name, category, description, supplier, catalog_number, 
           current_quantity, unit_of_measure, lot_number, expiration_date, 
           storage_location, storage_conditions, minimum_stock_level, 
           cost_per_unit, barcode, notes) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
          RETURNING id`,
          [
            insertData.inventory_id, insertData.name, insertData.category, 
            insertData.description, insertData.supplier, insertData.catalog_number,
            insertData.current_quantity, insertData.unit_of_measure, insertData.lot_number, 
            insertData.expiration_date, insertData.storage_location, insertData.storage_conditions,
            insertData.minimum_stock_level, insertData.cost_per_unit, insertData.barcode, 
            insertData.notes
          ]
        );
        
        // Create initial transaction record if quantity > 0
        if (insertData.current_quantity > 0) {
          await client.query(
            `INSERT INTO inventory_transactions 
            (inventory_id, transaction_type, quantity_change, quantity_after, reason, performed_by)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              insertResult.rows[0].id,
              'in',
              insertData.current_quantity,
              insertData.current_quantity,
              'Initial import',
              '00000000-0000-0000-0000-000000000000' // System user for imports
            ]
          );
        }
        
        // Log audit entry
        await client.query(
          `INSERT INTO audit_log 
          (user_id, action, table_name, record_id, changed_fields) 
          VALUES ($1, $2, $3, $4, $5)`,
          [
            '00000000-0000-0000-0000-000000000000', // System user for imports
            'CREATE_IMPORT',
            'inventory',
            insertResult.rows[0].id,
            JSON.stringify(insertData)
          ]
        );
        
        results.successful++;
        
      } catch (error) {
        logger.error('Error processing inventory item', { rowNumber: item._rowNumber, error: error.message });
        results.failed++;
        results.errors.push({
          row: item._rowNumber,
          errors: [error.message]
        });
      }
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  return results;
}

// @route   POST api/import/inventory
// @desc    Import inventory data from Excel/CSV file
// @access  Private (admin/editor only)
router.post('/inventory', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const { batchSize = 100 } = req.body;
    
    // Parse the uploaded file
    const parseResult = parseInventoryFileData(req.file.buffer, req.file.mimetype);
    
    if (!parseResult.success) {
      return res.status(400).json({
        msg: 'Failed to parse file',
        error: parseResult.error
      });
    }
    
    if (parseResult.data.length === 0) {
      return res.status(400).json({
        msg: 'No valid inventory data found in file'
      });
    }
    
    // Process data in batches
    const results = await processInventoryBatch(parseResult.data);
    
    // Log the import operation
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'BULK_IMPORT',
        'inventory',
        '00000000-0000-0000-0000-000000000000',
        JSON.stringify({
          filename: req.file.originalname,
          totalRows: parseResult.totalRows,
          processedRows: parseResult.processedRows,
          successful: results.successful,
          failed: results.failed,
          unmatchedHeaders: parseResult.unmatchedHeaders
        })
      ]
    );
    
    res.json({
      success: true,
      message: 'Inventory import completed',
      results: {
        ...results,
        totalRows: parseResult.totalRows,
        processedRows: parseResult.processedRows,
        unmatchedHeaders: parseResult.unmatchedHeaders
      }
    });
    
  } catch (error) {
    console.error('Inventory import error:', error);
    res.status(500).json({
      msg: 'Failed to import inventory data',
      error: error.message
    });
  }
});

module.exports = router;