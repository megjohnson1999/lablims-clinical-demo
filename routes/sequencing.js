const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const authenticateToken = require('../middleware/auth');
const sequencingService = require('../services/sequencingImportService');
const logger = require('../utils/logger');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

/**
 * Parse CSV/Excel file to JSON
 */
const parseFile = (buffer, filename) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    return data;
  } catch (err) {
    throw new Error(`Failed to parse file: ${err.message}`);
  }
};

/**
 * Map CSV columns to database fields
 */
const mapSequencingData = (row) => {
  return {
    facility_sample_name: row['Library Name'] || row['facility_sample_name'],
    library_id: row['Library Name'] || row['Library ID'] || row['library_id'], // Use Library Name as ID if not separate
    esp_id: row['ESP ID'] || row['esp_id'],
    index_sequence: row['Index Sequence'] || row['index_sequence'],
    flowcell_lane: row['Flowcell Lane'] || row['flowcell_lane'],
    fastq_r1_path: row['FASTQ Path - Read 1'] || row['fastq_r1_path'],
    fastq_r2_path: row['FASTQ Path - Read 2'] || row['fastq_r2_path'],
    species: row['Species'] || row['species'],
    library_type: row['Library Type'] || row['library_type'],
    sample_type: row['Illumina Sample Type'] || row['Sample Type'] || row['sample_type'],
    total_reads: row['Total Reads'] || row['total_reads'],
    total_bases: row['Total Bases'] || row['total_bases'],
    pct_q30_r1: row['% >Q30 Read 1'] || row['pct_q30_r1'],
    pct_q30_r2: row['% >Q30 Read 2'] || row['pct_q30_r2'],
    avg_q_score_r1: row['Avg Q Score Read 1'] || row['avg_q_score_r1'],
    avg_q_score_r2: row['Avg Q Score Read 2'] || row['avg_q_score_r2'],
    phix_error_rate_r1: row['PhiX Error Rate Read 1'] || row['phix_error_rate_r1'],
    phix_error_rate_r2: row['PhiX Error Rate Read 2'] || row['phix_error_rate_r2'],
    pct_pass_filter_r1: row['% Pass Filter Clusters Read 1'] || row['pct_pass_filter_r1'],
    pct_pass_filter_r2: row['% Pass Filter Clusters Read 2'] || row['pct_pass_filter_r2'],
    date_complete: row['Date Complete'] || row['date_complete']
  };
};

/**
 * Helper function to parse completion date from various formats
 */
const parseCompletionDate = (dateValue) => {
  if (!dateValue) return null;

  // Handle Excel serial date numbers (days since 1900-01-01)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
  } else {
    // Parse as string date
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  return null;
};

/**
 * POST /api/sequencing/preview
 * Preview sequencing data from CSV/Excel file WITHOUT saving
 */
router.post('/preview', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse file
    const rawData = parseFile(req.file.buffer, req.file.originalname);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    // Extract completion date from first row
    const firstRowDate = rawData[0]['Date Complete'] || rawData[0]['date_complete'];
    const extractedDate = parseCompletionDate(firstRowDate);

    // Check for date warnings
    const dateWarnings = [];
    if (extractedDate) {
      const year = extractedDate.getFullYear();
      if (year < 2000 || year > 2050) {
        dateWarnings.push(`Date looks suspicious: ${extractedDate.toLocaleDateString()}`);
      }
    } else if (firstRowDate) {
      dateWarnings.push('Could not parse completion date from file');
    }

    // Preview first 5 samples with WUID extraction
    const samplePreviews = rawData.slice(0, 5).map((row, idx) => {
      const facilityName = row['Library Name'] || row['facility_sample_name'];
      const wuid = sequencingService.extractWUID(facilityName);

      return {
        row: idx + 1,
        facility_sample_name: facilityName,
        wuid: wuid,
        has_wuid: wuid !== null,
        library_type: row['Library Type'] || row['library_type']
      };
    });

    // Count samples with/without WUIDs
    const totalSamples = rawData.length;
    const samplesWithWUID = rawData.filter(row => {
      const facilityName = row['Library Name'] || row['facility_sample_name'];
      return sequencingService.extractWUID(facilityName) !== null;
    }).length;

    // Build warnings array
    const warnings = [...dateWarnings];
    if (samplesWithWUID < totalSamples) {
      warnings.push(`${totalSamples - samplesWithWUID} samples may not link to specimens (no WUID found)`);
    }

    res.json({
      success: true,
      preview: {
        total_samples: totalSamples,
        samples_with_wuid: samplesWithWUID,
        completion_date: extractedDate ? extractedDate.toISOString() : null,
        completion_date_display: extractedDate ? extractedDate.toLocaleDateString() : 'Not found',
        sample_previews: samplePreviews,
        warnings: warnings
      }
    });

  } catch (err) {
    logger.error('Sequencing preview failed', {
      user: req.user?.username,
      error: err.message
    });

    res.status(500).json({
      error: 'Failed to preview sequencing data',
      details: err.message
    });
  }
});

/**
 * POST /api/sequencing/import
 * Import sequencing data from CSV/Excel file
 */
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      service_request_number,
      flowcell_id,
      pool_name,
      completion_date,
      sequencer_type,
      base_directory,
      file_pattern_r1,
      file_pattern_r2,
      library_type
    } = req.body;

    // Parse file
    const rawData = parseFile(req.file.buffer, req.file.originalname);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    // Map data to expected format and add library_type if provided
    const mappedData = rawData.map(row => ({
      ...mapSequencingData(row),
      library_type: library_type || row['Library Type'] || row['library_type']
    }));

    // Extract completion date from file if present
    let extractedDate = null;
    if (rawData.length > 0) {
      const firstRowDate = rawData[0]['Date Complete'] || rawData[0]['date_complete'];
      extractedDate = parseCompletionDate(firstRowDate);
    }

    // Prepare run metadata
    const runMetadata = {
      service_request_number,
      flowcell_id,
      pool_name,
      completion_date: extractedDate,
      sequencer_type: sequencer_type || 'NovaSeq',
      base_directory,
      file_pattern_r1: file_pattern_r1 || '_R1.fastq.gz',
      file_pattern_r2: file_pattern_r2 || '_R2.fastq.gz'
    };

    // Import data
    const results = await sequencingService.importSequencingData(
      mappedData,
      runMetadata,
      req.user.id
    );

    logger.info('Sequencing data import completed', {
      user: req.user.username,
      run_number: results.run_number,
      total: rawData.length,
      success: results.success,
      linked: results.linked,
      no_match: results.no_match,
      failed: results.failed
    });

    res.json({
      success: true,
      message: 'Sequencing data imported successfully',
      results
    });

  } catch (err) {
    logger.error('Sequencing import failed', {
      user: req.user?.username,
      error: err.message
    });

    res.status(500).json({
      error: 'Failed to import sequencing data',
      details: err.message
    });
  }
});

/**
 * GET /api/sequencing/runs
 * Get all sequencing runs
 */
router.get('/runs', authenticateToken, async (req, res) => {
  try {
    const runs = await sequencingService.getSequencingRuns();
    res.json(runs);
  } catch (err) {
    logger.error('Failed to fetch sequencing runs', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch sequencing runs' });
  }
});

/**
 * GET /api/sequencing/runs/:runId
 * Get a specific sequencing run
 */
router.get('/runs/:runId', authenticateToken, async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await sequencingService.getSequencingRun(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  } catch (err) {
    logger.error('Failed to fetch sequencing run', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch sequencing run' });
  }
});

/**
 * DELETE /api/sequencing/runs/:runId
 * Delete a sequencing run and all associated samples
 */
router.delete('/runs/:runId', authenticateToken, async (req, res) => {
  try {
    const { runId } = req.params;
    await sequencingService.deleteSequencingRun(runId, req.user.id);

    logger.info('Sequencing run deleted', {
      user: req.user.username,
      runId
    });

    res.json({
      success: true,
      message: 'Sequencing run deleted successfully'
    });
  } catch (err) {
    logger.error('Failed to delete sequencing run', {
      user: req.user?.username,
      runId: req.params.runId,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to delete sequencing run' });
  }
});

/**
 * GET /api/sequencing/runs/:runId/samples
 * Get all samples for a specific run
 */
router.get('/runs/:runId/samples', authenticateToken, async (req, res) => {
  try {
    const { runId } = req.params;
    const samples = await sequencingService.getRunSequencingSamples(runId);
    res.json(samples);
  } catch (err) {
    logger.error('Failed to fetch run samples', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch run samples' });
  }
});

/**
 * GET /api/sequencing/specimen/:specimenId
 * Get sequencing data for a specific specimen
 */
router.get('/specimen/:specimenId', authenticateToken, async (req, res) => {
  try {
    const { specimenId } = req.params;
    const sequencingData = await sequencingService.getSpecimenSequencingData(specimenId);
    res.json(sequencingData);
  } catch (err) {
    logger.error('Failed to fetch specimen sequencing data', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch specimen sequencing data' });
  }
});

module.exports = router;