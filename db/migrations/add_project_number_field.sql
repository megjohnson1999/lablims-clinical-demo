-- Migration: Add project_number field to projects table
-- Date: 2025-07-16
-- Description: Adds project_number field to store lab-specific project identifiers

-- Add project_number field to projects table
ALTER TABLE projects ADD COLUMN project_number VARCHAR(50);

-- Add index for better performance on project_number searches
CREATE INDEX IF NOT EXISTS idx_projects_project_number ON projects(project_number);

-- Add comment for field documentation
COMMENT ON COLUMN projects.project_number IS 'Lab-specific project identifier number (e.g., 849, 850, etc.)';