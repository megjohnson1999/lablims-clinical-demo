-- Migration: Add document metadata fields for enhanced organization
-- This migration adds category and description fields to protocol_documents table

-- Add category and description fields to protocol_documents table
ALTER TABLE protocol_documents 
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for category for better filtering performance
CREATE INDEX IF NOT EXISTS idx_protocol_documents_category ON protocol_documents(category);

-- Add comments for documentation
COMMENT ON COLUMN protocol_documents.category IS 'Optional category for organizing documents (e.g., "Standard Protocols", "SOPs", "References")';
COMMENT ON COLUMN protocol_documents.description IS 'Optional description or notes about the document';

-- Update the document_extraction_overview view to include new fields
DROP VIEW IF EXISTS document_extraction_overview;
CREATE OR REPLACE VIEW document_extraction_overview AS
SELECT 
  pd.id as document_id,
  pd.filename,
  pd.original_filename,
  pd.file_size,
  pd.mime_type,
  pd.upload_date,
  pd.category,
  pd.description,
  u_upload.username as uploaded_by_username,
  ej.job_id,
  ej.status as extraction_status,
  ej.started_at as extraction_started,
  ej.completed_at as extraction_completed,
  ej.processing_time_ms,
  epd.overall_confidence,
  epd.manual_review_required,
  epd.reviewed_by,
  epd.review_date,
  u_review.username as reviewed_by_username,
  p.id as protocol_id,
  p.name as protocol_name
FROM protocol_documents pd
LEFT JOIN users u_upload ON pd.uploaded_by = u_upload.id
LEFT JOIN extraction_jobs ej ON pd.id = ej.document_id
LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
LEFT JOIN users u_review ON epd.reviewed_by = u_review.id
LEFT JOIN protocols p ON pd.protocol_id = p.id
ORDER BY pd.upload_date DESC;

GRANT SELECT ON document_extraction_overview TO PUBLIC;