-- Performance optimization indexes for search functionality
-- Fixes slow search performance caused by missing foreign key indexes

-- Critical foreign key indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_specimens_project_id ON specimens(project_id);
CREATE INDEX IF NOT EXISTS idx_specimens_patient_id ON specimens(patient_id);
CREATE INDEX IF NOT EXISTS idx_projects_collaborator_id ON projects(collaborator_id);

-- Search field indexes for WHERE clause performance
CREATE INDEX IF NOT EXISTS idx_projects_specimen_type ON projects(specimen_type);
CREATE INDEX IF NOT EXISTS idx_projects_disease ON projects(disease);
CREATE INDEX IF NOT EXISTS idx_specimens_tube_id ON specimens(tube_id);
CREATE INDEX IF NOT EXISTS idx_specimens_specimen_site ON specimens(specimen_site);

-- Composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_specimens_project_specimen_type ON specimens(project_id) INCLUDE (specimen_number);
CREATE INDEX IF NOT EXISTS idx_projects_collaborator_disease ON projects(collaborator_id, disease);

-- Additional performance indexes for filtering
CREATE INDEX IF NOT EXISTS idx_specimens_extracted ON specimens(extracted);
CREATE INDEX IF NOT EXISTS idx_specimens_used_up ON specimens(used_up);
CREATE INDEX IF NOT EXISTS idx_specimens_activity_status ON specimens(activity_status);

-- Position/location search indexes
CREATE INDEX IF NOT EXISTS idx_specimens_position_freezer ON specimens(position_freezer);
CREATE INDEX IF NOT EXISTS idx_specimens_position_rack ON specimens(position_rack);
CREATE INDEX IF NOT EXISTS idx_specimens_position_box ON specimens(position_box);

-- Sequencing search indexes  
CREATE INDEX IF NOT EXISTS idx_specimens_sequencing_run_id ON specimens(sequencing_run_id);
CREATE INDEX IF NOT EXISTS idx_specimens_analysis_status ON specimens(analysis_status);

-- Date-based indexes for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_specimens_date_collected ON specimens(date_collected);
CREATE INDEX IF NOT EXISTS idx_projects_date_received ON projects(date_received);

-- Text search indexes (GIN for full-text search on text fields)
CREATE INDEX IF NOT EXISTS idx_specimens_comments_gin ON specimens USING GIN (to_tsvector('english', COALESCE(comments, '')));
CREATE INDEX IF NOT EXISTS idx_projects_comments_gin ON projects USING GIN (to_tsvector('english', COALESCE(comments, '')));

-- Update statistics after index creation
ANALYZE specimens;
ANALYZE projects; 
ANALYZE collaborators;
ANALYZE patients;