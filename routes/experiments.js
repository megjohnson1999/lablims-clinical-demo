const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const { idGenerationService } = require('../services/idGenerationService');
const logger = require('../utils/logger');

// @route   GET api/experiments
// @desc    Get all experiments with pagination and filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    protocol_id,
    user_id,
    status,
    date_from,
    date_to
  } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Build WHERE conditions
    let whereConditions = [];
    let queryParamsArray = [];
    let paramIndex = 1;
    
    // Protocol filter
    if (protocol_id) {
      whereConditions.push(`e.protocol_id = $${paramIndex}`);
      queryParamsArray.push(protocol_id);
      paramIndex++;
    }
    
    // User filter
    if (user_id) {
      whereConditions.push(`e.user_id = $${paramIndex}`);
      queryParamsArray.push(user_id);
      paramIndex++;
    }
    
    // Status filter
    if (status) {
      whereConditions.push(`e.status = $${paramIndex}`);
      queryParamsArray.push(status);
      paramIndex++;
    }
    
    // Date range filters
    if (date_from) {
      whereConditions.push(`e.date_performed >= $${paramIndex}`);
      queryParamsArray.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      whereConditions.push(`e.date_performed <= $${paramIndex}`);
      queryParamsArray.push(date_to);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM experiments e ${whereClause}`;
    const countResult = await db.query(countQuery, queryParamsArray);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Data query with pagination
    const dataQuery = `
      SELECT * FROM experiments_with_details
      ${whereClause}
      ORDER BY date_performed DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParamsArray.push(limit, offset);
    const result = await db.query(dataQuery, queryParamsArray);
    
    res.json({
      experiments: result.rows,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/experiments/search
// @desc    Search experiments
// @access  Private
router.get('/search', auth, async (req, res) => {
  const { term } = req.query;
  
  if (!term) {
    return res.status(400).json({ msg: 'Search term is required' });
  }
  
  try {
    const query = `
      SELECT * FROM experiments_with_details
      WHERE protocol_name ILIKE $1 OR
            notes ILIKE $1 OR
            performed_by_username ILIKE $1 OR
            performed_by_first_name ILIKE $1 OR
            performed_by_last_name ILIKE $1
      ORDER BY date_performed DESC
    `;
    
    const result = await db.query(query, [`%${term}%`]);
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/experiments/samples/:sampleId
// @desc    Get experiment history for a sample
// @access  Private
router.get('/samples/:sampleId', auth, async (req, res) => {
  try {
    const query = `
      SELECT * FROM experiments_with_details
      WHERE sample_ids @> $1::jsonb
      ORDER BY date_performed DESC
    `;
    
    const result = await db.query(query, [JSON.stringify([req.params.sampleId])]);
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/experiments/:id
// @desc    Get experiment by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM experiments_with_details WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Experiment not found' });
    }

    // Get inventory transactions for this experiment
    const inventoryResult = await db.query(
      `SELECT it.*, i.name as inventory_name, i.unit_of_measure
       FROM inventory_transactions it
       JOIN inventory i ON it.inventory_id = i.id
       WHERE it.experiment_id = $1
       ORDER BY it.transaction_date ASC`,
      [req.params.id]
    );

    const experiment = result.rows[0];
    experiment.inventory_transactions = inventoryResult.rows;

    // Get specimen numbers for sample_ids if they exist
    if (experiment.sample_ids && experiment.sample_ids.length > 0) {
      const specimenResult = await db.query(
        `SELECT id, specimen_number 
         FROM specimens 
         WHERE id = ANY($1::uuid[])`,
        [experiment.sample_ids]
      );
      
      // Create a mapping of UUID to specimen_number
      const specimenMap = {};
      specimenResult.rows.forEach(row => {
        specimenMap[row.id] = row.specimen_number;
      });
      
      // Add specimen_numbers array while preserving original sample_ids
      experiment.specimen_numbers = experiment.sample_ids.map(id => specimenMap[id] || id);
    }

    res.json(experiment);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/experiments
// @desc    Create an experiment and reserve inventory
// @access  Private (all users can log experiments)
router.post(
  '/',
  [
    auth,
    [
      check('protocol_id', 'Protocol ID is required').not().isEmpty(),
      check('date_performed', 'Date performed is required').isISO8601(),
      check('sample_ids', 'Sample IDs must be an array').isArray(),
      check('actual_reagents_used', 'Actual reagents used must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    // Debug: Log raw request body first
    logger.info('Raw experiment request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Experiment validation failed:', {
        errors: errors.array(),
        body: req.body
      });
      return res.status(400).json({ errors: errors.array() });
    }

    logger.info('Experiment validation passed successfully');

    const {
      protocol_id,
      date_performed,
      sample_ids = [],
      actual_reagents_used = [],
      notes,
      status = 'completed'
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Verify protocol exists and is active
      const protocolCheck = await client.query(
        'SELECT * FROM protocols WHERE id = $1 AND is_active = true',
        [protocol_id]
      );

      if (protocolCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: 'Protocol not found or inactive' });
      }

      const protocol = protocolCheck.rows[0];

      // Verify all sample IDs exist
      if (sample_ids.length > 0) {
        const sampleCheck = await client.query(
          'SELECT id FROM specimens WHERE id = ANY($1::uuid[])',
          [sample_ids]
        );

        if (sampleCheck.rows.length !== sample_ids.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ msg: 'One or more sample IDs not found' });
        }
      }

      // Get next experiment ID
      const nextIdResult = await client.query(
        "SELECT get_next_number('experiment') as experiment_number"
      );
      const experiment_id = nextIdResult.rows[0].experiment_number;

      // Create the experiment
      const result = await client.query(
        `INSERT INTO experiments 
        (experiment_id, protocol_id, user_id, date_performed, status, sample_ids, actual_reagents_used, notes) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [
          experiment_id,
          protocol_id,
          req.user.id,
          date_performed,
          status,
          JSON.stringify(sample_ids),
          JSON.stringify(actual_reagents_used),
          notes
        ]
      );

      const experimentRecord = result.rows[0];

      // Handle inventory requirements if provided by frontend
      const inventoryRequirements = req.body.inventory_requirements || [];
      let inventoryWarnings = [];
      
      if (inventoryRequirements.length > 0) {
        // Reserve inventory using the frontend-provided requirements
        try {
          const inventoryResult = await client.query(
            'SELECT reserve_inventory_for_experiment($1, $2, $3) as result',
            [
              experimentRecord.id,
              JSON.stringify(inventoryRequirements),
              req.user.id
            ]
          );
          
          const reservationResult = inventoryResult.rows[0].result;
          if (reservationResult.has_warnings) {
            inventoryWarnings = reservationResult.warnings;
          }
        } catch (inventoryError) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            msg: 'Inventory reservation failed',
            error: inventoryError.message 
          });
        }

        // Consume the reserved inventory immediately since experiments are "completed" by default
        try {
          await client.query(
            'SELECT consume_reserved_inventory($1, $2)',
            [experimentRecord.id, JSON.stringify(actual_reagents_used)]
          );
        } catch (consumeError) {
          logger.warn('Inventory consumption warning:', consumeError.message);
          // Don't fail the experiment creation for consumption issues
        }
      } else {
        // Fallback to old method if no inventory requirements provided
        const requiredReagents = protocol.required_reagents || [];
        const sampleCount = sample_ids.length;
        
        if (requiredReagents.length > 0 && sampleCount > 0) {
          // Build inventory requirements array using old method
          const fallbackRequirements = [];
          
          for (const reagent of requiredReagents) {
            // Find matching inventory item by name
            const inventoryCheck = await client.query(
              'SELECT * FROM inventory WHERE name ILIKE $1 AND current_quantity > 0 ORDER BY expiration_date ASC NULLS LAST LIMIT 1',
              [reagent.name]
            );
            
            if (inventoryCheck.rows.length > 0 && typeof reagent.quantity_per_sample === 'number') {
              const totalQuantityNeeded = reagent.quantity_per_sample * sampleCount;
              fallbackRequirements.push({
                inventory_id: inventoryCheck.rows[0].id,
                quantity: totalQuantityNeeded
              });
            }
          }

          // Reserve inventory if requirements found
          if (fallbackRequirements.length > 0) {
            try {
              const fallbackResult = await client.query(
                'SELECT reserve_inventory_for_experiment($1, $2, $3) as result',
                [
                  experimentRecord.id,
                  JSON.stringify(fallbackRequirements),
                  req.user.id
                ]
              );
              
              const reservationResult = fallbackResult.rows[0].result;
              if (reservationResult.has_warnings) {
                inventoryWarnings = inventoryWarnings.concat(reservationResult.warnings);
              }
            } catch (inventoryError) {
              await client.query('ROLLBACK');
              return res.status(400).json({ 
                msg: 'Inventory reservation failed',
                error: inventoryError.message 
              });
            }

            // Mark reservations as consumed with default amounts
            try {
              await client.query(
                'SELECT consume_reserved_inventory($1, NULL)',
                [experimentRecord.id]
              );
            } catch (consumeError) {
              logger.warn('Inventory consumption warning:', consumeError.message);
            }
          }
        }
      }

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'CREATE',
          'experiments',
          experimentRecord.id,
          JSON.stringify(req.body)
        ]
      );

      // Return with detailed information
      const experimentWithDetails = await client.query(
        'SELECT * FROM experiments_with_details WHERE id = $1',
        [experimentRecord.id]
      );
      
      await client.query('COMMIT');
      
      // Include inventory warnings in the response
      const response = {
        ...experimentWithDetails.rows[0],
        inventory_warnings: inventoryWarnings,
        has_inventory_warnings: inventoryWarnings.length > 0
      };
      
      res.json(response);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Experiment creation failed:', {
        error: err.message,
        stack: err.stack,
        userId: req.user?.id,
        protocolId: protocol_id,
        requestBody: req.body
      });
      res.status(500).json({ msg: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  }
);

// @route   PUT api/experiments/:id
// @desc    Update an experiment
// @access  Private (admin/editor or experiment creator)
router.put(
  '/:id',
  [
    auth,
    [
      check('protocol_id', 'Protocol ID is required').not().isEmpty(),
      check('date_performed', 'Date performed is required').isISO8601(),
      check('sample_ids', 'Sample IDs must be an array').isArray(),
      check('actual_reagents_used', 'Actual reagents used must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      protocol_id,
      date_performed,
      sample_ids = [],
      actual_reagents_used = [],
      notes,
      status = 'completed'
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // First check if experiment exists
      const checkResult = await client.query(
        'SELECT * FROM experiments WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ msg: 'Experiment not found' });
      }

      const oldData = checkResult.rows[0];

      // Check if user can edit this experiment (admin/editor or creator)
      const userRoles = req.user.role;
      const canEdit = ['admin', 'editor'].includes(userRoles) || oldData.user_id === req.user.id;

      if (!canEdit) {
        await client.query('ROLLBACK');
        return res.status(403).json({ msg: 'Not authorized to edit this experiment' });
      }

      // Verify protocol exists and is active
      const protocolCheck = await client.query(
        'SELECT * FROM protocols WHERE id = $1 AND is_active = true',
        [protocol_id]
      );

      if (protocolCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: 'Protocol not found or inactive' });
      }

      // Verify all sample IDs exist
      if (sample_ids.length > 0) {
        const sampleCheck = await client.query(
          'SELECT id FROM specimens WHERE id = ANY($1::uuid[])',
          [sample_ids]
        );

        if (sampleCheck.rows.length !== sample_ids.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ msg: 'One or more sample IDs not found' });
        }
      }

      // Update the experiment
      const result = await client.query(
        `UPDATE experiments
        SET protocol_id = $1, date_performed = $2, status = $3, 
            sample_ids = $4, actual_reagents_used = $5, notes = $6
        WHERE id = $7
        RETURNING *`,
        [
          protocol_id,
          date_performed,
          status,
          JSON.stringify(sample_ids),
          JSON.stringify(actual_reagents_used),
          notes,
          req.params.id
        ]
      );

      // Update inventory consumption if actual reagents changed
      if (actual_reagents_used.length > 0) {
        try {
          await client.query(
            'SELECT consume_reserved_inventory($1, $2)',
            [req.params.id, JSON.stringify(actual_reagents_used)]
          );
        } catch (consumeError) {
          logger.warn('Inventory consumption update warning:', consumeError.message);
        }
      }

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'UPDATE',
          'experiments',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      // Return with detailed information
      const experimentWithDetails = await client.query(
        'SELECT * FROM experiments_with_details WHERE id = $1',
        [req.params.id]
      );
      
      await client.query('COMMIT');
      res.json(experimentWithDetails.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Experiment update failed:', {
        error: err.message,
        userId: req.user?.id,
        experimentId: req.params.id
      });
      res.status(500).send('Server error');
    } finally {
      client.release();
    }
  }
);

// @route   DELETE api/experiments/:id
// @desc    Delete an experiment and cancel inventory reservations
// @access  Private (admin only or experiment creator)
router.delete('/:id', auth, async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // First check if experiment exists
    const checkResult = await client.query(
      'SELECT * FROM experiments WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Experiment not found' });
    }

    const oldData = checkResult.rows[0];

    // Check if user can delete this experiment (admin or creator)
    const userRoles = req.user.role;
    const canDelete = userRoles === 'admin' || oldData.user_id === req.user.id;

    if (!canDelete) {
      await client.query('ROLLBACK');
      return res.status(403).json({ msg: 'Not authorized to delete this experiment' });
    }

    // Cancel any reserved inventory
    try {
      await client.query(
        'SELECT cancel_reserved_inventory($1)',
        [req.params.id]
      );
    } catch (cancelError) {
      logger.warn('Inventory cancellation warning:', cancelError.message);
    }

    // Delete the experiment
    await client.query('DELETE FROM experiments WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await client.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DELETE',
        'experiments',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );
    
    await client.query('COMMIT');
    res.json({ msg: 'Experiment deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Experiment deletion failed:', {
      error: err.message,
      userId: req.user?.id,
      experimentId: req.params.id
    });
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
});

// @route   POST api/experiments/:id/cancel-reservation
// @desc    Cancel inventory reservation for an experiment
// @access  Private (admin/editor or experiment creator)
router.post('/:id/cancel-reservation', auth, async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Check if experiment exists and user has permission
    const checkResult = await client.query(
      'SELECT * FROM experiments WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Experiment not found' });
    }

    const experiment = checkResult.rows[0];
    const userRoles = req.user.role;
    const canCancel = ['admin', 'editor'].includes(userRoles) || experiment.user_id === req.user.id;

    if (!canCancel) {
      await client.query('ROLLBACK');
      return res.status(403).json({ msg: 'Not authorized to cancel reservations for this experiment' });
    }

    // Cancel reserved inventory
    await client.query(
      'SELECT cancel_reserved_inventory($1)',
      [req.params.id]
    );

    // Log the action
    await client.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'CANCEL_RESERVATION',
        'experiments',
        req.params.id,
        JSON.stringify({ action: 'inventory_reservation_cancelled' })
      ]
    );
    
    await client.query('COMMIT');
    res.json({ msg: 'Inventory reservation cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Reservation cancellation failed:', {
      error: err.message,
      userId: req.user?.id,
      experimentId: req.params.id
    });
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
});

module.exports = router;