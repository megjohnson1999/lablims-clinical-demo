-- Migration: Add running counter system for auto-generated IDs
-- This migration creates sequences for auto-generating integer IDs for collaborators, projects, and specimens

-- Create sequences for each entity type
CREATE SEQUENCE IF NOT EXISTS collaborator_id_seq;
CREATE SEQUENCE IF NOT EXISTS project_id_seq;
CREATE SEQUENCE IF NOT EXISTS specimen_id_seq;

-- Initialize sequences based on existing maximum IDs
-- Since the tables currently use UUIDs, we'll start from 1 for new integer IDs
-- If there are existing integer-like external IDs, adjust accordingly

-- Set starting values for sequences
-- These will be the next values to be used
SELECT setval('collaborator_id_seq', 1, false);
SELECT setval('project_id_seq', 1, false);
SELECT setval('specimen_id_seq', 1, false);

-- Add integer ID columns to existing tables (for future use if needed)
-- These will store the auto-generated integer IDs alongside existing UUID primary keys
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS collaborator_number INTEGER UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_id INTEGER UNIQUE;
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS specimen_number INTEGER UNIQUE;

-- Create a table to track ID generation history for auditing
CREATE TABLE IF NOT EXISTS id_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,
  generated_id INTEGER NOT NULL,
  generated_by VARCHAR(255),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_id_generation_log_entity_type ON id_generation_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_id_generation_log_generated_at ON id_generation_log(generated_at);

-- Create a function to get the next ID for any entity type
CREATE OR REPLACE FUNCTION get_next_id(entity_type VARCHAR)
RETURNS TABLE(id INTEGER, next_id INTEGER) AS $$
DECLARE
  current_val INTEGER;
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      next_val := nextval('collaborator_id_seq');
      current_val := currval('collaborator_id_seq');
    WHEN 'project' THEN
      next_val := nextval('project_id_seq');
      current_val := currval('project_id_seq');
    WHEN 'specimen' THEN
      next_val := nextval('specimen_id_seq');
      current_val := currval('specimen_id_seq');
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  -- Log the ID generation
  INSERT INTO id_generation_log (entity_type, generated_id)
  VALUES (entity_type, next_val);
  
  RETURN QUERY SELECT next_val as id, next_val + 1 as next_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE collaborator_id_seq TO PUBLIC;
GRANT USAGE ON SEQUENCE project_id_seq TO PUBLIC;
GRANT USAGE ON SEQUENCE specimen_id_seq TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_next_id(VARCHAR) TO PUBLIC;