-- Add protocol support to the database schema
-- This migration adds the protocol sequence and updates the ID generation functions

-- Create sequence for auto-generating protocol numbers
CREATE SEQUENCE IF NOT EXISTS protocol_number_seq;

-- Initialize sequence to start from 1
SELECT setval('protocol_number_seq', 1, false);

-- Update the get_next_number function to support protocols
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
    WHEN 'protocol' THEN
      next_val := nextval('protocol_number_seq');
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, protocol', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Update the peek_next_number function to support protocols
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
    WHEN 'protocol' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM protocol_number_seq;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, protocol', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Create index for performance (if protocols table exists)
CREATE INDEX IF NOT EXISTS idx_protocols_number ON protocols(protocol_number);