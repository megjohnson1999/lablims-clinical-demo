/**
 * Format a date string to a more readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string (e.g., "Jan 1, 2023")
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).format(date);
};

/**
 * Generate location string for a specimen
 * @param {Object} specimen - Specimen object
 * @returns {string} Formatted location string
 */
export const getLocationString = (specimen) => {
  if (!specimen) return '';
  
  const { position_freezer, position_rack, position_box, position_dimension_one, position_dimension_two } = specimen;
  
  const parts = [];
  if (position_freezer) parts.push(`Freezer: ${position_freezer}`);
  if (position_rack) parts.push(`Rack: ${position_rack}`);
  if (position_box) parts.push(`Box: ${position_box}`);
  
  let position = '';
  if (position_dimension_one && position_dimension_two) {
    position = `Position: ${position_dimension_one}${position_dimension_two}`;
  } else if (position_dimension_one) {
    position = `Position: ${position_dimension_one}`;
  } else if (position_dimension_two) {
    position = `Position: ${position_dimension_two}`;
  }
  
  if (position) parts.push(position);
  
  return parts.join(' • ');
};

/**
 * Clean form data by removing empty strings and converting them to null
 * @param {Object} data - Form data object
 * @returns {Object} Cleaned data object
 */
export const cleanFormData = (data) => {
  const cleaned = {};
  
  Object.keys(data).forEach(key => {
    // Convert empty strings to null
    cleaned[key] = data[key] === '' ? null : data[key];
    
    // Convert string 'true'/'false' to boolean for boolean fields
    if (data[key] === 'true') cleaned[key] = true;
    if (data[key] === 'false') cleaned[key] = false;
    
    // Convert numeric strings to numbers for number fields
    if (
      typeof data[key] === 'string' && 
      !isNaN(data[key]) && 
      // Fields that should be treated as numbers
      [
        'initial_quantity', 'cell_numbers', 'percentage_segs',
        'csf_protein', 'csf_gluc'
      ].includes(key)
    ) {
      cleaned[key] = Number(data[key]);
    }
  });
  
  return cleaned;
};

/**
 * Parse CSV or TSV data into an array of objects
 * @param {string} data - CSV/TSV string
 * @param {string} delimiter - Delimiter (comma or tab)
 * @returns {Array} Array of objects with header keys
 */
export const parseDelimitedData = (data, delimiter = ',') => {
  console.log('Parsing data with delimiter:', delimiter);
  
  // Handle different line ending types
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedData.split('\n').filter(line => line.trim());
  console.log(`Found ${lines.length} lines in the file`);
  
  // Get and normalize headers
  const headers = lines[0].split(delimiter).map(header => header.trim());
  console.log('Headers:', headers);
  
  const results = lines.slice(1).map((line, i) => {
    // Properly handle quoted values in CSV
    let values = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    // Add the last value
    values.push(currentValue);
    
    // Ensure values array length matches headers
    while (values.length < headers.length) {
      values.push('');
    }
    
    // Create object from headers and values
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].trim() : '';
    });
    
    return obj;
  });
  
  console.log(`Parsed ${results.length} rows of data`);
  if (results.length > 0) {
    console.log('First row sample:', results[0]);
  }
  
  return results;
};

/**
 * Get patient display name
 * @param {Object} patient - Patient object
 * @returns {string} Patient display name
 */
export const getPatientDisplayName = (patient) => {
  if (!patient) return '';
  
  if (patient.external_id) {
    if (patient.first_name || patient.last_name) {
      return `${patient.external_id} (${patient.first_name || ''} ${patient.last_name || ''})`;
    }
    return patient.external_id;
  }
  
  if (patient.first_name || patient.last_name) {
    return `${patient.first_name || ''} ${patient.last_name || ''}`;
  }
  
  return 'Unknown Patient';
};