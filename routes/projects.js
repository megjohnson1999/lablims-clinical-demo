const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');

// @route   GET api/projects
// @desc    Get all projects
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const searchField = req.query.field?.trim() || '';

    // Get total count for pagination info
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      WHERE p.project_number != 0
    `;
    let countParams = [];
    
    if (search) {
      if (searchField) {
        // Field-specific search
        let fieldCondition, parameter;
        const { getSearchCondition } = require('../utils/searchUtils');
        
        switch (searchField) {
          case 'project_number':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.project_number', search, true));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'disease':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.disease', search, false));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'specimen_type':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.specimen_type', search, false));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'source':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.source', search, false));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'pi_name':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.pi_name', search, false));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'pi_institute':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.pi_institute', search, false));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          case 'collaborator_number':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.collaborator_number', search, true));
            countQuery += ` AND ${fieldCondition}$1`;
            break;
          default:
            // Fallback to all fields if field not recognized
            const fieldConfigs = [
              { field: 'p.project_number', isId: true },
              { field: 'p.disease', isId: false },
              { field: 'p.specimen_type', isId: false },
              { field: 'p.source', isId: false },
              { field: 'c.pi_name', isId: false },
              { field: 'c.pi_institute', isId: false },
              { field: 'c.collaborator_number', isId: true }
            ];
            
            const searchResult = buildSearchClause(fieldConfigs, search, 1);
            countQuery += ` AND ${searchResult.whereClause}`;
            countParams = searchResult.parameters;
            break;
        }
        
        if (!countParams.length) {
          countParams = [parameter];
        }
      } else {
        // Search all fields (existing behavior)
        const fieldConfigs = [
          { field: 'p.project_number', isId: true },
          { field: 'p.disease', isId: false },
          { field: 'p.specimen_type', isId: false },
          { field: 'p.source', isId: false },
          { field: 'c.pi_name', isId: false },
          { field: 'c.pi_institute', isId: false },
          { field: 'c.collaborator_number', isId: true }
        ];
        
        const searchResult = buildSearchClause(fieldConfigs, search, 1);
        countQuery += ` AND (${searchResult.whereClause})`;
        countParams = searchResult.parameters;
      }
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results with specimen counts
    let dataQuery = `
      SELECT p.*, c.pi_name, c.pi_institute, c.collaborator_number,
        COALESCE(specimen_counts.count, 0) as specimen_count
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM specimens
        WHERE specimen_number != 0
        GROUP BY project_id
      ) specimen_counts ON p.id = specimen_counts.project_id
      WHERE p.project_number != 0
    `;
    let dataParams = [];
    
    if (search) {
      if (searchField) {
        // Use same field-specific search for data query
        let fieldCondition, parameter;
        const { getSearchCondition } = require('../utils/searchUtils');
        
        switch (searchField) {
          case 'project_number':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.project_number', search, true));
            break;
          case 'disease':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.disease', search, false));
            break;
          case 'specimen_type':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.specimen_type', search, false));
            break;
          case 'source':
            ({ condition: fieldCondition, parameter } = getSearchCondition('p.source', search, false));
            break;
          case 'pi_name':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.pi_name', search, false));
            break;
          case 'pi_institute':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.pi_institute', search, false));
            break;
          case 'collaborator_number':
            ({ condition: fieldCondition, parameter } = getSearchCondition('c.collaborator_number', search, true));
            break;
          default:
            // Fallback to all fields
            const fieldConfigs = [
              { field: 'p.project_number', isId: true },
              { field: 'p.disease', isId: false },
              { field: 'p.specimen_type', isId: false },
              { field: 'p.source', isId: false },
              { field: 'c.pi_name', isId: false },
              { field: 'c.pi_institute', isId: false },
              { field: 'c.collaborator_number', isId: true }
            ];
            
            const searchResult = buildSearchClause(fieldConfigs, search, 1);
            const nextParamIndex = searchResult.nextParamIndex;
            
            dataQuery += ` AND ${searchResult.whereClause} ORDER BY p.project_number, p.date_received DESC
            LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`;
            dataParams = [...searchResult.parameters, limit, offset];
            break;
        }
        
        if (!dataParams.length) {
          dataQuery += ` AND ${fieldCondition}$1 ORDER BY p.project_number, p.date_received DESC
          LIMIT $2 OFFSET $3`;
          dataParams = [parameter, limit, offset];
        }
      } else {
        // Search all fields (existing behavior)
        const fieldConfigs = [
          { field: 'p.project_number', isId: true },
          { field: 'p.disease', isId: false },
          { field: 'p.specimen_type', isId: false },
          { field: 'p.source', isId: false },
          { field: 'c.pi_name', isId: false },
          { field: 'c.pi_institute', isId: false },
          { field: 'c.collaborator_number', isId: true }
        ];
        
        const searchResult = buildSearchClause(fieldConfigs, search, 1);
        const nextParamIndex = searchResult.nextParamIndex;
        
        dataQuery += ` AND (${searchResult.whereClause}) ORDER BY p.project_number, p.date_received DESC
        LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`;
        dataParams = [...searchResult.parameters, limit, offset];
      }
    } else {
      dataQuery += ` ORDER BY p.project_number, p.date_received DESC
      LIMIT $1 OFFSET $2`;
      dataParams = [limit, offset];
    }
    
    const result = await db.query(dataQuery, dataParams);

    res.json({
      projects: result.rows,
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

// @route   GET api/projects/with-metadata
// @desc    Get projects that have specimens with metadata
// @access  Private
router.get('/with-metadata', auth, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        p.id,
        p.project_number,
        p.disease,
        p.specimen_type,
        p.source,
        p.date_received,
        p.feedback_date,
        p.comments,
        p.created_at,
        p.updated_at,
        c.id as collaborator_id,
        c.pi_name,
        c.pi_institute,
        COUNT(s.id) as specimen_count,
        COUNT(CASE WHEN s.metadata IS NOT NULL AND s.metadata != '{}' THEN 1 END) as metadata_count
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      JOIN specimens s ON p.id = s.project_id
      WHERE p.project_number != 0 
        AND s.metadata IS NOT NULL 
        AND s.metadata != '{}'
      GROUP BY p.id, c.id, c.pi_name, c.pi_institute
      ORDER BY p.project_number ASC
    `;

    const result = await db.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      projects: result.rows
    });

  } catch (err) {
    logger.error('Error fetching projects with metadata:', err.message);
    res.status(500).json({ 
      success: false,
      msg: 'Failed to fetch projects with metadata',
      error: err.message 
    });
  }
});

// @route   GET api/projects/:id
// @desc    Get project by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.pi_name, c.pi_institute 
       FROM projects p
       JOIN collaborators c ON p.collaborator_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects
// @desc    Create a project
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('collaborator_id', 'Collaborator ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      collaborator_id,
      disease,
      specimen_type,
      source,
      date_received,
      feedback_date,
      comments
    } = req.body;

    try {
      // Verify collaborator exists
      const collaboratorCheck = await db.query(
        'SELECT * FROM collaborators WHERE id = $1',
        [collaborator_id]
      );

      if (collaboratorCheck.rows.length === 0) {
        return res.status(400).json({ msg: 'Collaborator not found' });
      }

      const result = await db.query(
        `INSERT INTO projects 
        (collaborator_id, disease, specimen_type, source, date_received, feedback_date, comments, project_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, get_next_number('project')) 
        RETURNING *`,
        [collaborator_id, disease, specimen_type, source, date_received, feedback_date, comments]
      );

      // Log the action in audit trail
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'CREATE',
          'projects',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      // Return the project with collaborator info
      const projectWithCollaborator = await db.query(
        `SELECT p.*, c.pi_name, c.pi_institute 
         FROM projects p
         JOIN collaborators c ON p.collaborator_id = c.id
         WHERE p.id = $1`,
        [result.rows[0].id]
      );

      res.json(projectWithCollaborator.rows[0]);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/projects/:id
// @desc    Update a project
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('collaborator_id', 'Collaborator ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      collaborator_id,
      disease,
      specimen_type,
      source,
      date_received,
      feedback_date,
      comments,
      project_number
    } = req.body;

    try {
      // First check if project exists
      const checkResult = await db.query(
        'SELECT * FROM projects WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Project not found' });
      }

      const oldData = checkResult.rows[0];

      // Verify collaborator exists
      const collaboratorCheck = await db.query(
        'SELECT * FROM collaborators WHERE id = $1',
        [collaborator_id]
      );

      if (collaboratorCheck.rows.length === 0) {
        return res.status(400).json({ msg: 'Collaborator not found' });
      }

      // Update the project
      const result = await db.query(
        `UPDATE projects
        SET collaborator_id = $1, disease = $2, specimen_type = $3, source = $4,
            date_received = $5, feedback_date = $6, comments = $7, project_number = $8
        WHERE id = $9
        RETURNING *`,
        [
          collaborator_id,
          disease,
          specimen_type,
          source,
          date_received,
          feedback_date,
          comments,
          project_number,
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
          'projects',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      // Return the project with collaborator info
      const projectWithCollaborator = await db.query(
        `SELECT p.*, c.pi_name, c.pi_institute 
         FROM projects p
         JOIN collaborators c ON p.collaborator_id = c.id
         WHERE p.id = $1`,
        [req.params.id]
      );

      res.json(projectWithCollaborator.rows[0]);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE api/projects/:id
// @desc    Delete a project
// @access  Private (admin only)
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // First check if project exists
    const checkResult = await db.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const oldData = checkResult.rows[0];

    // Delete the project (cascades to specimens)
    await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'DELETE',
        'projects',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );

    res.json({ msg: 'Project removed' });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/projects/:id/specimens
// @desc    Get all specimens for a project
// @access  Private
router.get('/:id/specimens', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, p.external_id as patient_external_id,
         CONCAT(p.first_name, ' ', p.last_name) as patient_name
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       WHERE s.project_id = $1
       ORDER BY s.specimen_number::integer ASC NULLS LAST, s.tube_id ASC NULLS LAST`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects/bulk-import
// @desc    Bulk import projects
// @access  Private (admin only)
router.post('/bulk-import', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { projects } = req.body;
    
    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ msg: 'No projects provided for import' });
    }
    
    // Get a client for transaction
    const client = await db.getClient();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      const results = [];
      
      // Process each project
      for (const project of projects) {
        const {
          collaborator_id,
          disease,
          specimen_type,
          source,
          date_received,
          feedback_date,
          comments,
          project_number,
          // Optional: if we want to identify collaborator by name/institute instead of ID
          pi_name,
          pi_institute
        } = project;
        
        let actualCollaboratorId = collaborator_id;
        
        // If collaborator_id is not provided but pi_name and pi_institute are, try to find the collaborator
        if (!actualCollaboratorId && pi_name && pi_institute) {
          const collaboratorCheck = await client.query(
            'SELECT id FROM collaborators WHERE pi_name = $1 AND pi_institute = $2',
            [pi_name, pi_institute]
          );
          
          if (collaboratorCheck.rows.length > 0) {
            actualCollaboratorId = collaboratorCheck.rows[0].id;
          } else {
            throw new Error(`Collaborator with name "${pi_name}" and institute "${pi_institute}" not found`);
          }
        }
        
        if (!actualCollaboratorId) {
          throw new Error('Collaborator ID is required for each project');
        }
        
        // Verify collaborator exists
        const collaboratorCheck = await client.query(
          'SELECT * FROM collaborators WHERE id = $1',
          [actualCollaboratorId]
        );

        if (collaboratorCheck.rows.length === 0) {
          throw new Error(`Collaborator with ID ${actualCollaboratorId} not found`);
        }
        
        // Create the project
        const result = await client.query(
          `INSERT INTO projects 
          (collaborator_id, disease, specimen_type, source, date_received, feedback_date, comments, project_number) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            actualCollaboratorId,
            disease || null,
            specimen_type || null,
            source || null,
            date_received || null,
            feedback_date || null,
            comments || null,
            project_number || null
          ]
        );
        
        // Log project creation
        await client.query(
          `INSERT INTO audit_log 
          (user_id, action, table_name, record_id, changed_fields) 
          VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'CREATE',
            'projects',
            result.rows[0].id,
            JSON.stringify(project)
          ]
        );
        
        // Add collaborator info to the result
        const projectWithCollaborator = await client.query(
          `SELECT p.*, c.pi_name, c.pi_institute 
           FROM projects p
           JOIN collaborators c ON p.collaborator_id = c.id
           WHERE p.id = $1`,
          [result.rows[0].id]
        );
        
        results.push(projectWithCollaborator.rows[0]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.json({
        msg: `Successfully imported ${results.length} projects`,
        imported: results.length,
        projects: results
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

// @route   GET api/projects/:id/legacy-id
// @desc    Get legacy ID for a project
// @access  Private
router.get('/:id/legacy-id', auth, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Get project number using clean unified schema
    const projectResult = await db.query(`
      SELECT project_number 
      FROM projects 
      WHERE id = $1
    `, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.json({ project_number: null });
    }
    
    res.json({ project_number: projectResult.rows[0].project_number });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error while fetching legacy ID');
  }
});

module.exports = router;