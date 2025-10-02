const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const { createErrorResponse, handleDatabaseError } = require('../utils/errorHandling');

// @route   POST api/metadata/upload-preview
// @desc    Preview global metadata upload - show what will be updated
// @access  Private (admin/editor)
router.post('/upload-preview', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    console.log('=== METADATA UPLOAD PREVIEW DEBUG ===');
    const { csvData, specimenIdColumn, matchingStrategy = 'tube_id' } = req.body;
    console.log('Request params:', { 
      csvDataLength: csvData?.length, 
      specimenIdColumn, 
      matchingStrategy 
    });

    // Validate input
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({ msg: 'CSV data is required and must be a non-empty array' });
    }

    if (!specimenIdColumn || typeof specimenIdColumn !== 'string') {
      return res.status(400).json({ msg: 'Specimen ID column is required' });
    }

    if (!['tube_id', 'specimen_number'].includes(matchingStrategy)) {
      return res.status(400).json({ msg: 'Matching strategy must be either "tube_id" or "specimen_number"' });
    }

    // Extract specimen identifiers from CSV data based on matching strategy
    const specimenIds = csvData
      .map(row => row[specimenIdColumn])
      .filter(id => {
        if (!id) return false;
        if (matchingStrategy === 'specimen_number') {
          // For WUID matching, accept numbers as strings or actual numbers
          return !isNaN(id) && id.toString().trim() !== '';
        } else {
          // For tube_id matching, accept any non-empty string
          return typeof id === 'string' && id.trim() !== '';
        }
      })
      .map(id => matchingStrategy === 'specimen_number' ? parseInt(id) : id.toString().trim());

    if (specimenIds.length === 0) {
      const fieldType = matchingStrategy === 'specimen_number' ? 'specimen numbers (WUID)' : 'tube IDs';
      return res.status(400).json({ msg: `No valid ${fieldType} found in column "${specimenIdColumn}"` });
    }

    // Remove duplicates
    const uniqueSpecimenIds = [...new Set(specimenIds)];
    console.log('Specimen IDs extracted:', { 
      totalIds: specimenIds.length, 
      uniqueIds: uniqueSpecimenIds.length,
      sampleIds: uniqueSpecimenIds.slice(0, 5) 
    });

    // Find matching specimens across all projects based on matching strategy
    let matchQuery, matchParams;
    
    if (matchingStrategy === 'specimen_number') {
      matchQuery = `
        SELECT 
          s.id,
          s.specimen_number,
          s.tube_id,
          s.project_id,
          p.project_number,
          p.disease,
          c.pi_name,
          c.pi_institute
        FROM specimens s
        JOIN projects p ON s.project_id = p.id
        JOIN collaborators c ON p.collaborator_id = c.id
        WHERE s.specimen_number = ANY($1::int[])
        ORDER BY s.specimen_number, s.tube_id
      `;
      matchParams = [uniqueSpecimenIds];
    } else {
      matchQuery = `
        SELECT 
          s.id,
          s.specimen_number,
          s.tube_id,
          s.project_id,
          p.project_number,
          p.disease,
          c.pi_name,
          c.pi_institute
        FROM specimens s
        JOIN projects p ON s.project_id = p.id
        JOIN collaborators c ON p.collaborator_id = c.id
        WHERE s.tube_id = ANY($1::text[])
        ORDER BY s.tube_id, s.specimen_number
      `;
      matchParams = [uniqueSpecimenIds];
    }

    console.log('Executing database query:', { matchingStrategy, queryPreview: matchQuery.substring(0, 100) });
    const matchResult = await db.query(matchQuery, matchParams);
    const matchedSpecimens = matchResult.rows;
    console.log('Database query results:', { matchedCount: matchedSpecimens.length });

    // Group specimens by the matching field
    const specimensByMatchingField = {};
    const matchingFieldKey = matchingStrategy === 'specimen_number' ? 'specimen_number' : 'tube_id';
    
    matchedSpecimens.forEach(specimen => {
      const fieldValue = specimen[matchingFieldKey];
      if (!specimensByMatchingField[fieldValue]) {
        specimensByMatchingField[fieldValue] = [];
      }
      specimensByMatchingField[fieldValue].push(specimen);
    });

    // Identify matched and unmatched specimen IDs
    const matchedSpecimenIds = new Set(matchedSpecimens.map(s => s[matchingFieldKey]));
    const unmatchedSpecimenIds = uniqueSpecimenIds.filter(id => !matchedSpecimenIds.has(id));

    // Analyze project impact
    const projectImpact = {};
    matchedSpecimens.forEach(specimen => {
      const projectKey = `${specimen.project_number} - ${specimen.disease}`;
      if (!projectImpact[projectKey]) {
        projectImpact[projectKey] = {
          projectId: specimen.project_id,
          projectNumber: specimen.project_number,
          disease: specimen.disease,
          piName: specimen.pi_name,
          piInstitute: specimen.pi_institute,
          specimenCount: 0,
          tubeIdCount: 0,
          tubeIds: new Set()
        };
      }
      projectImpact[projectKey].specimenCount++;
      projectImpact[projectKey].tubeIds.add(specimen.tube_id);
    });

    // Convert sets to counts and arrays for response
    Object.values(projectImpact).forEach(project => {
      project.tubeIdCount = project.tubeIds.size;
      project.tubeIds = Array.from(project.tubeIds);
    });

    // Prepare metadata fields (exclude specimen ID column)
    const metadataFields = csvData.length > 0 
      ? Object.keys(csvData[0]).filter(key => key !== specimenIdColumn)
      : [];

    // Create sample metadata preview (first 3 matches)
    const sampleMetadata = csvData
      .filter(row => {
        const rowId = matchingStrategy === 'specimen_number' 
          ? parseInt(row[specimenIdColumn]) 
          : row[specimenIdColumn];
        return matchedSpecimenIds.has(rowId);
      })
      .slice(0, 3)
      .map(row => {
        const metadata = {};
        metadataFields.forEach(field => {
          metadata[field] = row[field] || '';
        });
        return {
          specimenId: row[specimenIdColumn],
          matchingStrategy: matchingStrategy,
          metadata
        };
      });

    // Prepare response
    const previewResult = {
      summary: {
        totalCsvRows: csvData.length,
        uniqueSpecimenIds: uniqueSpecimenIds.length,
        matchedSpecimenIds: matchedSpecimenIds.size,
        unmatchedSpecimenIds: unmatchedSpecimenIds.length,
        totalSpecimensToUpdate: matchedSpecimens.length,
        projectsAffected: Object.keys(projectImpact).length,
        metadataFieldCount: metadataFields.length,
        matchingStrategy: matchingStrategy
      },
      projectImpact: Object.values(projectImpact),
      metadataFields,
      sampleMetadata,
      unmatchedSpecimenIds: unmatchedSpecimenIds.slice(0, 20), // Limit for response size
      specimensByMatchingField: Object.fromEntries(
        Object.entries(specimensByMatchingField).slice(0, 10).map(([fieldValue, specimens]) => [
          fieldValue,
          specimens.map(s => ({
            specimenNumber: s.specimen_number,
            tubeId: s.tube_id,
            projectNumber: s.project_number,
            disease: s.disease
          }))
        ])
      )
    };

    res.json(previewResult);

  } catch (err) {
    console.error('Metadata upload preview error:', err);
    console.error('Stack trace:', err.stack);
    
    // Handle specific error types with user-friendly messages
    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        msg: 'File too large',
        error: 'Your CSV file is too large to process. Please reduce the file size by removing unnecessary columns or splitting the data into smaller files.',
        maxSize: '10MB',
        actualSize: err.expected ? `${Math.round(err.expected / 1024 / 1024 * 100) / 100}MB` : 'Unknown',
        suggestions: [
          'Remove unused columns from your CSV file',
          'Split large files into smaller batches',
          'Compress data by removing extra whitespace',
          'Contact support if you need to upload larger files'
        ]
      });
    }
    
    // Handle database connection errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        msg: 'Database connection error',
        error: 'Unable to connect to the database. Please try again in a few moments.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the problem persists'
        ]
      });
    }
    
    // Handle validation errors
    if (err.message.includes('No valid') && err.message.includes('found in column')) {
      return res.status(400).json({
        msg: 'Invalid data format',
        error: err.message,
        suggestions: [
          'Verify the selected column contains the correct data type',
          'Check for empty cells or invalid characters in your data',
          'Ensure WUID values are numeric without letters or special characters',
          'Review the sample data shown in the preview'
        ]
      });
    }
    
    res.status(500).json({ 
      msg: 'Failed to preview metadata upload',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      suggestions: [
        'Check your CSV file format and data quality',
        'Verify your internet connection',
        'Try refreshing the page and uploading again',
        'Contact support if the problem persists'
      ]
    });
  }
});

// @route   POST api/metadata/upload-apply
// @desc    Apply global metadata updates to specimens
// @access  Private (admin/editor)
router.post('/upload-apply', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const { csvData, specimenIdColumn, matchingStrategy = 'tube_id' } = req.body;

    // Validate input (same as preview)
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({ msg: 'CSV data is required and must be a non-empty array' });
    }

    if (!specimenIdColumn || typeof specimenIdColumn !== 'string') {
      return res.status(400).json({ msg: 'Specimen ID column is required' });
    }

    if (!['tube_id', 'specimen_number'].includes(matchingStrategy)) {
      return res.status(400).json({ msg: 'Matching strategy must be either "tube_id" or "specimen_number"' });
    }

    // Create a map of specimen_id to metadata based on matching strategy
    const metadataBySpecimenId = {};
    const metadataFields = csvData.length > 0 
      ? Object.keys(csvData[0]).filter(key => key !== specimenIdColumn)
      : [];

    csvData.forEach(row => {
      const specimenId = row[specimenIdColumn];
      if (specimenId) {
        let processedId;
        if (matchingStrategy === 'specimen_number') {
          if (!isNaN(specimenId) && specimenId.toString().trim() !== '') {
            processedId = parseInt(specimenId);
          }
        } else {
          if (typeof specimenId === 'string' && specimenId.trim() !== '') {
            processedId = specimenId.trim();
          }
        }
        
        if (processedId !== undefined) {
          const metadata = {};
          metadataFields.forEach(field => {
            metadata[field] = row[field] || '';
          });
          metadataBySpecimenId[processedId] = metadata;
        }
      }
    });

    const specimenIds = Object.keys(metadataBySpecimenId);

    if (specimenIds.length === 0) {
      const fieldType = matchingStrategy === 'specimen_number' ? 'specimen numbers (WUID)' : 'tube IDs';
      return res.status(400).json({ msg: `No valid ${fieldType} found in column "${specimenIdColumn}"` });
    }

    // Get all specimens with matching IDs based on strategy
    let specimenQuery, specimenParams;
    
    if (matchingStrategy === 'specimen_number') {
      const numericIds = specimenIds.map(id => parseInt(id));
      specimenQuery = `
        SELECT id, tube_id, specimen_number, metadata
        FROM specimens 
        WHERE specimen_number = ANY($1::int[])
        ORDER BY specimen_number, tube_id
      `;
      specimenParams = [numericIds];
    } else {
      specimenQuery = `
        SELECT id, tube_id, specimen_number, metadata
        FROM specimens 
        WHERE tube_id = ANY($1::text[])
        ORDER BY tube_id, specimen_number
      `;
      specimenParams = [specimenIds];
    }

    const specimenResult = await db.query(specimenQuery, specimenParams);
    const specimens = specimenResult.rows;

    if (specimens.length === 0) {
      const fieldType = matchingStrategy === 'specimen_number' ? 'specimen numbers (WUID)' : 'tube IDs';
      return res.status(404).json({ msg: `No specimens found with matching ${fieldType}` });
    }

    // Process updates in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < specimens.length; i += batchSize) {
      batches.push(specimens.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    // Use transaction for data integrity
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const batch of batches) {
        const updatePromises = batch.map(async (specimen) => {
          try {
            const matchingFieldValue = matchingStrategy === 'specimen_number' 
              ? specimen.specimen_number 
              : specimen.tube_id;
            const newMetadata = metadataBySpecimenId[matchingFieldValue];
            if (!newMetadata) {
              return { success: false, error: `No metadata found for ${matchingStrategy}` };
            }

            // Merge with existing metadata
            const existingMetadata = specimen.metadata || {};
            const mergedMetadata = { ...existingMetadata, ...newMetadata };

            await client.query(
              'UPDATE specimens SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [JSON.stringify(mergedMetadata), specimen.id]
            );

            return { success: true, specimenNumber: specimen.specimen_number };
          } catch (error) {
            return { 
              success: false, 
              error: error.message,
              specimenNumber: specimen.specimen_number,
              tubeId: specimen.tube_id
            };
          }
        });

        const batchResults = await Promise.allSettled(updatePromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successCount++;
            } else {
              failureCount++;
              errors.push({
                specimen: batch[index].specimen_number,
                tubeId: batch[index].tube_id,
                error: result.value.error
              });
            }
          } else {
            failureCount++;
            errors.push({
              specimen: batch[index].specimen_number,
              tubeId: batch[index].tube_id,
              error: result.reason?.message || 'Unknown error'
            });
          }
        });
      }

      await client.query('COMMIT');

      // Log the metadata upload action
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'METADATA_UPLOAD',
          'specimens',
          '00000000-0000-0000-0000-000000000000',
          JSON.stringify({
            matchingStrategy: matchingStrategy,
            specimenIds: specimenIds.length,
            metadataFields: metadataFields.length,
            successCount,
            failureCount,
            errors: errors.slice(0, 10) // Limit logged errors
          })
        ]
      );

      res.json({
        success: true,
        summary: {
          totalSpecimens: specimens.length,
          successCount,
          failureCount,
          metadataFields: metadataFields.length,
          uniqueSpecimenIds: specimenIds.length,
          matchingStrategy: matchingStrategy
        },
        errors: errors.slice(0, 20) // Limit response size
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Metadata upload apply error:', err);
    
    // Handle specific error types with user-friendly messages  
    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        msg: 'File too large',
        error: 'Your CSV file is too large to process. Please reduce the file size by removing unnecessary columns or splitting the data into smaller files.',
        maxSize: '10MB',
        actualSize: err.expected ? `${Math.round(err.expected / 1024 / 1024 * 100) / 100}MB` : 'Unknown',
        suggestions: [
          'Remove unused columns from your CSV file',
          'Split large files into smaller batches',
          'Compress data by removing extra whitespace',
          'Contact support if you need to upload larger files'
        ]
      });
    }
    
    // Handle database connection errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        msg: 'Database connection error',
        error: 'Unable to connect to the database. Please try again in a few moments.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the problem persists'
        ]
      });
    }
    
    res.status(500).json({ 
      msg: 'Failed to apply metadata updates',
      error: err.message,
      suggestions: [
        'Check your CSV file format and data quality',
        'Verify your internet connection', 
        'Try refreshing the page and uploading again',
        'Contact support if the problem persists'
      ]
    });
  }
});

// @route   GET api/metadata/tube-ids
// @desc    Get all unique tube_ids for validation
// @access  Private
router.get('/tube-ids', auth, async (req, res) => {
  try {
    const { search = '', limit = 100 } = req.query;

    let query = `
      SELECT DISTINCT tube_id, COUNT(*) as specimen_count
      FROM specimens 
      WHERE tube_id IS NOT NULL AND tube_id != ''
    `;
    
    const params = [];
    let paramIndex = 1;

    if (search.trim()) {
      query += ` AND tube_id ILIKE $${paramIndex}`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    query += ` GROUP BY tube_id ORDER BY tube_id LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json({
      tubeIds: result.rows.map(row => ({
        tubeId: row.tube_id,
        specimenCount: parseInt(row.specimen_count)
      }))
    });

  } catch (err) {
    console.error('Get tube IDs error:', err);
    res.status(500).json({ 
      msg: 'Failed to fetch tube IDs',
      error: err.message 
    });
  }
});

// @route   GET api/metadata/summary
// @desc    Get metadata summary across all projects  
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    // Get metadata field distribution across all specimens
    const metadataQuery = `
      SELECT 
        COUNT(*) as total_specimens,
        COUNT(CASE WHEN metadata IS NOT NULL AND metadata != '{}' THEN 1 END) as specimens_with_metadata,
        COUNT(DISTINCT tube_id) as unique_tube_ids
      FROM specimens 
      WHERE tube_id IS NOT NULL AND tube_id != ''
    `;

    const projectQuery = `
      SELECT 
        p.project_number,
        p.disease,
        c.pi_name,
        COUNT(s.id) as specimen_count,
        COUNT(CASE WHEN s.metadata IS NOT NULL AND s.metadata != '{}' THEN 1 END) as metadata_count
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      LEFT JOIN specimens s ON p.id = s.project_id
      GROUP BY p.id, p.project_number, p.disease, c.pi_name
      HAVING COUNT(s.id) > 0
      ORDER BY metadata_count DESC, specimen_count DESC
      LIMIT 20
    `;

    const [metadataResult, projectResult] = await Promise.all([
      db.query(metadataQuery),
      db.query(projectQuery)
    ]);

    res.json({
      summary: metadataResult.rows[0],
      topProjects: projectResult.rows
    });

  } catch (err) {
    console.error('Metadata summary error:', err);
    res.status(500).json({ 
      msg: 'Failed to fetch metadata summary',
      error: err.message 
    });
  }
});

module.exports = router;