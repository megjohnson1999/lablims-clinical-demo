const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// @route   POST api/import/comprehensive/preview
// @desc    Preview comprehensive import data
// @access  Private (admin/editor only)
router.post('/preview', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let workbook;

    // Read the file based on its type
    if (req.file.mimetype === 'text/csv') {
      const csvData = fs.readFileSync(filePath, 'utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.readFile(filePath);
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    if (data.length === 0) {
      return res.status(400).json({ msg: 'No data found in the file' });
    }

    // Process and validate the data
    const processedData = [];
    const errors = [];
    const collaboratorMap = new Map();
    const projectMap = new Map();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2; // Excel row number (1-based + header)

      const processedRow = {
        rowIndex,
        collaborator: {
          id: row['collaborator:ID'],
          pi_name: row['collaborator:PI_Name'],
          pi_institute: row['collaborator:PI_Institute']
        },
        project: {
          id: row['project:ID'],
          disease: row['project:Disease'],
          specimen_type: row['project:Specimen_Type']
        },
        specimen: {
          id: row['specimen:ID'],
          tube_id: row['specimen:Tube_ID'],
          date_collected: row['specimen:Date_Collected']
        }
      };

      // Validate required fields
      if (!processedRow.collaborator.pi_name) {
        errors.push({ row: rowIndex, field: 'collaborator:PI_Name', message: 'PI Name is required' });
      }
      if (!processedRow.collaborator.pi_institute) {
        errors.push({ row: rowIndex, field: 'collaborator:PI_Institute', message: 'PI Institute is required' });
      }
      if (!processedRow.project.id) {
        errors.push({ row: rowIndex, field: 'project:ID', message: 'Project ID is required' });
      }
      if (!processedRow.specimen.tube_id) {
        errors.push({ row: rowIndex, field: 'specimen:Tube_ID', message: 'Tube ID is required' });
      }

      // Track unique collaborators and projects
      const collaboratorKey = `${processedRow.collaborator.pi_name}|${processedRow.collaborator.pi_institute}`;
      if (!collaboratorMap.has(collaboratorKey)) {
        collaboratorMap.set(collaboratorKey, processedRow.collaborator);
      }

      const projectKey = `${processedRow.project.id}|${collaboratorKey}`;
      if (!projectMap.has(projectKey)) {
        projectMap.set(projectKey, {
          ...processedRow.project,
          collaborator: processedRow.collaborator
        });
      }

      processedData.push(processedRow);
    }

    // Check for existing data in database
    const existingChecks = await Promise.all([
      // Check existing collaborators
      db.query('SELECT pi_name, pi_institute FROM collaborators'),
      // Check existing projects
      db.query('SELECT project_number FROM projects WHERE project_number IS NOT NULL'),
      // Check existing specimens
      db.query('SELECT tube_id FROM specimens WHERE tube_id IS NOT NULL')
    ]);

    const existingCollaborators = new Set(
      existingChecks[0].rows.map(row => `${row.pi_name}|${row.pi_institute}`)
    );
    const existingProjects = new Set(
      existingChecks[1].rows.map(row => row.project_number)
    );
    const existingSpecimens = new Set(
      existingChecks[2].rows.map(row => row.tube_id)
    );

    // Summary statistics
    const summary = {
      totalRows: data.length,
      collaborators: {
        total: collaboratorMap.size,
        new: Array.from(collaboratorMap.keys()).filter(key => !existingCollaborators.has(key)).length,
        existing: Array.from(collaboratorMap.keys()).filter(key => existingCollaborators.has(key)).length
      },
      projects: {
        total: projectMap.size,
        new: Array.from(projectMap.values()).filter(proj => !existingProjects.has(proj.id)).length,
        existing: Array.from(projectMap.values()).filter(proj => existingProjects.has(proj.id)).length
      },
      specimens: {
        total: processedData.length,
        new: processedData.filter(row => !existingSpecimens.has(row.specimen.tube_id)).length,
        existing: processedData.filter(row => existingSpecimens.has(row.specimen.tube_id)).length
      },
      errors: errors.length
    };

    res.json({
      summary,
      errors,
      sampleData: processedData.slice(0, 5), // First 5 rows for preview
      collaborators: Array.from(collaboratorMap.values()),
      projects: Array.from(projectMap.values())
    });

  } catch (err) {
    console.error('Error in comprehensive import preview:', err);
    res.status(500).json({ msg: 'Server error during file processing: ' + err.message });
  }
});

// @route   POST api/import/comprehensive/execute
// @desc    Execute comprehensive import
// @access  Private (admin/editor only)
router.post('/execute', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], upload.single('file'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let workbook;

    // Read the file based on its type
    if (req.file.mimetype === 'text/csv') {
      const csvData = fs.readFileSync(filePath, 'utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.readFile(filePath);
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    if (data.length === 0) {
      return res.status(400).json({ msg: 'No data found in the file' });
    }

    // Start transaction
    await client.query('BEGIN');

    const results = {
      collaborators: { created: 0, updated: 0 },
      projects: { created: 0, updated: 0 },
      specimens: { created: 0, updated: 0 },
      errors: []
    };

    // Process data
    const collaboratorMap = new Map();
    const projectMap = new Map();

    // First pass: Create/update collaborators and projects
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2;

      try {
        // Process collaborator
        const collaboratorKey = `${row['collaborator:PI_Name']}|${row['collaborator:PI_Institute']}`;
        if (!collaboratorMap.has(collaboratorKey)) {
          // Check if collaborator exists
          const existingCollaborator = await client.query(
            'SELECT id FROM collaborators WHERE pi_name = $1 AND pi_institute = $2',
            [row['collaborator:PI_Name'], row['collaborator:PI_Institute']]
          );

          let collaboratorId;
          if (existingCollaborator.rows.length > 0) {
            collaboratorId = existingCollaborator.rows[0].id;
            results.collaborators.updated++;
          } else {
            // Create new collaborator
            const newCollaborator = await client.query(
              'INSERT INTO collaborators (pi_name, pi_institute) VALUES ($1, $2) RETURNING id',
              [row['collaborator:PI_Name'], row['collaborator:PI_Institute']]
            );
            collaboratorId = newCollaborator.rows[0].id;
            results.collaborators.created++;
          }

          collaboratorMap.set(collaboratorKey, collaboratorId);
        }

        // Process project
        const projectKey = `${row['project:ID']}|${collaboratorKey}`;
        if (!projectMap.has(projectKey)) {
          const collaboratorId = collaboratorMap.get(collaboratorKey);
          
          // Check if project exists
          const existingProject = await client.query(
            'SELECT id FROM projects WHERE project_number = $1 AND collaborator_id = $2',
            [row['project:ID'], collaboratorId]
          );

          let projectId;
          if (existingProject.rows.length > 0) {
            projectId = existingProject.rows[0].id;
            results.projects.updated++;
          } else {
            // Create new project
            const newProject = await client.query(
              `INSERT INTO projects (collaborator_id, project_number, disease, specimen_type, date_received) 
               VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
              [collaboratorId, row['project:ID'], row['project:Disease'], row['project:Specimen_Type']]
            );
            projectId = newProject.rows[0].id;
            results.projects.created++;
          }

          projectMap.set(projectKey, projectId);
        }

      } catch (err) {
        results.errors.push({
          row: rowIndex,
          message: `Error processing collaborator/project: ${err.message}`
        });
      }
    }

    // Second pass: Create specimens
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2;

      try {
        const collaboratorKey = `${row['collaborator:PI_Name']}|${row['collaborator:PI_Institute']}`;
        const projectKey = `${row['project:ID']}|${collaboratorKey}`;
        
        const projectId = projectMap.get(projectKey);
        
        if (!projectId) {
          results.errors.push({
            row: rowIndex,
            message: 'Project not found for specimen'
          });
          continue;
        }

        // Check if specimen exists
        const existingSpecimen = await client.query(
          'SELECT id FROM specimens WHERE tube_id = $1',
          [row['specimen:Tube_ID']]
        );

        if (existingSpecimen.rows.length === 0) {
          // Create new specimen
          const dateCollected = row['specimen:Date_Collected'] ? new Date(row['specimen:Date_Collected']) : null;
          await client.query(
            'INSERT INTO specimens (project_id, tube_id, date_collected) VALUES ($1, $2, $3)',
            [projectId, row['specimen:Tube_ID'], dateCollected]
          );
          results.specimens.created++;
        } else {
          results.specimens.updated++;
        }

      } catch (err) {
        results.errors.push({
          row: rowIndex,
          message: `Error processing specimen: ${err.message}`
        });
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      message: 'Import completed successfully',
      results,
      summary: {
        totalRows: data.length,
        successfulRows: data.length - results.errors.length,
        errorRows: results.errors.length
      }
    });

  } catch (err) {
    // Rollback transaction
    await client.query('ROLLBACK');
    console.error('Error in comprehensive import execute:', err);
    res.status(500).json({ msg: 'Server error during import: ' + err.message });
  } finally {
    // Release client
    client.release();
  }
});

module.exports = router;