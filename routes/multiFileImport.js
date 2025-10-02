const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');
const { FILE_UPLOAD } = require('../config/constants');
const { updateSequence } = require('../utils/sequenceUpdater');

// Configure multer for multiple file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed for multi-file import.'));
    }
  }
});

// Multi-file upload configuration
const multiUpload = upload.fields([
  { name: 'collaborators', maxCount: 1 },
  { name: 'projects', maxCount: 1 },
  { name: 'specimens', maxCount: 1 },
  { name: 'patients', maxCount: 1 }
]);

/**
 * Parse CSV file and extract data with flexible column mapping
 */
function parseCSVData(fileBuffer, filename) {
  try {
    const csvData = fileBuffer.toString('utf8');
    const workbook = XLSX.read(csvData, { 
      type: 'string',
      cellDates: false,  // Prevent date conversion
      raw: false         // Return formatted strings, not raw values
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row, keeping all values as strings
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,        // Return formatted strings
      dateNF: 'YYYY-MM-DD' // Date format (shouldn't matter since cellDates: false)
    });
    
    if (rawData.length === 0) {
      throw new Error(`File ${filename} appears to be empty`);
    }
    
    logger.info(`CSV parsing started for ${filename}`, { totalRows: rawData.length, filename });
    const debugInfo = [`XLSX parsed ${rawData.length} total rows (including header)`];
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
    
    logger.debug(`Filtered empty rows from ${filename}`, { validRows: dataRows.length, filename });
    debugInfo.push(`After filtering completely empty rows: ${dataRows.length} rows`);
    
    // Convert rows to objects, tracking filtered rows
    let filteredCount = 0;
    const allParsedData = dataRows.map((row, rowIndex) => {
      const record = {};
      
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined && row[colIndex] !== '') {
          // Clean header names - remove quotes, tabs, and extra whitespace
          const cleanHeader = String(header).replace(/["\t]/g, '').trim();
          if (cleanHeader) {
            record[cleanHeader] = String(row[colIndex]).trim();
          }
        }
      });
      
      record._rowNumber = rowIndex + 2; // +2 for header and 0-indexing
      record._filename = filename;
      return record;
    });
    
    // Filter out rows that are essentially empty, counting what we filter
    const parsedData = allParsedData.filter(record => {
      const dataKeys = Object.keys(record).filter(key => !key.startsWith('_'));
      // A row is valid if it has any non-empty field (including '0' which can be valid data) 
      const hasData = dataKeys.some(key => record[key] !== undefined && record[key] !== '' && record[key] !== 'NULL' && record[key] !== 'null');
      if (!hasData) {
        filteredCount++;
      }
      return hasData;
    });
    
    debugInfo.push(`After filtering empty fields: ${parsedData.length} valid rows (${filteredCount} filtered)`);
    logger.info(`CSV parsing completed for ${filename}`, { validRows: parsedData.length, filteredRows: filteredCount, filename });
    
    return {
      data: parsedData,
      headers: headers,
      totalRows: parsedData.length,
      filteredRows: filteredCount,
      originalRowCount: allParsedData.length,
      debugInfo: debugInfo,
      filename
    };
    
  } catch (error) {
    throw new Error(`Failed to parse ${filename}: ${error.message}`);
  }
}

/**
 * Validate collaborator data
 */
function validateCollaborator(collab, rowNumber, filename) {
  const errors = [];
  
  if (!collab.ID && !collab.id) {
    errors.push({
      file: filename,
      row: rowNumber,
      field: 'ID',
      message: 'Missing required collaborator ID'
    });
  }
  
  // Check for required data
  const hasName = collab.PI_Name || collab.pi_name || collab['PI Name'];
  const hasInstitute = collab.PI_Institute || collab.pi_institute || collab['PI Institute'];
  
  // Collaborators without both PI Name AND PI Institute will be skipped and their projects assigned to "Unknown"
  // This is not a validation error - it's expected behavior
  
  return errors;
}

/**
 * Validate project data
 */
function validateProject(project, rowNumber, filename) {
  const errors = [];
  
  // Check for project ID
  const hasProjectId = project.ID || project.id;
  if (!hasProjectId) {
    errors.push({
      file: filename,
      row: rowNumber,
      field: 'ID',
      message: 'Missing required project ID'
    });
  }
  
  // Skip validation for rows that look like headers or test data (disabled for migration imports)
  // const disease = project.Disease || project.disease;
  // if (disease === 'Disease' || disease === 'Specimen Type') {
  //   // This looks like a header row mixed in with data, skip it
  //   errors.push({
  //     file: filename,
  //     row: rowNumber,
  //     field: 'Data',
  //     message: 'Row appears to contain header data instead of project data - skipping'
  //   });
  // }
  
  // Note: Collaborator reference is no longer required - missing ones will be assigned to "Unknown" collaborator
  
  return errors;
}

/**
 * Validate specimen data
 */
function validateSpecimen(specimen, rowNumber, filename) {
  const errors = [];
  
  // Check for specimen identifier
  const hasAnyId = specimen.tube_id || specimen.specimen_id || specimen.sample_id || 
                   specimen.Tube_ID || specimen.Specimen_ID || specimen.Sample_ID || 
                   specimen.ID || specimen.id;
  
  if (!hasAnyId) {
    errors.push({
      file: filename,
      row: rowNumber,
      field: 'tube_id',
      message: 'Missing required specimen identifier'
    });
  }
  
  // Note: Project reference is no longer required - missing ones will be assigned to "Unknown" project
  
  return errors;
}

/**
 * Validate patient data
 */
function validatePatient(patient, rowNumber, filename) {
  const errors = [];
  
  // Check for patient ID (required for patient_number) - disabled for migration imports
  // const hasPatientId = patient.ID || patient.id || patient.patient_id || patient.Patient_ID;
  // if (!hasPatientId) {
  //   errors.push({
  //     file: filename,
  //     row: rowNumber,
  //     field: 'ID',
  //     message: 'Missing required patient ID'
  //   });
  // }
  
  return errors;
}

/**
 * Normalize field names to database format
 */
function normalizeCollaborator(collab) {
  const piName = collab.PI_Name || collab.pi_name || collab['PI Name'] || null;
  const piInstitute = collab.PI_Institute || collab.pi_institute || collab['PI Institute'] || null;
  
  return {
    id: collab.ID || collab.id,
    collaborator_number: collab.ID || collab.id, // Use existing ID as collaborator_number
    irb_id: collab.IRB_ID || collab.irb_id || collab['IRB ID'] || null,
    pi_name: piName || (piInstitute ? `PI at ${piInstitute}` : 'Unknown PI'),
    pi_institute: piInstitute || (piName ? 'Unknown Institution' : 'Unknown Institution'),
    pi_email: collab.PI_Email || collab.pi_email || collab['PI Email'] || null,
    pi_phone: collab.PI_Phone || collab.pi_phone || collab['PI Phone'] || null,
    pi_fax: collab.PI_Fax || collab.pi_fax || collab['PI Fax'] || null,
    internal_contact: collab.Internal_Contact || collab.internal_contact || collab['Internal Contact'] || null,
    comments: collab.Comments || collab.comments || null
  };
}

/**
 * Normalize project data
 */
function normalizeProject(project) {
  return {
    id: project.ID || project.id,
    project_id: project.ID || project.id, // Use existing ID as project_id
    collaborator_id: project.Collaborator || project.collaborator || project.collaborator_id,
    disease: project.Disease || project.disease || 'unknown',
    specimen_type: project.Specimen_Type || project.specimen_type || project['Specimen Type'] || null,
    source: project.Source || project.source || null,
    date_received: project.Date_Received || project.date_received || project['Date Received'] || null,
    feedback_date: project.Feedback_Date || project.feedback_date || project['Feedback Date'] || null,
    comments: project.Comments || project.comments || null
  };
}

/**
 * Normalize specimen data
 */
function normalizeSpecimen(specimen) {
  // Debug logging to see what fields are available
  logger.debug('Normalizing specimen data', { 
    availableFields: Object.keys(specimen),
    specimenID: specimen.ID,
    specimenId: specimen.id,
    specimenNumber: specimen.Specimen_Number
  });
  
  // For specimen_number, prioritize numeric values and validate each fallback
  let specimenNumber = null;
  const candidateFields = [
    specimen.ID, specimen.id, specimen.Specimen_Number, specimen.specimen_number
  ];
  
  for (const candidate of candidateFields) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      const parsed = parseInt(candidate);
      if (!isNaN(parsed)) {
        specimenNumber = candidate; // Keep original string for later parsing
        // console.log(`✅ Found valid specimen_number: "${candidate}" -> ${specimenNumber}`);
        break;
      }
    }
  }
  
  if (specimenNumber === null) {
    console.log(`❌ No valid specimen_number found from candidates:`, candidateFields);
  }
  
  return {
    // CSV ID field maps to specimen_number for migration import
    specimen_number: specimenNumber,
    tube_id: specimen.tube_id || specimen.specimen_id || specimen.sample_id || specimen.Tube_ID || specimen.Specimen_ID || specimen.Sample_ID,
    project_id: specimen.project_id || specimen.Project_ID || specimen.Project || specimen.project,
    date_collected: specimen.date_collected || specimen.Date_Collected || specimen['Date Collected'] || specimen.collection_date || specimen.Collection_Date,
    activity_status: specimen.activity_status || specimen.Activity_Status || specimen.Status || specimen.status || 'Active',
    extracted: specimen.extracted || specimen.Extracted || specimen.is_extracted || specimen.Is_Extracted || false,
    used_up: specimen.used_up || specimen.Used_Up || specimen['Used Up'] || false,
    initial_quantity: specimen.initial_quantity || specimen.Initial_Quantity || specimen.Quantity || specimen.quantity || specimen.Volume || specimen.volume,
    specimen_site: specimen.specimen_site || specimen.Specimen_Site || specimen.Site || specimen.site || specimen.specimen_type || specimen.Specimen_Type,
    position_freezer: specimen.position_freezer || specimen.Position_Freezer || specimen.Freezer || specimen.freezer || specimen.Location || specimen.location,
    position_rack: specimen.position_rack || specimen.Position_Rack || specimen.Rack || specimen.rack,
    position_box: specimen.position_box || specimen.Position_Box || specimen.Box || specimen.box,
    position_dimension_one: specimen.position_dimension_one || specimen.Position_1 || specimen.position_1 || specimen.Pos1 || specimen.pos1,
    position_dimension_two: specimen.position_dimension_two || specimen.Position_2 || specimen.position_2 || specimen.Pos2 || specimen.pos2,
    comments: specimen.comments || specimen.Comments || specimen.Notes || specimen.notes || specimen.Description || specimen.description
  };
}

/**
 * Normalize patient data
 */
function normalizePatient(patient) {
  const normalized = {
    // CSV ID column maps to patient_number (internal LIMS sequential ID)
    id: patient.ID || patient.id || patient.patient_id || patient.Patient_ID,
    // CSV External_ID column maps to external_id (hospital/clinic medical record number)
    external_id: patient.External_ID || patient.external_id || null,
    first_name: patient.first_name || patient.First_Name || patient.firstname || patient.FirstName || patient['First Name'] || null,
    last_name: patient.last_name || patient.Last_Name || patient.lastname || patient.LastName || patient['Last Name'] || null,
    date_of_birth: patient.date_of_birth || patient.Date_of_Birth || patient.DOB || patient.dob || patient['Date of Birth'] || null,
    diagnosis: patient.diagnosis || patient.Diagnosis || patient.disease || patient.Disease || null,
    medical_record_number: patient.medical_record_number || patient.Medical_Record_Number || patient.mrn || patient.MRN || patient['Medical Record Number'] || null,
    comments: patient.comments || patient.Comments || patient.notes || patient.Notes || null
  };
  
  logger.debug('Normalizing patient data', {
    originalID: patient.ID,
    originalExternalID: patient.External_ID,
    normalizedId: normalized.id,
    normalizedExternalId: normalized.external_id
  });
  return normalized;
}

/**
 * Parse boolean values more flexibly
 */
function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  const stringValue = String(value).toLowerCase().trim();
  
  const trueValues = ['yes', 'true', '1', 'y', 't', 'on', 'enabled', 'active'];
  const falseValues = ['no', 'false', '0', 'n', 'f', 'off', 'disabled', 'inactive'];
  
  if (trueValues.includes(stringValue)) return true;
  if (falseValues.includes(stringValue)) return false;
  
  return false; // Default to false for unrecognized values
}

/**
 * Clean and convert numeric values (remove units, handle invalid data)
 */
function cleanNumericValue(value) {
  if (!value || value === '' || value === 'NULL' || value === null) {
    return null;
  }
  
  // Convert to string and clean common units and formatting
  const cleaned = String(value)
    .replace(/[ul|μl|ml|ML|UL|units?|mg|g|kg]/gi, '') // Remove common units
    .replace(/[^\d.-]/g, '') // Remove non-numeric characters except decimal and minus
    .trim();
  
  if (cleaned === '' || isNaN(cleaned)) {
    return null;
  }
  
  return parseFloat(cleaned);
}

/**
 * Convert Excel date format to proper date
 */
function convertExcelDate(dateValue) {
  if (!dateValue) return null;
  
  // Handle invalid/placeholder dates commonly found in lab exports
  const stringValue = String(dateValue).trim();
  if (stringValue === '0000-00-00' || stringValue === '00/00/00' || stringValue === '' || stringValue === '0') {
    return null;
  }
  
  // Handle old epoch dates (12/31/69 = invalid placeholder)
  if (stringValue === '12/31/69' || stringValue === '1969-12-31') {
    return null;
  }
  
  // Handle Excel date format or date strings
  if (!isNaN(dateValue) && dateValue > 25569) {
    // Excel date: days since 1900-01-01
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + (dateValue * 24 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0];
  } else if (!isNaN(Date.parse(dateValue))) {
    let parsedDate = new Date(dateValue);
    
    // Handle 2-digit year problem: if year > 2030, assume it's 20th century
    if (parsedDate.getFullYear() > 2030) {
      const year = parsedDate.getFullYear() - 100; // Convert 2048 -> 1948
      parsedDate = new Date(year, parsedDate.getMonth(), parsedDate.getDate());
    }
    
    // Check if date is reasonable (after 1900, before 2030)
    if (parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2030) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  return null;
}

/**
 * Validation function to check if data was actually imported
 * Excludes Unknown placeholder entities (number = 0) to get true import counts
 */
async function validateImportSuccess(client) {
  try {
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM collaborators WHERE collaborator_number != 0) as collaborators,
        (SELECT COUNT(*) FROM projects WHERE project_number != 0) as projects,
        (SELECT COUNT(*) FROM specimens) as specimens,
        (SELECT COUNT(*) FROM patients) as patients
    `);
    
    const result = counts.rows[0];
    console.log('🔥 NEW VALIDATION FUNCTION - Post-import validation counts (excluding Unknown entities):', result);
    return {
      collaborators: parseInt(result.collaborators),
      projects: parseInt(result.projects),
      specimens: parseInt(result.specimens),
      patients: parseInt(result.patients)
    };
  } catch (error) {
    console.error('Error validating import success:', error);
    return { collaborators: 0, projects: 0, specimens: 0, patients: 0 };
  }
}

/**
 * Simple helper functions for handling missing references
 */

// Simple lookup for Unknown Collaborator (assumes it exists as #0)
async function getUnknownCollaboratorId(client) {
  try {
    const result = await client.query('SELECT id FROM collaborators WHERE collaborator_number = 0');
    return result.rows[0]?.id || null;
  } catch (error) {
    console.log('⚠️ Unknown Collaborator #0 not found, will use NULL');
    return null;
  }
}

// Simple lookup for Unknown Project (assumes it exists as #0)
async function getUnknownProjectId(client) {
  try {
    const result = await client.query('SELECT id FROM projects WHERE project_number = 0');
    return result.rows[0]?.id || null;
  } catch (error) {
    console.log('⚠️ Unknown Project #0 not found, will use NULL');
    return null;
  }
}

// Simple lookup for Unknown Patient (assumes it exists as #0)
async function getUnknownPatientId(client) {
  try {
    const result = await client.query('SELECT id FROM patients WHERE patient_number = 0');
    return result.rows[0]?.id || null;
  } catch (error) {
    console.log('⚠️ Unknown Patient #0 not found, will use NULL');
    return null;
  }
}

/**
 * Analyze error patterns to provide specific diagnostics
 */
function analyzeImportErrors(errors) {
  if (!errors || errors.length === 0) {
    return { summary: 'No specific errors recorded - likely silent database failures' };
  }

  const analysis = {
    totalErrors: errors.length,
    errorTypes: {},
    commonPatterns: [],
    samples: errors.slice(0, 3) // Show first 3 errors as examples
  };

  // Categorize error types
  errors.forEach(error => {
    const message = error.message || '';
    
    if (message.includes('constraint')) {
      analysis.errorTypes.constraints = (analysis.errorTypes.constraints || 0) + 1;
      analysis.commonPatterns.push('Database constraint violations');
    } else if (message.includes('column') && message.includes('does not exist')) {
      analysis.errorTypes.missingColumns = (analysis.errorTypes.missingColumns || 0) + 1;
      analysis.commonPatterns.push('Missing database columns');
    } else if (message.includes('foreign key')) {
      analysis.errorTypes.foreignKeys = (analysis.errorTypes.foreignKeys || 0) + 1;
      analysis.commonPatterns.push('Foreign key reference errors');
    } else if (message.includes('duplicate')) {
      analysis.errorTypes.duplicates = (analysis.errorTypes.duplicates || 0) + 1;
      analysis.commonPatterns.push('Duplicate record conflicts');
    } else {
      analysis.errorTypes.other = (analysis.errorTypes.other || 0) + 1;
    }
  });

  // Remove duplicate patterns
  analysis.commonPatterns = [...new Set(analysis.commonPatterns)];

  return analysis;
}

/**
 * Identify common causes based on import results and database state
 */
function getCommonFailureCauses(results, actualCounts) {
  const causes = [];

  // Check if database is completely empty
  const totalRecords = Object.values(actualCounts).reduce((sum, count) => sum + count, 0);
  if (totalRecords === 0) {
    causes.push({
      cause: 'Empty database',
      description: 'Database contains no records at all',
      solution: 'Check if database schema was applied correctly'
    });
  }

  // Check if specific errors indicate schema issues
  const errors = results?.errors || [];
  const hasSchemaErrors = errors.some(error => 
    error.message && error.message.includes('column') && error.message.includes('does not exist')
  );

  if (hasSchemaErrors) {
    causes.push({
      cause: 'Schema mismatch',
      description: 'Database schema missing required columns',
      solution: 'Run: psql -d your_db -f db/schema.sql'
    });
  }

  // Check for constraint violations
  const hasConstraintErrors = errors.some(error =>
    error.message && error.message.includes('constraint')
  );

  if (hasConstraintErrors) {
    causes.push({
      cause: 'Data validation failures',
      description: 'Records failed database constraint checks',
      solution: 'Check CSV data format matches expected database constraints'
    });
  }

  // Default cause if no specific patterns found
  if (causes.length === 0) {
    causes.push({
      cause: 'Silent database failures',
      description: 'Database operations completed without throwing errors but no data was inserted',
      solution: 'Check server logs for detailed database error messages'
    });
  }

  return causes;
}

/**
 * Check for existing records by ID within transaction
 */
async function checkExistingRecords(client, table, records, idField = 'id') {
  if (records.length === 0) return { existing: [], new: [], conflicts: [] };
  
  const ids = records.map(r => r[idField]).filter(Boolean);
  if (ids.length === 0) return { existing: [], new: records, conflicts: [] };
  
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const query = `SELECT ${idField} FROM ${table} WHERE ${idField} IN (${placeholders})`;
  
  const result = await client.query(query, ids);
  const existingIds = result.rows.map(row => row[idField]);
  
  const existing = records.filter(r => existingIds.includes(r[idField]));
  const newRecords = records.filter(r => !existingIds.includes(r[idField]));
  
  return { 
    existing, 
    new: newRecords, 
    conflicts: existing // For multi-file import, existing records are conflicts
  };
}


// @route   POST api/import/multi-file/preview
// @desc    Preview multi-file import data
// @access  Private (admin/editor only)
router.post('/preview', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), multiUpload], async (req, res) => {
  try {
    console.log('DEBUG: Preview endpoint called');
    console.log('DEBUG: req.files:', req.files ? Object.keys(req.files) : 'No files');
    console.log('DEBUG: req.user:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    
    const files = req.files;
    const results = {
      summary: {},
      errors: [],
      warnings: [],
      sampleData: {}
    };
    
    // Process each file type
    for (const [fileType, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        
        try {
          console.log(`Processing ${fileType} file: ${file.originalname}, size: ${file.size} bytes`);
          const parseResult = parseCSVData(file.buffer, file.originalname);
          console.log(`Parsed ${parseResult.totalRows} rows from ${fileType}`);
          
          // Debug info removed - not useful for end users
          
          // Warn about filtered rows
          if (parseResult.filteredRows > 0) {
            const warningMessage = `${file.originalname}: ${parseResult.filteredRows} empty rows were filtered out (${parseResult.totalRows} valid rows from ${parseResult.originalRowCount} total)`;
            console.log(`WARNING: ${warningMessage}`);
            results.warnings.push(warningMessage);
          }
          
          // Validate data based on file type
          let validationErrors = [];
          let processedData = [];
          
          if (fileType === 'collaborators') {
            processedData = parseResult.data.map(normalizeCollaborator);
            parseResult.data.forEach(collab => {
              const errors = validateCollaborator(collab, collab._rowNumber, file.originalname);
              validationErrors.push(...errors);
            });
            
            // Note: Existing record checks will be done during import execution within transaction
            results.summary.collaborators = {
              total: processedData.length,
              new: processedData.length, // Estimated, will be exact during import
              existing: 0,
              conflicts: 0
            };
            
          } else if (fileType === 'projects') {
            processedData = parseResult.data.map(normalizeProject);
            parseResult.data.forEach(project => {
              const errors = validateProject(project, project._rowNumber, file.originalname);
              validationErrors.push(...errors);
            });
            
            // Note: Existing record checks will be done during import execution within transaction
            results.summary.projects = {
              total: processedData.length,
              new: processedData.length, // Estimated, will be exact during import
              existing: 0,
              conflicts: 0
            };
            
          } else if (fileType === 'specimens') {
            logger.info('Starting specimen validation', { specimenCount: parseResult.data.length });
            
            processedData = parseResult.data.map(normalizeSpecimen);
            let specimenValidationErrors = 0;
            
            parseResult.data.forEach(specimen => {
              const errors = validateSpecimen(specimen, specimen._rowNumber, file.originalname);
              if (errors.length > 0) {
                specimenValidationErrors += errors.length;
              }
              validationErrors.push(...errors);
            });
            
            logger.info('Specimen validation completed', { errorCount: specimenValidationErrors });
            // Debug info removed from UI warnings
            
            // Note: Existing record checks will be done during import execution within transaction
            const existingCount = 0; // Will be checked during actual import
            
            results.summary.specimens = {
              total: processedData.length,
              new: processedData.length - existingCount,
              existing: existingCount,
              conflicts: existingCount
            };
            
            // Debug summary removed from UI warnings
            
            // Conflict warnings will be provided during actual import
          } else if (fileType === 'patients') {
            processedData = parseResult.data.map(normalizePatient);
            parseResult.data.forEach(patient => {
              const errors = validatePatient(patient, patient._rowNumber, file.originalname);
              validationErrors.push(...errors);
            });
            
            // Note: Existing record checks will be done during import execution within transaction
            results.summary.patients = {
              total: processedData.length,
              new: processedData.length, // Estimated, will be exact during import
              existing: 0,
              conflicts: 0
            };
          }
          
          results.errors.push(...validationErrors);
          results.sampleData[fileType] = parseResult.data.slice(0, 5); // Show 5 sample records
          
          // Add processed data directly to results for frontend compatibility
          results[fileType] = processedData;
          
        } catch (error) {
          results.errors.push({
            file: file.originalname,
            row: 'N/A',
            field: 'File',
            message: error.message
          });
        }
      }
    }
    
    // Note: We no longer warn about missing collaborator references since they are automatically 
    // assigned to "Unknown" collaborator during import execution
    
    res.json(results);
    
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('Multi-file preview failed:', {
      error: error.message,
      stack: error.stack,
      files: Object.keys(req.files || {}),
      userId: req.user?.id
    });
    res.status(500).json({ 
      msg: 'Failed to preview multi-file import',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST api/import/multi-file/execute
// @desc    Execute multi-file import with preserved IDs
// @access  Private (admin/editor only)
router.post('/execute', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), multiUpload], async (req, res) => {
  console.log('🚀 EXECUTE ENDPOINT CALLED - Multi-file import execution started - WITH UUID MAPPING FIX!!!');
  console.log('User:', req.user?.username, 'Files:', Object.keys(req.files || {}));
  
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const files = req.files;
    const results = {
      summary: { totalFiles: 0, totalRecords: 0 },
      results: {},
      errors: [],
      sequenceUpdates: {}
    };
    
    // Get Unknown entity IDs (simple lookups, don't fail if missing)
    console.log('🔧 Looking up Unknown entities...');
    const unknownCollaboratorId = await getUnknownCollaboratorId(client);
    const unknownProjectId = await getUnknownProjectId(client);
    const unknownPatientId = await getUnknownPatientId(client);
    console.log('✅ Unknown entity lookups complete');
    
    // Import order: collaborators -> projects -> specimens -> patients
    const importOrder = ['collaborators', 'projects', 'specimens', 'patients'];
    
    for (const fileType of importOrder) {
      if (files[fileType] && files[fileType].length > 0) {
        const file = files[fileType][0];
        results.summary.totalFiles++;
        
        try {
          const parseResult = parseCSVData(file.buffer, file.originalname);
          results.summary.totalRecords += parseResult.totalRows;
          
          // Log filtered rows during execution too
          if (parseResult.filteredRows > 0) {
            console.log(`INFO: ${file.originalname} - ${parseResult.filteredRows} empty rows filtered out during import`);
          }
          
          let imported = 0;
          let skipped = 0;
          
          if (fileType === 'collaborators') {
            console.log(`🏗️ Starting collaborator processing - ${parseResult.data.length} collaborators to process`);
            
            // Initialize lookup map for collaborator number -> UUID
            results.collaboratorMap = results.collaboratorMap || {};
            
            // Process collaborators
            for (const collabRaw of parseResult.data) {
              const collab = normalizeCollaborator(collabRaw);
              console.log(`Processing collaborator ID: ${collab.id}, PI: ${collab.pi_name}`);
              
              // Check if this collaborator has both PI Name and PI Institute missing
              const hasName = collabRaw.PI_Name || collabRaw.pi_name || collabRaw['PI Name'];
              const hasInstitute = collabRaw.PI_Institute || collabRaw.pi_institute || collabRaw['PI Institute'];
              
              // For migration imports, import everything - use "Unknown" for missing required fields
              if (!hasName && !hasInstitute) {
                console.log(`📝 Collaborator ${collab.id} missing PI Name and Institute - using Unknown values for migration import`);
              }
              
              // Check if collaborator already exists by number
              const existing = await client.query(
                `SELECT id FROM collaborators WHERE collaborator_number = $1`,
                [parseInt(collab.id)]
              );
              
              if (existing.rows.length > 0) {
                // Store UUID mapping for existing collaborator
                results.collaboratorMap[parseInt(collab.id)] = existing.rows[0].id;
                console.log(`✅ Found existing collaborator ${collab.id}, mapped to UUID ${existing.rows[0].id}`);
                skipped++;
                continue;
              }
              
              // Insert collaborator with number
              const insertQuery = `
                INSERT INTO collaborators (
                  collaborator_number, irb_id, pi_name, pi_institute, pi_email, 
                  pi_phone, pi_fax, internal_contact, comments, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING id
              `;
              
              try {
                console.log(`💾 Inserting collaborator ${collab.id}: ${collab.pi_name} at ${collab.pi_institute}`);
                const insertResult = await client.query(insertQuery, [
                  parseInt(collab.id),
                  collab.irb_id,
                  collab.pi_name || 'Unknown PI',
                  collab.pi_institute || 'Unknown Institution',
                  collab.pi_email,
                  collab.pi_phone,
                  collab.pi_fax,
                  collab.internal_contact,
                  collab.comments
                ]);
                console.log(`✅ Successfully inserted collaborator ${collab.id}, UUID: ${insertResult.rows[0].id}`);
                
                // Store UUID mapping for newly created collaborator
                results.collaboratorMap[parseInt(collab.id)] = insertResult.rows[0].id;
                
                imported++;
              } catch (insertError) {
                console.log(`❌ Failed to insert collaborator ${collab.id}:`, insertError.message);
                results.errors.push({
                  file: file.originalname,
                  row: collabRaw._rowNumber || 'unknown',
                  message: `Failed to insert collaborator ${collab.id}: ${insertError.message}`
                });
                skipped++; // Count database insertion failures as skipped
              }
            }
            
            console.log(`✅ Completed collaborator processing: ${imported} imported, ${skipped} skipped`);
            
            // Update sequence after migration import
            console.log('🔄 Updating collaborator sequence...');
            await updateSequence(client, 'collaborator_number_seq', 'collaborators', 'collaborator_number');
            console.log('✅ Collaborator sequence updated');
            results.sequenceUpdates.collaborators = 'Updated to max(collaborator_number) + 1';
            
          } else if (fileType === 'projects') {
            console.log(`🏗️ Starting projects processing - ${parseResult.data.length} projects to process`);
            
            // Initialize lookup map for project number -> UUID
            results.projectMap = results.projectMap || {};
            
            // Process projects
            for (const projectRaw of parseResult.data) {
              const project = normalizeProject(projectRaw);
              console.log(`Processing project ID: ${project.id}, disease: ${project.disease}`);
              
              // Check if project already exists by number
              const existing = await client.query(
                `SELECT id FROM projects WHERE project_number = $1`,
                [parseInt(project.id)]
              );
              
              if (existing.rows.length > 0) {
                // Store UUID mapping for existing project
                results.projectMap[parseInt(project.id)] = existing.rows[0].id;
                console.log(`✅ Found existing project ${project.id}, mapped to UUID ${existing.rows[0].id}`);
                skipped++;
                continue;
              }
              
              let collaboratorDbId = unknownCollaboratorId; // Default to Unknown Collaborator or NULL
              
              // Try to find collaborator by number if one is specified
              if (project.collaborator_id && project.collaborator_id !== '' && project.collaborator_id !== 'NULL') {
                // First check the collaboratorMap for existing mappings
                const collaboratorNumber = parseInt(project.collaborator_id);
                if (results.collaboratorMap && results.collaboratorMap[collaboratorNumber]) {
                  collaboratorDbId = results.collaboratorMap[collaboratorNumber];
                  console.log(`✅ Project ${project.id} linked to collaborator ${project.collaborator_id} via mapping`);
                } else {
                  // Fallback to database query
                  const collabResult = await client.query(
                    `SELECT id FROM collaborators WHERE collaborator_number = $1`,
                    [collaboratorNumber]
                  );
                  
                  if (collabResult.rows.length > 0) {
                    collaboratorDbId = collabResult.rows[0].id;
                    console.log(`✅ Project ${project.id} linked to collaborator ${project.collaborator_id} via database query`);
                  } else {
                    console.log(`⚠️ Project ${project.id}: Collaborator ${project.collaborator_id} not found, using Unknown Collaborator`);
                  }
                }
              } else {
                console.log(`⚠️ Project ${project.id}: No collaborator specified, using Unknown Collaborator`);
              }
              
              // Insert project with number - use "Unknown" for missing required fields
              const insertQuery = `
                INSERT INTO projects (
                  project_number, collaborator_id, disease, specimen_type, source,
                  date_received, feedback_date, comments, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                RETURNING id
              `;
              
              try {
                console.log(`💾 Inserting project ${project.id}: ${project.disease || 'Unknown'}`);
                const insertResult = await client.query(insertQuery, [
                  parseInt(project.id),
                  collaboratorDbId, // NULL if collaborator not found
                  project.disease || 'Unknown',
                  project.specimen_type || 'Unknown',
                  project.source || 'Unknown',
                  convertExcelDate(project.date_received),
                  convertExcelDate(project.feedback_date),
                  project.comments
                ]);
                console.log(`✅ Successfully inserted project ${project.id}, UUID: ${insertResult.rows[0].id}`);
                
                // Store UUID mapping for newly created project
                results.projectMap[parseInt(project.id)] = insertResult.rows[0].id;
                
                imported++;
              } catch (insertError) {
                console.log(`❌ Failed to insert project ${project.id}:`, insertError.message);
                results.errors.push({
                  file: file.originalname,
                  row: projectRaw._rowNumber || 'unknown',
                  message: `Failed to insert project ${project.id}: ${insertError.message}`
                });
                skipped++; // Count database insertion failures as skipped
              }
            }
            
            // Update sequence after migration import
            await updateSequence(client, 'project_number_seq', 'projects', 'project_number');
            results.sequenceUpdates.projects = 'Updated to max(project_number) + 1';
            
          } else if (fileType === 'specimens') {
            console.log(`🏗️ Starting specimens processing - ${parseResult.data.length} specimens to process`);

            // Process specimens in batches to handle large datasets
            const BATCH_SIZE = 1000;
            const totalSpecimens = parseResult.data.length;
            console.log(`Starting specimen processing for ${totalSpecimens} specimens in batches of ${BATCH_SIZE}`);
            
            for (let batchStart = 0; batchStart < totalSpecimens; batchStart += BATCH_SIZE) {
              const batchEnd = Math.min(batchStart + BATCH_SIZE, totalSpecimens);
              const batch = parseResult.data.slice(batchStart, batchEnd);
              console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(totalSpecimens / BATCH_SIZE)}: specimens ${batchStart + 1}-${batchEnd}`);
              
              for (const specimenRaw of batch) {
              const specimen = normalizeSpecimen(specimenRaw);
              
              // For migration import: If tube_id is missing, generate one based on specimen number
              if (!specimen.tube_id || specimen.tube_id === '' || specimen.tube_id === 'NULL') {
                specimen.tube_id = `MIGRATED-${specimen.specimen_number || 'UNKNOWN'}`;
                console.log(`⚠️ Generated tube_id for specimen: ${specimen.tube_id}`);
              }
              
              console.log(`Processing specimen: tube_id=${specimen.tube_id}, project_id=${specimen.project_id}`);
              
              // Skip duplicate checking for migration import - we want to preserve legacy data as-is
              // (Including duplicate Tube_IDs that may exist in legacy systems)
              // const existingQuery = `SELECT id FROM specimens WHERE tube_id = $1`;
              // const existing = await client.query(existingQuery, [specimen.tube_id]);
              // 
              // if (existing.rows.length > 0) {
              //   skipped++;
              //   continue;
              // }
              
              // Use Unknown Project for specimens with missing project references
              let projectDbId = unknownProjectId; // Default to Unknown Project or NULL
              
              // Try to find project by number if one is specified
              if (specimen.project_id && specimen.project_id !== '' && specimen.project_id !== 'NULL') {
                const projectNumber = parseInt(specimen.project_id);
                if (isNaN(projectNumber)) {
                  console.log(`⚠️ Specimen ${specimen.tube_id}: Invalid project_id "${specimen.project_id}", assigning to Unknown Project`);
                  projectDbId = unknownProjectId;
                } else {
                  // First check the projectMap for existing mappings
                  if (results.projectMap && results.projectMap[projectNumber]) {
                    projectDbId = results.projectMap[projectNumber];
                    console.log(`✅ Specimen ${specimen.tube_id} linked to project ${specimen.project_id} via mapping`);
                  } else {
                    // Fallback to database query
                    const projectResult = await client.query(
                      `SELECT id FROM projects WHERE project_number = $1`,
                      [projectNumber]
                    );
                  
                    if (projectResult.rows.length > 0) {
                      projectDbId = projectResult.rows[0].id;
                      console.log(`✅ Specimen ${specimen.tube_id} linked to project ${specimen.project_id} via database query`);
                    } else {
                      console.log(`⚠️ Specimen ${specimen.tube_id}: Project ${specimen.project_id} not found, assigning to Unknown Project`);
                      projectDbId = unknownProjectId;
                    }
                  }
                }
              } else {
                console.log(`⚠️ Specimen ${specimen.tube_id}: No project specified, assigning to Unknown Project`);
                projectDbId = unknownProjectId;
              }
              
              // Use specimen number from CSV ID field for migration import - DON'T generate new ones
              let specimenNumber = null;
              
              if (specimen.specimen_number === null || specimen.specimen_number === undefined || specimen.specimen_number === '') {
                // No valid numeric ID found - skip this specimen in migration import
                console.log(`⏭️ Skipping specimen ${specimen.tube_id}: No valid ID in CSV for migration import`);
                skipped++;
                continue;
              } else {
                specimenNumber = parseInt(specimen.specimen_number);
                console.log(`✅ Specimen ${specimen.tube_id} - Using CSV ID: ${specimenNumber}`);
                
                if (isNaN(specimenNumber)) {
                  console.log(`⏭️ Skipping specimen ${specimen.tube_id}: Invalid ID "${specimen.specimen_number}" in CSV`);
                  results.errors.push({
                    file: file.originalname,
                    row: specimenRaw._rowNumber,
                    message: `Skipped specimen ${specimen.tube_id}: Invalid specimen ID "${specimen.specimen_number}" in CSV`
                  });
                  skipped++;
                  continue;
                }
              }
              
              // Find patient by external_id if one is specified
              let patientDbId = unknownPatientId; // Default to Unknown Patient or NULL
              
              if (specimen.patient && specimen.patient !== '' && specimen.patient !== 'NULL' && specimen.patient !== 'None') {
                // First check the patientMap for existing mappings
                if (results.patientMap && results.patientMap[specimen.patient]) {
                  patientDbId = results.patientMap[specimen.patient];
                  console.log(`✅ Specimen ${specimen.tube_id} linked to patient ${specimen.patient} via mapping`);
                } else {
                  // Fallback to database query
                  const patientResult = await client.query(
                    `SELECT id FROM patients WHERE external_id = $1`,
                    [specimen.patient]
                  );
                  
                  if (patientResult.rows.length > 0) {
                    patientDbId = patientResult.rows[0].id;
                    console.log(`✅ Specimen ${specimen.tube_id} linked to patient ${specimen.patient} via database query`);
                  } else {
                    console.log(`⚠️ Specimen ${specimen.tube_id}: Patient ${specimen.patient} not found, using Unknown Patient`);
                  }
                }
              } else {
                console.log(`⚠️ Specimen ${specimen.tube_id}: No patient specified, using Unknown Patient`);
              }
              
              // Insert specimen
              const insertQuery = `
                INSERT INTO specimens (
                  tube_id, project_id, patient_id, date_collected, activity_status, extracted, used_up,
                  initial_quantity, specimen_site, position_freezer, position_rack, position_box,
                  position_dimension_one, position_dimension_two, comments, specimen_number,
                  created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
              `;
              
              try {
                const insertResult = await client.query(insertQuery + ' RETURNING id', [
                  specimen.tube_id,
                  projectDbId,
                  patientDbId, // ← FIXED: Added missing patientDbId parameter
                  convertExcelDate(specimen.date_collected),
                  specimen.activity_status || 'Active',
                  parseBoolean(specimen.extracted),
                  parseBoolean(specimen.used_up),
                  cleanNumericValue(specimen.initial_quantity),
                  specimen.specimen_site,
                  specimen.position_freezer,
                  specimen.position_rack,
                  specimen.position_box,
                  specimen.position_dimension_one,
                  specimen.position_dimension_two,
                  specimen.comments,
                  specimenNumber
                ]);
                
                // Create legacy ID mapping for specimen
                const specimenUuid = insertResult.rows[0].id;
                
                console.log(`Successfully inserted specimen ${specimen.tube_id}`);
                imported++;
              } catch (insertError) {
                console.log(`ERROR inserting specimen ${specimen.tube_id}:`, insertError.message);
                results.errors.push({
                  file: file.originalname,
                  row: specimenRaw._rowNumber,
                  message: `Failed to insert specimen ${specimen.tube_id}: ${insertError.message}`
                });
                skipped++; // Count database insertion failures as skipped
              }
            }
            
            console.log(`Completed specimen processing: ${imported} imported, ${skipped} skipped`);
            
            // Update sequence after migration import
            await updateSequence(client, 'specimen_number_seq', 'specimens', 'specimen_number');
            results.sequenceUpdates.specimens = 'Updated to max(specimen_number) + 1';
            }
            
          } else if (fileType === 'patients') {
            // Process patients
            console.log(`Starting patient processing for ${parseResult.data.length} patients`);
            
            // Initialize lookup map for patient external_id -> UUID
            results.patientMap = results.patientMap || {};
            
            for (const patientRaw of parseResult.data) {
              const patient = normalizePatient(patientRaw);
              console.log(`Processing patient: external_id=${patient.external_id}`);
              
              // Check if patient already exists by external_id
              const existingQuery = `SELECT id FROM patients WHERE external_id = $1`;
              const existing = await client.query(existingQuery, [patient.external_id]);
              
              if (existing.rows.length > 0) {
                // Store UUID mapping for existing patient
                results.patientMap[patient.external_id] = existing.rows[0].id;
                console.log(`✅ Found existing patient ${patient.external_id}, mapped to UUID ${existing.rows[0].id}`);
                skipped++;
                continue;
              }
              
              // Insert patient with number
              const insertQuery = `
                INSERT INTO patients (
                  patient_number, external_id, first_name, last_name, date_of_birth,
                  diagnosis, comments, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING id
              `;
              
              try {
                const patientNumber = parseInt(patient.id || patient.external_id);
                logger.debug('Inserting patient record', {
                  patientNumber,
                  externalId: patient.external_id,
                  name: `${patient.first_name} ${patient.last_name}`
                });
                
                const insertResult = await client.query(insertQuery, [
                  patientNumber, // patient_number
                  patient.external_id,
                  patient.first_name,
                  patient.last_name,
                  patient.date_of_birth,
                  patient.diagnosis,
                  patient.comments
                ]);
                
                console.log(`Successfully inserted patient ${patient.external_id}`);
                
                // Store UUID mapping for newly created patient
                results.patientMap[patient.external_id] = insertResult.rows[0].id;
                
                imported++;
              } catch (insertError) {
                console.log(`ERROR inserting patient ${patient.external_id}:`, insertError.message);
                results.errors.push({
                  file: file.originalname,
                  row: patientRaw._rowNumber,
                  message: `Failed to insert patient ${patient.external_id}: ${insertError.message}`
                });
                skipped++; // Count database insertion failures as skipped
              }
            }
            
            // Update sequence after migration import
            await updateSequence(client, 'patient_number_seq', 'patients', 'patient_number');
            results.sequenceUpdates.patients = 'Updated to max(patient_number) + 1';
          }
          
          results.results[fileType] = { imported, skipped };
          
        } catch (error) {
          results.errors.push({
            file: file.originalname,
            row: 'N/A',
            message: `Failed to process ${fileType}: ${error.message}`
          });
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Perform post-import validation to ensure data was actually inserted
    console.log('🔍 Performing post-import validation...');
    const actualCounts = await validateImportSuccess(client);
    const totalActual = Object.values(actualCounts).reduce((sum, count) => sum + count, 0);
    const totalExpected = results?.summary?.totalRecords || 0;
    
    console.log(`📊 VALIDATION RESULTS:`);
    console.log(`   Expected records: ${totalExpected}`);
    console.log(`   Actual records: ${totalActual}`);
    console.log(`   Database counts: ${JSON.stringify(actualCounts)}`);
    console.log(`   Validation condition (totalActual === 0 && totalExpected > 0): ${totalActual === 0 && totalExpected > 0}`);
    
    if (totalActual === 0 && totalExpected > 0) {
      console.log('🚨 CRITICAL: Import completed but no data was inserted into database');
      console.log('This suggests database insertions are failing silently');
      
      // Analyze error patterns for better diagnostics
      const errorAnalysis = analyzeImportErrors(results?.errors || []);
      const commonCauses = getCommonFailureCauses(results, actualCounts);
      
      const errorResponse = {
        success: false,
        msg: 'Migration import failed - no data was imported',
        error: 'Import processed files but no records were inserted into the database',
        details: {
          stage: 'Post-import validation',
          filesProcessed: results?.summary?.totalFiles || 0,
          recordsExpected: totalExpected,
          recordsActual: totalActual,
          databaseCounts: actualCounts,
          errorAnalysis,
          commonCauses,
          specificErrors: results?.errors || [],
          troubleshooting: {
            checkSchema: 'Verify database schema has all required columns (id, *_number fields)',
            checkConstraints: 'Look for foreign key constraint violations in server logs',
            checkDataFormat: 'Ensure CSV data matches expected column names and formats',
            checkSequences: 'Verify auto-ID sequences are working properly'
          }
        }
      };
      
      console.log('Returning detailed error response to client:', JSON.stringify(errorResponse, null, 2));
      return res.status(500).json(errorResponse);
    }
    
    // Check for low success rate
    const successRate = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 100;
    if (successRate < 80 && totalExpected > 0) {
      console.log(`⚠️  WARNING: Low success rate: ${successRate.toFixed(1)}% (${totalActual}/${totalExpected})`);
    }
    
    res.json({
      success: true,
      message: 'Multi-file import completed successfully',
      ...results,
      validation: {
        expected: totalExpected,
        actual: totalActual,
        successRate: Math.round(successRate * 10) / 10
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Perform post-import validation to see if any data was actually inserted
    console.log('Performing post-import validation...');
    const actualCounts = await validateImportSuccess(client);
    const expected = Object.values(actualCounts).reduce((sum, count) => sum + count, 0);
    
    if (expected === 0) {
      console.log('🚨 CRITICAL: Import completed but no data was inserted into database');
      console.log('This suggests database insertions are failing silently');
      
      const errorResponse = {
        success: false,
        msg: 'Migration import failed - no data was imported',
        error: 'CRITICAL: Migration completed processing but no records were inserted into the database',
        details: {
          stage: 'Success validation',
          expected: results?.summary?.totalRecords || 0,
          actual: expected,
          actualCounts,
          suggestion: 'Database insertions failed silently. Check server logs for constraint violations or data format issues.',
          errors: results?.errors || []
        }
      };
      
      console.log('Returning error response to client:', JSON.stringify(errorResponse, null, 2));
      return res.status(500).json(errorResponse);
    }
    
    // Log error for server monitoring without exposing sensitive details
    console.error('Multi-file import failed:', {
      error: error.message,
      userId: req.user?.id,
      totalFiles: results?.summary?.totalFiles || 0,
      totalRecords: results?.summary?.totalRecords || 0
    });
    res.status(500).json({ 
      msg: 'Failed to execute multi-file import',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;