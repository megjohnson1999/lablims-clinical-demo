const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { handleDatabaseError, handleValidationErrors, asyncHandler } = require('../utils/errorHandler');
const { buildSearchClause } = require('../utils/searchUtils');

// @route   GET api/collaborators
// @desc    Get all collaborators with pagination and search
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    // Get total count for pagination info
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM collaborators c
      WHERE c.collaborator_number != 0
    `;
    let countParams = [];
    
    if (search) {
      // Use smart search for collaborators - exact match for collaborator_number, substring for text fields
      const fieldConfigs = [
        { field: 'c.collaborator_number', isId: true },
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.pi_email', isId: false },
        { field: 'c.irb_id', isId: false },
        { field: 'c.internal_contact', isId: false }
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, search, 1);
      countQuery += ` AND ${searchResult.whereClause}`;
      countParams = searchResult.parameters;
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results with project information
    let dataQuery = `
      SELECT c.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'project_number', p.project_number,
              'disease', p.disease,
              'specimen_count', COALESCE(specimen_counts.count, 0)
            ) ORDER BY p.project_number
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS projects
      FROM collaborators c
      LEFT JOIN projects p ON c.id = p.collaborator_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM specimens
        WHERE specimen_number != 0
        GROUP BY project_id
      ) specimen_counts ON p.id = specimen_counts.project_id
      WHERE c.collaborator_number != 0
    `;
    let dataParams = [];
    
    if (search) {
      // Use the same smart search for data query
      const fieldConfigs = [
        { field: 'c.collaborator_number', isId: true },
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.pi_email', isId: false },
        { field: 'c.irb_id', isId: false },
        { field: 'c.internal_contact', isId: false }
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, search, 1);
      const nextParamIndex = searchResult.nextParamIndex;

      dataQuery += ` AND ${searchResult.whereClause}
      GROUP BY c.id
      ORDER BY c.collaborator_number, c.pi_name
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`;
      dataParams = [...searchResult.parameters, limit, offset];
    } else {
      dataQuery += `
      GROUP BY c.id
      ORDER BY c.collaborator_number, c.pi_name
      LIMIT $1 OFFSET $2`;
      dataParams = [limit, offset];
    }
    
    const result = await db.query(dataQuery, dataParams);

    res.json({
      collaborators: result.rows,
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
    logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   GET api/collaborators/:id
// @desc    Get collaborator by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM collaborators WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Collaborator not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   POST api/collaborators
// @desc    Create a collaborator
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('pi_name', 'PI name is required (1-255 chars)').not().isEmpty().isLength({ min: 1, max: 255 }).trim(),
      check('pi_institute', 'PI institute is required (1-255 chars)').not().isEmpty().isLength({ min: 1, max: 255 }).trim(),
      check('pi_email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail().withMessage('PI email must be valid'),
      check('pi_phone').optional({ nullable: true, checkFalsy: true }).isMobilePhone().withMessage('PI phone must be valid format'),
      check('pi_fax').optional().isLength({ max: 50 }).trim().withMessage('PI fax must be under 50 chars'),
      check('irb_id').optional().isLength({ max: 50 }).trim().withMessage('IRB ID must be under 50 chars'),
      check('internal_contact').optional().isLength({ max: 255 }).trim().withMessage('Internal contact must be under 255 chars'),
      check('comments').optional().isLength({ max: 1000 }).trim().withMessage('Comments must be under 1000 chars')
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      irb_id,
      pi_name,
      pi_institute,
      pi_email,
      pi_phone,
      pi_fax,
      internal_contact,
      comments
    } = req.body;

    try {
      // Generate ID at creation time to prevent sequence gaps from failed attempts
      const result = await db.query(
        `INSERT INTO collaborators 
        (irb_id, pi_name, pi_institute, pi_email, pi_phone, pi_fax, internal_contact, comments, collaborator_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, get_next_number('collaborator')) 
        RETURNING *`,
        [irb_id, pi_name, pi_institute, pi_email, pi_phone, pi_fax, internal_contact, comments]
      );

      // Log the action in audit trail
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'CREATE',
          'collaborators',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/collaborators/:id
// @desc    Update a collaborator
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('pi_name', 'PI name is required').not().isEmpty(),
      check('pi_institute', 'PI institute is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      irb_id,
      pi_name,
      pi_institute,
      pi_email,
      pi_phone,
      pi_fax,
      internal_contact,
      comments
    } = req.body;

    try {
      // First check if collaborator exists
      const checkResult = await db.query(
        'SELECT * FROM collaborators WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Collaborator not found' });
      }

      const oldData = checkResult.rows[0];

      // Update the collaborator
      const result = await db.query(
        `UPDATE collaborators
        SET irb_id = $1, pi_name = $2, pi_institute = $3, pi_email = $4,
            pi_phone = $5, pi_fax = $6, internal_contact = $7, comments = $8
        WHERE id = $9
        RETURNING *`,
        [
          irb_id,
          pi_name,
          pi_institute,
          pi_email,
          pi_phone,
          pi_fax,
          internal_contact,
          comments,
          req.params.id
        ]
      );

      // Log the action in audit trail
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'UPDATE',
          'collaborators',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE api/collaborators/:id
// @desc    Delete a collaborator
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // First check if collaborator exists
    const checkResult = await db.query(
      'SELECT * FROM collaborators WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Collaborator not found' });
    }

    const oldData = checkResult.rows[0];

    // Delete the collaborator (cascades to projects and specimens)
    await db.query('DELETE FROM collaborators WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DELETE',
        'collaborators',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );

    res.json({ msg: 'Collaborator removed' });
  } catch (err) {
    logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   GET api/collaborators/:id/projects
// @desc    Get all projects for a collaborator with specimen counts
// @access  Private
router.get('/:id/projects', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
        COALESCE(specimen_counts.count, 0) as specimen_count
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM specimens
        WHERE specimen_number != 0
        GROUP BY project_id
      ) specimen_counts ON p.id = specimen_counts.project_id
      WHERE p.collaborator_id = $1
      ORDER BY p.project_number, p.date_received DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   POST api/collaborators/bulk-import
// @desc    Bulk import collaborators
// @access  Private (admin only)
router.post('/bulk-import', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { collaborators } = req.body;
    
    if (!Array.isArray(collaborators) || collaborators.length === 0) {
      return res.status(400).json({ msg: 'No collaborators provided for import' });
    }
    
    // Get a client for transaction
    const client = await db.getClient();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      const results = [];
      
      // Process each collaborator
      for (const collaborator of collaborators) {
        const {
          irb_id,
          pi_name,
          pi_institute,
          pi_email,
          pi_phone,
          pi_fax,
          internal_contact,
          comments
        } = collaborator;
        
        if (!pi_name || !pi_institute) {
          throw new Error('PI name and institute are required for each collaborator');
        }
        
        // Create the collaborator
        const result = await client.query(
          `INSERT INTO collaborators 
          (irb_id, pi_name, pi_institute, pi_email, pi_phone, pi_fax, internal_contact, comments) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            irb_id || null,
            pi_name,
            pi_institute,
            pi_email || null,
            pi_phone || null,
            pi_fax || null,
            internal_contact || null,
            comments || null
          ]
        );
        
        // Log collaborator creation
        await client.query(
          `INSERT INTO audit_log 
          (user_id, action, table_name, record_id, changed_fields) 
          VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'CREATE',
            'collaborators',
            result.rows[0].id,
            JSON.stringify(collaborator)
          ]
        );
        
        results.push(result.rows[0]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.json({
        msg: `Successfully imported ${results.length} collaborators`,
        imported: results.length,
        collaborators: results
      });
    } catch (err) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      throw err;
    } finally {
      // Release client
      client.release();
    }
  } catch (err) {
    logger.error('Database error in collaborators GET', { error: err.message, stack: err.stack });
    res.status(500).send('Server error during bulk import: ' + err.message);
  }
});

module.exports = router;