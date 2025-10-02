-- Migration: Add JSONB metadata column to specimens table
-- This migration adds flexible metadata storage for diverse project types
-- Maintains full backward compatibility with existing Phase 0 functionality

-- Add metadata column to specimens table
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}' NOT NULL;

-- Set default empty JSON for existing specimens
UPDATE specimens SET metadata = '{}' WHERE metadata IS NULL;

-- Create GIN indexes for efficient JSON querying
-- General metadata index for any JSON operations
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_gin ON specimens USING GIN (metadata);

-- Specific indexes for common metadata query patterns
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_assay ON specimens USING GIN ((metadata->>'assay_type'));
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_treatment ON specimens USING GIN ((metadata->>'treatment_group'));
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_patient_age ON specimens USING GIN ((metadata->>'patient_age'));
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_sex ON specimens USING GIN ((metadata->>'sex'));
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_collection_date ON specimens USING GIN ((metadata->>'collection_date'));

-- Create composite index for project + metadata combinations
CREATE INDEX IF NOT EXISTS idx_specimens_project_metadata ON specimens USING GIN (project_id, metadata);

-- Helper function: Get all unique metadata keys used in a project
CREATE OR REPLACE FUNCTION get_project_metadata_keys(project_id_param INTEGER)
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT key ORDER BY key)
  INTO result
  FROM specimens s,
       jsonb_each_text(s.metadata) AS j(key, value)
  WHERE s.project_id = project_id_param
    AND s.metadata != '{}'::jsonb;
    
  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get metadata field statistics for a project
CREATE OR REPLACE FUNCTION get_metadata_field_stats(project_id_param INTEGER)
RETURNS TABLE(
  field_name TEXT,
  usage_count BIGINT,
  unique_values BIGINT,
  sample_values TEXT[],
  data_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH field_analysis AS (
    SELECT 
      j.key as field_name,
      COUNT(*) as usage_count,
      COUNT(DISTINCT j.value) as unique_values,
      ARRAY_AGG(DISTINCT j.value ORDER BY j.value LIMIT 5) as sample_values,
      CASE 
        WHEN j.value ~ '^[0-9]+$' THEN 'integer'
        WHEN j.value ~ '^[0-9]*\.?[0-9]+$' THEN 'numeric'
        WHEN j.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN 'date'
        WHEN LOWER(j.value) IN ('true', 'false') THEN 'boolean'
        ELSE 'text'
      END as data_type
    FROM specimens s,
         jsonb_each_text(s.metadata) AS j(key, value)
    WHERE s.project_id = project_id_param
      AND s.metadata != '{}'::jsonb
      AND j.value IS NOT NULL
      AND j.value != ''
    GROUP BY j.key, 
      CASE 
        WHEN j.value ~ '^[0-9]+$' THEN 'integer'
        WHEN j.value ~ '^[0-9]*\.?[0-9]+$' THEN 'numeric'
        WHEN j.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN 'date'
        WHEN LOWER(j.value) IN ('true', 'false') THEN 'boolean'
        ELSE 'text'
      END
  )
  SELECT 
    fa.field_name,
    fa.usage_count,
    fa.unique_values,
    fa.sample_values,
    fa.data_type
  FROM field_analysis fa
  ORDER BY fa.usage_count DESC, fa.field_name ASC;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Search specimens by metadata criteria
CREATE OR REPLACE FUNCTION search_specimens_by_metadata(
  project_id_param INTEGER,
  metadata_filters JSONB DEFAULT '{}'::jsonb,
  search_term TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id INTEGER,
  specimen_number INTEGER,
  specimen_type VARCHAR,
  tube_id VARCHAR,
  project_id INTEGER,
  patient_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
DECLARE
  query_text TEXT;
  where_conditions TEXT[] := ARRAY[]::TEXT[];
  param_values TEXT[] := ARRAY[]::TEXT[];
  param_count INTEGER := 0;
BEGIN
  -- Base query
  query_text := 'SELECT id, specimen_number, specimen_type, tube_id, project_id, patient_id, metadata, created_at, updated_at FROM specimens WHERE project_id = $1';
  param_count := 1;
  
  -- Add metadata filters
  IF metadata_filters != '{}'::jsonb THEN
    where_conditions := where_conditions || 'metadata @> $' || (param_count + 1)::text;
    param_values := param_values || metadata_filters::text;
    param_count := param_count + 1;
  END IF;
  
  -- Add search term filter
  IF search_term IS NOT NULL AND search_term != '' THEN
    where_conditions := where_conditions || 
      '(specimen_type ILIKE $' || (param_count + 1)::text || 
      ' OR tube_id ILIKE $' || (param_count + 1)::text ||
      ' OR metadata::text ILIKE $' || (param_count + 1)::text || ')';
    param_values := param_values || ('%' || search_term || '%');
    param_count := param_count + 1;
  END IF;
  
  -- Combine conditions
  IF array_length(where_conditions, 1) > 0 THEN
    query_text := query_text || ' AND ' || array_to_string(where_conditions, ' AND ');
  END IF;
  
  -- Add ordering and pagination
  query_text := query_text || ' ORDER BY created_at DESC LIMIT $' || (param_count + 1)::text || ' OFFSET $' || (param_count + 2)::text;
  param_values := param_values || limit_count::text || offset_count::text;
  
  -- Execute dynamic query
  RETURN QUERY EXECUTE query_text 
    USING project_id_param, VARIADIC param_values;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get metadata field suggestions based on project history
CREATE OR REPLACE FUNCTION get_metadata_field_suggestions(project_id_param INTEGER DEFAULT NULL)
RETURNS TABLE(
  field_name TEXT,
  usage_frequency NUMERIC,
  common_values TEXT[],
  suggested_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH field_usage AS (
    SELECT 
      j.key as field_name,
      COUNT(*) as usage_count,
      COUNT(*) * 100.0 / (SELECT COUNT(*) FROM specimens WHERE project_id = COALESCE(project_id_param, s.project_id)) as usage_frequency,
      ARRAY_AGG(DISTINCT j.value ORDER BY j.value LIMIT 3) as common_values,
      CASE 
        WHEN AVG(CASE WHEN j.value ~ '^[0-9]+$' THEN 1.0 ELSE 0.0 END) > 0.8 THEN 'integer'
        WHEN AVG(CASE WHEN j.value ~ '^[0-9]*\.?[0-9]+$' THEN 1.0 ELSE 0.0 END) > 0.8 THEN 'numeric'
        WHEN AVG(CASE WHEN j.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN 1.0 ELSE 0.0 END) > 0.8 THEN 'date'
        WHEN AVG(CASE WHEN LOWER(j.value) IN ('true', 'false') THEN 1.0 ELSE 0.0 END) > 0.8 THEN 'boolean'
        ELSE 'text'
      END as suggested_type
    FROM specimens s,
         jsonb_each_text(s.metadata) AS j(key, value)
    WHERE (project_id_param IS NULL OR s.project_id = project_id_param)
      AND s.metadata != '{}'::jsonb
      AND j.value IS NOT NULL
      AND j.value != ''
    GROUP BY j.key, s.project_id
  )
  SELECT 
    fu.field_name,
    ROUND(fu.usage_frequency, 2) as usage_frequency,
    fu.common_values,
    fu.suggested_type
  FROM field_usage fu
  WHERE fu.usage_count >= 2  -- Only suggest fields used in multiple specimens
  ORDER BY fu.usage_frequency DESC, fu.field_name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Validate metadata JSON structure
CREATE OR REPLACE FUNCTION validate_specimen_metadata(metadata_input JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if it's a valid JSON object (not array or primitive)
  IF jsonb_typeof(metadata_input) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  -- Check that all keys are strings and values are simple types
  IF EXISTS (
    SELECT 1 
    FROM jsonb_each(metadata_input) AS j(key, value)
    WHERE jsonb_typeof(j.value) NOT IN ('string', 'number', 'boolean', 'null')
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Passed all validation checks
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure metadata is always a valid JSON object
ALTER TABLE specimens ADD CONSTRAINT check_metadata_valid 
  CHECK (validate_specimen_metadata(metadata));

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION get_project_metadata_keys(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_metadata_field_stats(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION search_specimens_by_metadata(INTEGER, JSONB, TEXT, INTEGER, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_metadata_field_suggestions(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION validate_specimen_metadata(JSONB) TO PUBLIC;

-- Create updated_at trigger for metadata changes
CREATE OR REPLACE FUNCTION update_specimen_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to specimen updates
DROP TRIGGER IF EXISTS update_specimen_metadata_timestamp ON specimens;
CREATE TRIGGER update_specimen_metadata_timestamp 
  BEFORE UPDATE ON specimens 
  FOR EACH ROW 
  WHEN (OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION update_specimen_metadata_timestamp();

-- Add audit logging for metadata changes
CREATE OR REPLACE FUNCTION log_specimen_metadata_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if metadata actually changed
  IF TG_OP = 'UPDATE' AND OLD.metadata IS DISTINCT FROM NEW.metadata THEN
    INSERT INTO audit_log (
      user_id, 
      action, 
      table_name, 
      record_id, 
      changed_fields
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', -- System user for metadata changes
      'UPDATE_METADATA',
      'specimens',
      NEW.id::text,
      jsonb_build_object(
        'old_metadata', OLD.metadata,
        'new_metadata', NEW.metadata,
        'metadata_diff', NEW.metadata - OLD.metadata
      )::text
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to specimen metadata updates
DROP TRIGGER IF EXISTS log_specimen_metadata_changes ON specimens;
CREATE TRIGGER log_specimen_metadata_changes 
  AFTER UPDATE ON specimens 
  FOR EACH ROW 
  EXECUTE FUNCTION log_specimen_metadata_changes();

-- Performance optimization: Analyze tables after migration
ANALYZE specimens;

-- Create materialized view for metadata field statistics (optional optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS metadata_field_stats_cache AS
  SELECT 
    project_id,
    field_name,
    usage_count,
    unique_values,
    sample_values,
    data_type,
    NOW() as cache_updated_at
  FROM (
    SELECT DISTINCT project_id FROM specimens WHERE metadata != '{}'::jsonb
  ) projects
  CROSS JOIN LATERAL get_metadata_field_stats(projects.project_id) stats;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_stats_cache 
  ON metadata_field_stats_cache (project_id, field_name);

-- Function to refresh metadata stats cache
CREATE OR REPLACE FUNCTION refresh_metadata_stats_cache()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY metadata_field_stats_cache;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON metadata_field_stats_cache TO PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_metadata_stats_cache() TO PUBLIC;