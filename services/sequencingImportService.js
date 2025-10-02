const db = require('../db');
const logger = require('../utils/logger');

/**
 * Extract WUID from facility sample name
 * Example: "I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M" -> 39552
 */
const extractWUID = (facilityName) => {
  if (!facilityName) return null;

  const parts = facilityName.split('_');
  if (parts.length >= 2) {
    const wuid = parseInt(parts[1], 10);
    return isNaN(wuid) ? null : wuid;
  }
  return null;
};

/**
 * Parse numeric value with comma formatting
 * Example: "1,613,040" -> 1613040
 */
const parseNumeric = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;

  // Remove commas and parse
  const cleaned = String(value).replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Find specimen by WUID
 */
const findSpecimenByWUID = async (wuid) => {
  const result = await db.query(
    'SELECT id FROM specimens WHERE specimen_number = $1',
    [wuid]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
};

/**
 * Create or get sequencing run
 */
const createOrGetSequencingRun = async (runData, userId) => {
  const {
    service_request_number,
    flowcell_id,
    pool_name,
    completion_date,
    sequencer_type,
    base_directory,
    file_pattern_r1,
    file_pattern_r2
  } = runData;

  // Check if run already exists
  const existing = await db.query(
    'SELECT id, run_number, base_directory, file_pattern_r1, file_pattern_r2, service_request_number, flowcell_id FROM sequencing_runs WHERE service_request_number = $1 OR flowcell_id = $2',
    [service_request_number, flowcell_id]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Generate new run number
  const runNumberResult = await db.query('SELECT generate_sequencing_run_number() as run_number');
  const runNumber = runNumberResult.rows[0].run_number;

  // Create new run
  const result = await db.query(
    `INSERT INTO sequencing_runs
     (run_number, service_request_number, flowcell_id, pool_name, completion_date, sequencer_type, base_directory, file_pattern_r1, file_pattern_r2, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, run_number, base_directory, file_pattern_r1, file_pattern_r2, service_request_number, flowcell_id`,
    [
      runNumber,
      service_request_number,
      flowcell_id,
      pool_name,
      completion_date,
      sequencer_type || 'NovaSeq',
      base_directory,
      file_pattern_r1 || '_R1.fastq.gz',
      file_pattern_r2 || '_R2.fastq.gz',
      userId
    ]
  );

  return result.rows[0];
};

/**
 * Construct FASTQ file path
 * Pattern: {base_directory}/{run_identifier}_{library_name}{pattern}
 */
const constructFastqPath = (baseDirectory, runIdentifier, libraryName, pattern) => {
  if (!baseDirectory || !libraryName) return null;

  // Remove any trailing slash from base directory
  const cleanBase = baseDirectory.replace(/\/$/, '');

  // Construct full path
  if (runIdentifier) {
    return `${cleanBase}/${runIdentifier}_${libraryName}${pattern}`;
  } else {
    return `${cleanBase}/${libraryName}${pattern}`;
  }
};

/**
 * Import sequencing sample
 */
const importSequencingSample = async (sampleData, runData, userId) => {
  const {
    facility_sample_name,
    library_id,
    esp_id,
    index_sequence,
    flowcell_lane,
    species,
    library_type,
    sample_type,
    total_reads,
    total_bases,
    pct_q30_r1,
    pct_q30_r2,
    avg_q_score_r1,
    avg_q_score_r2,
    phix_error_rate_r1,
    phix_error_rate_r2,
    pct_pass_filter_r1,
    pct_pass_filter_r2
  } = sampleData;

  // Extract WUID
  const wuid = extractWUID(facility_sample_name);

  if (!wuid) {
    return {
      success: false,
      status: 'failed',
      error: 'Could not extract WUID from facility sample name',
      facility_sample_name
    };
  }

  // Find matching specimen
  let specimenId = null;
  let linkStatus = 'no_match';
  let linkError = null;

  try {
    specimenId = await findSpecimenByWUID(wuid);

    if (specimenId) {
      linkStatus = 'linked';
    } else {
      linkError = `No specimen found with WUID ${wuid}`;
    }
  } catch (err) {
    linkStatus = 'failed';
    linkError = `Error finding specimen: ${err.message}`;
  }

  // Parse numeric values
  const parsedTotalReads = parseNumeric(total_reads);
  const parsedTotalBases = parseNumeric(total_bases);

  // Construct FASTQ file paths using run data
  const fastq_r1_path = constructFastqPath(
    runData.base_directory,
    runData.service_request_number || runData.flowcell_id,
    facility_sample_name,
    runData.file_pattern_r1 || '_R1.fastq.gz'
  );

  const fastq_r2_path = constructFastqPath(
    runData.base_directory,
    runData.service_request_number || runData.flowcell_id,
    facility_sample_name,
    runData.file_pattern_r2 || '_R2.fastq.gz'
  );

  // Insert sequencing sample
  const result = await db.query(
    `INSERT INTO sequencing_samples (
      specimen_id, sequencing_run_id, facility_sample_name, wuid, library_id, esp_id,
      index_sequence, flowcell_lane, fastq_r1_path, fastq_r2_path,
      species, library_type, sample_type,
      total_reads, total_bases, pct_q30_r1, pct_q30_r2,
      avg_q_score_r1, avg_q_score_r2, phix_error_rate_r1, phix_error_rate_r2,
      pct_pass_filter_r1, pct_pass_filter_r2,
      link_status, link_error, linked_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) RETURNING id`,
    [
      specimenId, runData.id, facility_sample_name, wuid, library_id, esp_id,
      index_sequence, flowcell_lane, fastq_r1_path, fastq_r2_path,
      species, library_type, sample_type,
      parsedTotalReads, parsedTotalBases, pct_q30_r1, pct_q30_r2,
      avg_q_score_r1, avg_q_score_r2, phix_error_rate_r1, phix_error_rate_r2,
      pct_pass_filter_r1, pct_pass_filter_r2,
      linkStatus, linkError, linkStatus === 'linked' ? new Date() : null
    ]
  );

  return {
    success: true,
    status: linkStatus,
    wuid,
    specimen_id: specimenId,
    sample_id: result.rows[0].id,
    facility_sample_name,
    library_id
  };
};

/**
 * Import sequencing data from CSV rows
 */
const importSequencingData = async (csvRows, runMetadata, userId) => {
  const results = {
    success: 0,
    linked: 0,
    no_match: 0,
    failed: 0,
    errors: [],
    run_id: null,
    run_number: null
  };

  let client;

  try {
    client = await db.getClient();
    await client.query('BEGIN');

    // Create or get sequencing run
    const run = await createOrGetSequencingRun(runMetadata, userId);
    results.run_id = run.id;
    results.run_number = run.run_number;

    // Import each sample
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];

      try {
        const result = await importSequencingSample(row, run, userId);

        if (result.success) {
          results.success++;

          if (result.status === 'linked') {
            results.linked++;
          } else if (result.status === 'no_match') {
            results.no_match++;
          }
        } else {
          results.failed++;
          results.errors.push({
            row: i + 1,
            facility_sample_name: row.facility_sample_name,
            error: result.error
          });
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          facility_sample_name: row.facility_sample_name,
          error: err.message
        });

        logger.error('Error importing sequencing sample', {
          row: i + 1,
          facility_sample_name: row.facility_sample_name,
          error: err.message
        });
      }
    }

    await client.query('COMMIT');

    logger.info('Sequencing import completed', {
      run_number: results.run_number,
      success: results.success,
      linked: results.linked,
      no_match: results.no_match,
      failed: results.failed
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }

    logger.error('Sequencing import failed', { error: err.message });
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }

  return results;
};

/**
 * Get sequencing data for a specimen
 */
const getSpecimenSequencingData = async (specimenId) => {
  const result = await db.query(
    `SELECT ss.*, sr.run_number, sr.service_request_number, sr.completion_date
     FROM sequencing_samples ss
     LEFT JOIN sequencing_runs sr ON ss.sequencing_run_id = sr.id
     WHERE ss.specimen_id = $1
     ORDER BY ss.created_at DESC`,
    [specimenId]
  );

  return result.rows;
};

/**
 * Get all sequencing runs
 */
const getSequencingRuns = async () => {
  const result = await db.query(
    `SELECT sr.*,
       COUNT(ss.id) as sample_count,
       SUM(CASE WHEN ss.link_status = 'linked' THEN 1 ELSE 0 END) as linked_count,
       SUM(CASE WHEN ss.link_status = 'no_match' THEN 1 ELSE 0 END) as no_match_count,
       SUM(CASE WHEN ss.link_status = 'failed' THEN 1 ELSE 0 END) as failed_count
     FROM sequencing_runs sr
     LEFT JOIN sequencing_samples ss ON sr.id = ss.sequencing_run_id
     GROUP BY sr.id
     ORDER BY sr.run_number DESC`
  );

  return result.rows;
};

/**
 * Get sequencing samples for a run
 */
const getRunSequencingSamples = async (runId) => {
  const result = await db.query(
    `SELECT ss.*, s.specimen_number, s.tube_id,
       p.project_number, c.pi_name
     FROM sequencing_samples ss
     LEFT JOIN specimens s ON ss.specimen_id = s.id
     LEFT JOIN projects p ON s.project_id = p.id
     LEFT JOIN collaborators c ON p.collaborator_id = c.id
     WHERE ss.sequencing_run_id = $1
     ORDER BY ss.wuid`,
    [runId]
  );

  return result.rows;
};

/**
 * Get a single sequencing run by ID
 */
const getSequencingRun = async (runId) => {
  const result = await db.query(
    `SELECT sr.*,
       COUNT(ss.id) as sample_count,
       SUM(CASE WHEN ss.link_status = 'linked' THEN 1 ELSE 0 END) as linked_count,
       SUM(CASE WHEN ss.link_status = 'no_match' THEN 1 ELSE 0 END) as no_match_count,
       SUM(CASE WHEN ss.link_status = 'failed' THEN 1 ELSE 0 END) as failed_count
     FROM sequencing_runs sr
     LEFT JOIN sequencing_samples ss ON sr.id = ss.sequencing_run_id
     WHERE sr.id = $1
     GROUP BY sr.id`,
    [runId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Delete a sequencing run and all associated samples
 */
const deleteSequencingRun = async (runId, userId) => {
  let client;

  try {
    client = await db.getClient();
    await client.query('BEGIN');

    // Delete all samples associated with the run (cascade should handle this, but being explicit)
    await client.query(
      'DELETE FROM sequencing_samples WHERE sequencing_run_id = $1',
      [runId]
    );

    // Delete the run
    const result = await client.query(
      'DELETE FROM sequencing_runs WHERE id = $1 RETURNING service_request_number, flowcell_id',
      [runId]
    );

    if (result.rows.length === 0) {
      throw new Error('Run not found');
    }

    await client.query('COMMIT');

    logger.info('Sequencing run deleted', {
      runId,
      service_request: result.rows[0].service_request_number,
      flowcell: result.rows[0].flowcell_id,
      userId
    });

    return { success: true };
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logger.error('Failed to delete sequencing run', { runId, error: err.message });
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  extractWUID,
  importSequencingData,
  getSpecimenSequencingData,
  getSequencingRuns,
  getSequencingRun,
  getRunSequencingSamples,
  deleteSequencingRun
};