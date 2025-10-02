-- Clean Unified Schema Migration (Fixed)
-- Eliminates legacy mapping complexity and standardizes integer ID columns
-- Date: 2025-08-07
-- Author: Database Schema Unification

-- ================================================================================
-- STEP 1: Fix project_number column type and standardize integer ID columns
-- ================================================================================

-- Fix projects table: convert project_number to integer for consistency
ALTER TABLE projects DROP COLUMN IF EXISTS project_number CASCADE;
ALTER TABLE projects ADD COLUMN project_number INTEGER UNIQUE;

-- Ensure all tables have consistent integer number columns
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS collaborator_number INTEGER UNIQUE;
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS specimen_number INTEGER UNIQUE; 
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_number INTEGER UNIQUE;

-- ================================================================================
-- STEP 2: Create/update sequences for integer IDs
-- ================================================================================

-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS collaborator_number_seq;
CREATE SEQUENCE IF NOT EXISTS project_number_seq; 
CREATE SEQUENCE IF NOT EXISTS specimen_number_seq;
CREATE SEQUENCE IF NOT EXISTS patient_number_seq;

-- Set sequences to start from maximum existing values + 1
DO $$
DECLARE
  max_collab INTEGER := 0;
  max_project INTEGER := 0; 
  max_specimen INTEGER := 0;
  max_patient INTEGER := 0;
BEGIN
  -- Check existing values
  SELECT COALESCE(MAX(collaborator_number), 0) INTO max_collab FROM collaborators;
  SELECT COALESCE(MAX(project_number), 0) INTO max_project FROM projects;
  SELECT COALESCE(MAX(specimen_number), 0) INTO max_specimen FROM specimens;  
  SELECT COALESCE(MAX(patient_number), 0) INTO max_patient FROM patients;
  
  -- Set sequences to resume from next available number
  PERFORM setval('collaborator_number_seq', GREATEST(max_collab + 1, 1), false);
  PERFORM setval('project_number_seq', GREATEST(max_project + 1, 1), false);
  PERFORM setval('specimen_number_seq', GREATEST(max_specimen + 1, 1), false);
  PERFORM setval('patient_number_seq', GREATEST(max_patient + 1, 1), false);
  
  RAISE NOTICE 'Sequences initialized - Collaborators: %, Projects: %, Specimens: %, Patients: %', 
    GREATEST(max_collab + 1, 1), GREATEST(max_project + 1, 1), 
    GREATEST(max_specimen + 1, 1), GREATEST(max_patient + 1, 1);
END $$;

-- ================================================================================
-- STEP 3: Create unified ID generation functions
-- ================================================================================

-- Clean, simple function to get next ID for any entity
CREATE OR REPLACE FUNCTION get_next_number(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      next_val := nextval('collaborator_number_seq');
    WHEN 'project' THEN  
      next_val := nextval('project_number_seq');
    WHEN 'specimen' THEN
      next_val := nextval('specimen_number_seq');
    WHEN 'patient' THEN
      next_val := nextval('patient_number_seq');
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Function to peek at next number without consuming it
CREATE OR REPLACE FUNCTION peek_next_number(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM collaborator_number_seq;
    WHEN 'project' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM project_number_seq;
    WHEN 'specimen' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM specimen_number_seq;
    WHEN 'patient' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM patient_number_seq;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- STEP 4: Create indexes for performance
-- ================================================================================

CREATE INDEX IF NOT EXISTS idx_collaborators_number ON collaborators(collaborator_number);
CREATE INDEX IF NOT EXISTS idx_projects_number ON projects(project_number);
CREATE INDEX IF NOT EXISTS idx_specimens_number ON specimens(specimen_number);
CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);

-- ================================================================================
-- STEP 5: Add constraints and comments
-- ================================================================================

-- Ensure number fields are positive
ALTER TABLE collaborators ADD CONSTRAINT check_collaborator_number_positive 
  CHECK (collaborator_number IS NULL OR collaborator_number > 0);
  
ALTER TABLE projects ADD CONSTRAINT check_project_number_positive 
  CHECK (project_number IS NULL OR project_number > 0);
  
ALTER TABLE specimens ADD CONSTRAINT check_specimen_number_positive 
  CHECK (specimen_number IS NULL OR specimen_number > 0);
  
ALTER TABLE patients ADD CONSTRAINT check_patient_number_positive 
  CHECK (patient_number IS NULL OR patient_number > 0);

-- Add documentation
COMMENT ON COLUMN collaborators.collaborator_number IS 'Sequential collaborator identifier for searches and references';
COMMENT ON COLUMN projects.project_number IS 'Sequential project identifier for searches and references'; 
COMMENT ON COLUMN specimens.specimen_number IS 'Sequential specimen identifier for searches and references';
COMMENT ON COLUMN patients.patient_number IS 'Sequential patient identifier for searches and references';

COMMENT ON FUNCTION get_next_number(VARCHAR) IS 'Gets next sequential number for entity type. Use for project imports.';
COMMENT ON FUNCTION peek_next_number(VARCHAR) IS 'Previews next sequential number without consuming it.';

-- ================================================================================
-- STEP 6: Grant permissions
-- ================================================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_next_number(VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION peek_next_number(VARCHAR) TO PUBLIC;

-- ================================================================================
-- STEP 7: Log migration completion
-- ================================================================================

DO $$
BEGIN
  INSERT INTO audit_log (
    user_id, action, table_name, record_id, changed_fields, timestamp
  ) SELECT 
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'SCHEMA_MIGRATION',
    'all_tables',
    uuid_generate_v4(),
    jsonb_build_object(
      'migration', 'clean_unified_schema',
      'description', 'Standardized integer ID columns across all tables',
      'changes', jsonb_build_array(
        'Fixed projects.project_number to INTEGER type',
        'Ensured all tables have consistent [entity]_number columns', 
        'Created unified get_next_number() function',
        'Established clean sequences without complex tracking'
      )
    ),
    NOW()
  WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');

  RAISE NOTICE 'Clean Unified Schema migration completed successfully!';
  RAISE NOTICE 'All tables now have consistent [entity]_number INTEGER columns';  
  RAISE NOTICE 'Use get_next_number(''entity_type'') for project imports';
  RAISE NOTICE 'Migration imports can directly set number columns from CSV ID values';
END $$;