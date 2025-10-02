const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');

// @route   GET api/system-options/:category
// @desc    Get system options for a specific category
// @access  Private
router.get('/:category', auth, async (req, res) => {
  try {
    const { category } = req.params;

    const query = `
      SELECT option_key, option_value, display_order, description
      FROM system_options
      WHERE category = $1 AND is_active = true
      ORDER BY display_order ASC, option_value ASC
    `;

    const result = await db.query(query, [category]);

    // Transform to match frontend expected format
    const transformedOptions = result.rows.map(row => ({
      key: row.option_key,
      value: row.option_value,
      order: row.display_order,
      description: row.description
    }));

    res.json({
      success: true,
      category,
      options: transformedOptions
    });
  } catch (error) {
    logger.error('Error fetching system options', { category: req.params.category, error: error.message });
    res.status(500).json({
      msg: 'Failed to fetch system options',
      error: error.message
    });
  }
});

// @route   GET api/system-options
// @desc    Get all system options grouped by category
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const query = `
      SELECT category, option_key, option_value, display_order, description
      FROM system_options
      WHERE is_active = true
      ORDER BY category ASC, display_order ASC, option_value ASC
    `;
    
    const result = await db.query(query);
    
    // Group options by category
    const groupedOptions = {};
    result.rows.forEach(row => {
      if (!groupedOptions[row.category]) {
        groupedOptions[row.category] = [];
      }
      groupedOptions[row.category].push({
        key: row.option_key,
        value: row.option_value,
        order: row.display_order,
        description: row.description
      });
    });
    
    res.json({
      success: true,
      options: groupedOptions
    });
  } catch (error) {
    logger.error('Error fetching all system options', { error: error.message, stack: error.stack });
    res.status(500).json({
      msg: 'Failed to fetch system options',
      error: error.message
    });
  }
});

// @route   POST api/system-options
// @desc    Create a new system option
// @access  Private (admin only)
router.post('/', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { category, option_key, option_value, display_order = 0, description } = req.body;
    
    // Validate required fields
    if (!category || !option_key || !option_value) {
      return res.status(400).json({
        msg: 'Category, option_key, and option_value are required'
      });
    }
    
    const query = `
      INSERT INTO system_options (category, option_key, option_value, display_order, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      category,
      option_key,
      option_value,
      display_order,
      description
    ]);
    
    res.json({
      success: true,
      message: 'System option created successfully',
      option: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating system option', { error: error.message, stack: error.stack });
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        msg: 'An option with this key already exists in this category'
      });
    }
    
    res.status(500).json({
      msg: 'Failed to create system option',
      error: error.message
    });
  }
});

// @route   PUT api/system-options/:id
// @desc    Update a system option
// @access  Private (admin only)
router.put('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { id } = req.params;
    const { option_value, display_order, description, is_active } = req.body;
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (option_value !== undefined) {
      updateFields.push(`option_value = $${paramCount}`);
      values.push(option_value);
      paramCount++;
    }
    
    if (display_order !== undefined) {
      updateFields.push(`display_order = $${paramCount}`);
      values.push(display_order);
      paramCount++;
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        msg: 'No fields to update'
      });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE system_options
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        msg: 'System option not found'
      });
    }
    
    res.json({
      success: true,
      message: 'System option updated successfully',
      option: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating system option:', error);
    res.status(500).json({
      msg: 'Failed to update system option',
      error: error.message
    });
  }
});

// @route   DELETE api/system-options/:id
// @desc    Delete a system option (soft delete by setting is_active = false)
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE system_options
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        msg: 'System option not found'
      });
    }
    
    res.json({
      success: true,
      message: 'System option deactivated successfully',
      option: result.rows[0]
    });
  } catch (error) {
    console.error('Error deactivating system option:', error);
    res.status(500).json({
      msg: 'Failed to deactivate system option',
      error: error.message
    });
  }
});

module.exports = router;