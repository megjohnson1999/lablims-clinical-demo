-- Migration: Add sequencing tracking fields to specimens table
-- Date: 2025-07-14
-- Description: Adds fields for tracking sequencing runs, file locations, analysis status, and related notes

-- Add new sequencing tracking fields to specimens table
ALTER TABLE specimens ADD COLUMN sequencing_run_id VARCHAR(255);
ALTER TABLE specimens ADD COLUMN fastq_location TEXT;
ALTER TABLE specimens ADD COLUMN analysis_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE specimens ADD COLUMN results_location TEXT;
ALTER TABLE specimens ADD COLUMN sequencing_notes TEXT;

-- Add index for better performance on sequencing_run_id searches
CREATE INDEX IF NOT EXISTS idx_specimens_sequencing_run_id ON specimens(sequencing_run_id);

-- Add index for analysis_status filtering
CREATE INDEX IF NOT EXISTS idx_specimens_analysis_status ON specimens(analysis_status);

-- Add comments for field documentation
COMMENT ON COLUMN specimens.sequencing_run_id IS 'Identifier for the sequencing run associated with this specimen';
COMMENT ON COLUMN specimens.fastq_location IS 'File path or location of the FASTQ sequencing data files';
COMMENT ON COLUMN specimens.analysis_status IS 'Current status of bioinformatics analysis: pending, in_progress, completed, failed';
COMMENT ON COLUMN specimens.results_location IS 'File path or location of analysis results and reports';
COMMENT ON COLUMN specimens.sequencing_notes IS 'Notes and comments related to sequencing and analysis workflow';