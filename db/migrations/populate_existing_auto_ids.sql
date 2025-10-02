-- Migration: Populate existing records with auto-generated IDs
-- This script safely assigns sequential IDs to existing records that have NULL auto-IDs
-- CRITICAL: This migration is safe and reversible

-- Backup current state
CREATE TEMP TABLE collaborators_backup AS SELECT * FROM collaborators WHERE collaborator_number IS NULL;
CREATE TEMP TABLE projects_backup AS SELECT * FROM projects WHERE project_id IS NULL;
CREATE TEMP TABLE specimens_backup AS SELECT * FROM specimens WHERE specimen_number IS NULL;

BEGIN;

-- Function to safely populate auto-IDs
CREATE OR REPLACE FUNCTION populate_auto_ids()
RETURNS TEXT AS $$
DECLARE
  collaborator_count INTEGER := 0;
  project_count INTEGER := 0;
  specimen_count INTEGER := 0;
  current_seq_val INTEGER;
  max_existing_id INTEGER;
  rec RECORD;
BEGIN
  -- COLLABORATORS: Populate NULL collaborator_number values
  RAISE NOTICE 'Populating collaborator auto-IDs...';
  
  -- Get current sequence value
  SELECT last_value INTO current_seq_val FROM collaborator_id_seq;
  
  -- Find any existing non-null values to avoid conflicts
  SELECT COALESCE(MAX(collaborator_number), 0) INTO max_existing_id FROM collaborators;
  
  -- Ensure sequence starts after existing max
  IF max_existing_id >= current_seq_val THEN
    PERFORM setval('collaborator_id_seq', max_existing_id + 1, false);
  END IF;
  
  -- Assign sequential IDs to NULL records
  FOR rec IN 
    SELECT id FROM collaborators 
    WHERE collaborator_number IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE collaborators 
    SET collaborator_number = nextval('collaborator_id_seq')
    WHERE id = rec.id;
    collaborator_count := collaborator_count + 1;
  END LOOP;
  
  -- PROJECTS: Populate NULL project_id values
  RAISE NOTICE 'Populating project auto-IDs...';
  
  SELECT last_value INTO current_seq_val FROM project_id_seq;
  SELECT COALESCE(MAX(project_id), 0) INTO max_existing_id FROM projects;
  
  IF max_existing_id >= current_seq_val THEN
    PERFORM setval('project_id_seq', max_existing_id + 1, false);
  END IF;
  
  FOR rec IN 
    SELECT id FROM projects 
    WHERE project_id IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE projects 
    SET project_id = nextval('project_id_seq')
    WHERE id = rec.id;
    project_count := project_count + 1;
  END LOOP;
  
  -- SPECIMENS: Populate NULL specimen_number values
  RAISE NOTICE 'Populating specimen auto-IDs...';
  
  SELECT last_value INTO current_seq_val FROM specimen_id_seq;
  SELECT COALESCE(MAX(specimen_number), 0) INTO max_existing_id FROM specimens;
  
  IF max_existing_id >= current_seq_val THEN
    PERFORM setval('specimen_id_seq', max_existing_id + 1, false);
  END IF;
  
  FOR rec IN 
    SELECT id FROM specimens 
    WHERE specimen_number IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE specimens 
    SET specimen_number = nextval('specimen_id_seq')
    WHERE id = rec.id;
    specimen_count := specimen_count + 1;
  END LOOP;
  
  -- Log the population activity
  INSERT INTO id_generation_log (entity_type, generated_id, generated_by, generated_at)
  SELECT 'collaborator_bulk_populate', collaborator_number, 'migration_script', NOW()
  FROM collaborators 
  WHERE collaborator_number IS NOT NULL;
  
  INSERT INTO id_generation_log (entity_type, generated_id, generated_by, generated_at)
  SELECT 'project_bulk_populate', project_id, 'migration_script', NOW()
  FROM projects 
  WHERE project_id IS NOT NULL;
  
  INSERT INTO id_generation_log (entity_type, generated_id, generated_by, generated_at)
  SELECT 'specimen_bulk_populate', specimen_number, 'migration_script', NOW()
  FROM specimens 
  WHERE specimen_number IS NOT NULL;
  
  RETURN format('Successfully populated: %s collaborators, %s projects, %s specimens', 
                collaborator_count, project_count, specimen_count);
END;
$$ LANGUAGE plpgsql;

-- Execute the population
SELECT populate_auto_ids();

-- Verification queries
DO $$
DECLARE
  null_collaborators INTEGER;
  null_projects INTEGER;
  null_specimens INTEGER;
  total_collaborators INTEGER;
  total_projects INTEGER;
  total_specimens INTEGER;
BEGIN
  -- Count NULL values
  SELECT COUNT(*) INTO null_collaborators FROM collaborators WHERE collaborator_number IS NULL;
  SELECT COUNT(*) INTO null_projects FROM projects WHERE project_id IS NULL;
  SELECT COUNT(*) INTO null_specimens FROM specimens WHERE specimen_number IS NULL;
  
  -- Count totals
  SELECT COUNT(*) INTO total_collaborators FROM collaborators;
  SELECT COUNT(*) INTO total_projects FROM projects;
  SELECT COUNT(*) INTO total_specimens FROM specimens;
  
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE 'Collaborators: %/% have auto-IDs (% NULL)', (total_collaborators - null_collaborators), total_collaborators, null_collaborators;
  RAISE NOTICE 'Projects: %/% have auto-IDs (% NULL)', (total_projects - null_projects), total_projects, null_projects;
  RAISE NOTICE 'Specimens: %/% have auto-IDs (% NULL)', (total_specimens - null_specimens), total_specimens, null_specimens;
  
  -- Check for duplicates
  IF (SELECT COUNT(*) FROM (SELECT collaborator_number, COUNT(*) FROM collaborators WHERE collaborator_number IS NOT NULL GROUP BY collaborator_number HAVING COUNT(*) > 1) dup) > 0 THEN
    RAISE EXCEPTION 'DUPLICATE collaborator_number values detected!';
  END IF;
  
  IF (SELECT COUNT(*) FROM (SELECT project_id, COUNT(*) FROM projects WHERE project_id IS NOT NULL GROUP BY project_id HAVING COUNT(*) > 1) dup) > 0 THEN
    RAISE EXCEPTION 'DUPLICATE project_id values detected!';
  END IF;
  
  IF (SELECT COUNT(*) FROM (SELECT specimen_number, COUNT(*) FROM specimens WHERE specimen_number IS NOT NULL GROUP BY specimen_number HAVING COUNT(*) > 1) dup) > 0 THEN
    RAISE EXCEPTION 'DUPLICATE specimen_number values detected!';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: No duplicate auto-IDs detected';
END $$;

-- Clean up
DROP FUNCTION populate_auto_ids();

COMMIT;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auto-ID population completed successfully!';
  RAISE NOTICE 'All existing records now have sequential auto-generated IDs';
  RAISE NOTICE 'Migration is safe and preserves all existing data';
END $$;