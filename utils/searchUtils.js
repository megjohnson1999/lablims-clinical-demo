/**
 * Search utility functions for LIMS
 * Provides smart matching logic: exact matching for IDs, substring matching for text fields
 */

/**
 * Determines if a search term looks like an ID (numeric) vs text
 * @param {string} searchTerm - The search term to analyze
 * @returns {boolean} - True if term looks like an ID
 */
function isNumericId(searchTerm) {
  // Check if the term is purely numeric
  return /^\d+$/.test(searchTerm.trim());
}

/**
 * Gets the appropriate SQL condition and parameter for a field
 * @param {string} fieldName - Database column name
 * @param {string} searchTerm - Search term
 * @param {boolean} isIdField - Whether this is an ID field (uses exact matching)
 * @returns {object} - {condition, parameter}
 */
function getSearchCondition(fieldName, searchTerm, isIdField = false) {
  const trimmedTerm = searchTerm.trim();
  
  if (isIdField && isNumericId(trimmedTerm)) {
    // For ID fields with numeric search terms, use exact matching
    return {
      condition: `${fieldName} = `,
      parameter: parseInt(trimmedTerm)
    };
  } else if (isIdField) {
    // For ID fields with text search terms, use exact string matching
    return {
      condition: `${fieldName}::text ILIKE `,
      parameter: trimmedTerm
    };
  } else {
    // For text fields, use substring matching
    return {
      condition: `${fieldName} ILIKE `,
      parameter: `%${trimmedTerm}%`
    };
  }
}

/**
 * Builds a search WHERE clause with smart ID vs text field handling
 * @param {Array} fieldConfigs - Array of {field, isId} objects
 * @param {string} searchTerm - Search term
 * @param {number} paramIndex - Starting parameter index for SQL query
 * @returns {object} - {whereClause, parameters, nextParamIndex}
 */
function buildSearchClause(fieldConfigs, searchTerm, paramIndex = 1) {
  const conditions = [];
  const parameters = [];
  let currentParamIndex = paramIndex;
  const isNumeric = isNumericId(searchTerm);
  
  // Smart filtering: if search term is purely numeric, only search ID fields
  // This prevents "25" from matching disease names like "COVID-25 Study"
  let fieldsToSearch = isNumeric 
    ? fieldConfigs.filter(config => config.isId) 
    : fieldConfigs;
  
  if (fieldsToSearch.length === 0) {
    // Fallback: if no ID fields and searching for number, search all fields
    fieldsToSearch = fieldConfigs;
  }
  
  fieldsToSearch.forEach(config => {
    const { field, isId = false } = config;
    const searchCondition = getSearchCondition(field, searchTerm, isId);
    
    conditions.push(searchCondition.condition + '$' + currentParamIndex);
    parameters.push(searchCondition.parameter);
    currentParamIndex++;
  });
  
  const whereClause = conditions.length > 0 ? `(${conditions.join(' OR ')})` : '';
  
  return {
    whereClause,
    parameters,
    nextParamIndex: currentParamIndex
  };
}

/**
 * Parses a text input containing multiple identifiers (comma/newline separated)
 * @param {string} input - Text containing identifiers
 * @returns {string[]} - Array of cleaned, deduplicated identifiers
 */
function parseIdentifierList(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  // Split by comma, semicolon, or newline
  return input
    .split(/[,;\n\r]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .filter(id => id.length > 0);
}

/**
 * Validates an array of identifiers for bulk search
 * @param {string[]} identifiers - Array of identifiers to validate
 * @param {number} maxCount - Maximum allowed identifiers (default 1000)
 * @returns {object} - {valid: boolean, error?: string, cleanIdentifiers?: string[]}
 */
function validateIdentifierList(identifiers, maxCount = 1000) {
  if (!Array.isArray(identifiers)) {
    return { valid: false, error: 'Identifiers must be an array' };
  }
  
  if (identifiers.length === 0) {
    return { valid: false, error: 'At least one identifier is required' };
  }
  
  if (identifiers.length > maxCount) {
    return { valid: false, error: `Maximum ${maxCount} identifiers allowed` };
  }
  
  // Clean and deduplicate
  const cleanIdentifiers = [...new Set(identifiers.map(id => String(id).trim()).filter(Boolean))];
  
  if (cleanIdentifiers.length === 0) {
    return { valid: false, error: 'No valid identifiers found after cleaning' };
  }
  
  return { valid: true, cleanIdentifiers };
}

/**
 * Builds bulk search WHERE clauses with proper array handling
 * @param {string[]} identifiers - Array of identifiers to search for
 * @param {object[]} fieldConfigs - Array of {field, isId, arrayType} objects
 * @param {number} paramIndex - Starting parameter index
 * @returns {object} - {whereClause, parameters, nextParamIndex}
 */
function buildBulkSearchClause(identifiers, fieldConfigs, paramIndex = 1) {
  const conditions = [];
  const parameters = [];
  let currentParamIndex = paramIndex;
  
  // Separate numeric and text identifiers for optimized queries
  const numericIds = identifiers.filter(id => /^\d+$/.test(id)).map(id => parseInt(id));
  const textIds = identifiers;
  
  fieldConfigs.forEach(config => {
    const { field, isId = false, arrayType = 'text[]' } = config;
    
    if (isId && numericIds.length > 0) {
      // For ID fields, try numeric array first
      conditions.push(`${field} = ANY($${currentParamIndex}::int[])`);
      parameters.push(numericIds);
      currentParamIndex++;
      
      // Also add text casting for mixed scenarios
      if (textIds.some(id => !/^\d+$/.test(id))) {
        conditions.push(`${field}::text = ANY($${currentParamIndex}::text[])`);
        parameters.push(textIds);
        currentParamIndex++;
      }
    } else {
      // For text fields, use text array
      conditions.push(`${field} = ANY($${currentParamIndex}::${arrayType})`);
      parameters.push(textIds);
      currentParamIndex++;
    }
  });
  
  const whereClause = conditions.length > 0 ? `(${conditions.join(' OR ')})` : '';
  
  return {
    whereClause,
    parameters,
    nextParamIndex: currentParamIndex
  };
}

module.exports = {
  isNumericId,
  getSearchCondition,
  buildSearchClause,
  parseIdentifierList,
  validateIdentifierList,
  buildBulkSearchClause
};