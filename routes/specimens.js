const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const multer = require('multer');
const XLSX = require('xlsx');
const { FILE_UPLOAD } = require('../config/constants');
const logger = require('../utils/logger');
const { buildSearchClause, getSearchCondition } = require('../utils/searchUtils');
const { createErrorResponse, handleDatabaseError, withErrorHandling } = require('../utils/errorHandling');
const { analyzeMetadataFields } = require('../utils/metadataAnalytics');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx) and CSV files are allowed.'));
    }
  }
});

// @route   GET api/specimens
// @desc    Get all specimens (with pagination and metadata filtering) 
// @access  Private
router.get('/', auth, async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    project_id,
    searchTerm,
    // Metadata filters (format: metadata.field_name=value or metadata.field_name>value)
    ...queryParams 
  } = req.query;
  const offset = (page - 1) * limit;
  
  
  try {
    // Extract metadata filters from query parameters
    const metadataFilters = {};
    const metadataComparisons = {};
    
    Object.keys(queryParams).forEach(key => {
      if (key.startsWith('metadata.')) {
        const fieldName = key.substring(9); // Remove 'metadata.' prefix
        const value = queryParams[key];
        
        // Check for comparison operators
        if (value.startsWith('>')) {
          metadataComparisons[fieldName] = { op: '>', value: value.substring(1) };
        } else if (value.startsWith('<')) {
          metadataComparisons[fieldName] = { op: '<', value: value.substring(1) };
        } else if (value.startsWith('=')) {
          metadataFilters[fieldName] = value.substring(1);
        } else {
          metadataFilters[fieldName] = value;
        }
      }
    });
    
    // Build WHERE conditions
    let whereConditions = [];
    let queryParamsArray = [];
    let paramIndex = 1;
    
    // Project filter
    if (project_id) {
      whereConditions.push(`s.project_id = $${paramIndex}`);
      queryParamsArray.push(project_id);
      paramIndex++;
    }
    
    // Search term filter (searches across multiple fields)
    if (searchTerm && searchTerm.trim()) {
      const fieldConfigs = [
        // Specimen fields
        { field: 's.tube_id', isId: false },
        { field: 's.position_freezer', isId: false },
        { field: 's.position_rack', isId: false },
        { field: 's.position_box', isId: false },
        { field: 's.position_dimension_one', isId: false },
        { field: 's.position_dimension_two', isId: false },
        { field: 's.specimen_site', isId: false },
        { field: 's.comments', isId: false },
        { field: 's.specimen_number', isId: true },
        // Patient fields
        { field: 'p.external_id', isId: false },
        { field: 'p.first_name', isId: false },
        { field: 'p.last_name', isId: false },
        // Collaborator fields
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.collaborator_number', isId: true },
        // Project fields
        { field: 'proj.disease', isId: false },
        { field: 'proj.specimen_type', isId: false },
        { field: 'proj.project_number', isId: true }
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, searchTerm.trim(), paramIndex);
      whereConditions.push(`(${searchResult.whereClause})`);
      queryParamsArray.push(...searchResult.parameters);
      paramIndex += searchResult.parameters.length;
    }
    
    // Handle regular field filters with multi-value support
    const regularFilters = ['specimen_type', 'disease', 'position_freezer', 'tube_id', 'specimen_number', 'collaboratorId', 'projectId'];
    
    regularFilters.forEach(field => {
      const value = queryParams[field];
      if (value) {
        // Check if it's a comma-separated list (multi-value)
        if (value.includes(',')) {
          const values = value.split(',').map(v => v.trim()).filter(Boolean);
          if (values.length > 0) {
            const placeholders = values.map(() => `$${paramIndex++}`).join(',');
            
            // Map field names to actual table columns
            let dbColumn;
            switch (field) {
              case 'specimen_type':
                dbColumn = 'proj.specimen_type';
                break;
              case 'disease':
                dbColumn = 'proj.disease';
                break;
              case 'position_freezer':
                dbColumn = 's.position_freezer';
                break;
              case 'tube_id':
                dbColumn = 's.tube_id';
                break;
              case 'specimen_number':
                dbColumn = 's.specimen_number';
                break;
              case 'collaboratorId':
                dbColumn = 'c.id';
                break;
              case 'projectId':
                dbColumn = 'proj.id';
                break;
            }
            
            if (dbColumn) {
              whereConditions.push(`${dbColumn} IN (${placeholders})`);
              queryParamsArray.push(...values);
            }
          }
        } else {
          // Single value filter
          let dbColumn;
          switch (field) {
            case 'specimen_type':
              dbColumn = 'proj.specimen_type';
              break;
            case 'disease':
              dbColumn = 'proj.disease';
              break;
            case 'position_freezer':
              dbColumn = 's.position_freezer';
              break;
            case 'tube_id':
              dbColumn = 's.tube_id';
              break;
            case 'specimen_number':
              dbColumn = 's.specimen_number';
              break;
            case 'collaboratorId':
              dbColumn = 'c.id';
              break;
            case 'projectId':
              dbColumn = 'proj.id';
              break;
          }
          
          if (dbColumn) {
            // Use exact match for UUID fields, pattern match for text fields
            if (field === 'collaboratorId' || field === 'projectId') {
              whereConditions.push(`${dbColumn} = $${paramIndex}`);
              queryParamsArray.push(value);
            } else {
              whereConditions.push(`${dbColumn} ILIKE $${paramIndex}`);
              queryParamsArray.push(`%${value}%`);
            }
            paramIndex++;
          }
        }
      }
    });
    
    // Metadata exact match filters
    if (Object.keys(metadataFilters).length > 0) {
      whereConditions.push(`s.metadata @> $${paramIndex}::jsonb`);
      queryParamsArray.push(JSON.stringify(metadataFilters));
      paramIndex++;
    }
    
    // Metadata comparison filters
    Object.entries(metadataComparisons).forEach(([fieldName, { op, value }]) => {
      if (op === '>' || op === '<') {
        // Handle numeric comparisons
        whereConditions.push(`(s.metadata->>'${fieldName}')::numeric ${op} $${paramIndex}`);
        queryParamsArray.push(parseFloat(value));
        paramIndex++;
      }
    });
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM specimens s 
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       JOIN collaborators c ON proj.collaborator_id = c.id
       ${whereClause}`;
    const countResult = await db.query(countQuery, queryParamsArray);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Data query with pagination
    const dataQuery = `
      SELECT s.*, 
        p.external_id as patient_external_id,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        proj.disease, proj.specimen_type, proj.project_number,
        c.pi_name, c.pi_institute, c.collaborator_number
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       JOIN collaborators c ON proj.collaborator_id = c.id
       ${whereClause}
       ORDER BY s.specimen_number::integer ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParamsArray.push(limit, offset);
    const result = await db.query(dataQuery, queryParamsArray);
    
    res.json({
      specimens: result.rows,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch specimens', 'specimen', null, { page, limit, project_id });
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/specimens/search
// @desc    Search specimens
// @access  Private
router.get('/search', auth, async (req, res) => {
  const { term, field } = req.query;
  
  if (!term) {
    return res.status(400).json({ msg: 'Search term is required' });
  }
  
  let query;
  let params;
  
  try {
    // Base query with all required joins
    const baseQuery = `
      SELECT s.*, 
        p.external_id as patient_external_id,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        proj.disease, proj.specimen_type, proj.project_number,
        c.pi_name, c.pi_institute, c.collaborator_number
      FROM specimens s
      LEFT JOIN patients p ON s.patient_id = p.id
      JOIN projects proj ON s.project_id = proj.id
      JOIN collaborators c ON proj.collaborator_id = c.id
    `;
    
    // If specific field is provided, search in that field with smart ID matching
    if (field) {
      let fieldCondition, parameter;
      
      switch (field) {
        case 'tube_id':
          ({ condition: fieldCondition, parameter } = getSearchCondition('s.tube_id', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'position_freezer':
          ({ condition: fieldCondition, parameter } = getSearchCondition('s.position_freezer', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'position_rack':
          ({ condition: fieldCondition, parameter } = getSearchCondition('s.position_rack', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'position_box':
          ({ condition: fieldCondition, parameter } = getSearchCondition('s.position_box', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'patient':
          // Multiple patient fields - keep substring matching for names
          query = `${baseQuery} WHERE p.external_id ILIKE $1 OR p.first_name ILIKE $1 OR p.last_name ILIKE $1`;
          parameter = `%${term}%`;
          break;
        case 'collaborator':
          // Multiple collaborator fields - keep substring matching
          query = `${baseQuery} WHERE c.pi_name ILIKE $1 OR c.pi_institute ILIKE $1`;
          parameter = `%${term}%`;
          break;
        case 'project':
          // Project number is an ID field - use exact matching
          ({ condition: fieldCondition, parameter } = getSearchCondition('proj.project_number', term, true));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'disease':
          ({ condition: fieldCondition, parameter } = getSearchCondition('proj.disease', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        case 'specimen_type':
          ({ condition: fieldCondition, parameter } = getSearchCondition('proj.specimen_type', term, false));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        // Note: sequencing_run_id and analysis_status columns don't exist in current schema
        case 'specimen_number':
          // Specimen number is an ID field - use exact matching
          ({ condition: fieldCondition, parameter } = getSearchCondition('s.specimen_number', term, true));
          query = `${baseQuery} WHERE ${fieldCondition}$1`;
          break;
        default:
          // Default case - search across multiple fields with smart matching
          const fieldConfigs = [
            { field: 's.tube_id', isId: false },
            { field: 's.position_freezer', isId: false },
            { field: 's.position_rack', isId: false },
            { field: 's.position_box', isId: false },
            { field: 's.position_dimension_one', isId: false },
            { field: 's.position_dimension_two', isId: false },
            { field: 's.specimen_site', isId: false },
            { field: 's.comments', isId: false },
            { field: 's.specimen_number', isId: true },
            { field: 'proj.disease', isId: false },
            { field: 'proj.specimen_type', isId: false }
          ];
          
          const searchResult = buildSearchClause(fieldConfigs, term, 1);
          query = `${baseQuery} WHERE ${searchResult.whereClause}`;
          params = searchResult.parameters;
          break;
      }
      
      if (!params) {
        params = [parameter];
      }
    } else {
      // No specific field - search across all relevant fields with smart ID matching
      const fieldConfigs = [
        // Specimen fields
        { field: 's.tube_id', isId: false },
        { field: 's.position_freezer', isId: false },
        { field: 's.position_rack', isId: false },
        { field: 's.position_box', isId: false },
        { field: 's.position_dimension_one', isId: false },
        { field: 's.position_dimension_two', isId: false },
        { field: 's.specimen_site', isId: false },
        { field: 's.comments', isId: false },
        { field: 's.specimen_number', isId: true },
        // Patient fields
        { field: 'p.external_id', isId: false },
        { field: 'p.first_name', isId: false },
        { field: 'p.last_name', isId: false },
        // Collaborator fields
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.collaborator_number', isId: true },
        // Project fields
        { field: 'proj.disease', isId: false },
        { field: 'proj.specimen_type', isId: false },
        { field: 'proj.project_number', isId: true }
      ];
      
      const searchResult = buildSearchClause(fieldConfigs, term, 1);
      query = `${baseQuery} WHERE ${searchResult.whereClause}`;
      params = searchResult.parameters;
    }
    
    // Finalize the query with ordering
    query += ` ORDER BY s.specimen_number ASC`;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'search specimens', 'specimen', null, { term, field });
    res.status(500).json(errorResponse);
  }
});

// @route   POST api/specimens/bulk-search
// @desc    Search for multiple specimens by ID, tube ID, or other identifiers
// @access  Private
router.post('/bulk-search', auth, async (req, res) => {
  const { identifiers, searchField = 'auto' } = req.body;
  
  if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
    return res.status(400).json({ msg: 'Identifiers array is required and cannot be empty' });
  }
  
  if (identifiers.length > 1000) {
    return res.status(400).json({ msg: 'Maximum 1000 identifiers allowed per bulk search' });
  }
  
  try {
    // Clean and deduplicate identifiers
    const cleanIdentifiers = [...new Set(identifiers.map(id => String(id).trim()).filter(Boolean))];
    
    if (cleanIdentifiers.length === 0) {
      return res.status(400).json({ msg: 'No valid identifiers provided' });
    }
    
    // Base query with all required joins
    const baseQuery = `
      SELECT s.*, 
        p.external_id as patient_external_id,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        proj.disease, proj.specimen_type, proj.project_number,
        c.pi_name, c.pi_institute, c.collaborator_number
      FROM specimens s
      LEFT JOIN patients p ON s.patient_id = p.id
      JOIN projects proj ON s.project_id = proj.id
      JOIN collaborators c ON proj.collaborator_id = c.id
    `;
    
    let query, params;
    
    // Determine search strategy based on searchField parameter
    switch (searchField) {
      case 'specimen_number':
        // Search only by specimen number (ID field - supports both numeric and exact string matching)
        const numericIds = cleanIdentifiers.filter(id => /^\d+$/.test(id)).map(id => parseInt(id));
        const stringIds = cleanIdentifiers.filter(id => !/^\d+$/.test(id));
        
        if (numericIds.length > 0 && stringIds.length > 0) {
          query = `${baseQuery} WHERE s.specimen_number = ANY($1::int[]) OR s.specimen_number::text = ANY($2::text[])`;
          params = [numericIds, stringIds];
        } else if (numericIds.length > 0) {
          query = `${baseQuery} WHERE s.specimen_number = ANY($1::int[])`;
          params = [numericIds];
        } else {
          query = `${baseQuery} WHERE s.specimen_number::text = ANY($1::text[])`;
          params = [stringIds];
        }
        break;
        
      case 'tube_id':
        // Search only by tube ID
        query = `${baseQuery} WHERE s.tube_id = ANY($1::text[])`;
        params = [cleanIdentifiers];
        break;
        
      case 'auto':
      default:
        // Smart auto-detect: prioritize exact matches and avoid broad searching
        // Strategy: Try specimen_number first (most common), then tube_id for non-numeric
        const numericIdentifiers = cleanIdentifiers.filter(id => /^\d+$/.test(id)).map(id => parseInt(id));
        const nonNumericIdentifiers = cleanIdentifiers.filter(id => !/^\d+$/.test(id));
        
        if (numericIdentifiers.length > 0 && nonNumericIdentifiers.length > 0) {
          // Mixed identifiers: search specimen numbers for numeric, tube_id for non-numeric
          query = `${baseQuery} WHERE 
            s.specimen_number = ANY($1::int[]) OR
            s.tube_id = ANY($2::text[])`;
          params = [numericIdentifiers, nonNumericIdentifiers];
        } else if (numericIdentifiers.length > 0) {
          // Only numeric identifiers: search only specimen numbers
          query = `${baseQuery} WHERE s.specimen_number = ANY($1::int[])`;
          params = [numericIdentifiers];
        } else {
          // Only non-numeric identifiers: search only tube_id (most likely for alphanumeric codes)
          query = `${baseQuery} WHERE s.tube_id = ANY($1::text[])`;
          params = [nonNumericIdentifiers];
        }
        break;
    }
    
    // Add ordering
    query += ` ORDER BY s.specimen_number ASC`;
    
    const result = await db.query(query, params);
    
    // Analyze results to provide helpful feedback
    const foundSpecimens = result.rows;
    const foundIdentifiers = new Set();
    
    // Extract identifiers that were found from the results
    foundSpecimens.forEach(specimen => {
      // Check various fields to see which identifier matched
      if (cleanIdentifiers.includes(String(specimen.specimen_number))) {
        foundIdentifiers.add(String(specimen.specimen_number));
      }
      if (specimen.tube_id && cleanIdentifiers.includes(specimen.tube_id)) {
        foundIdentifiers.add(specimen.tube_id);
      }
      if (specimen.patient_external_id && cleanIdentifiers.includes(specimen.patient_external_id)) {
        foundIdentifiers.add(specimen.patient_external_id);
      }
    });
    
    // Determine missing identifiers
    const missingIdentifiers = cleanIdentifiers.filter(id => !foundIdentifiers.has(id));
    
    // Return comprehensive results
    res.json({
      specimens: foundSpecimens,
      summary: {
        total_searched: cleanIdentifiers.length,
        found_count: foundSpecimens.length,
        missing_count: missingIdentifiers.length,
        search_field: searchField,
        found_identifiers: Array.from(foundIdentifiers),
        missing_identifiers: missingIdentifiers
      }
    });
    
  } catch (err) {
    logger.error('Bulk search error', { error: err.message, identifiers: identifiers?.slice(0, 5) });
    const errorResponse = handleDatabaseError(err, 'bulk search specimens', 'specimen', null, { 
      identifiers_count: identifiers?.length,
      search_field: searchField 
    });
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/specimens/:id
// @desc    Get specimen by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, 
        p.external_id as patient_external_id,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        proj.disease, proj.specimen_type,
        c.pi_name, c.pi_institute,
        proj.project_number, c.collaborator_number
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       JOIN collaborators c ON proj.collaborator_id = c.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Specimen not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch specimen by ID', 'specimen', req.params.id);
    res.status(500).json(errorResponse);
  }
});

// @route   POST api/specimens
// @desc    Create a specimen
// @access  Private (admin/editor only)
router.post(
  '/',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('project_id', 'Project ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      project_id,
      patient_id,
      tube_id,
      extracted,
      initial_quantity,
      position_freezer,
      position_rack,
      position_box,
      position_dimension_one,
      position_dimension_two,
      activity_status,
      date_collected,
      collection_category,
      extraction_method,
      nucleated_cells,
      cell_numbers,
      percentage_segs,
      csf_protein,
      csf_gluc,
      used_up,
      specimen_site,
      run_number,
      comments,
      specimen_number,
      metadata = {}
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Verify project exists
      const projectCheck = await client.query(
        'SELECT * FROM projects WHERE id = $1',
        [project_id]
      );

      if (projectCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: 'Project not found' });
      }

      // If patient_id is provided, verify patient exists
      if (patient_id) {
        const patientCheck = await client.query(
          'SELECT * FROM patients WHERE id = $1',
          [patient_id]
        );

        if (patientCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ msg: 'Patient not found' });
        }
      }

      const result = await client.query(
        `INSERT INTO specimens
        (project_id, patient_id, tube_id, extracted, initial_quantity,
         position_freezer, position_rack, position_box, position_dimension_one, position_dimension_two,
         activity_status, date_collected, collection_category, extraction_method,
         nucleated_cells, cell_numbers, percentage_segs, csf_protein, csf_gluc,
         used_up, specimen_site, run_number, comments, specimen_number, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING *`,
        [
          project_id, patient_id, tube_id, extracted, initial_quantity,
          position_freezer, position_rack, position_box, position_dimension_one, position_dimension_two,
          activity_status, date_collected, collection_category, extraction_method,
          nucleated_cells, cell_numbers, percentage_segs, csf_protein, csf_gluc,
          used_up, specimen_site, run_number, comments, specimen_number, JSON.stringify(metadata)
        ]
      );

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4::uuid, $5)`,
        [
          req.user.id,
          'CREATE',
          'specimens',
          result.rows[0].id,
          JSON.stringify(req.body)
        ]
      );

      // Return with additional related information
      const specimenWithDetails = await client.query(
        `SELECT s.*, 
          p.external_id as patient_external_id,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          proj.disease, proj.specimen_type,
          c.pi_name, c.pi_institute,
          proj.project_number, c.collaborator_number
         FROM specimens s
         LEFT JOIN patients p ON s.patient_id = p.id
         JOIN projects proj ON s.project_id = proj.id
         JOIN collaborators c ON proj.collaborator_id = c.id
         WHERE s.id = $1`,
        [result.rows[0].id]
      );
      
      await client.query('COMMIT');
      res.json(specimenWithDetails.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      const errorResponse = handleDatabaseError(err, 'create specimen', 'specimen', null, {
        userId: req.user?.id,
        projectId: project_id,
        tubeId: tube_id
      });
      res.status(500).json(errorResponse);
    } finally {
      client.release();
    }
  }
);

// @route   PUT api/specimens/:id
// @desc    Update a specimen
// @access  Private (admin/editor only)
router.put(
  '/:id',
  [
    auth, 
    roleCheck(['admin', 'lab_manager', 'lab_technician']),
    [
      check('project_id', 'Project ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      project_id,
      patient_id,
      tube_id,
      extracted,
      initial_quantity,
      position_freezer,
      position_rack,
      position_box,
      position_dimension_one,
      position_dimension_two,
      activity_status,
      date_collected,
      collection_category,
      extraction_method,
      nucleated_cells,
      cell_numbers,
      percentage_segs,
      csf_protein,
      csf_gluc,
      used_up,
      specimen_site,
      run_number,
      comments,
      specimen_number
    } = req.body;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // First check if specimen exists
      const checkResult = await client.query(
        'SELECT * FROM specimens WHERE id = $1',
        [req.params.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Specimen not found' });
      }

      const oldData = checkResult.rows[0];

      // Verify project exists
      const projectCheck = await client.query(
        'SELECT * FROM projects WHERE id = $1',
        [project_id]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(400).json({ msg: 'Project not found' });
      }

      // If patient_id is provided, verify patient exists
      if (patient_id) {
        const patientCheck = await client.query(
          'SELECT * FROM patients WHERE id = $1',
          [patient_id]
        );

        if (patientCheck.rows.length === 0) {
          return res.status(400).json({ msg: 'Patient not found' });
        }
      }

      // Update the specimen
      const result = await client.query(
        `UPDATE specimens
        SET project_id = $1, patient_id = $2, tube_id = $3, extracted = $4, initial_quantity = $5,
            position_freezer = $6, position_rack = $7, position_box = $8,
            position_dimension_one = $9, position_dimension_two = $10,
            activity_status = $11, date_collected = $12, collection_category = $13,
            extraction_method = $14, nucleated_cells = $15, cell_numbers = $16,
            percentage_segs = $17, csf_protein = $18, csf_gluc = $19,
            used_up = $20, specimen_site = $21, run_number = $22, comments = $23
        WHERE id = $24
        RETURNING *`,
        [
          project_id, patient_id, tube_id, extracted, initial_quantity,
          position_freezer, position_rack, position_box,
          position_dimension_one, position_dimension_two,
          activity_status, date_collected, collection_category,
          extraction_method, nucleated_cells, cell_numbers,
          percentage_segs, csf_protein, csf_gluc,
          used_up, specimen_site, run_number, comments,
          req.params.id
        ]
      );

      // Log the action in audit trail
      await client.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4::uuid, $5)`,
        [
          req.user.id,
          'UPDATE',
          'specimens',
          req.params.id,
          JSON.stringify({
            old: oldData,
            new: result.rows[0]
          })
        ]
      );

      // Return with additional related information
      const specimenWithDetails = await client.query(
        `SELECT s.*, 
          p.external_id as patient_external_id,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          proj.disease, proj.specimen_type,
          c.pi_name, c.pi_institute,
          proj.project_number, c.collaborator_number
         FROM specimens s
         LEFT JOIN patients p ON s.patient_id = p.id
         JOIN projects proj ON s.project_id = proj.id
         JOIN collaborators c ON proj.collaborator_id = c.id
         WHERE s.id = $1`,
        [req.params.id]
      );
      
      await client.query('COMMIT');
      res.json(specimenWithDetails.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      const errorResponse = handleDatabaseError(err, 'update specimen', 'specimen', req.params.id, {
        userId: req.user?.id
      });
      res.status(500).json(errorResponse);
    } finally {
      client.release();
    }
  }
);

// @route   DELETE api/specimens/:id
// @desc    Delete a specimen
// @access  Private (admin/editor only)
router.delete('/:id', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // First check if specimen exists
    const checkResult = await client.query(
      'SELECT * FROM specimens WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Specimen not found' });
    }

    const oldData = checkResult.rows[0];

    // Delete the specimen
    await client.query('DELETE FROM specimens WHERE id = $1', [req.params.id]);

    // Log the action in audit trail
    await client.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4::uuid, $5)`,
      [
        req.user.id,
        'DELETE',
        'specimens',
        req.params.id,
        JSON.stringify(oldData)
      ]
    );
    
    await client.query('COMMIT');
    res.json({ msg: 'Specimen removed' });
  } catch (err) {
    await client.query('ROLLBACK');
    const errorResponse = handleDatabaseError(err, 'delete specimen', 'specimen', req.params.id, {
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  } finally {
    client.release();
  }
});

// Define field mapping groups with priority order (shared with import system)
const FIELD_MAPPINGS = {
  'tube_id': [
    'tube_id', 'specimen_id', 'sample_id', 'Sample_ID', 'Specimen_ID', 'Tube_ID',
    'Sample ID', 'Specimen ID', 'Tube ID', 'sample id', 'specimen id', 'tube id',
    'TubeID', 'SampleID', 'SpecimenID', 'ID', 'id', 'identifier', 'Identifier'
  ],
  'patient_external_id': [
    'patient_external_id', 'patient_id', 'Patient_Code', 'patient_code', 
    'Patient ID', 'Patient Code', 'patient id', 'patient code',
    'PatientID', 'PatientCode', 'subject_id', 'Subject ID', 'Subject_ID'
  ],
  'date_collected': [
    'date_collected', 'collection_date', 'Collection_Date', 'Collection Date',
    'Date Collected', 'date collected', 'collection date', 'CollectionDate',
    'date', 'Date', 'sample_date', 'Sample Date', 'collection', 'Collection'
  ],
  'position_freezer': [
    'position_freezer', 'freezer', 'Location', 'location', 'Storage_Location',
    'Storage Location', 'storage location', 'storage_location', 'Freezer',
    'freezer_location', 'Freezer Location', 'storage', 'Storage'
  ],
  'position_rack': [
    'position_rack', 'rack', 'Rack', 'rack_position', 'Rack Position',
    'RackPosition', 'shelf', 'Shelf'
  ],
  'position_box': [
    'position_box', 'box', 'Box', 'container', 'Container', 'box_position',
    'Box Position', 'BoxPosition'
  ],
  'specimen_site': [
    'specimen_site', 'site', 'Sample_Type', 'sample_type', 'Type', 'type',
    'specimen type', 'sample type', 'Site', 'SpecimenSite', 'specimen_source',
    'source', 'Source', 'body_site', 'Body Site'
  ],
  'activity_status': [
    'activity_status', 'status', 'Status', 'Sample_Status', 'sample_status',
    'sample status', 'ActivityStatus', 'activity', 'Activity', 'state', 'State'
  ],
  'comments': [
    'comments', 'specimen_comments', 'notes', 'Notes', 'Note', 'note',
    'specimen comments', 'specimen_comments', 'Comments', 'description',
    'Description', 'remarks', 'Remarks', 'observations', 'Observations'
  ],
  'initial_quantity': [
    'initial_quantity', 'quantity', 'Quantity', 'Initial Quantity', 'initial quantity',
    'InitialQuantity', 'volume', 'Volume', 'amount', 'Amount'
  ],
  'extracted': [
    'extracted', 'Extracted', 'is_extracted', 'Is Extracted', 'extraction_status',
    'Extraction Status', 'extracted_status', 'Extracted Status'
  ],
  'used_up': [
    'used_up', 'Used_Up', 'used up', 'Used Up', 'UsedUp'
  ],
  'patient_name': [
    'patient_name', 'Patient Name', 'patient name', 'Patient_Name',
    'name', 'Name', 'full_name', 'Full Name', 'subject_name', 'Subject Name'
  ],
  'specimen_number': [
    'specimen_number', 'Specimen Number', 'specimen number', 'Specimen_Number',
    'spec_number', 'Spec Number', 'sample_number', 'Sample Number'
  ]
};

/**
 * Convert Excel date format to proper date
 */
function convertExcelDate(dateValue) {
  // Handle Excel date format (numeric values like 45305.75)
  if (dateValue && !isNaN(dateValue) && dateValue > 25569) {
    // Excel date: days since 1900-01-01 (with 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + (dateValue * 24 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } else if (dateValue && !isNaN(Date.parse(dateValue))) {
    return new Date(dateValue).toISOString().split('T')[0];
  }
  return null;
}

/**
 * Map flexible column names to database fields using unified system
 */
function mapSpecimenData(specimen) {
  const mapped = {};
  
  // Use unified mapping system for each field
  Object.entries(FIELD_MAPPINGS).forEach(([dbField, alternatives]) => {
    let value = null;
    
    // Find first matching alternative using priority order
    for (const alternative of alternatives) {
      if (specimen[alternative] !== undefined && specimen[alternative] !== null && specimen[alternative] !== '') {
        value = specimen[alternative];
        break;
      }
    }
    
    // Special handling for date fields
    if (dbField === 'date_collected' && value) {
      mapped[dbField] = convertExcelDate(value);
    } else if (dbField === 'activity_status' && !value) {
      mapped[dbField] = 'Active'; // Default value
    } else if (dbField === 'extracted' || dbField === 'used_up') {
      mapped[dbField] = value || false; // Boolean fields default to false
    } else {
      mapped[dbField] = value;
    }
  });
  
  return mapped;
}

// @route   POST api/specimens/bulk-import
// @desc    Bulk import specimens
// @access  Private (admin/editor only)
router.post('/bulk-import', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const { specimens, project_id } = req.body;
    
    if (!Array.isArray(specimens) || specimens.length === 0) {
      return res.status(400).json({ msg: 'No specimens provided for import' });
    }
    
    if (!project_id) {
      return res.status(400).json({ msg: 'Project ID is required for bulk import' });
    }
    
    // Verify project exists
    const projectCheck = await db.query(
      'SELECT * FROM projects WHERE id = $1',
      [project_id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ msg: 'Project not found' });
    }
    
    // Get a client for transaction
    const client = await db.getClient();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      const results = [];
      
      // Process each specimen
      for (const specimenRaw of specimens) {
        // Map flexible column names to database fields
        const specimen = mapSpecimenData(specimenRaw);
        
        // Basic validation - only require specimen ID
        if (!specimen.tube_id) {
          return res.status(400).json({ 
            msg: `Import failed: Row with missing specimen identifier. Please ensure each row has a specimen ID in one of these columns: Sample_ID, Specimen_ID, Tube_ID, or similar.` 
          });
        }
        
        // If specimen has patient_external_id, find or create the patient
        let patient_id = null;
        if (specimen.patient_external_id) {
          // Check if patient exists
          const patientCheck = await client.query(
            'SELECT id FROM patients WHERE external_id = $1',
            [specimen.patient_external_id]
          );
          
          if (patientCheck.rows.length > 0) {
            // Use existing patient
            patient_id = patientCheck.rows[0].id;
          } else if (specimen.patient_first_name || specimen.patient_last_name) {
            // Create new patient
            const newPatient = await client.query(
              `INSERT INTO patients 
              (external_id, first_name, last_name, diagnosis) 
              VALUES ($1, $2, $3, $4) 
              RETURNING id`,
              [
                specimen.patient_external_id,
                specimen.patient_first_name || '',
                specimen.patient_last_name || '',
                specimen.diagnosis || ''
              ]
            );
            
            patient_id = newPatient.rows[0].id;
            
            // Log patient creation
            await client.query(
              `INSERT INTO audit_log 
              (user_id, action, table_name, record_id, changed_fields) 
              VALUES ($1, $2, $3, $4::uuid, $5)`,
              [
                req.user.id,
                'CREATE',
                'patients',
                patient_id,
                JSON.stringify({
                  external_id: specimen.patient_external_id,
                  first_name: specimen.patient_first_name,
                  last_name: specimen.patient_last_name,
                  diagnosis: specimen.diagnosis
                })
              ]
            );
          }
        }
        
        // Create the specimen
        const result = await client.query(
          `INSERT INTO specimens 
          (project_id, patient_id, tube_id, extracted, initial_quantity, 
           position_freezer, position_rack, position_box, position_dimension_one, position_dimension_two,
           activity_status, date_collected, collection_category, extraction_method,
           nucleated_cells, cell_numbers, percentage_segs, csf_protein, csf_gluc,
           used_up, specimen_site, run_number, comments) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) 
          RETURNING *`,
          [
            project_id, 
            patient_id,
            specimen.tube_id || null,
            specimen.extracted || false,
            specimen.initial_quantity || null,
            specimen.position_freezer || null,
            specimen.position_rack || null,
            specimen.position_box || null,
            specimen.position_dimension_one || null,
            specimen.position_dimension_two || null,
            specimen.activity_status || 'Active',
            specimen.date_collected || null,
            specimen.collection_category || null,
            specimen.extraction_method || null,
            specimen.nucleated_cells || null,
            specimen.cell_numbers || null,
            specimen.percentage_segs || null,
            specimen.csf_protein || null,
            specimen.csf_gluc || null,
            specimen.used_up || false,
            specimen.specimen_site || null,
            specimen.run_number || null,
            specimen.comments || null
          ]
        );
        
        // Log specimen creation
        await client.query(
          `INSERT INTO audit_log 
          (user_id, action, table_name, record_id, changed_fields) 
          VALUES ($1, $2, $3, $4::uuid, $5)`,
          [
            req.user.id,
            'CREATE',
            'specimens',
            result.rows[0].id,
            JSON.stringify(specimen)
          ]
        );
        
        results.push(result.rows[0]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.json({
        msg: `Successfully imported ${results.length} specimens`,
        imported: results.length,
        specimens: results
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
    const errorResponse = handleDatabaseError(err, 'bulk import specimens', 'specimen', null, { 
      specimenCount: specimens?.length,
      projectId: project_id 
    });
    res.status(500).json(errorResponse);
  }
});

// Import route handlers
const specimenImportRoutes = require('./specimenImport');
router.use('/import', specimenImportRoutes);

// @route   GET api/specimens/metadata-fields/:project_id
// @desc    Get all metadata field names used in a project
// @access  Private
router.get('/metadata-fields/:project_id', auth, async (req, res) => {
  try {
    const { project_id } = req.params;
    
    // Direct SQL query that works with UUIDs instead of the legacy function
    const result = await db.query(`
      SELECT 
        key as field_name,
        COUNT(*) as usage_count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM specimens WHERE project_id = $1)), 2) as usage_frequency,
        COUNT(DISTINCT value) as unique_values
      FROM specimens s,
           jsonb_each_text(s.metadata) AS j(key, value)
      WHERE s.project_id = $1
        AND s.metadata != '{}'::jsonb
      GROUP BY key
      ORDER BY usage_count DESC, key
    `, [project_id]);
    
    res.json(result.rows);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch metadata fields', 'specimen', null, { 
      projectId: req.params.project_id 
    });
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/specimens/metadata-analytics/:project_id
// @desc    Get comprehensive metadata analytics for a project
// @access  Private
router.get('/metadata-analytics/:project_id', auth, async (req, res) => {
  try {
    const { project_id } = req.params;
    
    // Get all specimens with metadata for this project
    const specimens = await db.query(`
      SELECT s.id, s.metadata
      FROM specimens s
      WHERE s.project_id = $1
        AND s.metadata IS NOT NULL
        AND s.metadata != '{}'::jsonb
    `, [project_id]);
    
    if (specimens.rows.length === 0) {
      return res.json({
        totalSpecimens: 0,
        specimensWithMetadata: 0,
        fields: [],
        summary: {
          dataQuality: 'No metadata available',
          completeness: 0
        }
      });
    }
    
    // Analyze all metadata fields
    const analytics = analyzeMetadataFields(specimens.rows);
    
    res.json(analytics);
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'analyze specimen metadata', 'specimen', null, { 
      projectId: req.params.project_id 
    });
    res.status(500).json(errorResponse);
  }
});

// @route   PUT api/specimens/:id/metadata
// @desc    Update specimen metadata
// @access  Private
router.put('/:id/metadata', auth, roleCheck(['admin', 'lab_manager', 'lab_technician']), async (req, res) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;

    // Validate that metadata is provided
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ msg: 'Valid metadata object is required' });
    }

    // Check if specimen exists
    const specimenExists = await db.query('SELECT id FROM specimens WHERE id = $1', [id]);
    if (specimenExists.rows.length === 0) {
      return res.status(404).json({ msg: 'Specimen not found' });
    }

    // Update specimen metadata
    const result = await db.query(
      'UPDATE specimens SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, metadata',
      [JSON.stringify(metadata), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Specimen not found' });
    }

    res.json({
      msg: 'Specimen metadata updated successfully',
      specimen: result.rows[0]
    });

  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'update specimen metadata', 'specimen', req.params.id);
    res.status(500).json(errorResponse);
  }
});

// @route   GET api/specimens/:id/experiments
// @desc    Get all experiments (with protocol details) for a specific specimen
// @access  Private
router.get('/:id/experiments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if specimen exists
    const specimenCheck = await db.query('SELECT id, specimen_number, tube_id FROM specimens WHERE id = $1', [id]);
    if (specimenCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'Specimen not found' });
    }
    
    const specimen = specimenCheck.rows[0];
    
    // Get all experiments that include this specimen
    const query = `
      SELECT 
        e.id,
        e.experiment_id,
        e.protocol_id,
        e.date_performed,
        e.status,
        e.notes,
        e.created_at,
        e.updated_at,
        p.name as protocol_name,
        p.description as protocol_description,
        p.version as protocol_version,
        u.username as performed_by,
        CONCAT(u.first_name, ' ', u.last_name) as performed_by_name
      FROM experiments e
      JOIN protocols p ON e.protocol_id = p.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.sample_ids @> $1::jsonb
      ORDER BY e.date_performed DESC NULLS LAST, e.created_at DESC
    `;
    
    const result = await db.query(query, [JSON.stringify([id])]);
    
    res.json({
      specimen: {
        id: specimen.id,
        specimen_number: specimen.specimen_number,
        tube_id: specimen.tube_id
      },
      experiments: result.rows,
      total_experiments: result.rows.length
    });
    
  } catch (err) {
    const errorResponse = handleDatabaseError(err, 'fetch specimen experiments', 'specimen', req.params.id);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
