-- Migration: Add Legacy ID Mapping Support
-- Description: Enables migration imports to preserve original IDs from legacy systems
-- Author: Claude Code Migration Import Fix
-- Date: 2025-01-31

-- Create legacy ID mapping table to track original IDs from imported systems
CREATE TABLE IF NOT EXISTS legacy_id_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  legacy_id VARCHAR(100) NOT NULL,
  current_uuid UUID NOT NULL,
  import_batch_id UUID DEFAULT NULL,
  imported_from VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(table_name, legacy_id),
  UNIQUE(table_name, current_uuid)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_legacy_mappings_table_legacy ON legacy_id_mappings (table_name, legacy_id);
CREATE INDEX IF NOT EXISTS idx_legacy_mappings_table_uuid ON legacy_id_mappings (table_name, current_uuid);
CREATE INDEX IF NOT EXISTS idx_legacy_mappings_batch ON legacy_id_mappings (import_batch_id);

-- Add comments for documentation
COMMENT ON TABLE legacy_id_mappings IS 'Maps legacy system IDs to current UUID primary keys for migration imports';
COMMENT ON COLUMN legacy_id_mappings.table_name IS 'Target table name (collaborators, projects, specimens, patients)';
COMMENT ON COLUMN legacy_id_mappings.legacy_id IS 'Original ID from legacy system';
COMMENT ON COLUMN legacy_id_mappings.current_uuid IS 'Current UUID primary key in target table';
COMMENT ON COLUMN legacy_id_mappings.import_batch_id IS 'Groups records from same import batch';
COMMENT ON COLUMN legacy_id_mappings.imported_from IS 'Source system identifier';

-- Helper function to find UUID by legacy ID
CREATE OR REPLACE FUNCTION get_uuid_by_legacy_id(
  p_table_name VARCHAR(50),
  p_legacy_id VARCHAR(100)
) RETURNS UUID AS $$
DECLARE
  v_uuid UUID;
BEGIN
  SELECT current_uuid INTO v_uuid
  FROM legacy_id_mappings
  WHERE table_name = p_table_name AND legacy_id = p_legacy_id;
  
  RETURN v_uuid;
END;
$$ LANGUAGE plpgsql;

-- Helper function to find legacy ID by UUID
CREATE OR REPLACE FUNCTION get_legacy_id_by_uuid(
  p_table_name VARCHAR(50),
  p_uuid UUID
) RETURNS VARCHAR(100) AS $$
DECLARE
  v_legacy_id VARCHAR(100);
BEGIN
  SELECT legacy_id INTO v_legacy_id
  FROM legacy_id_mappings
  WHERE table_name = p_table_name AND current_uuid = p_uuid;
  
  RETURN v_legacy_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create or get mapping
CREATE OR REPLACE FUNCTION create_legacy_mapping(
  p_table_name VARCHAR(50),
  p_legacy_id VARCHAR(100),
  p_current_uuid UUID,
  p_import_batch_id UUID DEFAULT NULL,
  p_imported_from VARCHAR(100) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_mapping_id UUID;
  v_existing_uuid UUID;
BEGIN
  -- Check if legacy ID already mapped
  SELECT current_uuid INTO v_existing_uuid
  FROM legacy_id_mappings
  WHERE table_name = p_table_name AND legacy_id = p_legacy_id;
  
  IF v_existing_uuid IS NOT NULL THEN
    -- Return existing mapping
    RETURN v_existing_uuid;
  END IF;
  
  -- Create new mapping
  INSERT INTO legacy_id_mappings (
    table_name, legacy_id, current_uuid, import_batch_id, imported_from
  ) VALUES (
    p_table_name, p_legacy_id, p_current_uuid, p_import_batch_id, p_imported_from
  ) RETURNING id INTO v_mapping_id;
  
  RETURN p_current_uuid;
END;
$$ LANGUAGE plpgsql;

-- Add audit log entry
INSERT INTO audit_log (
  user_id, action, table_name, record_id, changed_fields, timestamp
) SELECT 
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  'SCHEMA_MIGRATION',
  'legacy_id_mappings',
  uuid_generate_v4(),
  '{"migration": "add_legacy_id_mapping", "description": "Added legacy ID mapping support for migration imports"}'::jsonb,
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');