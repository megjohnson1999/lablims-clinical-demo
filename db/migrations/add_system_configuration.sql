-- Migration: Add system configuration table for dropdown values
-- Date: 2025-01-17
-- Description: Creates configurable dropdown values instead of hard-coded options

-- Create system_options table for configurable dropdown values
CREATE TABLE IF NOT EXISTS system_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  option_key VARCHAR(100) NOT NULL,
  option_value VARCHAR(255) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for category/key combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_options_category_key 
ON system_options(category, option_key);

-- Create index for active lookups
CREATE INDEX IF NOT EXISTS idx_system_options_category_active 
ON system_options(category, is_active);

-- Insert default activity status options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('activity_status', 'active', 'Active', 1, 'Specimen is active and available for use'),
('activity_status', 'inactive', 'Inactive', 2, 'Specimen is inactive but preserved'),
('activity_status', 'qc_failed', 'QC Failed', 3, 'Specimen failed quality control'),
('activity_status', 'on_hold', 'On Hold', 4, 'Specimen is temporarily on hold');

-- Insert default analysis status options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('analysis_status', 'pending', 'Pending', 1, 'Analysis has not started'),
('analysis_status', 'in_progress', 'In Progress', 2, 'Analysis is currently underway'),
('analysis_status', 'completed', 'Completed', 3, 'Analysis has been completed'),
('analysis_status', 'failed', 'Failed', 4, 'Analysis failed or was unsuccessful');

-- Insert default specimen site options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('specimen_site', 'blood', 'Blood', 1, 'Blood specimen'),
('specimen_site', 'plasma', 'Plasma', 2, 'Plasma specimen'),
('specimen_site', 'serum', 'Serum', 3, 'Serum specimen'),
('specimen_site', 'urine', 'Urine', 4, 'Urine specimen'),
('specimen_site', 'stool', 'Stool', 5, 'Stool specimen'),
('specimen_site', 'throat', 'Throat', 6, 'Throat swab specimen'),
('specimen_site', 'nasal', 'Nasal', 7, 'Nasal swab specimen'),
('specimen_site', 'tissue', 'Tissue', 8, 'Tissue specimen'),
('specimen_site', 'csf', 'CSF', 9, 'Cerebrospinal fluid specimen'),
('specimen_site', 'other', 'Other', 10, 'Other specimen type');

-- Insert default specimen type options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('specimen_type', 'blood', 'Blood', 1, 'Blood samples'),
('specimen_type', 'stool', 'Stool', 2, 'Stool samples'),
('specimen_type', 'urine', 'Urine', 3, 'Urine samples'),
('specimen_type', 'tissue', 'Tissue', 4, 'Tissue samples'),
('specimen_type', 'swab', 'Swab', 5, 'Swab samples'),
('specimen_type', 'other', 'Other', 6, 'Other specimen types');

-- Insert default user role options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('user_role', 'user', 'User', 1, 'Standard user with basic permissions'),
('user_role', 'editor', 'Editor', 2, 'Editor with specimen management permissions'),
('user_role', 'admin', 'Admin', 3, 'Administrator with full system access');

-- Insert default extraction method options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('extraction_method', 'standard', 'Standard Protocol', 1, 'Standard extraction protocol'),
('extraction_method', 'modified', 'Modified Extraction', 2, 'Modified extraction method'),
('extraction_method', 'custom', 'Custom Method', 3, 'Custom extraction method');

-- Insert default collection category options
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('collection_category', 'clinical', 'Clinical', 1, 'Clinical collection'),
('collection_category', 'research', 'Research', 2, 'Research collection'),
('collection_category', 'diagnostic', 'Diagnostic', 3, 'Diagnostic collection'),
('collection_category', 'surveillance', 'Surveillance', 4, 'Surveillance collection');

-- Add comment for table documentation
COMMENT ON TABLE system_options IS 'Configurable dropdown options for various system categories';
COMMENT ON COLUMN system_options.category IS 'Category of the option (e.g., activity_status, analysis_status)';
COMMENT ON COLUMN system_options.option_key IS 'Unique key for the option within the category';
COMMENT ON COLUMN system_options.option_value IS 'Display value for the option';
COMMENT ON COLUMN system_options.display_order IS 'Order in which options should be displayed';
COMMENT ON COLUMN system_options.is_active IS 'Whether this option is currently active/available';