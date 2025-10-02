const express = require('express');
const router = express.Router();
const { stringify } = require('csv-stringify');
const ExcelJS = require('exceljs');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Template definitions with field descriptions and sample data
const templateDefinitions = {
  project_import: {
    name: 'Project Import Template',
    description: 'Template for importing specimens into a specific project',
    fields: [
      { name: 'tube_id', description: 'Unique specimen identifier (required)', sample: 'SPEC001' },
      { name: 'date_collected', description: 'Collection date (YYYY-MM-DD format)', sample: '2024-01-15' },
      { name: 'specimen_type', description: 'Type of specimen', sample: 'Blood' },
      { name: 'patient_external_id', description: 'Patient identifier', sample: 'PT001' },
      { name: 'patient_first_name', description: 'Patient first name (optional if using external ID)', sample: 'John' },
      { name: 'patient_last_name', description: 'Patient last name (optional if using external ID)', sample: 'Doe' },
      { name: 'position_freezer', description: 'Freezer location', sample: 'Freezer-A' },
      { name: 'position_rack', description: 'Rack position', sample: 'R1' },
      { name: 'position_box', description: 'Box position', sample: 'B1' },
      { name: 'position_dimension_one', description: 'Position coordinate 1', sample: 'A1' },
      { name: 'position_dimension_two', description: 'Position coordinate 2', sample: '1' },
      { name: 'initial_quantity', description: 'Initial specimen quantity', sample: '5.0' },
      { name: 'specimen_site', description: 'Anatomical site of collection', sample: 'Arm' },
      { name: 'comments', description: 'Additional notes', sample: 'Morning collection' }
    ]
  },
  
  migration_collaborators: {
    name: 'Migration - Collaborators',
    description: 'Template for importing collaborators during migration',
    fields: [
      { name: 'ID', description: 'Legacy collaborator ID (will be preserved)', sample: '1' },
      { name: 'PI_Name', description: 'Principal Investigator name (required)', sample: 'Dr. Jane Smith' },
      { name: 'PI_Institute', description: 'Institution name (required)', sample: 'University Medical Center' },
      { name: 'PI_Email', description: 'PI email address', sample: 'jane.smith@umc.edu' },
      { name: 'PI_Phone', description: 'PI phone number', sample: '555-0123' },
      { name: 'PI_Fax', description: 'PI fax number', sample: '555-0124' },
      { name: 'IRB_ID', description: 'IRB approval number', sample: 'IRB-2024-001' },
      { name: 'Internal_Contact', description: 'Internal lab contact', sample: 'Lab Manager' },
      { name: 'Comments', description: 'Additional notes', sample: 'Primary collaborator' }
    ]
  },
  
  migration_projects: {
    name: 'Migration - Projects',
    description: 'Template for importing projects during migration',
    fields: [
      { name: 'ID', description: 'Legacy project ID (will be preserved)', sample: '101' },
      { name: 'Collaborator', description: 'Collaborator ID (must match collaborators file)', sample: '1' },
      { name: 'Disease', description: 'Disease or condition being studied', sample: 'COVID-19' },
      { name: 'Specimen_Type', description: 'Primary specimen type for project', sample: 'Nasopharyngeal Swab' },
      { name: 'Source', description: 'Sample source or study type', sample: 'Clinical Study' },
      { name: 'Date_Received', description: 'Date project was received (YYYY-MM-DD)', sample: '2024-01-01' },
      { name: 'Feedback_Date', description: 'Expected feedback date (YYYY-MM-DD)', sample: '2024-03-01' },
      { name: 'Comments', description: 'Project notes', sample: 'Longitudinal study' }
    ]
  },
  
  migration_specimens: {
    name: 'Migration - Specimens',
    description: 'Template for importing specimens during migration',
    fields: [
      { name: 'tube_id', description: 'Unique specimen identifier (required)', sample: 'SPEC001' },
      { name: 'project_id', description: 'Project ID (must match projects file)', sample: '101' },
      { name: 'date_collected', description: 'Collection date (YYYY-MM-DD)', sample: '2024-01-15' },
      { name: 'activity_status', description: 'Specimen status (Active/Inactive)', sample: 'Active' },
      { name: 'extracted', description: 'Has DNA/RNA been extracted (Yes/No)', sample: 'No' },
      { name: 'used_up', description: 'Is specimen depleted (Yes/No)', sample: 'No' },
      { name: 'initial_quantity', description: 'Starting quantity', sample: '5.0' },
      { name: 'specimen_site', description: 'Collection site', sample: 'Nasopharynx' },
      { name: 'position_freezer', description: 'Freezer location', sample: 'Freezer-A' },
      { name: 'position_rack', description: 'Rack position', sample: 'R1' },
      { name: 'position_box', description: 'Box position', sample: 'B1' },
      { name: 'position_dimension_one', description: 'Grid position 1', sample: 'A1' },
      { name: 'position_dimension_two', description: 'Grid position 2', sample: '1' },
      { name: 'comments', description: 'Specimen notes', sample: 'High quality sample' }
    ]
  },
  
  migration_patients: {
    name: 'Migration - Patients',
    description: 'Template for importing patients during migration',
    fields: [
      { name: 'external_id', description: 'Patient external identifier', sample: 'PT001' },
      { name: 'first_name', description: 'Patient first name', sample: 'John' },
      { name: 'last_name', description: 'Patient last name', sample: 'Doe' },
      { name: 'date_of_birth', description: 'Date of birth (YYYY-MM-DD)', sample: '1985-06-15' },
      { name: 'diagnosis', description: 'Primary diagnosis', sample: 'COVID-19' },
      { name: 'physician_first_name', description: 'Attending physician first name', sample: 'Dr. Sarah' },
      { name: 'physician_last_name', description: 'Attending physician last name', sample: 'Wilson' },
      { name: 'comments', description: 'Patient notes', sample: 'Enrolled in longitudinal study' }
    ]
  }
};

// @route   GET api/templates/:templateType
// @desc    Download CSV template for imports
// @access  Private
router.get('/:templateType', auth, async (req, res) => {
  try {
    const { templateType } = req.params;
    const { format = 'csv', includeSamples = 'true' } = req.query;
    
    const template = templateDefinitions[templateType];
    if (!template) {
      return res.status(404).json({ 
        msg: 'Template not found',
        availableTemplates: Object.keys(templateDefinitions)
      });
    }

    logger.info('Template download requested', {
      templateType,
      format,
      userId: req.user?.id,
      includeSamples
    });

    if (format === 'excel') {
      // Generate Excel template
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(template.name);
      
      // Create headers with styling
      const headerRow = worksheet.addRow(template.fields.map(field => field.name));
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
      };
      
      // Add descriptions as comments
      template.fields.forEach((field, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.note = {
          texts: [{ text: field.description }]
        };
      });
      
      // Add sample data if requested
      if (includeSamples === 'true') {
        const sampleRow = worksheet.addRow(template.fields.map(field => field.sample));
        sampleRow.font = { italic: true };
        sampleRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
      
      // Add instructions worksheet
      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.addRow(['Import Template Instructions']);
      instructionsSheet.addRow(['']);
      instructionsSheet.addRow([`Template: ${template.name}`]);
      instructionsSheet.addRow([`Description: ${template.description}`]);
      instructionsSheet.addRow(['']);
      instructionsSheet.addRow(['Field Descriptions:']);
      
      template.fields.forEach(field => {
        instructionsSheet.addRow([field.name, field.description, `Example: ${field.sample}`]);
      });
      
      // Style the instructions
      instructionsSheet.getCell('A1').font = { bold: true, size: 14 };
      instructionsSheet.getCell('A3').font = { bold: true };
      instructionsSheet.getCell('A4').font = { italic: true };
      instructionsSheet.getCell('A6').font = { bold: true };
      
      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 15);
      });
      instructionsSheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 20);
      });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${templateType}_template.xlsx"`);
      
      // Send the Excel file
      await workbook.xlsx.write(res);
      res.end();
      
    } else {
      // Generate CSV template
      const headers = template.fields.map(field => field.name);
      const rows = [headers];
      
      // Add sample data if requested
      if (includeSamples === 'true') {
        const sampleRow = template.fields.map(field => field.sample);
        rows.push(sampleRow);
      }
      
      // Convert to CSV
      stringify(rows, (err, output) => {
        if (err) {
          logger.error('CSV generation failed', { error: err.message, templateType });
          return res.status(500).json({ msg: 'Failed to generate CSV template' });
        }
        
        // Add descriptive header comment
        const headerComment = `# ${template.name}\n# ${template.description}\n# Field descriptions:\n`;
        const fieldDescriptions = template.fields.map(field => 
          `# ${field.name}: ${field.description} (e.g., ${field.sample})`
        ).join('\n');
        
        const csvWithComments = `${headerComment}${fieldDescriptions}\n#\n${output}`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${templateType}_template.csv"`);
        res.send(csvWithComments);
      });
    }
    
  } catch (error) {
    logger.error('Template generation failed', {
      error: error.message,
      stack: error.stack,
      templateType: req.params.templateType
    });
    res.status(500).json({ msg: 'Failed to generate template' });
  }
});

// @route   GET api/templates
// @desc    Get list of available templates
// @access  Private
router.get('/', auth, (req, res) => {
  try {
    const templates = Object.entries(templateDefinitions).map(([key, template]) => ({
      id: key,
      name: template.name,
      description: template.description,
      fieldCount: template.fields.length
    }));
    
    res.json({
      templates,
      formats: ['csv', 'excel'],
      options: {
        includeSamples: 'Include sample data in template'
      }
    });
    
  } catch (error) {
    logger.error('Failed to list templates', { error: error.message });
    res.status(500).json({ msg: 'Failed to retrieve templates' });
  }
});

module.exports = router;