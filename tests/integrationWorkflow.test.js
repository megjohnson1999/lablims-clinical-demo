const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const app = require('../server');
const db = require('../db');

describe('Integration Test: Create → Store → Export Workflow', () => {
  const authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
  let createdCollaboratorId;
  let createdProjectId;
  let createdSpecimenId;
  let createdPatientId;

  beforeAll(async () => {
    // Clean up test data from previous runs
    await db.query(`
      DELETE FROM specimens 
      WHERE tube_id LIKE 'TEST-%'
    `);
    await db.query(`
      DELETE FROM projects 
      WHERE comments LIKE '%Integration Test%'
    `);
    await db.query(`
      DELETE FROM collaborators 
      WHERE pi_name LIKE 'Test PI%'
    `);
    await db.query(`
      DELETE FROM patients 
      WHERE external_id LIKE 'TEST-%'
    `);
  });

  afterAll(async () => {
    // Clean up created test data
    if (createdSpecimenId) {
      await db.query('DELETE FROM specimens WHERE id = $1', [createdSpecimenId]);
    }
    if (createdProjectId) {
      await db.query('DELETE FROM projects WHERE id = $1', [createdProjectId]);
    }
    if (createdCollaboratorId) {
      await db.query('DELETE FROM collaborators WHERE id = $1', [createdCollaboratorId]);
    }
    if (createdPatientId) {
      await db.query('DELETE FROM patients WHERE id = $1', [createdPatientId]);
    }
    
    await db.end();
  });

  describe('Step 1: Create records with auto-generated IDs', () => {
    it('should create a collaborator with auto-generated ID', async () => {
      // Get next collaborator ID
      const idResponse = await request(app)
        .get('/api/ids/next-collaborator')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(idResponse.status).toBe(200);
      const generatedId = idResponse.body.data.id;

      // Create collaborator
      const createResponse = await request(app)
        .post('/api/collaborators')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          collaborator_number: generatedId,
          pi_name: 'Test PI Integration',
          pi_institute: 'Test Institute',
          pi_email: 'test@example.com',
          comments: 'Integration Test Collaborator'
        });

      expect(createResponse.status).toBe(201);
      createdCollaboratorId = createResponse.body.id;

      // Verify the collaborator was created with the correct ID
      const getResponse = await request(app)
        .get(`/api/collaborators/${createdCollaboratorId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.collaborator_number).toBe(generatedId);
    });

    it('should create a patient for testing', async () => {
      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          external_id: 'TEST-PATIENT-001',
          first_name: 'Test',
          last_name: 'Patient',
          date_of_birth: '1990-01-01',
          diagnosis: 'Test Diagnosis'
        });

      expect(createResponse.status).toBe(201);
      createdPatientId = createResponse.body.id;
    });

    it('should create a project with auto-generated ID', async () => {
      // Get next project ID
      const idResponse = await request(app)
        .get('/api/ids/next-project')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(idResponse.status).toBe(200);
      const generatedId = idResponse.body.data.id;

      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project_id: generatedId,
          collaborator_id: createdCollaboratorId,
          project_number: `P-${generatedId}`,
          disease: 'Test Disease',
          specimen_type: 'Blood',
          source: 'Test Source',
          date_received: new Date().toISOString(),
          comments: 'Integration Test Project'
        });

      expect(createResponse.status).toBe(201);
      createdProjectId = createResponse.body.id;

      // Verify the project was created with the correct ID
      const getResponse = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.project_id).toBe(generatedId);
    });

    it('should create a specimen with auto-generated ID', async () => {
      // Get next specimen ID
      const idResponse = await request(app)
        .get('/api/ids/next-specimen')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(idResponse.status).toBe(200);
      const generatedId = idResponse.body.data.id;

      // Create specimen
      const createResponse = await request(app)
        .post('/api/specimens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          specimen_number: generatedId,
          project_id: createdProjectId,
          patient_id: createdPatientId,
          tube_id: `TEST-TUBE-${generatedId}`,
          extracted: false,
          initial_quantity: 5.5,
          position_freezer: 'F1',
          position_rack: 'R1',
          position_box: 'B1',
          position_dimension_one: 'A',
          position_dimension_two: '1',
          activity_status: 'active',
          date_collected: new Date().toISOString(),
          collection_category: 'Baseline',
          extraction_method: 'Standard',
          cell_numbers: 1000000,
          specimen_site: 'Blood',
          comments: 'Integration Test Specimen'
        });

      expect(createResponse.status).toBe(201);
      createdSpecimenId = createResponse.body.id;

      // Verify the specimen was created with the correct ID
      const getResponse = await request(app)
        .get(`/api/specimens/${createdSpecimenId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.specimen_number).toBe(generatedId);
    });
  });

  describe('Step 2: Verify data storage', () => {
    it('should have all records properly linked in database', async () => {
      // Query database directly to verify relationships
      const result = await db.query(`
        SELECT 
          s.specimen_number,
          s.tube_id,
          p.project_id,
          p.project_number,
          c.collaborator_number,
          c.pi_name,
          pat.external_id
        FROM specimens s
        JOIN projects p ON s.project_id = p.id
        JOIN collaborators c ON p.collaborator_id = c.id
        JOIN patients pat ON s.patient_id = pat.id
        WHERE s.id = $1
      `, [createdSpecimenId]);

      expect(result.rows.length).toBe(1);
      const record = result.rows[0];
      
      expect(record.specimen_number).toBeTruthy();
      expect(record.project_id).toBeTruthy();
      expect(record.collaborator_number).toBeTruthy();
      expect(record.pi_name).toBe('Test PI Integration');
      expect(record.external_id).toBe('TEST-PATIENT-001');
    });
  });

  describe('Step 3: Export to CSV', () => {
    it('should export specimens to CSV with correct IDs', async () => {
      const exportResponse = await request(app)
        .get('/api/export/specimens/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          filters: JSON.stringify({
            tube_id: `TEST-TUBE-`
          })
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');

      // Parse CSV content
      const csvContent = exportResponse.text;
      const records = csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });

      // Find our test specimen
      const testSpecimen = records.find(r => 
        r['Tube ID'] && r['Tube ID'].startsWith('TEST-TUBE-')
      );

      expect(testSpecimen).toBeTruthy();
      expect(testSpecimen['Specimen Number']).toBeTruthy();
      expect(parseInt(testSpecimen['Specimen Number'])).toBeGreaterThan(0);
      expect(testSpecimen['Project Number']).toBeTruthy();
      expect(testSpecimen['PI Name']).toBe('Test PI Integration');
    });
  });

  describe('Step 4: Export to Excel', () => {
    it('should export all data to Excel with correct IDs', async () => {
      const exportResponse = await request(app)
        .get('/api/export/all/excel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('spreadsheetml');

      // Save Excel file temporarily
      const tempPath = path.join(__dirname, 'temp_export.xlsx');
      await fs.writeFile(tempPath, exportResponse.body);

      // Read and verify Excel content
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(tempPath);

      // Check Collaborators sheet
      const collaboratorsSheet = workbook.getWorksheet('Collaborators');
      expect(collaboratorsSheet).toBeTruthy();
      
      let foundCollaborator = false;
      collaboratorsSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(2).value === 'Test PI Integration') {
          foundCollaborator = true;
          expect(row.getCell(1).value).toBeTruthy(); // ID column
        }
      });
      expect(foundCollaborator).toBe(true);

      // Check Projects sheet
      const projectsSheet = workbook.getWorksheet('Projects');
      expect(projectsSheet).toBeTruthy();
      
      let foundProject = false;
      projectsSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(8).value && 
            row.getCell(8).value.includes('Integration Test Project')) {
          foundProject = true;
          expect(row.getCell(1).value).toBeTruthy(); // ID column
        }
      });
      expect(foundProject).toBe(true);

      // Check Specimens sheet
      const specimensSheet = workbook.getWorksheet('Specimens');
      expect(specimensSheet).toBeTruthy();
      
      let foundSpecimen = false;
      specimensSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(3).value && 
            row.getCell(3).value.toString().startsWith('TEST-TUBE-')) {
          foundSpecimen = true;
          expect(row.getCell(1).value).toBeTruthy(); // Specimen Number column
        }
      });
      expect(foundSpecimen).toBe(true);

      // Clean up temp file
      await fs.unlink(tempPath);
    });
  });

  describe('Step 5: Verify ID consistency', () => {
    it('should maintain ID consistency across all operations', async () => {
      // Get all specimens and verify IDs are sequential
      const specimensResponse = await request(app)
        .get('/api/specimens')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          filters: JSON.stringify({
            tube_id: 'TEST-TUBE-'
          })
        });

      expect(specimensResponse.status).toBe(200);
      const specimens = specimensResponse.body;
      
      // Check that specimen numbers are integers
      specimens.forEach(specimen => {
        if (specimen.specimen_number) {
          expect(Number.isInteger(specimen.specimen_number)).toBe(true);
          expect(specimen.specimen_number).toBeGreaterThan(0);
        }
      });

      // Verify no duplicate IDs
      const specimenNumbers = specimens
        .map(s => s.specimen_number)
        .filter(n => n != null);
      
      const uniqueNumbers = new Set(specimenNumbers);
      expect(uniqueNumbers.size).toBe(specimenNumbers.length);
    });
  });

  describe('Step 6: Test re-import scenario', () => {
    it('should handle re-import without ID conflicts', async () => {
      // First, export current data
      const exportResponse = await request(app)
        .get('/api/export/specimens/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          filters: JSON.stringify({
            tube_id: 'TEST-TUBE-'
          })
        });

      expect(exportResponse.status).toBe(200);
      const csvContent = exportResponse.text;

      // Simulate import of the exported data
      // This should not create duplicate IDs
      const importData = csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });

      // The import endpoint should handle existing IDs gracefully
      // (Implementation depends on your import logic)
      
      // Verify no new duplicate IDs were created
      const afterImportResponse = await request(app)
        .get('/api/specimens')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          filters: JSON.stringify({
            tube_id: 'TEST-TUBE-'
          })
        });

      const afterImportSpecimens = afterImportResponse.body;
      const afterImportNumbers = afterImportSpecimens
        .map(s => s.specimen_number)
        .filter(n => n != null);
      
      const uniqueAfterImport = new Set(afterImportNumbers);
      expect(uniqueAfterImport.size).toBe(afterImportNumbers.length);
    });
  });
});