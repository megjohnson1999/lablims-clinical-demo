const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const productLookupService = require('../services/productLookupService');
const idGenerationService = require('../services/idGenerationService');
const logger = require('../utils/logger');

console.log('🔍 STARTUP - inventory.js routes file loaded');

// @route   GET api/inventory
// @desc    Get all inventory items with filtering/pagination
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const category = req.query.category?.trim() || '';
    const lowStock = req.query.lowStock === 'true';
    const expiring = req.query.expiring?.trim() || '';

    // Build conditions for search and filters
    const conditions = [];
    let countParams = [];
    let dataParams = [];

    if (search) {
      conditions.push(`(
        i.name ILIKE ? OR
        i.description ILIKE ? OR
        i.catalog_number ILIKE ? OR
        i.supplier ILIKE ? OR
        i.lot_number ILIKE ?
      )`);
      const searchParam = `%${search}%`;
      countParams.push(searchParam);
      dataParams.push(searchParam);
    }

    if (category) {
      conditions.push(`i.category = ?`);
      countParams.push(category);
      dataParams.push(category);
    }

    if (lowStock) {
      conditions.push(`i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0`);
    }

    if (expiring) {
      const days = parseInt(expiring) || 30;
      conditions.push(`i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL ? day)`);
      countParams.push(days);
      dataParams.push(days);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Convert ? placeholders to PostgreSQL $1, $2, etc. for count query
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM inventory i
      ${whereClause}
    `;
    countQuery = countQuery.replace(/\?/g, () => `$${countParams.indexOf(countParams[countParams.length - countParams.filter((_, i) => countQuery.substring(0, countQuery.indexOf('?')).split('?').length - 1 <= i).length]) + 1}`);
    
    // Simpler approach - rebuild the query with proper parameter numbers
    let countQueryFinal = `SELECT COUNT(*) as total FROM inventory i`;
    let countParamsFinal = [];
    let paramIndex = 1;
    
    if (conditions.length > 0) {
      let conditionsFinal = [];
      
      if (search) {
        conditionsFinal.push(`(
          i.name ILIKE $${paramIndex} OR
          i.description ILIKE $${paramIndex} OR
          i.catalog_number ILIKE $${paramIndex} OR
          i.supplier ILIKE $${paramIndex} OR
          i.lot_number ILIKE $${paramIndex}
        )`);
        countParamsFinal.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        conditionsFinal.push(`i.category = $${paramIndex}`);
        countParamsFinal.push(category);
        paramIndex++;
      }

      if (lowStock) {
        conditionsFinal.push(`i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0`);
      }

      if (expiring) {
        const days = parseInt(expiring) || 30;
        conditionsFinal.push(`i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL '${days} days')`);
      }

      countQueryFinal += ` WHERE ` + conditionsFinal.join(' AND ');
    }

    const countResult = await db.query(countQueryFinal, countParamsFinal);
    const total = parseInt(countResult.rows[0].total);

    // Build data query with same conditions
    let dataQuery = `
      SELECT 
        i.*,
        ic.description as category_description,
        ic.default_unit as default_unit,
        CASE 
          WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
          ELSE false
        END as is_low_stock,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') AND i.expiration_date > CURRENT_DATE THEN true
          ELSE false
        END as is_expiring_soon
      FROM inventory i
      LEFT JOIN inventory_categories ic ON i.category = ic.category_name
    `;
    
    let dataParamsFinal = [...countParamsFinal];
    
    if (conditions.length > 0) {
      dataQuery += ` WHERE ` + countQueryFinal.split(' WHERE ')[1];
    }
    
    dataQuery += ` ORDER BY i.inventory_id ASC LIMIT $${dataParamsFinal.length + 1} OFFSET $${dataParamsFinal.length + 2}`;
    dataParamsFinal.push(limit, offset);

    const result = await db.query(dataQuery, dataParamsFinal);

    res.json({
      inventory: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/categories
// @desc    Get all available inventory categories
// @access  Private
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT category_name, description, default_unit FROM inventory_categories ORDER BY category_name'
    );
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/low-stock
// @desc    Get items below minimum stock level
// @access  Private
router.get('/low-stock', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM get_low_stock_items()');
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/expiring
// @desc    Get items expiring within specified timeframe
// @access  Private
router.get('/expiring', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await db.query('SELECT * FROM get_expiring_items($1)', [days]);
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/:id
// @desc    Get inventory item by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        i.*,
        ic.description as category_description,
        ic.default_unit as default_unit,
        CASE 
          WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
          ELSE false
        END as is_low_stock,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') AND i.expiration_date > CURRENT_DATE THEN true
          ELSE false
        END as is_expiring_soon
       FROM inventory i
       LEFT JOIN inventory_categories ic ON i.category = ic.category_name
       WHERE i.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory/check-availability
// @desc    Check if required reagents are available in sufficient quantities
// @access  Private
router.post('/check-availability', [
  auth,
  [
    check('reagents', 'Reagents array is required').isArray({ min: 1 }),
    check('reagents.*.name', 'Each reagent must have a name').notEmpty(),
    check('reagents.*.quantity_needed', 'Each reagent must have quantity_needed as a number').isNumeric(),
    check('reagents.*.unit', 'Each reagent must have a unit').notEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { reagents } = req.body;

  try {
    const availabilityResults = [];
    let allAvailable = true;
    let totalEstimatedCost = 0;

    for (const reagent of reagents) {
      // Search for matching inventory items by name (case-insensitive)
      const inventoryResult = await db.query(`
        SELECT i.*, 
               ic.description as category_description,
               CASE 
                 WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
                 ELSE false
               END as is_low_stock,
               CASE 
                 WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
                 ELSE false
               END as is_expired
        FROM inventory i
        LEFT JOIN inventory_categories ic ON i.category = ic.category_name
        WHERE LOWER(i.name) LIKE LOWER($1)
          AND i.current_quantity > 0
        ORDER BY i.current_quantity DESC, i.expiration_date ASC NULLS LAST
      `, [`%${reagent.name}%`]);

      let availableQuantity = 0;
      let estimatedCost = 0;
      let matchingItems = [];
      let warnings = [];

      // Calculate total available quantity from all matching items
      for (const item of inventoryResult.rows) {
        availableQuantity += parseFloat(item.current_quantity);
        matchingItems.push({
          id: item.id,
          inventory_id: item.inventory_id,
          name: item.name,
          current_quantity: item.current_quantity,
          unit_of_measure: item.unit_of_measure,
          cost_per_unit: item.cost_per_unit,
          is_low_stock: item.is_low_stock,
          is_expired: item.is_expired,
          expiration_date: item.expiration_date,
          storage_location: item.storage_location
        });

        // Calculate estimated cost
        if (item.cost_per_unit) {
          const quantityFromThisItem = Math.min(
            parseFloat(reagent.quantity_needed), 
            parseFloat(item.current_quantity)
          );
          estimatedCost += quantityFromThisItem * parseFloat(item.cost_per_unit);
        }

        // Add warnings for problematic items
        if (item.is_expired) {
          warnings.push(`Item ${item.name} (ID: ${item.inventory_id}) is expired`);
        } else if (item.is_low_stock) {
          warnings.push(`Item ${item.name} (ID: ${item.inventory_id}) is low stock`);
        }
      }

      const isAvailable = availableQuantity >= parseFloat(reagent.quantity_needed);
      if (!isAvailable) {
        allAvailable = false;
      }

      totalEstimatedCost += estimatedCost;

      availabilityResults.push({
        reagent_name: reagent.name,
        quantity_needed: parseFloat(reagent.quantity_needed),
        unit: reagent.unit,
        available_quantity: availableQuantity,
        is_available: isAvailable,
        shortage: isAvailable ? 0 : parseFloat(reagent.quantity_needed) - availableQuantity,
        matching_inventory_items: matchingItems,
        estimated_cost: estimatedCost,
        warnings: warnings
      });
    }

    res.json({
      all_reagents_available: allAvailable,
      availability_results: availabilityResults,
      total_estimated_cost: totalEstimatedCost,
      currency: process.env.DEFAULT_CURRENCY || 'USD',
      checked_at: new Date().toISOString()
    });

  } catch (err) {
    logger.error('Inventory availability check failed:', {
      error: err.message,
      reagents: reagents
    });
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory
// @desc    Create an inventory item
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('name', 'Name is required').not().isEmpty(),
      check('category', 'Category is required').not().isEmpty(),
      check('current_quantity', 'Current quantity must be a number').isNumeric(),
    ]
  ],
  async (req, res) => {
    console.log('🔍 DEBUG - POST /api/inventory route hit');
    console.log('🔍 DEBUG - Request body keys:', Object.keys(req.body));
    console.log('🔍 DEBUG - Request body barcode field:', req.body.barcode);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('🔍 DEBUG - Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      category,
      description,
      supplier,
      catalog_number,
      current_quantity,
      unit_of_measure,
      lot_number,
      expiration_date,
      storage_location,
      storage_conditions,
      minimum_stock_level,
      cost_per_unit,
      notes,
      barcode
    } = req.body;

    try {
      // Debug: Log what we received
      console.log('🔍 BARCODE DEBUG - Received barcode:', barcode);
      console.log('🔍 BARCODE DEBUG - Full request body:', JSON.stringify(req.body, null, 2));
      
      // Check if we have a commercial barcode
      const hasCommercialBarcode = barcode && barcode.trim();
      
      let inventory_id = null;
      let finalBarcode;
      
      if (hasCommercialBarcode) {
        // Use commercial barcode, no internal ID needed
        finalBarcode = barcode.trim();
        console.log('🔍 Using commercial barcode:', finalBarcode);
      } else {
        // Generate internal ID and LAB barcode for items without commercial barcodes
        const username = req.user?.username || req.user?.email;
        const idResult = await idGenerationService.getNextId('inventory', username);
        inventory_id = idResult.id;
        finalBarcode = `LAB-${inventory_id.toString().padStart(3, '0')}`;
        console.log('🔍 Generated LAB barcode:', finalBarcode, 'with inventory_id:', inventory_id);
      }
      
      console.log('🔍 BARCODE DEBUG - Final barcode decision:', {
        receivedBarcode: barcode,
        hasBarcodeValue: !!barcode,
        trimmedBarcode: barcode ? barcode.trim() : 'N/A',
        finalBarcode: finalBarcode
      });

      const result = await db.query(
        `INSERT INTO inventory 
        (inventory_id, name, category, description, supplier, catalog_number, 
         current_quantity, unit_of_measure, lot_number, expiration_date, 
         storage_location, storage_conditions, minimum_stock_level, 
         cost_per_unit, barcode, notes) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
        RETURNING *`,
        [
          inventory_id, name, category, description, supplier, catalog_number,
          current_quantity || 0, unit_of_measure, lot_number, expiration_date,
          storage_location, storage_conditions, minimum_stock_level || 0,
          cost_per_unit, finalBarcode, notes
        ]
      );

      // Log the action in audit trail
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'CREATE',
          'inventory',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      // Create initial transaction record if quantity > 0
      if (current_quantity > 0) {
        await db.query(
          `INSERT INTO inventory_transactions 
          (inventory_id, transaction_type, quantity_change, quantity_after, reason, performed_by)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            result.rows[0].id,
            'in',
            current_quantity,
            current_quantity,
            'Initial stock',
            req.user.id
          ]
        );
      }

      res.json(result.rows[0]);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/inventory/:id
// @desc    Update an inventory item
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('name', 'Name is required').not().isEmpty(),
      check('category', 'Category is required').not().isEmpty(),
      check('current_quantity', 'Current quantity must be a number').isNumeric(),
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      category,
      description,
      supplier,
      catalog_number,
      current_quantity,
      unit_of_measure,
      lot_number,
      expiration_date,
      storage_location,
      storage_conditions,
      minimum_stock_level,
      cost_per_unit,
      notes
    } = req.body;

    try {
      // First check if inventory item exists
      const checkResult = await db.query(
        'SELECT * FROM inventory WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Inventory item not found' });
      }

      const oldData = checkResult.rows[0];

      // Update the inventory item
      const result = await db.query(
        `UPDATE inventory
        SET name = $1, category = $2, description = $3, supplier = $4,
            catalog_number = $5, current_quantity = $6, unit_of_measure = $7,
            lot_number = $8, expiration_date = $9, storage_location = $10,
            storage_conditions = $11, minimum_stock_level = $12, 
            cost_per_unit = $13, notes = $14
        WHERE id = $15
        RETURNING *`,
        [
          name, category, description, supplier, catalog_number,
          current_quantity, unit_of_measure, lot_number, expiration_date,
          storage_location, storage_conditions, minimum_stock_level || 0,
          cost_per_unit, notes, req.params.id
        ]
      );

      // Log quantity change if applicable
      const quantityChanged = parseFloat(current_quantity) !== parseFloat(oldData.current_quantity);
      if (quantityChanged) {
        const quantityDiff = parseFloat(current_quantity) - parseFloat(oldData.current_quantity);
        await db.query(
          `INSERT INTO inventory_transactions 
          (inventory_id, transaction_type, quantity_change, quantity_after, reason, performed_by)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.params.id,
            quantityDiff > 0 ? 'in' : 'out',
            Math.abs(quantityDiff),
            current_quantity,
            `Manual adjustment via edit (${quantityDiff > 0 ? '+' : '-'}${Math.abs(quantityDiff)})`,
            req.user.id
          ]
        );
      }

      // Log the action in audit trail
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'UPDATE',
          'inventory',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/inventory/:id/quantity
// @desc    Update quantity only (for quick stock adjustments)
// @access  Private (admin/editor only)
router.put(
  '/:id/quantity',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('quantity', 'Quantity must be a number').isNumeric(),
      check('reason', 'Reason is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, reason } = req.body;

    try {
      // First check if inventory item exists and get current quantity
      const checkResult = await db.query(
        'SELECT * FROM inventory WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Inventory item not found' });
      }

      const currentQuantity = parseFloat(checkResult.rows[0].current_quantity);
      const newQuantity = parseFloat(quantity);
      const quantityChange = newQuantity - currentQuantity;

      // Update the quantity
      const result = await db.query(
        'UPDATE inventory SET current_quantity = $1 WHERE id = $2 RETURNING *',
        [newQuantity, req.params.id]
      );

      // Log the transaction
      await db.query(
        `INSERT INTO inventory_transactions 
        (inventory_id, transaction_type, quantity_change, quantity_after, reason, performed_by)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.params.id,
          quantityChange > 0 ? 'in' : (quantityChange < 0 ? 'out' : 'adjustment'),
          Math.abs(quantityChange),
          newQuantity,
          reason,
          req.user.id
        ]
      );

      res.json({
        success: true,
        data: result.rows[0],
        transaction: {
          quantityChange,
          previousQuantity: currentQuantity,
          newQuantity
        }
      });
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE api/inventory/:id
// @desc    Delete an inventory item
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // First check if inventory item exists
    const checkResult = await db.query(
      'SELECT * FROM inventory WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }

    const oldData = checkResult.rows[0];

    // Delete the inventory item (cascades to transactions)
    await db.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DELETE',
        'inventory',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );

    res.json({ msg: 'Inventory item removed' });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/:id/transactions
// @desc    Get transaction history for an inventory item
// @access  Private
router.get('/:id/transactions', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        t.*,
        u.username as performed_by_username,
        u.first_name,
        u.last_name
       FROM inventory_transactions t
       LEFT JOIN users u ON t.performed_by = u.id
       WHERE t.inventory_id = $1
       ORDER BY t.transaction_date DESC`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/search
// @desc    Search inventory items
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({ msg: 'Search query is required' });
    }

    const result = await db.query(
      `SELECT 
        i.*,
        ic.description as category_description
       FROM inventory i
       LEFT JOIN inventory_categories ic ON i.category = ic.category_name
       WHERE 
        i.name ILIKE $1 OR
        i.description ILIKE $1 OR
        i.catalog_number ILIKE $1 OR
        i.supplier ILIKE $1 OR
        i.lot_number ILIKE $1
       ORDER BY 
        CASE 
          WHEN i.name ILIKE $1 THEN 1
          WHEN i.catalog_number ILIKE $1 THEN 2
          ELSE 3
        END,
        i.inventory_id
       LIMIT 50`,
      [`%${query}%`]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory/transactions
// @desc    Create a manual inventory transaction
// @access  Private (admin/editor only)
router.post(
  '/transactions',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('inventory_id', 'Inventory ID is required').not().isEmpty(),
      check('transaction_type', 'Transaction type is required').isIn(['in', 'out', 'adjustment']),
      check('quantity_change', 'Quantity change must be a number').isNumeric(),
      check('reason', 'Reason is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      inventory_id,
      transaction_type,
      quantity_change,
      reason
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Verify inventory item exists
      const inventoryCheck = await client.query(
        'SELECT * FROM inventory WHERE id = $1',
        [inventory_id]
      );

      if (inventoryCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: 'Inventory item not found' });
      }

      const inventory = inventoryCheck.rows[0];
      let newQuantity;
      
      // Calculate new quantity based on transaction type
      if (transaction_type === 'in') {
        newQuantity = parseFloat(inventory.current_quantity) + parseFloat(quantity_change);
      } else if (transaction_type === 'out') {
        newQuantity = parseFloat(inventory.current_quantity) - parseFloat(quantity_change);
        
        // Check if enough quantity available
        if (newQuantity < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            msg: `Insufficient quantity. Available: ${inventory.current_quantity}, Requested: ${quantity_change}` 
          });
        }
      } else { // adjustment
        newQuantity = parseFloat(quantity_change);
      }

      // Update inventory quantity
      await client.query(
        'UPDATE inventory SET current_quantity = $1 WHERE id = $2',
        [newQuantity, inventory_id]
      );

      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO inventory_transactions 
        (inventory_id, transaction_type, quantity_change, quantity_after, reason, performed_by, transaction_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          inventory_id,
          transaction_type,
          transaction_type === 'adjustment' ? newQuantity - inventory.current_quantity : 
            (transaction_type === 'out' ? -parseFloat(quantity_change) : parseFloat(quantity_change)),
          newQuantity,
          reason,
          req.user.id,
          'completed'
        ]
      );

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'INVENTORY_TRANSACTION',
          'inventory_transactions',
          transactionResult.rows[0].id,
          JSON.stringify({
            inventory_id,
            transaction_type,
            quantity_change,
            old_quantity: inventory.current_quantity,
            new_quantity: newQuantity,
            reason
          })
        ]
      );

      await client.query('COMMIT');
      res.json({
        transaction: transactionResult.rows[0],
        inventory_name: inventory.name,
        old_quantity: inventory.current_quantity,
        new_quantity: newQuantity
      });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Transaction creation failed:', {
        error: err.message,
        userId: req.user?.id,
        inventoryId: inventory_id
      });
      res.status(500).send('Server error');
    } finally {
      client.release();
    }
  }
);

// @route   GET api/inventory/transactions
// @desc    Get all inventory transactions with filtering
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    inventory_id,
    experiment_id,
    transaction_type,
    user_id,
    date_from,
    date_to
  } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Build WHERE conditions
    let whereConditions = [];
    let queryParamsArray = [];
    let paramIndex = 1;
    
    // Inventory filter
    if (inventory_id) {
      whereConditions.push(`t.inventory_id = $${paramIndex}`);
      queryParamsArray.push(inventory_id);
      paramIndex++;
    }
    
    // Experiment filter
    if (experiment_id) {
      whereConditions.push(`t.experiment_id = $${paramIndex}`);
      queryParamsArray.push(experiment_id);
      paramIndex++;
    }
    
    // Transaction type filter
    if (transaction_type) {
      whereConditions.push(`t.transaction_type = $${paramIndex}`);
      queryParamsArray.push(transaction_type);
      paramIndex++;
    }
    
    // User filter
    if (user_id) {
      whereConditions.push(`t.performed_by = $${paramIndex}`);
      queryParamsArray.push(user_id);
      paramIndex++;
    }
    
    // Date range filters
    if (date_from) {
      whereConditions.push(`t.transaction_date >= $${paramIndex}`);
      queryParamsArray.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      whereConditions.push(`t.transaction_date <= $${paramIndex}`);
      queryParamsArray.push(date_to);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM inventory_transactions t ${whereClause}`;
    const countResult = await db.query(countQuery, queryParamsArray);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Data query with pagination
    const dataQuery = `
      SELECT 
        t.*,
        i.name as inventory_name,
        i.unit_of_measure,
        u.username as performed_by_username,
        u.first_name,
        u.last_name,
        e.experiment_id as experiment_number
      FROM inventory_transactions t
      JOIN inventory i ON t.inventory_id = i.id
      LEFT JOIN users u ON t.performed_by = u.id
      LEFT JOIN experiments e ON t.experiment_id = e.id
      ${whereClause}
      ORDER BY t.transaction_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParamsArray.push(limit, offset);
    const result = await db.query(dataQuery, queryParamsArray);
    
    res.json({
      transactions: result.rows,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/inventory/reservations
// @desc    Get current inventory reservations
// @access  Private
router.get('/reservations', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        t.*,
        i.name as inventory_name,
        i.unit_of_measure,
        u.username as performed_by_username,
        u.first_name,
        u.last_name,
        e.experiment_id as experiment_number,
        p.name as protocol_name
       FROM inventory_transactions t
       JOIN inventory i ON t.inventory_id = i.id
       LEFT JOIN users u ON t.performed_by = u.id
       LEFT JOIN experiments e ON t.experiment_id = e.id
       LEFT JOIN protocols p ON e.protocol_id = p.id
       WHERE t.transaction_status = 'reserved'
       ORDER BY t.transaction_date DESC`
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory/check-availability
// @desc    Check inventory availability for experiment planning
// @access  Private
router.post('/check-availability', auth, async (req, res) => {
  const { required_reagents, sample_count = 1 } = req.body;
  
  if (!Array.isArray(required_reagents)) {
    return res.status(400).json({ msg: 'Required reagents must be an array' });
  }
  
  try {
    const availability = [];
    
    for (const reagent of required_reagents) {
      // Handle "As needed" quantities
      const totalNeeded = typeof reagent.quantity_per_sample === 'number' 
        ? reagent.quantity_per_sample * sample_count 
        : reagent.quantity_per_sample; // Keep "As needed" as string
      
      // Find matching inventory items
      const inventoryCheck = await db.query(
        `SELECT 
          id, name, current_quantity, unit_of_measure, 
          expiration_date, lot_number
         FROM inventory 
         WHERE name ILIKE $1 AND current_quantity > 0 
         ORDER BY expiration_date ASC NULLS LAST`,
        [reagent.name]
      );
      
      let totalAvailable = 0;
      const items = inventoryCheck.rows.map(item => {
        totalAvailable += parseFloat(item.current_quantity);
        return {
          ...item,
          current_quantity: parseFloat(item.current_quantity)
        };
      });
      
      availability.push({
        reagent_name: reagent.name,
        required_quantity: totalNeeded,
        required_unit: reagent.unit,
        total_available: totalAvailable,
        is_sufficient: totalAvailable >= totalNeeded,
        available_items: items
      });
    }
    
    const allSufficient = availability.every(item => item.is_sufficient);
    
    res.json({
      availability,
      all_sufficient: allSufficient,
      sample_count,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory/lookup-barcode
// @desc    Look up product information by commercial barcode
// @access  Private
router.post('/lookup-barcode', [
  auth,
  [
    check('barcode', 'Barcode is required').notEmpty(),
    check('barcode', 'Barcode must be a valid UPC or EAN code').matches(/^\d{8,13}$/)
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { barcode } = req.body;

  try {
    // Check if this barcode already exists in our inventory
    const existingResult = await db.query(
      'SELECT * FROM inventory WHERE barcode = $1 LIMIT 1',
      [barcode]
    );

    if (existingResult.rows.length > 0) {
      return res.json({
        found: true,
        source: 'existing_inventory',
        product: existingResult.rows[0],
        message: 'This product already exists in your inventory'
      });
    }

    // Look up the barcode in external/internal product databases
    const lookupResult = await productLookupService.lookupProductByBarcode(barcode);

    if (lookupResult.success && lookupResult.product) {
      return res.json({
        found: true,
        source: lookupResult.source,
        product: {
          name: lookupResult.product.name,
          manufacturer: lookupResult.product.manufacturer,
          catalogNumber: lookupResult.product.catalogNumber,
          description: lookupResult.product.description,
          category: lookupResult.product.category,
          unitOfMeasure: lookupResult.product.unitOfMeasure,
          packSize: lookupResult.product.packSize,
          barcode: barcode
        }
      });
    } else {
      // Barcode not found in any database
      return res.json({
        found: false,
        source: 'none',
        product: null,
        message: 'Product not found in any database. You can enter details manually.',
        barcode: barcode
      });
    }

  } catch (err) {
    logger.error('Barcode lookup error:', err);
    res.status(500).json({
      found: false,
      error: 'Server error during barcode lookup',
      barcode: barcode
    });
  }
});

// @route   GET api/inventory/barcode-stats
// @desc    Get statistics about the product barcode database
// @access  Private
router.get('/barcode-stats', auth, async (req, res) => {
  try {
    // Get stats from internal product database
    const internalStats = productLookupService.getDatabaseStats();
    
    // Get stats from inventory barcodes
    const inventoryStats = await db.query(`
      SELECT 
        COUNT(*) as total_with_barcodes,
        COUNT(DISTINCT barcode) as unique_barcodes
      FROM inventory 
      WHERE barcode IS NOT NULL AND barcode != ''
    `);

    res.json({
      internalDatabase: internalStats,
      inventoryBarcodes: {
        totalWithBarcodes: parseInt(inventoryStats.rows[0].total_with_barcodes),
        uniqueBarcodes: parseInt(inventoryStats.rows[0].unique_barcodes)
      }
    });

  } catch (err) {
    logger.error('Error getting barcode stats:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/inventory/add-product-to-db
// @desc    Add a new product to the internal barcode database
// @access  Private (admin/editor only)
router.post('/add-product-to-db', [
  auth,
  roleCheck(['admin', 'lab_manager', 'lab_technician']),
  [
    check('barcode', 'Barcode is required').notEmpty(),
    check('name', 'Product name is required').notEmpty(),
    check('manufacturer', 'Manufacturer is required').notEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { barcode, name, manufacturer, catalogNumber, description, category, unitOfMeasure, packSize } = req.body;

  try {
    // Check if barcode format is supported
    if (!productLookupService.isSupportedBarcodeFormat(barcode)) {
      return res.status(400).json({ 
        msg: 'Unsupported barcode format. Only UPC and EAN codes are supported.' 
      });
    }

    // Add to internal database
    const success = productLookupService.addProductToDatabase(barcode, {
      name,
      manufacturer,
      catalogNumber: catalogNumber || '',
      description: description || '',
      category: category || 'general',
      unitOfMeasure: unitOfMeasure || '',
      packSize: packSize || null
    });

    if (success) {
      res.json({
        success: true,
        message: 'Product added to internal database successfully',
        barcode: barcode
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to add product to database'
      });
    }

  } catch (err) {
    logger.error('Error adding product to database:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;