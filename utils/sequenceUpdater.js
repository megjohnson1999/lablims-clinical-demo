const db = require('../db');
const logger = require('./logger');

/**
 * Update auto-ID sequence to continue from max existing ID
 * @param {Object|null} client - Database client (for transactions) or null to use default db
 * @param {string} sequenceName - Name of the PostgreSQL sequence
 * @param {string} tableName - Name of the table
 * @param {string} idField - Name of the ID field to check for max value
 * @returns {number|null} - Next auto-generated ID value, or null if error
 */
async function updateSequence(client, sequenceName, tableName, idField) {
  try {
    const dbClient = client || db;
    
    // Get the maximum existing ID
    const maxQuery = `SELECT COALESCE(MAX(${idField}), 0) as max_id FROM ${tableName}`;
    const result = await dbClient.query(maxQuery);
    const maxId = result.rows[0].max_id;
    
    if (maxId > 0) {
      // Update sequence to continue from max + 1
      const setvalQuery = `SELECT setval('${sequenceName}', $1)`;
      await dbClient.query(setvalQuery, [maxId]);
      
      logger.info('Sequence updated', { sequenceName, maxId, nextValue: maxId + 1 });
      return maxId + 1; // Next value will be max + 1
    }
    
    // If no records exist, start from 1
    logger.info('No records found, sequence starting from 1', { tableName, sequenceName });
    return 1;
    
  } catch (error) {
    logger.error('Error updating sequence', { sequenceName, tableName, error: error.message, stack: error.stack });
    return null;
  }
}

/**
 * Update all auto-ID sequences after multi-file import
 * @param {Object} client - Database client (for transaction)
 * @returns {Object} - Map of table names to next ID values
 */
async function updateAllSequences(client = null) {
  const dbClient = client || db;
  const results = {};
  
  // Mapping of tables to their sequence names and ID fields
  const sequences = [
    {
      table: 'collaborators',
      sequence: 'collaborator_id_seq',
      idField: 'collaborator_number'
    },
    {
      table: 'projects', 
      sequence: 'project_id_seq',
      idField: 'project_id'
    },
    {
      table: 'specimens',
      sequence: 'specimen_id_seq', 
      idField: 'specimen_number'
    },
    {
      table: 'patients',
      sequence: 'patient_id_seq',
      idField: 'patient_number'
    }
  ];
  
  for (const { table, sequence, idField } of sequences) {
    try {
      // Get the maximum existing ID
      const maxQuery = `SELECT COALESCE(MAX(${idField}), 0) as max_id FROM ${table}`;
      const result = await dbClient.query(maxQuery);
      const maxId = result.rows[0].max_id;
      
      if (maxId > 0) {
        // Update sequence to continue from max + 1
        const setvalQuery = `SELECT setval('${sequence}', $1)`;
        await dbClient.query(setvalQuery, [maxId]);
        results[table] = maxId + 1;
        logger.info('Sequence updated for table', { table, maxId, nextValue: maxId + 1 });
      } else {
        results[table] = 1;
        logger.info('No records found, sequence starting from 1', { table });
      }
      
    } catch (error) {
      logger.error('Error updating table sequence', { table, error: error.message, stack: error.stack });
      results[table] = null;
    }
  }
  
  return results;
}

/**
 * Get the next auto-generated ID for a table without updating the sequence
 * @param {string} tableName - Name of the table
 * @param {string} idField - Name of the ID field
 * @returns {number} - Next available ID
 */
async function getNextId(tableName, idField) {
  try {
    const maxQuery = `SELECT COALESCE(MAX(${idField}), 0) + 1 as next_id FROM ${tableName}`;
    const result = await db.query(maxQuery);
    return result.rows[0].next_id;
  } catch (error) {
    logger.error('Error getting next ID', { tableName, error: error.message, stack: error.stack });
    return 1;
  }
}

/**
 * Check if a sequence exists and create it if it doesn't
 * @param {string} sequenceName - Name of the sequence
 * @param {number} startValue - Starting value for the sequence
 * @returns {boolean} - Success status
 */
async function ensureSequenceExists(sequenceName, startValue = 1) {
  try {
    // Check if sequence exists
    const checkQuery = `
      SELECT 1 FROM pg_class 
      WHERE relname = $1 AND relkind = 'S'
    `;
    const exists = await db.query(checkQuery, [sequenceName]);
    
    if (exists.rows.length === 0) {
      // Create sequence if it doesn't exist
      const createQuery = `CREATE SEQUENCE ${sequenceName} START ${startValue}`;
      await db.query(createQuery);
      logger.info('Sequence created', { sequenceName, startValue });
    }
    
    return true;
  } catch (error) {
    logger.error('Error ensuring sequence exists', { sequenceName, error: error.message, stack: error.stack });
    return false;
  }
}

module.exports = {
  updateSequence,
  updateAllSequences,
  getNextId,
  ensureSequenceExists
};