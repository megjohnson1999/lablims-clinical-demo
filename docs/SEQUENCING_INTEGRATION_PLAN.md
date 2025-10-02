# Sequencing Data Integration Plan

## Overview

This document outlines the plan to integrate sequencing data from the facility into the LIMS using automated WUID linking.

## Key Insight

The sequencing facility provides sample names like:
```
I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M
```

The **second position** (39552) is always the WUID, which corresponds to `specimen_number` in the LIMS database. This enables fully automated linking of sequencing data to specimens.

## Current Sequencing Data Structure

### Files from Facility
- `NovaSeq_N978_QC.csv` - Quality control metrics
- `NovaSeq_N978_Samplemap.csv` - File paths and technical details
- `NovaSeq_N978_Samplemap2.csv` - Combined QC + file path data
- `NovaSeq_N978_rename_guide.txt` - File renaming mappings

### Available Data Fields
- **Run Information**: Service request number, flowcell ID, pool name, completion date
- **Sample Technical**: FASTQ paths (R1/R2), library IDs, index sequences, flowcell lanes
- **Quality Metrics**: Total reads/bases, Q30 percentages, Q scores, PhiX error rates
- **Library Metadata**: Species, library type, sample type

## Database Schema Changes

### 1. Sequencing Runs Table
```sql
CREATE TABLE IF NOT EXISTS sequencing_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_number INTEGER UNIQUE,
  service_request_number VARCHAR(255),
  flowcell_id VARCHAR(255),
  pool_name VARCHAR(255),
  sequencer_type VARCHAR(100) DEFAULT 'NovaSeq',
  completion_date TIMESTAMP,
  run_status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Sequencing Samples Table
```sql
CREATE TABLE IF NOT EXISTS sequencing_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  specimen_id UUID REFERENCES specimens(id) ON DELETE CASCADE,
  sequencing_run_id UUID REFERENCES sequencing_runs(id),
  
  -- Facility identifiers
  facility_sample_name VARCHAR(255), -- Full name: I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M
  wuid INTEGER, -- Extracted from position 2: 39552
  library_id VARCHAR(255), -- LIB059299
  esp_id VARCHAR(255),
  
  -- Technical details
  index_sequence VARCHAR(100), -- TGCCGGTCAG-TTGTATCAGG
  flowcell_lane INTEGER,
  fastq_r1_path TEXT,
  fastq_r2_path TEXT,
  
  -- QC metrics
  total_reads BIGINT,
  total_bases BIGINT,
  pct_q30_r1 DECIMAL(5,2),
  pct_q30_r2 DECIMAL(5,2),
  avg_q_score_r1 DECIMAL(5,2),
  avg_q_score_r2 DECIMAL(5,2),
  phix_error_rate_r1 DECIMAL(8,4),
  phix_error_rate_r2 DECIMAL(8,4),
  pct_pass_filter_r1 DECIMAL(5,2),
  pct_pass_filter_r2 DECIMAL(5,2),
  
  -- Linking info
  link_status VARCHAR(50) DEFAULT 'pending', -- pending, linked, no_match
  linked_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraint for automated linking
  FOREIGN KEY (wuid) REFERENCES specimens(specimen_number)
);
```

## Implementation Plan

### Phase 1: Backend Infrastructure
1. **Add schema changes** to `db/schema.sql`
2. **Create import service** (`services/sequencingImportService.js`)
3. **Add API routes** (`routes/sequencingImport.js`)
4. **Add ID generation** for sequencing runs

### Phase 2: Import Logic
```javascript
// WUID extraction function
const extractWUID = (facilityName) => {
  // Parse: I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M
  const parts = facilityName.split('_');
  if (parts.length >= 2) {
    const wuid = parseInt(parts[1]);
    return isNaN(wuid) ? null : wuid;
  }
  return null;
};

// Import workflow
const importSequencingData = async (csvData) => {
  const results = { success: 0, failed: 0, noMatch: 0 };
  
  for (const row of csvData) {
    try {
      // Extract WUID from facility sample name
      const wuid = extractWUID(row.facility_sample_name);
      
      if (!wuid) {
        results.failed++;
        continue;
      }
      
      // Find matching specimen
      const specimen = await pool.query(
        'SELECT id FROM specimens WHERE specimen_number = $1',
        [wuid]
      );
      
      if (specimen.rows.length === 0) {
        // Insert with no match - can be reviewed later
        await pool.query(`
          INSERT INTO sequencing_samples (
            facility_sample_name, wuid, library_id, fastq_r1_path, fastq_r2_path,
            total_reads, pct_q30_r1, pct_q30_r2, link_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'no_match')
        `, [
          row.facility_sample_name, wuid, row.library_id,
          row.fastq_r1_path, row.fastq_r2_path,
          row.total_reads, row.pct_q30_r1, row.pct_q30_r2
        ]);
        results.noMatch++;
      } else {
        // Successful linking
        await pool.query(`
          INSERT INTO sequencing_samples (
            specimen_id, facility_sample_name, wuid, library_id,
            fastq_r1_path, fastq_r2_path, total_reads, pct_q30_r1, pct_q30_r2,
            link_status, linked_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'linked', NOW())
        `, [
          specimen.rows[0].id, row.facility_sample_name, wuid, row.library_id,
          row.fastq_r1_path, row.fastq_r2_path,
          row.total_reads, row.pct_q30_r1, row.pct_q30_r2
        ]);
        results.success++;
      }
    } catch (err) {
      logger.error('Sequencing import error', { error: err.message, row });
      results.failed++;
    }
  }
  
  return results;
};
```

### Phase 3: Frontend Components
1. **Sequencing Import Page** (`components/sequencing/SequencingImport.js`)
   - CSV upload interface
   - Import preview with WUID matching
   - Results summary (success/failed/no_match counts)

2. **Sequencing Dashboard** (`components/sequencing/SequencingDashboard.js`)
   - Run-level statistics
   - QC metrics visualization
   - Link status overview

3. **Enhanced Specimen Detail** 
   - Add sequencing status indicator
   - Show linked FASTQ files
   - Display QC metrics
   - Direct download links

### Phase 4: Integration Enhancements
1. **Specimen List Updates**
   - Add "Sequenced" status column
   - Filter by sequencing status
   - Bulk operations for sequenced samples

2. **Search Enhancements**
   - Search by library ID
   - Search by sequencing run
   - Filter by QC status

3. **Reporting Features**
   - Sequencing success rates
   - QC trend analysis
   - File location tracking

## Benefits

✅ **Fully Automated**: No manual specimen linking required  
✅ **Reliable**: WUID is a stable, unique identifier  
✅ **Traceable**: Complete path from specimen → sequencing → FASTQ files  
✅ **Flexible**: Can handle cases where WUID doesn't match (review queue)  
✅ **Scalable**: Works for any number of sequencing runs  

## File Structure Changes

### New Files to Create
```
routes/sequencingImport.js          # API endpoints for import
services/sequencingImportService.js # Import business logic
client/src/components/sequencing/   # Frontend components
  ├── SequencingImport.js          # Import interface
  ├── SequencingDashboard.js       # Dashboard/analytics
  └── SequencingList.js            # Browse sequencing data
```

### Files to Modify
```
db/schema.sql                       # Add sequencing tables
server.js                          # Add sequencing routes
client/src/App.js                  # Add sequencing navigation
client/src/components/specimens/    # Add sequencing status
```

## Sample Data Mapping

### Input (from facility CSV):
```csv
FASTQ Path - Read 1,FASTQ Path - Read 2,Library Name,Total Reads,% >Q30 Read 1,% >Q30 Read 2
LIB059299_22HM22LT4_S895_L007_R1_001.fastq.gz,LIB059299_22HM22LT4_S895_L007_R2_001.fastq.gz,I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M,"1,613,040",93.0,95.0
```

### Extracted Data:
- **WUID**: 39552 (from position 2 of library name)
- **Library ID**: LIB059299
- **FASTQ R1**: LIB059299_22HM22LT4_S895_L007_R1_001.fastq.gz
- **FASTQ R2**: LIB059299_22HM22LT4_S895_L007_R2_001.fastq.gz
- **Total Reads**: 1,613,040
- **Q30 R1**: 93.0%
- **Q30 R2**: 95.0%

### Database Storage:
```sql
INSERT INTO sequencing_samples (
  specimen_id, facility_sample_name, wuid, library_id,
  fastq_r1_path, fastq_r2_path, total_reads, pct_q30_r1, pct_q30_r2,
  link_status, linked_at
) VALUES (
  'specimen-uuid', 'I13129_39552_Celiac_Leonard_Stool_01_GEMM_068_12M', 39552, 'LIB059299',
  'LIB059299_22HM22LT4_S895_L007_R1_001.fastq.gz',
  'LIB059299_22HM22LT4_S895_L007_R2_001.fastq.gz',
  1613040, 93.0, 95.0, 'linked', NOW()
);
```

## Next Steps

1. **Test WUID extraction** logic with sample data
2. **Add database schema** changes to main schema file
3. **Create import service** with error handling
4. **Build basic import interface** for CSV uploads
5. **Add sequencing status** to specimen views
6. **Implement QC dashboard** for monitoring

## Notes

- The system can handle cases where facility WUIDs don't match existing specimens (stored as 'no_match' for later review)
- All sequencing data is preserved even if linking fails
- QC metrics can be used for filtering and quality monitoring
- File paths enable direct access to raw sequencing data