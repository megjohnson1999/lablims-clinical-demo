/**
 * Unified Import Logic
 * Handles both migration imports (preserve CSV IDs) and project imports (generate new IDs)
 * Results in identical database structure regardless of import type
 */

const db = require('../db');

// ================================================================================
// MIGRATION IMPORT CSV MAPPINGS
// ================================================================================

const MIGRATION_MAPPINGS = {
  collaborators: {
    'ID': 'collaborator_number',           // CSV ID → collaborator_number  
    'IRB_ID': 'irb_id',
    'PI_Name': 'pi_name',
    'PI_Institute': 'pi_institute', 
    'PI_Email': 'pi_email',
    'PI_Phone': 'pi_phone',
    'PI_Fax': 'pi_fax',
    'Internal_Contact': 'internal_contact',
    'Comments': 'comments'
  },
  
  projects: {
    'ID': 'project_number',                // CSV ID → project_number
    'Collaborator': 'collaborator_reference',
    'Disease': 'disease',
    'Specimen_Type': 'specimen_type', 
    'Source': 'source',
    'Date_Received': 'date_received',
    'Feedback_Date': 'feedback_date',
    'Comments': 'comments',
    'Custom_Field_1': 'custom_field_1',
    'Specimen': 'specimen_reference',
    'Collaborator_Name': 'collaborator_name'
  },
  
  specimens: {
    'ID': 'specimen_number',               // CSV ID → specimen_number
    'Project': 'project_reference',
    'Patient': 'patient_reference',
    'Tube_ID': 'tube_id',
    'Extracted': 'extracted',
    'Initial_Quantity': 'initial_quantity',
    'Position_Freezer': 'position_freezer',
    'Position_Rack': 'position_rack', 
    'Position_Box': 'position_box',
    'Position_Dimension_One': 'position_dimension_one',
    'Position_Dimension_Two': 'position_dimension_two',
    'Activity_Status': 'activity_status',
    'Date_Collected': 'date_collected',
    'Collection_Category': 'collection_category',
    'Extraction_Method': 'extraction_method',
    'Analysis_Method': 'analysis_method',
    'Nucleated_Cells': 'nucleated_cells',
    'Cell_Numbers': 'cell_numbers',
    'Percentage_Segs': 'percentage_segs',
    'CSF_Protein': 'csf_protein',
    'CSF_Gluc': 'csf_gluc',
    'Used_Up': 'used_up',
    'Specimen_Site': 'specimen_site',
    'Run_Number': 'run_number',
    'Comments': 'comments'
  },
  
  patients: {
    'ID': 'patient_number',                // CSV ID → patient_number
    'External_ID': 'external_id',
    'First_Name': 'first_name',
    'Last_Name': 'last_name',
    'Date_of_Birth': 'date_of_birth',
    'Diagnosis': 'diagnosis',
    'Physician_First_Name': 'physician_first_name', 
    'Physician_Last_Name': 'physician_last_name',
    'Comments': 'comments',
    'Status': 'status'
  }
};

// ================================================================================
// CORE IMPORT FUNCTIONS
// ================================================================================

/**
 * Parse CSV data and map headers to database columns
 * @param {Array} csvData - Raw CSV data with headers
 * @param {String} entityType - collaborators, projects, specimens, or patients
 * @param {Boolean} isMigration - true for migration import, false for project import
 * @returns {Object} Parsed and mapped data
 */
function parseEntityData(csvData, entityType, isMigration = false) {
  if (!csvData || csvData.length === 0) {
    throw new Error(`No ${entityType} data provided`);
  }
  
  const headers = csvData[0];
  const rows = csvData.slice(1);
  const mapping = MIGRATION_MAPPINGS[entityType];
  
  if (!mapping) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  // Create header mapping
  const headerMap = {};
  const unmatchedHeaders = [];
  
  headers.forEach((header, index) => {
    if (mapping[header]) {
      headerMap[index] = mapping[header];
    } else {
      unmatchedHeaders.push(header);
    }
  });
  
  // Transform rows to objects
  const entities = rows.map((row, rowIndex) => {
    const entity = {
      _rowNumber: rowIndex + 2, // For error reporting
      _importType: isMigration ? 'migration' : 'project'
    };
    
    headers.forEach((header, colIndex) => {
      const dbColumn = headerMap[colIndex];
      const value = row[colIndex];
      
      if (dbColumn && value !== undefined && value !== '') {
        // Special handling for ID column
        if (dbColumn.endsWith('_number')) {
          if (isMigration) {
            // Migration: preserve original ID from CSV
            entity[dbColumn] = parseInt(value);
          } else {
            // Project: ignore CSV ID, will generate new one
            // Don't set the number column - will be generated
          }
        } else {
          entity[dbColumn] = value;
        }
      }
    });
    
    return entity;
  });
  
  return {
    entities,
    unmatchedHeaders,
    totalRows: rows.length,
    isMigration
  };
}

/**
 * Import entities with unified logic
 * @param {Array} entities - Parsed entity data
 * @param {String} entityType - Table name
 * @param {Object} options - Import options
 * @returns {Object} Import results
 */
async function importEntities(entities, entityType, options = {}) {
  const { 
    batchSize = 1000,
    onProgress = null,
    validateOnly = false 
  } = options;
  
  const results = {
    processed: 0,
    created: 0, 
    updated: 0,
    errors: [],
    isMigration: entities.length > 0 ? entities[0]._importType === 'migration' : false
  };
  
  // Process in batches
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const entity of batch) {
        try {
          const result = await processEntity(client, entity, entityType, validateOnly);
          
          if (result.action === 'created') results.created++;
          else if (result.action === 'updated') results.updated++;
          
          results.processed++;
          
        } catch (error) {
          results.errors.push({
            row: entity._rowNumber,
            entityId: entity[`${entityType.slice(0, -1)}_number`] || 'unknown',
            error: error.message
          });
        }
      }
      
      if (!validateOnly) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      
      // Report progress
      if (onProgress) {
        onProgress({
          processed: Math.min(i + batchSize, entities.length),
          total: entities.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length
        });
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  return results;
}

/**
 * Process single entity (create or update)
 * @param {Object} client - Database client
 * @param {Object} entity - Entity data
 * @param {String} entityType - Table name
 * @param {Boolean} validateOnly - Only validate, don't save
 * @returns {Object} Processing result
 */
async function processEntity(client, entity, entityType, validateOnly) {
  const tableName = entityType;
  const numberColumn = `${entityType.slice(0, -1)}_number`;
  const isMigration = entity._importType === 'migration';
  
  // For project imports, generate new number
  if (!isMigration && !entity[numberColumn]) {
    const nextNumber = await client.query('SELECT get_next_number($1) as number', [entityType.slice(0, -1)]);
    entity[numberColumn] = nextNumber.rows[0].number;
  }
  
  // Build the entity object for database insertion
  const dbEntity = { ...entity };
  delete dbEntity._rowNumber;
  delete dbEntity._importType;
  
  // Remove reference fields (handle separately in comprehensive import)
  Object.keys(dbEntity).forEach(key => {
    if (key.endsWith('_reference')) {
      delete dbEntity[key];
    }
  });
  
  if (validateOnly) {
    return { action: 'validated', entityNumber: entity[numberColumn] };
  }
  
  // Check if entity exists by number (for updates)
  let existingEntity = null;
  if (entity[numberColumn]) {
    const checkQuery = `SELECT id FROM ${tableName} WHERE ${numberColumn} = $1`;
    const checkResult = await client.query(checkQuery, [entity[numberColumn]]);
    existingEntity = checkResult.rows[0] || null;
  }
  
  if (existingEntity) {
    // Update existing entity
    const updateFields = Object.keys(dbEntity).filter(key => key !== 'id' && dbEntity[key] !== undefined);
    const updateValues = updateFields.map(field => dbEntity[field]);
    const updateSet = updateFields.map((field, idx) => `${field} = $${idx + 2}`).join(', ');
    
    const updateQuery = `
      UPDATE ${tableName} 
      SET ${updateSet}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING id, ${numberColumn}
    `;
    
    await client.query(updateQuery, [existingEntity.id, ...updateValues]);
    return { action: 'updated', entityNumber: entity[numberColumn] };
    
  } else {
    // Create new entity
    const insertFields = Object.keys(dbEntity).filter(field => dbEntity[field] !== undefined);
    const insertValues = insertFields.map(field => dbEntity[field]);
    const insertPlaceholders = insertFields.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const insertQuery = `
      INSERT INTO ${tableName} (${insertFields.join(', ')}, created_at, updated_at)
      VALUES (${insertPlaceholders}, NOW(), NOW())
      RETURNING id, ${numberColumn}
    `;
    
    const insertResult = await client.query(insertQuery, insertValues);
    return { action: 'created', entityNumber: insertResult.rows[0][numberColumn] };
  }
}

// ================================================================================
// VALIDATION FUNCTIONS
// ================================================================================

/**
 * Validate entity data before import
 * @param {Object} entity - Entity data
 * @param {String} entityType - Table name
 * @returns {Array} Validation errors
 */
function validateEntity(entity, entityType) {
  const errors = [];
  
  switch (entityType) {
    case 'collaborators':
      if (!entity.pi_name) errors.push('PI Name is required');
      if (!entity.pi_institute) errors.push('PI Institute is required');
      break;
      
    case 'projects':
      if (!entity.disease) errors.push('Disease is required');
      break;
      
    case 'specimens':
      if (!entity.tube_id) errors.push('Tube ID is required');
      break;
      
    case 'patients':
      // No required fields for patients currently
      break;
  }
  
  return errors;
}

/**
 * Check for duplicate numbers within import data
 * @param {Array} entities - Entity data
 * @param {String} numberColumn - Number column name
 * @returns {Array} Duplicate entities
 */
function findDuplicateNumbers(entities, numberColumn) {
  const seen = new Set();
  const duplicates = [];
  
  entities.forEach(entity => {
    if (entity[numberColumn]) {
      if (seen.has(entity[numberColumn])) {
        duplicates.push(entity);
      } else {
        seen.add(entity[numberColumn]);
      }
    }
  });
  
  return duplicates;
}

// ================================================================================
// REFERENCE RESOLUTION (for comprehensive imports)
// ================================================================================

/**
 * Resolve entity references by number
 * @param {Object} client - Database client
 * @param {String} entityType - Referenced entity type  
 * @param {Number} entityNumber - Referenced entity number
 * @returns {String|null} UUID of referenced entity
 */
async function resolveEntityReference(client, entityType, entityNumber) {
  if (!entityNumber) return null;
  
  const tableName = `${entityType}s`; // collaborator → collaborators
  const numberColumn = `${entityType}_number`;
  
  const query = `SELECT id FROM ${tableName} WHERE ${numberColumn} = $1`;
  const result = await client.query(query, [entityNumber]);
  
  return result.rows[0]?.id || null;
}

module.exports = {
  parseEntityData,
  importEntities, 
  processEntity,
  validateEntity,
  findDuplicateNumbers,
  resolveEntityReference,
  MIGRATION_MAPPINGS
};