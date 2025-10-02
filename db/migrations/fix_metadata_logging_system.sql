-- Fix metadata logging system for specimen updates
-- This migration addresses issues with the log_specimen_metadata_changes trigger

-- Create system user for metadata audit logging if it doesn't exist
INSERT INTO users (id, username, password, email, role) 
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system',
  'disabled',
  'system@lims.local',
  'admin'
) ON CONFLICT (id) DO NOTHING;

-- Fix the log_specimen_metadata_changes trigger function
-- Removes problematic JSONB subtraction and fixes UUID type handling
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
      '00000000-0000-0000-0000-000000000000'::uuid, -- System user for metadata changes
      'UPDATE_METADATA',
      'specimens',
      NEW.id, -- Use UUID directly, not as text
      jsonb_build_object(
        'old_metadata', OLD.metadata,
        'new_metadata', NEW.metadata,
        'table_name', 'specimens'
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION log_specimen_metadata_changes() IS 'Logs specimen metadata changes to audit_log table. Fixed to handle JSONB properly and use correct UUID types.';
COMMENT ON USER MAPPING FOR "system" SERVER system IS 'System user for automated audit logging of metadata changes';