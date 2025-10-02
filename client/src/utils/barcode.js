import JsBarcode from 'jsbarcode';

// Supported barcode formats for different use cases
export const BARCODE_FORMATS = {
  CODE128: 'CODE128',
  EAN13: 'EAN13',
  EAN8: 'EAN8', 
  UPC: 'UPC',
  CODE39: 'CODE39',
  CODABAR: 'codabar'
};

// Use cases for different barcode types
export const BARCODE_USE_CASES = {
  SPECIMEN: 'specimen',      // Internal lab specimens
  INVENTORY: 'inventory',    // Lab inventory items
  COMMERCIAL: 'commercial'   // Commercial products
};

/**
 * Generate a barcode for various use cases
 * @param {string} value - The value to encode
 * @param {HTMLCanvasElement} canvas - Canvas element to render the barcode
 * @param {Object} options - Barcode options
 */
export const generateBarcode = (value, canvas, options = {}) => {
  const defaultOptions = {
    format: 'CODE128',
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 14,
    margin: 10,
    background: '#ffffff',
    lineColor: '#000000',
    ...options
  };

  try {
    JsBarcode(canvas, value, defaultOptions);
    return true;
  } catch (error) {
    console.error('Error generating barcode:', error);
    return false;
  }
};

/**
 * Generate a barcode as a data URL for use in labels or exports
 * @param {string} specimenId - The specimen ID to encode
 * @param {Object} options - Barcode options
 * @returns {string} Data URL of the barcode image
 */
export const generateBarcodeDataURL = (specimenId, options = {}) => {
  const canvas = document.createElement('canvas');
  const success = generateBarcode(specimenId, canvas, options);
  
  if (success) {
    return canvas.toDataURL('image/png');
  }
  return null;
};

/**
 * Validate if a string can be encoded as Code 128
 * @param {string} text - Text to validate
 * @returns {boolean} True if valid for Code 128
 */
export const isValidBarcodeText = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  // Code 128 can encode ASCII characters 0-127
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode < 0 || charCode > 127) {
      return false;
    }
  }
  
  return text.length > 0;
};

/**
 * Detect the likely format of a barcode based on its content
 * @param {string} barcode - The barcode string
 * @returns {string} Most likely barcode format
 */
export const detectBarcodeFormat = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return BARCODE_FORMATS.CODE128;
  
  const cleanBarcode = barcode.trim();
  
  // UPC-A: 12 digits
  if (/^\d{12}$/.test(cleanBarcode)) {
    return BARCODE_FORMATS.UPC;
  }
  
  // EAN-13: 13 digits
  if (/^\d{13}$/.test(cleanBarcode)) {
    return BARCODE_FORMATS.EAN13;
  }
  
  // EAN-8: 8 digits
  if (/^\d{8}$/.test(cleanBarcode)) {
    return BARCODE_FORMATS.EAN8;
  }
  
  // Default to CODE128 for everything else
  return BARCODE_FORMATS.CODE128;
};

/**
 * Validate a barcode against its detected or specified format
 * @param {string} barcode - The barcode string
 * @param {string} format - Optional format to validate against
 * @returns {Object} Validation result with isValid, format, and errors
 */
export const validateBarcode = (barcode, format = null) => {
  if (!barcode || typeof barcode !== 'string') {
    return { isValid: false, format: null, errors: ['Barcode is required'] };
  }
  
  const cleanBarcode = barcode.trim();
  const detectedFormat = format || detectBarcodeFormat(cleanBarcode);
  const errors = [];
  
  switch (detectedFormat) {
    case BARCODE_FORMATS.UPC:
      if (!/^\d{12}$/.test(cleanBarcode)) {
        errors.push('UPC codes must be exactly 12 digits');
      }
      break;
      
    case BARCODE_FORMATS.EAN13:
      if (!/^\d{13}$/.test(cleanBarcode)) {
        errors.push('EAN-13 codes must be exactly 13 digits');
      }
      break;
      
    case BARCODE_FORMATS.EAN8:
      if (!/^\d{8}$/.test(cleanBarcode)) {
        errors.push('EAN-8 codes must be exactly 8 digits');
      }
      break;
      
    case BARCODE_FORMATS.CODE128:
      if (!isValidBarcodeText(cleanBarcode)) {
        errors.push('Code 128 barcodes must contain valid ASCII characters');
      }
      break;
      
    default:
      errors.push('Unsupported barcode format');
  }
  
  return {
    isValid: errors.length === 0,
    format: detectedFormat,
    errors,
    cleanValue: cleanBarcode
  };
};

/**
 * Check if a barcode appears to be a commercial product barcode
 * @param {string} barcode - The barcode string
 * @returns {boolean} True if it looks like a commercial barcode
 */
export const isCommercialBarcode = (barcode) => {
  if (!barcode) return false;
  
  const format = detectBarcodeFormat(barcode);
  return [BARCODE_FORMATS.UPC, BARCODE_FORMATS.EAN13, BARCODE_FORMATS.EAN8].includes(format);
};

/**
 * Format specimen ID for barcode scanning consistency
 * @param {string} specimenId - Raw specimen ID
 * @returns {string} Formatted specimen ID
 */
export const formatSpecimenIdForBarcode = (specimenId) => {
  if (!specimenId) return '';
  
  // Remove any whitespace and convert to uppercase for consistency
  return specimenId.toString().trim().toUpperCase();
};

/**
 * Generate printable label data for specimen
 * @param {Object} specimen - Specimen object with id, tube_id, etc.
 * @returns {Object} Label data with barcode and text information
 */
export const generateLabelData = (specimen) => {
  const barcodeText = formatSpecimenIdForBarcode(specimen.tube_id || specimen.id);
  const barcodeDataURL = generateBarcodeDataURL(barcodeText, {
    width: 1.5,
    height: 80,
    fontSize: 12,
    margin: 5
  });

  return {
    barcodeText,
    barcodeDataUrl: barcodeDataURL,
    displayText: specimen.tube_id || specimen.id,
    specimenInfo: {
      id: specimen.id,
      tubeId: specimen.tube_id,
      dateCollected: specimen.date_collected,
      disease: specimen.disease,
      specimenType: specimen.specimen_type,
      piName: specimen.pi_name
    }
  };
};

/**
 * Generate lab-created inventory barcode for items without commercial barcodes
 * @param {Object} inventoryItem - Inventory item with inventory_id, etc.
 * @returns {string} Formatted barcode text for lab-created items
 */
export const generateLabBarcode = (inventoryItem) => {
  if (!inventoryItem) return '';
  
  // Use inventory_id as the primary identifier, fall back to UUID
  const identifier = inventoryItem.inventory_id || inventoryItem.id;
  return `LAB${identifier.toString().padStart(3, '0')}`;
};

/**
 * Generate printable label data for inventory item
 * @param {Object} inventoryItem - Inventory item object
 * @returns {Object} Label data with barcode and text information
 */
export const generateInventoryLabelData = (inventoryItem) => {
  // Use commercial barcode if available, otherwise generate lab barcode
  const barcodeText = inventoryItem.barcode || generateLabBarcode(inventoryItem);
  const barcodeDataURL = generateBarcodeDataURL(barcodeText, {
    width: 1.5,
    height: 80,
    fontSize: 12,
    margin: 5
  });

  return {
    barcodeText,
    barcodeDataUrl: barcodeDataURL,
    displayText: barcodeText,
    inventoryInfo: {
      id: inventoryItem.id,
      inventoryId: inventoryItem.inventory_id,
      name: inventoryItem.name,
      catalogNumber: inventoryItem.catalog_number,
      supplier: inventoryItem.supplier,
      lotNumber: inventoryItem.lot_number
    }
  };
};

/**
 * Parse and structure commercial barcode data
 * @param {string} barcode - The commercial barcode string
 * @param {Object} productInfo - Optional product information from lookup
 * @returns {Object} Structured commercial barcode data
 */
export const parseCommercialBarcode = (barcode, productInfo = {}) => {
  const validation = validateBarcode(barcode);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      errors: validation.errors,
      barcode: barcode
    };
  }

  return {
    isValid: true,
    barcode: validation.cleanValue,
    format: validation.format,
    isCommercial: isCommercialBarcode(validation.cleanValue),
    productInfo: {
      name: productInfo.name || '',
      manufacturer: productInfo.manufacturer || productInfo.supplier || '',
      catalogNumber: productInfo.catalogNumber || productInfo.catalog_number || '',
      description: productInfo.description || '',
      ...productInfo
    },
    scannedAt: new Date().toISOString()
  };
};