const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');

// @route   GET api/patients
// @desc    Get all patients with pagination and search
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
      FROM patients
    `;
    let countParams = [];
    
    if (search) {
      // Use smart search for patients - exact match for IDs, substring for text fields
      const fieldConfigs = [
        { field: 'external_id', isId: false }, // External ID might contain letters, so treat as text
        { field: 'first_name', isId: false },
        { field: 'last_name', isId: false },
        { field: 'diagnosis', isId: false },
        { field: 'medical_record_number', isId: false } // MRN often contains letters, so treat as text
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, search, 1);
      countQuery += ` WHERE ${searchResult.whereClause}`;
      countParams = searchResult.parameters;
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    let dataQuery = `
      SELECT * 
      FROM patients
    `;
    let dataParams = [];
    
    if (search) {
      // Use the same smart search for data query
      const fieldConfigs = [
        { field: 'external_id', isId: false },
        { field: 'first_name', isId: false },
        { field: 'last_name', isId: false },
        { field: 'diagnosis', isId: false },
        { field: 'medical_record_number', isId: false }
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, search, 1);
      const nextParamIndex = searchResult.nextParamIndex;
      
      dataQuery += ` WHERE ${searchResult.whereClause} ORDER BY patient_number, last_name, first_name
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`;
      dataParams = [...searchResult.parameters, limit, offset];
    } else {
      dataQuery += ` ORDER BY patient_number, last_name, first_name
      LIMIT $1 OFFSET $2`;
      dataParams = [limit, offset];
    }
    
    const result = await db.query(dataQuery, dataParams);

    res.json({
      patients: result.rows,
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

// @route   GET api/patients/search
// @desc    Search patients
// @access  Private
router.get('/search', auth, async (req, res) => {
  const { term } = req.query;
  
  if (!term) {
    return res.status(400).json({ msg: 'Search term is required' });
  }
  
  try {
    // Use smart search for patient search endpoint
    const fieldConfigs = [
      { field: 'external_id', isId: false },
      { field: 'first_name', isId: false },
      { field: 'last_name', isId: false },
      { field: 'diagnosis', isId: false }
    ];
    
    const searchResult = buildSearchClause(fieldConfigs, term, 1);
    
    const result = await db.query(
      `SELECT * FROM patients 
       WHERE ${searchResult.whereClause}
       ORDER BY last_name, first_name`,
      searchResult.parameters
    );
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/patients/:id
// @desc    Get patient by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/patients
// @desc    Create a patient
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('external_id', 'External ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      external_id,
      first_name,
      last_name,
      date_of_birth,
      diagnosis,
      physician_first_name,
      physician_last_name,
      comments,
      patient_number
    } = req.body;

    try {
      // Check if patient with this external_id already exists
      const patientCheck = await db.query(
        'SELECT * FROM patients WHERE external_id = $1',
        [external_id]
      );

      if (patientCheck.rows.length > 0) {
        return res.status(400).json({ msg: 'Patient with this External ID already exists' });
      }

      // Generate ID at creation time to prevent sequence gaps from failed attempts
      const result = await db.query(
        `INSERT INTO patients 
        (external_id, first_name, last_name, date_of_birth, diagnosis, 
        physician_first_name, physician_last_name, comments, patient_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, get_next_number('patient')) 
        RETURNING *`,
        [
          external_id,
          first_name,
          last_name,
          date_of_birth,
          diagnosis,
          physician_first_name,
          physician_last_name,
          comments
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
          'patients',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/patients/:id
// @desc    Update a patient
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('external_id', 'External ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      external_id,
      first_name,
      last_name,
      date_of_birth,
      diagnosis,
      physician_first_name,
      physician_last_name,
      comments,
      patient_number
    } = req.body;

    try {
      // First check if patient exists
      const checkResult = await db.query(
        'SELECT * FROM patients WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Patient not found' });
      }

      const oldData = checkResult.rows[0];

      // Check if this external_id is already used by another patient
      const externalIdCheck = await db.query(
        'SELECT * FROM patients WHERE external_id = $1 AND id != $2',
        [external_id, req.params.id]
      );

      if (externalIdCheck.rows.length > 0) {
        return res.status(400).json({ msg: 'External ID is already in use by another patient' });
      }

      // Update the patient
      const result = await db.query(
        `UPDATE patients
        SET external_id = $1, first_name = $2, last_name = $3, date_of_birth = $4,
            diagnosis = $5, physician_first_name = $6, physician_last_name = $7,
            comments = $8, patient_number = $9
        WHERE id = $10
        RETURNING *`,
        [
          external_id,
          first_name,
          last_name,
          date_of_birth,
          diagnosis,
          physician_first_name,
          physician_last_name,
          comments,
          patient_number,
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
          'patients',
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

// @route   DELETE api/patients/:id
// @desc    Delete a patient
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // First check if patient exists
    const checkResult = await db.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    const oldData = checkResult.rows[0];

    // Check if specimens reference this patient
    const specimenCheck = await db.query(
      'SELECT COUNT(*) FROM specimens WHERE patient_id = $1',
      [req.params.id]
    );

    if (parseInt(specimenCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        msg: 'Cannot delete patient with associated specimens. Update or delete the specimens first.' 
      });
    }

    // Delete the patient
    await db.query('DELETE FROM patients WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DELETE',
        'patients',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );

    res.json({ msg: 'Patient removed' });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/patients/:id/specimens
// @desc    Get all specimens for a patient
// @access  Private
router.get('/:id/specimens', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, p.disease, p.specimen_type,
         c.pi_name, c.pi_institute
       FROM specimens s
       JOIN projects p ON s.project_id = p.id
       JOIN collaborators c ON p.collaborator_id = c.id
       WHERE s.patient_id = $1
       ORDER BY s.date_collected DESC`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/patients/bulk-import
// @desc    Bulk import patients
// @access  Private (admin only)
router.post('/bulk-import', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { patients } = req.body;
    
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ msg: 'No patients provided for import' });
    }
    
    // Get a client for transaction
    const client = await db.getClient();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      const results = [];
      const skipped = [];
      
      // Process each patient
      for (const patient of patients) {
        const {
          external_id,
          first_name,
          last_name,
          date_of_birth,
          diagnosis,
          physician_first_name,
          physician_last_name,
          comments
        } = patient;
        
        if (!external_id) {
          throw new Error('External ID is required for each patient');
        }
        
        // Check if patient with this external_id already exists
        const patientCheck = await client.query(
          'SELECT * FROM patients WHERE external_id = $1',
          [external_id]
        );

        if (patientCheck.rows.length > 0) {
          // Skip existing patients but add to skipped list
          skipped.push({
            external_id,
            reason: 'Patient with this External ID already exists'
          });
          continue;
        }
        
        // Create the patient
        const result = await client.query(
          `INSERT INTO patients 
          (external_id, first_name, last_name, date_of_birth, diagnosis, 
          physician_first_name, physician_last_name, comments) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            external_id,
            first_name || null,
            last_name || null,
            date_of_birth || null,
            diagnosis || null,
            physician_first_name || null,
            physician_last_name || null,
            comments || null
          ]
        );
        
        // Log patient creation
        await client.query(
          `INSERT INTO audit_log 
          (user_id, action, table_name, record_id, changed_fields) 
          VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'CREATE',
            'patients',
            result.rows[0].id,
            JSON.stringify(patient)
          ]
        );
        
        results.push(result.rows[0]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.json({
        msg: `Successfully imported ${results.length} patients. Skipped ${skipped.length} patients.`,
        imported: results.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        patients: results
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
    logger.error(err.message);
    res.status(500).send('Server error during bulk import: ' + err.message);
  }
});

module.exports = router;