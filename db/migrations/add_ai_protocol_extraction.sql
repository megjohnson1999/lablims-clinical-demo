-- Migration: Add AI-powered protocol extraction system
-- This migration adds tables for document storage and AI extraction processing

-- Create protocol_documents table for storing uploaded documents
CREATE TABLE IF NOT EXISTS protocol_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create extraction_jobs table for tracking AI extraction processes
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id VARCHAR(50) UNIQUE NOT NULL,
  document_id UUID REFERENCES protocol_documents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  initiated_by UUID REFERENCES users(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  processing_time_ms INTEGER
);

-- Create extracted_protocol_data table for storing AI extraction results
CREATE TABLE IF NOT EXISTS extracted_protocol_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  document_id UUID REFERENCES protocol_documents(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL, -- Main extraction results with confidence scores
  extraction_metadata JSONB NOT NULL, -- Processing metadata, warnings, etc.
  overall_confidence DECIMAL(3,2), -- Overall confidence score 0.00-1.00
  manual_review_required BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  review_date TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add extraction_source to protocols table to track source
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS extraction_job_id UUID REFERENCES extraction_jobs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES protocol_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS manual_review_completed BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_protocol_documents_protocol_id ON protocol_documents(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_documents_uploaded_by ON protocol_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_protocol_documents_upload_date ON protocol_documents(upload_date);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_initiated_by ON extraction_jobs(initiated_by);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_started_at ON extraction_jobs(started_at);

CREATE INDEX IF NOT EXISTS idx_extracted_protocol_data_job_id ON extracted_protocol_data(extraction_job_id);
CREATE INDEX IF NOT EXISTS idx_extracted_protocol_data_document_id ON extracted_protocol_data(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_protocol_data_confidence ON extracted_protocol_data(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_extracted_protocol_data_review_required ON extracted_protocol_data(manual_review_required);

CREATE INDEX IF NOT EXISTS idx_protocols_extraction_job ON protocols(extraction_job_id);
CREATE INDEX IF NOT EXISTS idx_protocols_source_document ON protocols(source_document_id);

-- Create function to generate unique job IDs
CREATE OR REPLACE FUNCTION generate_extraction_job_id()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_job_id VARCHAR(50);
  counter INTEGER := 0;
BEGIN
  LOOP
    new_job_id := 'EXT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 10000)::TEXT, 4, '0');
    
    -- Add random suffix if collision
    IF counter > 0 THEN
      new_job_id := new_job_id || '-' || LPAD(counter::TEXT, 2, '0');
    END IF;
    
    -- Check if this ID already exists
    IF NOT EXISTS (SELECT 1 FROM extraction_jobs WHERE job_id = new_job_id) THEN
      RETURN new_job_id;
    END IF;
    
    counter := counter + 1;
    IF counter > 99 THEN
      RAISE EXCEPTION 'Unable to generate unique job ID after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to update extraction job status
CREATE OR REPLACE FUNCTION update_extraction_job_status(
  p_job_id VARCHAR(50),
  p_status VARCHAR(50),
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_status = 'completed' OR p_status = 'failed' THEN
    UPDATE extraction_jobs 
    SET status = p_status,
        completed_at = CURRENT_TIMESTAMP,
        error_message = p_error_message,
        processing_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000
    WHERE job_id = p_job_id;
  ELSE
    UPDATE extraction_jobs 
    SET status = p_status,
        error_message = p_error_message
    WHERE job_id = p_job_id;
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to get extraction statistics
CREATE OR REPLACE FUNCTION get_extraction_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  total_extractions BIGINT,
  successful_extractions BIGINT,
  failed_extractions BIGINT,
  average_confidence DECIMAL(3,2),
  average_processing_time_ms DECIMAL(10,2),
  review_required_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_extractions,
    COUNT(CASE WHEN ej.status = 'completed' THEN 1 END)::BIGINT as successful_extractions,
    COUNT(CASE WHEN ej.status = 'failed' THEN 1 END)::BIGINT as failed_extractions,
    AVG(epd.overall_confidence) as average_confidence,
    AVG(ej.processing_time_ms::DECIMAL) as average_processing_time_ms,
    COUNT(CASE WHEN epd.manual_review_required THEN 1 END)::BIGINT as review_required_count
  FROM extraction_jobs ej
  LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
  WHERE ej.started_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back);
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old extraction data
CREATE OR REPLACE FUNCTION cleanup_old_extraction_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old failed extraction jobs and related data
  WITH deleted_jobs AS (
    DELETE FROM extraction_jobs 
    WHERE status = 'failed' 
      AND started_at < (CURRENT_DATE - INTERVAL '1 day' * days_to_keep)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
  
  -- Note: Successful extractions are kept indefinitely as they may be linked to active protocols
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at timestamps on new tables
CREATE TRIGGER update_extraction_job_timestamp 
  BEFORE UPDATE ON extraction_jobs 
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON protocol_documents TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON extraction_jobs TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON extracted_protocol_data TO PUBLIC;
GRANT EXECUTE ON FUNCTION generate_extraction_job_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION update_extraction_job_status(VARCHAR, VARCHAR, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_extraction_statistics(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_extraction_data(INTEGER) TO PUBLIC;

-- Create view for document extraction overview
CREATE OR REPLACE VIEW document_extraction_overview AS
SELECT 
  pd.id as document_id,
  pd.filename,
  pd.original_filename,
  pd.file_size,
  pd.mime_type,
  pd.upload_date,
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