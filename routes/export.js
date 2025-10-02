const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { getAllColumnKeys, getColumnConfig, buildSelectClause, buildExcelColumns } = require('../utils/exportColumns');

// @route   GET api/export/specimens/csv
// @desc    Export specimens data as CSV with filtering
// @access  Private
router.get('/specimens/csv', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      searchTerm,
      searchField,
      dateStart,
      dateEnd,
      collaboratorId,
      projectId,
      disease,
      specimenType,
      limit = 10000, // Cap at 10,000 records
      selectedColumns,
      selectedSpecimens,
      bulkIdText
    } = req.query;
    
    // DEBUG: Log all query parameters
    console.log('🔍 CSV DEBUG - All query params:', req.query);
    console.log('🔍 CSV DEBUG - selectedSpecimens:', selectedSpecimens);
    
    // Write debug info to file
    const fs = require('fs');
    const debugInfo = {
      timestamp: new Date().toISOString(),
      allParams: req.query,
      selectedSpecimens: selectedSpecimens,
      selectedSpecimensType: typeof selectedSpecimens,
      selectedSpecimensLength: selectedSpecimens ? selectedSpecimens.length : 'N/A'
    };
    fs.appendFileSync('/tmp/export-debug.log', JSON.stringify(debugInfo, null, 2) + '\n\n');
    
    // Parse selected columns or use all columns as default
    const columnsToExport = selectedColumns ? selectedColumns.split(',') : getAllColumnKeys();

    // Handle bulk search export
    if (bulkIdText && bulkIdText.trim()) {
      console.log('📋 CSV Export: Using bulk search for IDs:', bulkIdText.trim());
      
      // Parse bulk IDs from text
      const identifiers = bulkIdText
        .split(/[,;\n\r]+/)
        .map(id => id.trim())
        .filter(Boolean);
      
      console.log('📋 CSV Export: Parsed identifiers:', identifiers);
      
      // Use the same bulk search logic as the specimens route
      
      const baseQuery = `
        SELECT 
          s.specimen_number as specimen_id,
          s.tube_id,
          s.date_collected,
          s.position_freezer,
          s.position_rack,
          s.position_box,
          s.position_dimension_one,
          s.position_dimension_two,
          s.activity_status,
          s.specimen_site,
          s.used_up,
          s.extracted,
          s.initial_quantity,
          s.created_at as specimen_created_at,
          p.external_id as patient_external_id,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          p.diagnosis,
          proj.id as project_id,
          proj.disease,
          proj.specimen_type,
          proj.source as project_source,
          proj.date_received,
          proj.feedback_date,
          c.pi_name,
          c.pi_institute,
          c.irb_id,
          c.pi_email
        FROM specimens s
        LEFT JOIN patients p ON s.patient_id = p.id
        JOIN projects proj ON s.project_id = proj.id
        JOIN collaborators c ON proj.collaborator_id = c.id`;
      
      // Use bulk search logic
      const cleanIdentifiers = [...new Set(identifiers.map(id => String(id).trim()).filter(Boolean))];
      const numericIdentifiers = cleanIdentifiers.filter(id => /^\d+$/.test(id)).map(id => parseInt(id));
      const nonNumericIdentifiers = cleanIdentifiers.filter(id => !/^\d+$/.test(id));
      
      let bulkQuery, bulkParams;
      if (numericIdentifiers.length > 0 && nonNumericIdentifiers.length > 0) {
        // Mixed identifiers
        bulkQuery = `${baseQuery} WHERE 
          s.specimen_number = ANY($1::int[]) OR
          s.tube_id = ANY($2::text[])
          ORDER BY s.specimen_number ASC`;
        bulkParams = [numericIdentifiers, nonNumericIdentifiers];
      } else if (numericIdentifiers.length > 0) {
        // Only numeric identifiers
        bulkQuery = `${baseQuery} WHERE s.specimen_number = ANY($1::int[]) ORDER BY s.specimen_number ASC`;
        bulkParams = [numericIdentifiers];
      } else {
        // Only non-numeric identifiers
        bulkQuery = `${baseQuery} WHERE s.tube_id = ANY($1::text[]) ORDER BY s.specimen_number ASC`;
        bulkParams = [nonNumericIdentifiers];
      }
      
      const result = await db.query(bulkQuery, bulkParams);
      console.log('📋 CSV Export: Bulk search found', result.rows.length, 'specimens');
      
      // Skip the regular filtering and use bulk search results
      const bulkResults = result.rows;
      
      // Jump to CSV generation with bulk results
      if (bulkResults.length === 0) {
        return res.status(404).json({ msg: 'No specimens found matching the provided identifiers' });
      }
      
      // Process bulk results for CSV generation
      const csvData = bulkResults.map(row => {
        // Build location string
        const locationParts = [
          row.position_freezer,
          row.position_rack,
          row.position_box,
          row.position_dimension_one,
          row.position_dimension_two
        ].filter(Boolean);
        const location = locationParts.join(' / ') || '';

        // Build patient name
        const patientNameParts = [row.patient_first_name, row.patient_last_name].filter(Boolean);
        const patientName = patientNameParts.join(' ') || '';

        return {
          specimen_id: row.specimen_id,
          tube_id: row.tube_id || '',
          pi_name: row.pi_name || '',
          pi_institute: row.pi_institute || '',
          disease: row.disease || '',
          specimen_type: row.specimen_type || '',
          patient_external_id: row.patient_external_id || '',
          patient_name: patientName,
          date_collected: row.date_collected ? new Date(row.date_collected).toISOString().split('T')[0] : '',
          location: location,
          activity_status: row.activity_status || '',
          extracted: row.extracted ? 'Yes' : 'No',
          used_up: row.used_up ? 'Yes' : 'No',
          initial_quantity: row.initial_quantity || '',
          project_source: row.project_source || '',
          date_received: row.date_received ? new Date(row.date_received).toISOString().split('T')[0] : '',
          diagnosis: row.diagnosis || '',
          irb_id: row.irb_id || '',
          sequencing_run_id: '', // Not in bulk search query
          fastq_location: '', // Not in bulk search query
          analysis_status: '', // Not in bulk search query
          results_location: '', // Not in bulk search query
          sequencing_notes: '' // Not in bulk search query
        };
      });

      // Create CSV file for bulk results
      const exportsDir = path.join(__dirname, '../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `specimens_bulk_export_${timestamp}.csv`;
      const filepath = path.join(exportsDir, filename);

      const csvWriter = createCsvWriter({
        path: filepath,
        header: [
          { id: 'specimen_id', title: 'Specimen ID' },
          { id: 'tube_id', title: 'Tube ID' },
          { id: 'pi_name', title: 'PI Name' },
          { id: 'pi_institute', title: 'PI Institute' },
          { id: 'disease', title: 'Disease' },
          { id: 'specimen_type', title: 'Specimen Type' },
          { id: 'patient_external_id', title: 'Patient ID' },
          { id: 'patient_name', title: 'Patient Name' },
          { id: 'date_collected', title: 'Date Collected' },
          { id: 'location', title: 'Location' },
          { id: 'activity_status', title: 'Status' },
          { id: 'extracted', title: 'Extracted' },
          { id: 'used_up', title: 'Used Up' },
          { id: 'initial_quantity', title: 'Initial Quantity' },
          { id: 'project_source', title: 'Project Source' },
          { id: 'date_received', title: 'Date Received' },
          { id: 'diagnosis', title: 'Diagnosis' },
          { id: 'irb_id', title: 'IRB ID' }
        ]
      });

      await csvWriter.writeRecords(csvData);

      // Log the export action
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'EXPORT_BULK_CSV',
          'specimens',
          '00000000-0000-0000-0000-000000000000',
          JSON.stringify({
            identifiers_searched: identifiers.length,
            records_found: csvData.length,
            filename: filename
          })
        ]
      );

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the file to the client
      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);

      // Clean up file after sending
      fileStream.on('end', () => {
        fs.unlink(filepath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      });

      return; // Exit early for bulk search - don't continue to regular export logic
    }

    // Regular export logic (non-bulk search)
    let query = `
      SELECT 
        s.specimen_number as specimen_id,
        s.tube_id,
        s.date_collected,
        s.position_freezer,
        s.position_rack,
        s.position_box,
        s.position_dimension_one,
        s.position_dimension_two,
        s.activity_status,
        s.specimen_site,
        s.used_up,
        s.extracted,
        s.initial_quantity,
        s.created_at as specimen_created_at,
        p.external_id as patient_external_id,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.diagnosis,
        proj.id as project_id,
        proj.disease,
        proj.specimen_type,
        proj.source as project_source,
        proj.date_received,
        c.id as collaborator_id,
        c.pi_name,
        c.pi_institute,
        c.pi_email,
        c.irb_id
      FROM specimens s
      LEFT JOIN patients p ON s.patient_id = p.id
      JOIN projects proj ON s.project_id = proj.id
      JOIN collaborators c ON proj.collaborator_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add filters
    if (dateStart) {
      query += ` AND s.date_collected >= $${paramIndex}`;
      params.push(dateStart);
      paramIndex++;
    }

    if (dateEnd) {
      query += ` AND s.date_collected <= $${paramIndex}`;
      params.push(dateEnd);
      paramIndex++;
    }

    if (collaboratorId) {
      query += ` AND c.id = $${paramIndex}`;
      params.push(collaboratorId);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND proj.id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (disease) {
      query += ` AND proj.disease ILIKE $${paramIndex}`;
      params.push(`%${disease}%`);
      paramIndex++;
    }

    if (specimenType) {
      query += ` AND proj.specimen_type ILIKE $${paramIndex}`;
      params.push(`%${specimenType}%`);
      paramIndex++;
    }

    // Add search term filtering (similar to existing search logic)
    if (searchTerm) {
      if (searchField) {
        switch (searchField) {
          case 'tube_id':
            query += ` AND s.tube_id ILIKE $${paramIndex}`;
            break;
          case 'position_freezer':
            query += ` AND s.position_freezer ILIKE $${paramIndex}`;
            break;
          case 'position_rack':
            query += ` AND s.position_rack ILIKE $${paramIndex}`;
            break;
          case 'position_box':
            query += ` AND s.position_box ILIKE $${paramIndex}`;
            break;
          case 'patient':
            query += ` AND (p.external_id ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`;
            break;
          case 'collaborator':
            query += ` AND (c.pi_name ILIKE $${paramIndex} OR c.pi_institute ILIKE $${paramIndex})`;
            break;
          case 'disease':
            query += ` AND proj.disease ILIKE $${paramIndex}`;
            break;
          case 'specimen_type':
            query += ` AND proj.specimen_type ILIKE $${paramIndex}`;
            break;
          default:
            query += ` AND (s.tube_id ILIKE $${paramIndex} OR s.position_freezer ILIKE $${paramIndex} OR s.position_rack ILIKE $${paramIndex} OR s.position_box ILIKE $${paramIndex} OR s.specimen_site ILIKE $${paramIndex})`;
        }
        params.push(`%${searchTerm}%`);
        paramIndex++;
      } else {
        // Search across all fields
        query += ` AND (
          s.tube_id ILIKE $${paramIndex} OR
          s.position_freezer ILIKE $${paramIndex} OR
          s.position_rack ILIKE $${paramIndex} OR
          s.position_box ILIKE $${paramIndex} OR
          s.specimen_site ILIKE $${paramIndex} OR
          p.external_id ILIKE $${paramIndex} OR
          p.first_name ILIKE $${paramIndex} OR
          p.last_name ILIKE $${paramIndex} OR
          c.pi_name ILIKE $${paramIndex} OR
          c.pi_institute ILIKE $${paramIndex} OR
          proj.disease ILIKE $${paramIndex} OR
          proj.specimen_type ILIKE $${paramIndex}
        )`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }
    }

    // Add specimen selection filtering (if specific specimens are selected)
    console.log('🔍 CSV DEBUG - Before specimen filter check, selectedSpecimens:', selectedSpecimens);
    if (selectedSpecimens) {
      const specimenIds = selectedSpecimens.split(',').map(id => id.trim()).filter(Boolean);
      console.log('🔍 CSV DEBUG - Parsed specimen IDs:', specimenIds);
      if (specimenIds.length > 0) {
        console.log('🔍 CSV DEBUG - Adding specimen filter to query');
        query += ` AND s.id = ANY($${paramIndex}::uuid[])`;
        params.push(specimenIds);
        console.log('🔍 CSV DEBUG - Added params at index', paramIndex, ':', specimenIds);
        paramIndex++;
      }
    }

    // Add ordering and limit
    query += ` ORDER BY s.date_collected DESC, s.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    console.log('🔍 CSV DEBUG - Final query:', query);
    console.log('🔍 CSV DEBUG - Final params:', params);

    // Execute query
    const result = await db.query(query, params);

    console.log('🔍 CSV DEBUG - Query result count:', result.rows.length);
    
    // DEBUG: Check what the query is actually returning for specimen_id
    if (result.rows.length > 0) {
      console.log('🔍 CSV DEBUG - First row specimen_id field:', result.rows[0].specimen_id);
      console.log('🔍 CSV DEBUG - First row sample data:', {
        specimen_id: result.rows[0].specimen_id,
        specimen_number: result.rows[0].specimen_number,
        id: result.rows[0].id,
        tube_id: result.rows[0].tube_id
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No specimens found with the specified criteria' });
    }

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `specimens_export_${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    // Define CSV columns (extensible design)
    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'specimen_id', title: 'Specimen ID' },
        { id: 'tube_id', title: 'Tube ID' },
        { id: 'pi_name', title: 'PI Name' },
        { id: 'pi_institute', title: 'PI Institute' },
        { id: 'disease', title: 'Disease' },
        { id: 'specimen_type', title: 'Specimen Type' },
        { id: 'patient_external_id', title: 'Patient ID' },
        { id: 'patient_name', title: 'Patient Name' },
        { id: 'date_collected', title: 'Date Collected' },
        { id: 'location', title: 'Location' },
        { id: 'activity_status', title: 'Status' },
        { id: 'extracted', title: 'Extracted' },
        { id: 'used_up', title: 'Used Up' },
        { id: 'initial_quantity', title: 'Initial Quantity' },
        { id: 'project_source', title: 'Project Source' },
        { id: 'date_received', title: 'Date Received' },
        { id: 'diagnosis', title: 'Diagnosis' },
        { id: 'irb_id', title: 'IRB ID' },
        { id: 'sequencing_run_id', title: 'Sequencing Run ID' },
        { id: 'fastq_location', title: 'FASTQ Location' },
        { id: 'analysis_status', title: 'Analysis Status' },
        { id: 'results_location', title: 'Results Location' },
        { id: 'sequencing_notes', title: 'Sequencing Notes' }
      ]
    });

    // Transform data for CSV
    const csvData = result.rows.map(row => {
      // Build location string
      const locationParts = [
        row.position_freezer,
        row.position_rack,
        row.position_box,
        row.position_dimension_one,
        row.position_dimension_two
      ].filter(Boolean);
      const location = locationParts.join(' / ') || '';

      // Build patient name
      const patientNameParts = [row.patient_first_name, row.patient_last_name].filter(Boolean);
      const patientName = patientNameParts.join(' ') || '';

      // DEBUG: Log the actual row data to see what we're getting
      console.log('🔍 CSV DEBUG - Raw row data:', {
        specimen_id: row.specimen_id,
        specimen_number: row.specimen_number,
        id: row.id
      });

      return {
        specimen_id: row.specimen_id,
        tube_id: row.tube_id || '',
        pi_name: row.pi_name || '',
        pi_institute: row.pi_institute || '',
        disease: row.disease || '',
        specimen_type: row.specimen_type || '',
        patient_external_id: row.patient_external_id || '',
        patient_name: patientName,
        date_collected: row.date_collected ? new Date(row.date_collected).toISOString().split('T')[0] : '',
        location: location,
        activity_status: row.activity_status || '',
        extracted: row.extracted ? 'Yes' : 'No',
        used_up: row.used_up ? 'Yes' : 'No',
        initial_quantity: row.initial_quantity || '',
        project_source: row.project_source || '',
        date_received: row.date_received ? new Date(row.date_received).toISOString().split('T')[0] : '',
        diagnosis: row.diagnosis || '',
        irb_id: row.irb_id || '',
        sequencing_run_id: row.sequencing_run_id || '',
        fastq_location: row.fastq_location || '',
        analysis_status: row.analysis_status || '',
        results_location: row.results_location || '',
        sequencing_notes: row.sequencing_notes || ''
      };
    });

    // Write CSV file
    await csvWriter.writeRecords(csvData);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_CSV',
        'specimens',
        '00000000-0000-0000-0000-000000000000', // Use a placeholder UUID for bulk exports
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename,
          selected_columns: columnsToExport
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending (optional - could keep for caching)
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ msg: 'Failed to export data', error: err.message });
  }
});

// @route   GET api/export/specimens/excel
// @desc    Export specimens data as Excel with formatting
// @access  Private
router.get('/specimens/excel', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      searchTerm,
      searchField,
      dateStart,
      dateEnd,
      collaboratorId,
      projectId,
      disease,
      specimenType,
      limit = 10000, // Cap at 10,000 records
      selectedColumns,
      selectedSpecimens,
      bulkIdText
    } = req.query;
    
    // Parse selected columns or use all columns as default
    const columnsToExport = selectedColumns ? selectedColumns.split(',') : getAllColumnKeys();

    // Handle bulk search export (same as CSV)
    if (bulkIdText && bulkIdText.trim()) {
      console.log('📋 Excel Export: Using bulk search for IDs:', bulkIdText.trim());
      
      // Parse bulk IDs from text
      const identifiers = bulkIdText
        .split(/[,;\n\r]+/)
        .map(id => id.trim())
        .filter(Boolean);
      
      console.log('📋 Excel Export: Parsed identifiers:', identifiers);
      
      // Use the same bulk search logic as CSV export
      const baseQuery = `
        SELECT 
          s.specimen_number as specimen_id,
          s.tube_id,
          s.date_collected,
          s.position_freezer,
          s.position_rack,
          s.position_box,
          s.position_dimension_one,
          s.position_dimension_two,
          s.activity_status,
          s.specimen_site,
          s.used_up,
          s.extracted,
          s.initial_quantity,
          s.created_at as specimen_created_at,
          p.external_id as patient_external_id,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          p.diagnosis,
          proj.id as project_id,
          proj.disease,
          proj.specimen_type,
          proj.source as project_source,
          proj.date_received,
          proj.feedback_date,
          c.pi_name,
          c.pi_institute,
          c.irb_id,
          c.pi_email
        FROM specimens s
        LEFT JOIN patients p ON s.patient_id = p.id
        JOIN projects proj ON s.project_id = proj.id
        JOIN collaborators c ON proj.collaborator_id = c.id`;
      
      // Use bulk search logic
      const cleanIdentifiers = [...new Set(identifiers.map(id => String(id).trim()).filter(Boolean))];
      const numericIdentifiers = cleanIdentifiers.filter(id => /^\d+$/.test(id)).map(id => parseInt(id));
      const nonNumericIdentifiers = cleanIdentifiers.filter(id => !/^\d+$/.test(id));
      
      let bulkQuery, bulkParams;
      if (numericIdentifiers.length > 0 && nonNumericIdentifiers.length > 0) {
        // Mixed identifiers
        bulkQuery = `${baseQuery} WHERE 
          s.specimen_number = ANY($1::int[]) OR
          s.tube_id = ANY($2::text[])
          ORDER BY s.specimen_number ASC`;
        bulkParams = [numericIdentifiers, nonNumericIdentifiers];
      } else if (numericIdentifiers.length > 0) {
        // Only numeric identifiers
        bulkQuery = `${baseQuery} WHERE s.specimen_number = ANY($1::int[]) ORDER BY s.specimen_number ASC`;
        bulkParams = [numericIdentifiers];
      } else {
        // Only non-numeric identifiers
        bulkQuery = `${baseQuery} WHERE s.tube_id = ANY($1::text[]) ORDER BY s.specimen_number ASC`;
        bulkParams = [nonNumericIdentifiers];
      }
      
      const result = await db.query(bulkQuery, bulkParams);
      console.log('📋 Excel Export: Bulk search found', result.rows.length, 'specimens');
      
      if (result.rows.length === 0) {
        return res.status(404).json({ msg: 'No specimens found matching the provided identifiers' });
      }

      // Create Excel workbook for bulk results
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Specimens Export');

      // Define column headers with formatting based on selection
      const excelColumns = buildExcelColumns(columnsToExport);
      worksheet.columns = excelColumns;

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0077B6' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      // Add data rows for bulk results
      result.rows.forEach((row, index) => {
        // Build computed fields
        const locationParts = [
          row.position_freezer,
          row.position_rack,
          row.position_box,
          row.position_dimension_one,
          row.position_dimension_two
        ].filter(Boolean);
        const location = locationParts.join(' / ') || '';

        const patientNameParts = [row.patient_first_name, row.patient_last_name].filter(Boolean);
        const patientName = patientNameParts.join(' ') || '';

        // Build row data for only selected columns
        const rowData = {};
        const dateFields = [];
        
        columnsToExport.forEach(columnKey => {
          const config = getColumnConfig(columnKey);
          if (config) {
            switch (columnKey) {
              case 'location':
                rowData[config.excelKey] = location;
                break;
              case 'patient_name':
                rowData[config.excelKey] = patientName;
                break;
              case 'date_collected':
              case 'date_received':
              case 'feedback_date':
              case 'date_of_birth':
                rowData[config.excelKey] = row[columnKey] ? new Date(row[columnKey]) : '';
                if (row[columnKey]) dateFields.push(config.excelKey);
                break;
              case 'extracted':
              case 'used_up':
                rowData[config.excelKey] = row[columnKey] ? 'Yes' : 'No';
                break;
              default:
                rowData[config.excelKey] = row[columnKey] || '';
            }
          }
        });

        const newRow = worksheet.addRow(rowData);
        
        // Alternate row coloring
        if (index % 2 === 1) {
          newRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F8F9FA' }
          };
        }

        // Format date cells
        dateFields.forEach(dateField => {
          const cell = newRow.getCell(dateField);
          if (cell.value instanceof Date) {
            cell.numFmt = 'mm/dd/yyyy';
          }
        });
      });

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Freeze the header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Create exports directory if it doesn't exist
      const exportsDir = path.join(__dirname, '../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `specimens_bulk_export_${timestamp}.xlsx`;
      const filepath = path.join(exportsDir, filename);

      // Write Excel file
      await workbook.xlsx.writeFile(filepath);

      // Log the export action
      await db.query(
        `INSERT INTO audit_log 
        (user_id, action, table_name, record_id, changed_fields) 
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          'EXPORT_BULK_EXCEL',
          'specimens',
          '00000000-0000-0000-0000-000000000000',
          JSON.stringify({
            identifiers_searched: identifiers.length,
            records_found: result.rows.length,
            filename: filename
          })
        ]
      );

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the file to the client
      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);

      // Clean up file after sending
      fileStream.on('end', () => {
        fs.unlink(filepath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      });

      return; // Exit early for bulk search - don't continue to regular export logic
    }

    // Build dynamic query with selected columns (same as CSV)
    const selectFields = buildSelectClause(columnsToExport);
    
    let query = `
      SELECT 
        ${selectFields.join(',\n        ')}
      FROM specimens s
      LEFT JOIN patients p ON s.patient_id = p.id
      JOIN projects proj ON s.project_id = proj.id
      JOIN collaborators c ON proj.collaborator_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add the same filters as CSV export
    if (dateStart) {
      query += ` AND s.date_collected >= $${paramIndex}`;
      params.push(dateStart);
      paramIndex++;
    }

    if (dateEnd) {
      query += ` AND s.date_collected <= $${paramIndex}`;
      params.push(dateEnd);
      paramIndex++;
    }

    if (collaboratorId) {
      query += ` AND c.id = $${paramIndex}`;
      params.push(collaboratorId);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND proj.id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (disease) {
      query += ` AND proj.disease ILIKE $${paramIndex}`;
      params.push(`%${disease}%`);
      paramIndex++;
    }

    if (specimenType) {
      query += ` AND proj.specimen_type ILIKE $${paramIndex}`;
      params.push(`%${specimenType}%`);
      paramIndex++;
    }

    // Add search term filtering (same logic as CSV)
    if (searchTerm) {
      if (searchField) {
        switch (searchField) {
          case 'tube_id':
            query += ` AND s.tube_id ILIKE $${paramIndex}`;
            break;
          case 'position_freezer':
            query += ` AND s.position_freezer ILIKE $${paramIndex}`;
            break;
          case 'position_rack':
            query += ` AND s.position_rack ILIKE $${paramIndex}`;
            break;
          case 'position_box':
            query += ` AND s.position_box ILIKE $${paramIndex}`;
            break;
          case 'patient':
            query += ` AND (p.external_id ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`;
            break;
          case 'collaborator':
            query += ` AND (c.pi_name ILIKE $${paramIndex} OR c.pi_institute ILIKE $${paramIndex})`;
            break;
          case 'disease':
            query += ` AND proj.disease ILIKE $${paramIndex}`;
            break;
          case 'specimen_type':
            query += ` AND proj.specimen_type ILIKE $${paramIndex}`;
            break;
          default:
            query += ` AND (s.tube_id ILIKE $${paramIndex} OR s.position_freezer ILIKE $${paramIndex} OR s.position_rack ILIKE $${paramIndex} OR s.position_box ILIKE $${paramIndex} OR s.specimen_site ILIKE $${paramIndex})`;
        }
        params.push(`%${searchTerm}%`);
        paramIndex++;
      } else {
        // Search across all fields
        query += ` AND (
          s.tube_id ILIKE $${paramIndex} OR
          s.position_freezer ILIKE $${paramIndex} OR
          s.position_rack ILIKE $${paramIndex} OR
          s.position_box ILIKE $${paramIndex} OR
          s.specimen_site ILIKE $${paramIndex} OR
          p.external_id ILIKE $${paramIndex} OR
          p.first_name ILIKE $${paramIndex} OR
          p.last_name ILIKE $${paramIndex} OR
          c.pi_name ILIKE $${paramIndex} OR
          c.pi_institute ILIKE $${paramIndex} OR
          proj.disease ILIKE $${paramIndex} OR
          proj.specimen_type ILIKE $${paramIndex}
        )`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }
    }

    // Add specimen selection filtering (if specific specimens are selected)
    if (selectedSpecimens) {
      const specimenIds = selectedSpecimens.split(',').map(id => id.trim()).filter(Boolean);
      if (specimenIds.length > 0) {
        query += ` AND s.id = ANY($${paramIndex}::uuid[])`;
        params.push(specimenIds);
        paramIndex++;
      }
    }

    // Add ordering and limit
    query += ` ORDER BY s.date_collected DESC, s.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    // Execute query
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No specimens found with the specified criteria' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Specimens Export');

    // Define column headers with formatting based on selection
    const excelColumns = buildExcelColumns(columnsToExport);
    worksheet.columns = excelColumns;

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0077B6' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add data rows based on selected columns
    result.rows.forEach((row, index) => {
      // Build computed fields
      const locationParts = [
        row.position_freezer,
        row.position_rack,
        row.position_box,
        row.position_dimension_one,
        row.position_dimension_two
      ].filter(Boolean);
      const location = locationParts.join(' / ') || '';

      const patientNameParts = [row.patient_first_name, row.patient_last_name].filter(Boolean);
      const patientName = patientNameParts.join(' ') || '';

      // Build row data for only selected columns
      const rowData = {};
      const dateFields = [];
      
      columnsToExport.forEach(columnKey => {
        const config = getColumnConfig(columnKey);
        if (config) {
          switch (columnKey) {
            case 'location':
              rowData[config.excelKey] = location;
              break;
            case 'patient_name':
              rowData[config.excelKey] = patientName;
              break;
            case 'date_collected':
            case 'date_received':
            case 'feedback_date':
            case 'date_of_birth':
              rowData[config.excelKey] = row[columnKey] ? new Date(row[columnKey]) : '';
              if (row[columnKey]) dateFields.push(config.excelKey);
              break;
            case 'extracted':
            case 'used_up':
              rowData[config.excelKey] = row[columnKey] ? 'Yes' : 'No';
              break;
            default:
              rowData[config.excelKey] = row[columnKey] || '';
          }
        }
      });

      const newRow = worksheet.addRow(rowData);
      
      // Alternate row coloring
      if (index % 2 === 1) {
        newRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }

      // Format date cells
      dateFields.forEach(dateField => {
        const cell = newRow.getCell(dateField);
        if (cell.value instanceof Date) {
          cell.numFmt = 'mm/dd/yyyy';
        }
      });
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `specimens_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Write Excel file
    await workbook.xlsx.writeFile(filepath);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_EXCEL',
        'specimens',
        '00000000-0000-0000-0000-000000000000', // Use a placeholder UUID for bulk exports
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename,
          selected_columns: columnsToExport
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending (optional - could keep for caching)
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Excel export error:', err.message);
    res.status(500).json({ msg: 'Failed to export Excel data', error: err.message });
  }
});

// @route   GET api/export/inventory/csv
// @desc    Export inventory data as CSV with filtering
// @access  Private
router.get('/inventory/csv', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      searchTerm,
      category,
      lowStock,
      expiring,
      limit = 10000 // Cap at 10,000 records
    } = req.query;

    // Build dynamic query with filters
    let query = `
      SELECT 
        i.inventory_id,
        i.name,
        i.category,
        i.description,
        i.supplier,
        i.catalog_number,
        i.current_quantity,
        i.unit_of_measure,
        i.lot_number,
        i.expiration_date,
        i.storage_location,
        i.storage_conditions,
        i.minimum_stock_level,
        i.cost_per_unit,
        i.barcode,
        i.notes,
        i.created_at,
        i.updated_at,
        ic.description as category_description,
        ic.default_unit,
        CASE 
          WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
          ELSE false
        END as is_low_stock,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') AND i.expiration_date > CURRENT_DATE THEN true
          ELSE false
        END as is_expiring_soon
      FROM inventory i
      LEFT JOIN inventory_categories ic ON i.category = ic.category_name
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add filters
    if (searchTerm) {
      query += ` AND (
        i.name ILIKE $${paramIndex} OR
        i.description ILIKE $${paramIndex} OR
        i.catalog_number ILIKE $${paramIndex} OR
        i.supplier ILIKE $${paramIndex} OR
        i.lot_number ILIKE $${paramIndex}
      )`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND i.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (lowStock === 'true') {
      query += ` AND i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0`;
    }

    if (expiring) {
      const days = parseInt(expiring) || 30;
      paramIndex++;
      query += ` AND i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL $${paramIndex} day)`;
      params.push(days);
    }

    // Add ordering and limit
    paramIndex++;
    query += ` ORDER BY i.inventory_id ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    // Execute query
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No inventory items found with the specified criteria' });
    }

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `inventory_export_${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    // Define CSV columns
    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'inventory_id', title: 'Inventory ID' },
        { id: 'barcode', title: 'Barcode' },
        { id: 'name', title: 'Name' },
        { id: 'category', title: 'Category' },
        { id: 'description', title: 'Description' },
        { id: 'supplier', title: 'Supplier' },
        { id: 'catalog_number', title: 'Catalog Number' },
        { id: 'lot_number', title: 'Lot Number' },
        { id: 'current_quantity', title: 'Current Quantity' },
        { id: 'unit_of_measure', title: 'Unit' },
        { id: 'minimum_stock_level', title: 'Min Stock Level' },
        { id: 'cost_per_unit', title: 'Cost per Unit' },
        { id: 'expiration_date', title: 'Expiration Date' },
        { id: 'storage_location', title: 'Storage Location' },
        { id: 'storage_conditions', title: 'Storage Conditions' },
        { id: 'status', title: 'Status' },
        { id: 'notes', title: 'Notes' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' }
      ]
    });

    // Transform data for CSV
    const csvData = result.rows.map(row => {
      let status = 'Normal';
      if (row.is_expired) status = 'Expired';
      else if (row.is_expiring_soon) status = 'Expiring Soon';
      else if (row.is_low_stock) status = 'Low Stock';

      return {
        inventory_id: `INV-${row.inventory_id.toString().padStart(3, '0')}`,
        barcode: row.barcode || '',
        name: row.name || '',
        category: row.category || '',
        description: row.description || '',
        supplier: row.supplier || '',
        catalog_number: row.catalog_number || '',
        lot_number: row.lot_number || '',
        current_quantity: row.current_quantity || '0',
        unit_of_measure: row.unit_of_measure || '',
        minimum_stock_level: row.minimum_stock_level || '0',
        cost_per_unit: row.cost_per_unit || '',
        expiration_date: row.expiration_date ? new Date(row.expiration_date).toISOString().split('T')[0] : '',
        storage_location: row.storage_location || '',
        storage_conditions: row.storage_conditions || '',
        status: status,
        notes: row.notes || '',
        created_at: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : ''
      };
    });

    // Write CSV file
    await csvWriter.writeRecords(csvData);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_CSV',
        'inventory',
        '00000000-0000-0000-0000-000000000000',
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Inventory export error:', err.message);
    res.status(500).json({ msg: 'Failed to export inventory data', error: err.message });
  }
});

// @route   GET api/export/inventory/excel
// @desc    Export inventory data as Excel with formatting
// @access  Private
router.get('/inventory/excel', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      searchTerm,
      category,
      lowStock,
      expiring,
      limit = 10000
    } = req.query;

    // Build dynamic query (same as CSV)
    let query = `
      SELECT 
        i.inventory_id,
        i.name,
        i.category,
        i.description,
        i.supplier,
        i.catalog_number,
        i.current_quantity,
        i.unit_of_measure,
        i.lot_number,
        i.expiration_date,
        i.storage_location,
        i.storage_conditions,
        i.minimum_stock_level,
        i.cost_per_unit,
        i.barcode,
        i.notes,
        i.created_at,
        i.updated_at,
        ic.description as category_description,
        ic.default_unit,
        CASE 
          WHEN i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0 THEN true
          ELSE false
        END as is_low_stock,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') AND i.expiration_date > CURRENT_DATE THEN true
          ELSE false
        END as is_expiring_soon
      FROM inventory i
      LEFT JOIN inventory_categories ic ON i.category = ic.category_name
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add same filters as CSV
    if (searchTerm) {
      query += ` AND (
        i.name ILIKE $${paramIndex} OR
        i.description ILIKE $${paramIndex} OR
        i.catalog_number ILIKE $${paramIndex} OR
        i.supplier ILIKE $${paramIndex} OR
        i.lot_number ILIKE $${paramIndex}
      )`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND i.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (lowStock === 'true') {
      query += ` AND i.current_quantity <= i.minimum_stock_level AND i.minimum_stock_level > 0`;
    }

    if (expiring) {
      const days = parseInt(expiring) || 30;
      paramIndex++;
      query += ` AND i.expiration_date IS NOT NULL AND i.expiration_date <= (CURRENT_DATE + INTERVAL $${paramIndex} day)`;
      params.push(days);
    }

    query += ` ORDER BY i.inventory_id ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    // Execute query
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No inventory items found with the specified criteria' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Export');

    // Define columns
    worksheet.columns = [
      { header: 'Inventory ID', key: 'inventory_id', width: 15 },
      { header: 'Barcode', key: 'barcode', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Supplier', key: 'supplier', width: 20 },
      { header: 'Catalog Number', key: 'catalog_number', width: 15 },
      { header: 'Lot Number', key: 'lot_number', width: 15 },
      { header: 'Current Quantity', key: 'current_quantity', width: 15 },
      { header: 'Unit', key: 'unit_of_measure', width: 10 },
      { header: 'Min Stock Level', key: 'minimum_stock_level', width: 15 },
      { header: 'Cost per Unit', key: 'cost_per_unit', width: 12 },
      { header: 'Expiration Date', key: 'expiration_date', width: 15 },
      { header: 'Storage Location', key: 'storage_location', width: 20 },
      { header: 'Storage Conditions', key: 'storage_conditions', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created At', key: 'created_at', width: 12 },
      { header: 'Updated At', key: 'updated_at', width: 12 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0077B6' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add data rows
    result.rows.forEach((row, index) => {
      let status = 'Normal';
      if (row.is_expired) status = 'Expired';
      else if (row.is_expiring_soon) status = 'Expiring Soon';
      else if (row.is_low_stock) status = 'Low Stock';

      const rowData = {
        inventory_id: `INV-${row.inventory_id.toString().padStart(3, '0')}`,
        barcode: row.barcode || '',
        name: row.name || '',
        category: row.category || '',
        description: row.description || '',
        supplier: row.supplier || '',
        catalog_number: row.catalog_number || '',
        lot_number: row.lot_number || '',
        current_quantity: parseFloat(row.current_quantity) || 0,
        unit_of_measure: row.unit_of_measure || '',
        minimum_stock_level: parseFloat(row.minimum_stock_level) || 0,
        cost_per_unit: parseFloat(row.cost_per_unit) || '',
        expiration_date: row.expiration_date ? new Date(row.expiration_date) : '',
        storage_location: row.storage_location || '',
        storage_conditions: row.storage_conditions || '',
        status: status,
        notes: row.notes || '',
        created_at: row.created_at ? new Date(row.created_at) : '',
        updated_at: row.updated_at ? new Date(row.updated_at) : ''
      };

      const newRow = worksheet.addRow(rowData);
      
      // Alternate row coloring
      if (index % 2 === 1) {
        newRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }

      // Color code status cells
      const statusCell = newRow.getCell('status');
      if (status === 'Expired') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEBEE' }
        };
        statusCell.font = { color: { argb: 'C62828' } };
      } else if (status === 'Expiring Soon') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3E0' }
        };
        statusCell.font = { color: { argb: 'EF6C00' } };
      } else if (status === 'Low Stock') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8E1' }
        };
        statusCell.font = { color: { argb: 'F57F17' } };
      }

      // Format date cells
      ['expiration_date', 'created_at', 'updated_at'].forEach(dateField => {
        const cell = newRow.getCell(dateField);
        if (cell.value instanceof Date) {
          cell.numFmt = 'mm/dd/yyyy';
        }
      });

      // Format currency cells
      ['cost_per_unit'].forEach(currencyField => {
        const cell = newRow.getCell(currencyField);
        if (cell.value) {
          cell.numFmt = '$#,##0.00';
        }
      });
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `inventory_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Write Excel file
    await workbook.xlsx.writeFile(filepath);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_EXCEL',
        'inventory',
        '00000000-0000-0000-0000-000000000000',
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Inventory Excel export error:', err.message);
    res.status(500).json({ msg: 'Failed to export inventory Excel data', error: err.message });
  }
});

// @route   GET api/export/projects/excel
// @desc    Export projects data as Excel with formatting
// @access  Private
router.get('/projects/excel', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      search,
      limit = 10000 // Cap at 10,000 records
    } = req.query;

    // Build query with specimen counts (same as projects route)
    let query = `
      SELECT p.*, c.pi_name, c.pi_institute, c.collaborator_number,
        COALESCE(specimen_counts.count, 0) as specimen_count
      FROM projects p
      JOIN collaborators c ON p.collaborator_id = c.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM specimens
        WHERE specimen_number != 0
        GROUP BY project_id
      ) specimen_counts ON p.id = specimen_counts.project_id
      WHERE p.project_number != 0
    `;

    const params = [];
    let paramIndex = 1;

    // Add search filter if provided
    if (search?.trim()) {
      // Use smart search for projects - exact match for project_number, substring for text fields
      const { buildSearchClause } = require('../utils/searchUtils');
      const fieldConfigs = [
        { field: 'p.project_number', isId: true },
        { field: 'p.disease', isId: false },
        { field: 'p.specimen_type', isId: false },
        { field: 'p.source', isId: false },
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.collaborator_number', isId: true }
      ];

      const searchResult = buildSearchClause(fieldConfigs, search.trim(), paramIndex);
      query += ` AND ${searchResult.whereClause}`;
      params.push(...searchResult.parameters);
      paramIndex = searchResult.nextParamIndex;
    }

    // Add ordering and limit
    query += `
      ORDER BY p.project_number, p.date_received DESC
      LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    // Execute query
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No projects found with the specified criteria' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Projects Export');

    // Define columns
    worksheet.columns = [
      { header: 'Project Number', key: 'project_number', width: 15 },
      { header: 'Disease', key: 'disease', width: 20 },
      { header: 'Specimen Type', key: 'specimen_type', width: 15 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Specimen Count', key: 'specimen_count', width: 15 },
      { header: 'PI Name', key: 'pi_name', width: 25 },
      { header: 'Institution', key: 'pi_institute', width: 30 },
      { header: 'Collaborator Number', key: 'collaborator_number', width: 18 },
      { header: 'Date Received', key: 'date_received', width: 15 },
      { header: 'Feedback Date', key: 'feedback_date', width: 15 },
      { header: 'Comments', key: 'comments', width: 30 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0077B6' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add data rows
    result.rows.forEach((row, index) => {
      const rowData = {
        project_number: row.project_number === 0 ? 'Unknown' : row.project_number || '',
        disease: row.disease || '',
        specimen_type: row.specimen_type || '',
        source: row.source || '',
        specimen_count: row.specimen_count || 0,
        pi_name: row.pi_name || '',
        pi_institute: row.pi_institute || '',
        collaborator_number: row.collaborator_number === 0 ? 'Unknown' : row.collaborator_number || '',
        date_received: row.date_received ? new Date(row.date_received) : '',
        feedback_date: row.feedback_date ? new Date(row.feedback_date) : '',
        comments: row.comments || ''
      };

      const newRow = worksheet.addRow(rowData);

      // Alternate row coloring
      if (index % 2 === 1) {
        newRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }

      // Format date cells
      ['date_received', 'feedback_date'].forEach(dateField => {
        const cell = newRow.getCell(dateField);
        if (cell.value instanceof Date) {
          cell.numFmt = 'mm/dd/yyyy';
        }
      });
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `projects_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Write Excel file
    await workbook.xlsx.writeFile(filepath);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log
      (user_id, action, table_name, record_id, changed_fields)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_EXCEL',
        'projects',
        '00000000-0000-0000-0000-000000000000',
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Projects Excel export error:', err.message);
    res.status(500).json({ msg: 'Failed to export projects Excel data', error: err.message });
  }
});

// @route   GET api/export/collaborators/excel
// @desc    Export collaborators data as Excel with formatting
// @access  Private
router.get('/collaborators/excel', [auth, roleCheck(['admin', 'lab_manager', 'lab_technician'])], async (req, res) => {
  try {
    const {
      search,
      limit = 10000 // Cap at 10,000 records
    } = req.query;

    // Build query with project information and specimen counts (same as collaborators route)
    let query = `
      SELECT c.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'project_number', p.project_number,
              'disease', p.disease,
              'specimen_count', COALESCE(specimen_counts.count, 0)
            ) ORDER BY p.project_number
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS projects
      FROM collaborators c
      LEFT JOIN projects p ON c.id = p.collaborator_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count
        FROM specimens
        WHERE specimen_number != 0
        GROUP BY project_id
      ) specimen_counts ON p.id = specimen_counts.project_id
      WHERE c.collaborator_number != 0
    `;

    const params = [];
    let paramIndex = 1;

    // Add search filter if provided
    if (search?.trim()) {
      // Use smart search for collaborators - exact match for collaborator_number, substring for text fields
      const { buildSearchClause } = require('../utils/searchUtils');
      const fieldConfigs = [
        { field: 'c.collaborator_number', isId: true },
        { field: 'c.pi_name', isId: false },
        { field: 'c.pi_institute', isId: false },
        { field: 'c.pi_email', isId: false },
        { field: 'c.irb_id', isId: false },
        { field: 'c.internal_contact', isId: false }
      ];

      const searchResult = buildSearchClause(fieldConfigs, search.trim(), paramIndex);
      query += ` AND ${searchResult.whereClause}`;
      params.push(...searchResult.parameters);
      paramIndex = searchResult.nextParamIndex;
    }

    // Add GROUP BY and ordering
    query += `
      GROUP BY c.id
      ORDER BY c.collaborator_number, c.pi_name
      LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    // Execute query
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No collaborators found with the specified criteria' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Collaborators Export');

    // Define columns
    worksheet.columns = [
      { header: 'Collaborator Number', key: 'collaborator_number', width: 18 },
      { header: 'PI Name', key: 'pi_name', width: 25 },
      { header: 'Institution', key: 'pi_institute', width: 30 },
      { header: 'PI Email', key: 'pi_email', width: 25 },
      { header: 'Internal Contact', key: 'internal_contact', width: 20 },
      { header: 'IRB ID', key: 'irb_id', width: 15 },
      { header: 'Projects', key: 'projects_list', width: 50 },
      { header: 'Total Specimens', key: 'total_specimens', width: 15 },
      { header: 'Phone', key: 'pi_phone', width: 15 },
      { header: 'Fax', key: 'pi_fax', width: 15 },
      { header: 'Comments', key: 'comments', width: 30 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0077B6' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add data rows
    result.rows.forEach((row, index) => {
      // Build projects list string
      const projects = Array.isArray(row.projects) ? row.projects : [];
      const projectsList = projects
        .map(p => `${p.project_number} (${p.specimen_count})`)
        .join(', ');

      // Calculate total specimens
      const totalSpecimens = projects.reduce((sum, p) => sum + (p.specimen_count || 0), 0);

      const rowData = {
        collaborator_number: row.collaborator_number === 0 ? 'Unknown' : row.collaborator_number || '',
        pi_name: row.pi_name || '',
        pi_institute: row.pi_institute || '',
        pi_email: row.pi_email || '',
        internal_contact: row.internal_contact || '',
        irb_id: row.irb_id || '',
        projects_list: projectsList || '',
        total_specimens: totalSpecimens,
        pi_phone: row.pi_phone || '',
        pi_fax: row.pi_fax || '',
        comments: row.comments || ''
      };

      const newRow = worksheet.addRow(rowData);

      // Alternate row coloring
      if (index % 2 === 1) {
        newRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `collaborators_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Write Excel file
    await workbook.xlsx.writeFile(filepath);

    // Log the export action
    await db.query(
      `INSERT INTO audit_log
      (user_id, action, table_name, record_id, changed_fields)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'EXPORT_EXCEL',
        'collaborators',
        '00000000-0000-0000-0000-000000000000',
        JSON.stringify({
          filter_criteria: req.query,
          record_count: result.rows.length,
          filename: filename
        })
      ]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (err) {
    console.error('Collaborators Excel export error:', err.message);
    res.status(500).json({ msg: 'Failed to export collaborators Excel data', error: err.message });
  }
});

module.exports = router;