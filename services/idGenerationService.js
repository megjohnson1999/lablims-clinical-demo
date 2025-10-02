const db = require('../db');
const logger = require('../utils/logger');

class IdGenerationService {
  /**
   * Get the next available ID for a given entity type
   * Uses database get_next_number function for consistency
   * @param {string} entityType - The type of entity ('collaborator', 'project', or 'specimen')
   * @param {string} username - Optional username for audit logging
   * @returns {Promise<{id: number, nextId: number}>}
   */
  async getNextId(entityType, username = null) {
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}. Must be one of: ${validTypes.join(', ')}`);
    }

    try {
      // Use the database function to get next ID (this increments the sequence)
      const query = 'SELECT get_next_number($1) as next_id';
      const result = await db.query(query, [entityType]);
      
      if (result.rows.length === 0) {
        throw new Error(`Failed to generate next ID for ${entityType}`);
      }
      
      const nextId = parseInt(result.rows[0].next_id);
      
      // Log the ID generation for audit purposes
      try {
        await db.query(
          'INSERT INTO id_generation_log (entity_type, generated_id, generated_by) VALUES ($1, $2, $3)',
          [entityType, nextId, username || 'system']
        );
      } catch (logError) {
        // Don't fail the ID generation if logging fails
        logger.warn('Failed to log ID generation', { entityType, error: logError.message });
      }
      
      return {
        id: nextId,
        nextId: nextId + 1  // For display purposes
      };
    } catch (error) {
      logger.error('Error generating ID', { entityType, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Peek at the next available ID without incrementing anything
   * Uses database peek_next_number function for consistency
   * @param {string} entityType - The type of entity ('collaborator', 'project', or 'specimen')
   * @returns {Promise<number>}
   */
  async peekNextId(entityType) {
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}. Must be one of: ${validTypes.join(', ')}`);
    }

    try {
      // Use the database function for consistency with backend
      const query = 'SELECT peek_next_number($1) as next_id';
      const result = await db.query(query, [entityType]);
      
      if (result.rows.length === 0) {
        throw new Error(`Failed to peek next ID for ${entityType}`);
      }
      
      return parseInt(result.rows[0].next_id);
    } catch (error) {
      logger.error('Error peeking next ID', { entityType, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get the generation history for a specific entity type
   * @param {string} entityType - The type of entity ('collaborator', 'project', or 'specimen')
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>}
   */
  async getGenerationHistory(entityType, limit = 100) {
    try {
      const query = `
        SELECT 
          entity_type,
          generated_id,
          generated_by,
          generated_at
        FROM id_generation_log
        WHERE entity_type = $1
        ORDER BY generated_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [entityType, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching generation history', { entityType, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Check if an ID is already in use for a given entity type
   * @param {string} entityType - The type of entity ('collaborator', 'project', or 'specimen')
   * @param {number} id - The ID to check
   * @returns {Promise<boolean>}
   */
  async isIdInUse(entityType, id) {
    try {
      let query;
      let column;
      
      switch (entityType) {
        case 'collaborator':
          query = 'SELECT COUNT(*) FROM collaborators WHERE collaborator_number = $1';
          break;
        case 'project':
          query = 'SELECT COUNT(*) FROM projects WHERE project_number = $1';
          break;
        case 'specimen':
          query = 'SELECT COUNT(*) FROM specimens WHERE specimen_number = $1';
          break;
        case 'inventory':
          query = 'SELECT COUNT(*) FROM inventory WHERE inventory_id = $1';
          break;
        case 'patient':
          query = 'SELECT COUNT(*) FROM patients WHERE patient_number = $1';
          break;
        default:
          throw new Error(`Invalid entity type: ${entityType}`);
      }
      
      const result = await db.query(query, [id]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Error checking if ID is in use', { entityType, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Reset a sequence to a specific value (admin function)
   * WARNING: This should only be used in exceptional circumstances
   * @param {string} entityType - The type of entity ('collaborator', 'project', or 'specimen')
   * @param {number} value - The value to reset the sequence to
   * @returns {Promise<void>}
   */
  async resetSequence(entityType, value) {
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}. Must be one of: ${validTypes.join(', ')}`);
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Value must be a positive integer');
    }

    try {
      const sequenceName = `${entityType}_id_seq`;
      const query = `SELECT setval($1, $2, false)`;
      await db.query(query, [sequenceName, value]);
      
      logger.info('Sequence reset completed', { sequenceName, value });
    } catch (error) {
      logger.error('Error resetting sequence', { entityType, error: error.message, stack: error.stack });
      throw error;
    }
  }
}

module.exports = new IdGenerationService();