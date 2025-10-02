/**
 * Product Lookup Service
 * Handles commercial barcode lookups and product information retrieval
 */

const https = require('https');
const logger = require('../utils/logger');

/**
 * Mock product database for testing
 * In production, this would be replaced with API calls to commercial databases
 */
const MOCK_PRODUCTS = {
  // Example UPC codes for lab supplies (these are made up for demo)
  '123456789012': {
    name: 'PCR Reaction Tubes 0.2mL',
    manufacturer: 'ThermoFisher Scientific',
    catalogNumber: 'AB-1234',
    description: 'Ultra-thin wall PCR tubes for optimal heat transfer',
    category: 'labware',
    unitOfMeasure: 'pieces',
    packSize: 1000
  },
  '234567890123': {
    name: 'Taq DNA Polymerase 500U',
    manufacturer: 'New England Biolabs',
    catalogNumber: 'M0273S',
    description: 'Thermostable DNA polymerase for PCR',
    category: 'enzymes',
    unitOfMeasure: 'units',
    packSize: 500
  },
  '345678901234': {
    name: 'Agarose Gel Electrophoresis Grade',
    manufacturer: 'Invitrogen',
    catalogNumber: '16500500',
    description: 'High-resolution agarose for DNA separation',
    category: 'reagents',
    unitOfMeasure: 'g',
    packSize: 500
  },
  // Add more mock products as needed
};

/**
 * Look up product information by barcode
 * @param {string} barcode - The product barcode (UPC/EAN)
 * @returns {Promise<Object>} Product information or null if not found
 */
const lookupProductByBarcode = async (barcode) => {
  try {
    // First check our mock database
    if (MOCK_PRODUCTS[barcode]) {
      return {
        success: true,
        source: 'internal_db',
        product: MOCK_PRODUCTS[barcode]
      };
    }

    // In production, you would call external APIs here
    // Example implementations:
    
    // 1. Open Food Facts API (for general products)
    // const openFoodFactsResult = await lookupOpenFoodFacts(barcode);
    // if (openFoodFactsResult) return openFoodFactsResult;

    // 2. Supplier-specific APIs (if available)
    // const supplierResult = await lookupSupplierAPI(barcode);
    // if (supplierResult) return supplierResult;

    // 3. Generic barcode lookup services
    // const genericResult = await lookupGenericBarcode(barcode);
    // if (genericResult) return genericResult;

    return {
      success: false,
      source: 'none',
      product: null,
      message: 'Product not found in any database'
    };

  } catch (error) {
    logger.error('Error in product lookup', { error: error.message, stack: error.stack });
    return {
      success: false,
      source: 'error',
      product: null,
      error: error.message
    };
  }
};

/**
 * Example implementation for Open Food Facts API
 * (Currently commented out - would need to be implemented for production)
 */
/*
const lookupOpenFoodFacts = async (barcode) => {
  return new Promise((resolve, reject) => {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === 1 && result.product) {
            const product = result.product;
            resolve({
              success: true,
              source: 'openfoodfacts',
              product: {
                name: product.product_name || product.product_name_en,
                manufacturer: product.brands,
                description: product.generic_name || product.categories,
                category: 'food', // This would need to be mapped appropriately
                barcode: barcode
              }
            });
          } else {
            resolve(null);
          }
        } catch (parseError) {
          reject(parseError);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
};
*/

/**
 * Validate if a barcode format is supported for lookup
 * @param {string} barcode - The barcode to validate
 * @returns {boolean} True if the format is supported
 */
const isSupportedBarcodeFormat = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return false;
  
  const cleanBarcode = barcode.trim();
  
  // Support UPC-A (12 digits) and EAN-13 (13 digits)
  return /^\d{12}$/.test(cleanBarcode) || /^\d{13}$/.test(cleanBarcode);
};

/**
 * Add a new product to the internal database
 * @param {string} barcode - The product barcode
 * @param {Object} productInfo - Product information
 * @returns {boolean} Success status
 */
const addProductToDatabase = (barcode, productInfo) => {
  try {
    // In production, this would save to a real database
    MOCK_PRODUCTS[barcode] = {
      ...productInfo,
      addedAt: new Date().toISOString(),
      source: 'manual'
    };
    return true;
  } catch (error) {
    logger.error('Error adding product to database', { error: error.message, stack: error.stack });
    return false;
  }
};

/**
 * Get statistics about the product database
 * @returns {Object} Database statistics
 */
const getDatabaseStats = () => {
  return {
    totalProducts: Object.keys(MOCK_PRODUCTS).length,
    categories: [...new Set(Object.values(MOCK_PRODUCTS).map(p => p.category))],
    manufacturers: [...new Set(Object.values(MOCK_PRODUCTS).map(p => p.manufacturer))]
  };
};

module.exports = {
  lookupProductByBarcode,
  isSupportedBarcodeFormat,
  addProductToDatabase,
  getDatabaseStats
};