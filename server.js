const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { Pool } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { 
    missingVars: missingEnvVars,
    message: 'Please check your .env file and ensure these variables are set.'
  });
  process.exit(1);
}

// Initialize Express app
const app = express();

// Connect to PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database in production (Railway sets NODE_ENV or RAILWAY_ENVIRONMENT)
async function initializeDatabase() {
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    try {
      // Create sequencing tables if they don't exist (safe for existing databases)
      const sequencingTablesSQL = `
        -- Sequencing runs table
        CREATE TABLE IF NOT EXISTS sequencing_runs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          run_number INTEGER UNIQUE NOT NULL,
          service_request_number VARCHAR(255),
          flowcell_id VARCHAR(255),
          pool_name VARCHAR(255),
          completion_date TIMESTAMP,
          sequencer_type VARCHAR(100) DEFAULT 'NovaSeq',
          base_directory TEXT,
          file_pattern_r1 VARCHAR(255) DEFAULT '_R1.fastq.gz',
          file_pattern_r2 VARCHAR(255) DEFAULT '_R2.fastq.gz',
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Sequencing samples table
        CREATE TABLE IF NOT EXISTS sequencing_samples (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          specimen_id UUID REFERENCES specimens(id) ON DELETE SET NULL,
          sequencing_run_id UUID REFERENCES sequencing_runs(id) ON DELETE CASCADE,
          facility_sample_name VARCHAR(255) NOT NULL,
          wuid INTEGER,
          library_id VARCHAR(255),
          esp_id VARCHAR(255),
          index_sequence VARCHAR(255),
          flowcell_lane VARCHAR(50),
          fastq_r1_path TEXT,
          fastq_r2_path TEXT,
          species VARCHAR(255),
          library_type VARCHAR(100),
          sample_type VARCHAR(100),
          total_reads BIGINT,
          total_bases BIGINT,
          pct_q30_r1 DECIMAL(5,2),
          pct_q30_r2 DECIMAL(5,2),
          avg_q_score_r1 DECIMAL(5,2),
          avg_q_score_r2 DECIMAL(5,2),
          phix_error_rate_r1 DECIMAL(6,4),
          phix_error_rate_r2 DECIMAL(6,4),
          pct_pass_filter_r1 DECIMAL(5,2),
          pct_pass_filter_r2 DECIMAL(5,2),
          link_status VARCHAR(50) DEFAULT 'pending' CHECK (link_status IN ('pending', 'linked', 'no_match', 'failed')),
          link_error TEXT,
          linked_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Function to generate sequencing run numbers
        CREATE OR REPLACE FUNCTION generate_sequencing_run_number()
        RETURNS INTEGER AS $$
        DECLARE
          next_num INTEGER;
        BEGIN
          SELECT COALESCE(MAX(run_number), 0) + 1 INTO next_num FROM sequencing_runs;
          RETURN next_num;
        END;
        $$ LANGUAGE plpgsql;
      `;

      await pool.query(sequencingTablesSQL);
      logger.info('Sequencing tables initialized successfully');
    } catch (error) {
      logger.error('Database initialization error:', error);
      // Don't exit - let server start anyway for debugging
    }
  } else {
    logger.info('Skipping database initialization (not in production environment)');
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for large metadata uploads
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Health check endpoint for API testing
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({
      message: 'Pathogen Discovery Database API',
      dbConnection: 'Success',
      timestamp: dbRes.rows[0].now
    });
  } catch (err) {
    res.json({
      message: 'Pathogen Discovery Database API',
      dbConnection: 'Failed',
      error: err.message
    });
  }
});

// Fix ID generation functions to use MAX+1 approach (fixes duplicate ID issue)
app.post('/api/admin/fix-id-functions', async (req, res) => {
  try {
    const fixFunctions = `
      CREATE OR REPLACE FUNCTION get_next_number(entity_type VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE next_val INTEGER;
      BEGIN
        CASE entity_type
          WHEN 'collaborator' THEN
            SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
          WHEN 'project' THEN  
            SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
          WHEN 'specimen' THEN
            SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
          WHEN 'patient' THEN
            SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
          WHEN 'protocol' THEN
            SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
          WHEN 'inventory' THEN
            SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
          WHEN 'experiment' THEN
            SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
          ELSE RAISE EXCEPTION 'Invalid entity type: %', entity_type;
        END CASE;
        RETURN next_val;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION peek_next_number(entity_type VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE next_val INTEGER;
      BEGIN
        CASE entity_type
          WHEN 'collaborator' THEN
            SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
          WHEN 'project' THEN
            SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
          WHEN 'specimen' THEN
            SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
          WHEN 'patient' THEN
            SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
          WHEN 'protocol' THEN
            SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
          WHEN 'inventory' THEN
            SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
          WHEN 'experiment' THEN
            SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
          ELSE RAISE EXCEPTION 'Invalid entity type: %', entity_type;
        END CASE;
        RETURN next_val;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await db.query(fixFunctions);
    
    const collaboratorNext = await db.query("SELECT get_next_number('collaborator') as next_id");
    const projectNext = await db.query("SELECT get_next_number('project') as next_id");
    
    res.json({
      success: true,
      message: 'ID functions fixed - now using MAX+1',
      results: {
        next_collaborator: collaboratorNext.rows[0].next_id,
        next_project: projectNext.rows[0].next_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint to deploy full schema using core schema.sql
app.post('/api/admin/deploy-schema', async (req, res) => {
  try {
    const fs = require('fs');
    const schemaSQL = fs.readFileSync('./db/schema.sql', 'utf8');
    await pool.query(schemaSQL);
    
    res.json({
      success: true,
      message: 'Core database schema deployed successfully!'
    });
  } catch (error) {
    logger.error('Schema deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Schema deployment error',
      error: error.message
    });
  }
});

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/collaborators', require('./routes/collaborators'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/specimens', require('./routes/specimens'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/protocols', require('./routes/protocols'));
app.use('/api/experiments', require('./routes/experiments'));
app.use('/api/labels', require('./routes/labels'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/import'));
app.use('/api/import/comprehensive', require('./routes/comprehensiveImport'));
app.use('/api/import/multi-file', require('./routes/multiFileImport'));
app.use('/api/unified-import', require('./routes/unifiedImport'));
app.use('/api/metadata', require('./routes/metadata'));
app.use('/api/system-options', require('./routes/systemOptions'));
app.use('/api/ids', require('./routes/ids'));
app.use('/api/errors', require('./routes/errors'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/sequencing', require('./routes/sequencing'));
app.use('/api/analytics', require('./routes/analytics'));

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Handle React routing - this MUST come after API routes
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.url.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const buildPath = path.join(__dirname, 'client/build', 'index.html');
    try {
      res.sendFile(buildPath);
    } catch (error) {
      logger.error('Failed to serve React app:', error);
      res.status(500).send('Application temporarily unavailable');
    }
  });
}

// Error handling middleware
const { errorMiddleware } = require('./utils/errorHandler');
app.use(errorMiddleware);

// Set port
const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });

  // Log file storage location
  const uploadPath = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production'
    ? '/data/uploads/protocol-documents'
    : './uploads/protocol-documents';
  logger.info('File upload path configured', { path: uploadPath });

  // Initialize database after server starts (non-blocking)
  initializeDatabase().catch(error => {
    logger.error('Database initialization failed during startup:', error);
  });
});

// Keep server alive
server.keepAliveTimeout = 61000;
server.headersTimeout = 65000;

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});
