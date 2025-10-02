const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
require('dotenv').config();

// @route   POST api/labels/generate
// @desc    Generate label file for specimens
// @access  Private
router.post('/generate', auth, async (req, res) => {
  try {
    const { specimen_ids } = req.body;
    
    if (!specimen_ids || !Array.isArray(specimen_ids) || specimen_ids.length === 0) {
      return res.status(400).json({ msg: 'Specimen IDs are required' });
    }
    
    // Get specimens with related data
    const specimens = await db.query(
      `SELECT s.*, 
        p.external_id as patient_external_id,
        proj.specimen_type
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       WHERE s.id = ANY($1)`,
      [specimen_ids]
    );
    
    if (specimens.rows.length === 0) {
      return res.status(404).json({ msg: 'No specimens found with the provided IDs' });
    }

    // Generate label content in the format required by the current printer
    const labelTemplate = process.env.LABEL_TEMPLATE || 'PathDiscCapLid.Lab';

    let labelContent = '';

    // Add a block for each specimen in the required format
    specimens.rows.forEach(specimen => {
      const dateCollected = specimen.date_collected
        ? new Date(specimen.date_collected).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/(\d+)\/(\d+)\/(\d+)/, '$1/$2/$3')
        : '01/01/1970';

      const labelNumber = specimen.specimen_number || '00000';
      const extId = specimen.tube_id || `SPEC_${specimen.specimen_number}`;
      const specimenType = specimen.specimen_type || 'TNA';

      labelContent += `LABELNAME = "${labelTemplate}"\n`;
      labelContent += `LABEL = "${labelNumber}"\n`;
      labelContent += `EXTID = "${extId}"\n`;
      labelContent += `SPECIMENTYPE = "${specimenType}"\n`;
      labelContent += `Date = "${dateCollected}"\n`;
      labelContent += `LabelQuantity = "1"\n`;
      labelContent += `END\n\n`;
    });

    // Create directory for label files if it doesn't exist
    const labelsDir = path.join(__dirname, '../labels');
    if (!fs.existsSync(labelsDir)) {
      fs.mkdirSync(labelsDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `labels_${Date.now()}.txt`;
    const filepath = path.join(labelsDir, filename);
    
    // Write file
    fs.writeFileSync(filepath, labelContent);
    
    // Log the action
    await db.query(
      `INSERT INTO audit_log
      (user_id, action, table_name, record_id, changed_fields)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'GENERATE_LABELS',
        'specimens',
        specimen_ids[0], // Use first specimen ID as record_id
        JSON.stringify({
          specimen_ids,
          filename,
          count: specimen_ids.length
        })
      ]
    );
    
    // Return file path and content
    res.json({
      msg: `Label file generated for ${specimens.rows.length} specimens`,
      filename,
      filepath,
      content: labelContent
    });
  } catch (err) {
    logger.error('Label generation error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   POST api/labels/project/:id
// @desc    Generate label file for all specimens in a project
// @access  Private
router.post('/project/:id', auth, async (req, res) => {
  try {
    // First check if project exists
    const projectCheck = await db.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    
    // Get all specimens for the project
    const specimens = await db.query(
      `SELECT s.*, 
        p.external_id as patient_external_id,
        proj.specimen_type
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       WHERE s.project_id = $1`,
      [req.params.id]
    );
    
    if (specimens.rows.length === 0) {
      return res.status(404).json({ msg: 'No specimens found in this project' });
    }

    // Generate label content in the format required by the current printer
    const labelTemplate = process.env.LABEL_TEMPLATE || 'PathDiscCapLid.Lab';

    let labelContent = '';

    // Add a block for each specimen in the required format
    specimens.rows.forEach(specimen => {
      const dateCollected = specimen.date_collected
        ? new Date(specimen.date_collected).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/(\d+)\/(\d+)\/(\d+)/, '$1/$2/$3')
        : '01/01/1970';

      const labelNumber = specimen.specimen_number || '00000';
      const extId = specimen.tube_id || `SPEC_${specimen.specimen_number}`;
      const specimenType = specimen.specimen_type || 'TNA';

      labelContent += `LABELNAME = "${labelTemplate}"\n`;
      labelContent += `LABEL = "${labelNumber}"\n`;
      labelContent += `EXTID = "${extId}"\n`;
      labelContent += `SPECIMENTYPE = "${specimenType}"\n`;
      labelContent += `Date = "${dateCollected}"\n`;
      labelContent += `LabelQuantity = "1"\n`;
      labelContent += `END\n\n`;
    });

    // Create directory for label files if it doesn't exist
    const labelsDir = path.join(__dirname, '../labels');
    if (!fs.existsSync(labelsDir)) {
      fs.mkdirSync(labelsDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `project_${req.params.id}_labels_${Date.now()}.txt`;
    const filepath = path.join(labelsDir, filename);
    
    // Write file
    fs.writeFileSync(filepath, labelContent);
    
    // Log the action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'GENERATE_PROJECT_LABELS',
        'projects',
        req.params.id,
        JSON.stringify({
          project_id: req.params.id,
          specimen_count: specimens.rows.length,
          filename
        })
      ]
    );
    
    // Return file path and content
    res.json({
      msg: `Label file generated for ${specimens.rows.length} specimens in project`,
      filename,
      filepath,
      content: labelContent
    });
  } catch (err) {
    logger.error('Label generation error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   GET api/labels/download/:filename
// @desc    Download a generated label file
// @access  Private
router.get('/download/:filename', auth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../labels', filename);
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ msg: 'Label file not found' });
    }
    
    // Send file
    res.download(filepath);
  } catch (err) {
    logger.error('Label generation error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   POST api/labels/generate-pdf
// @desc    Generate PDF labels for specimens
// @access  Private
router.post('/generate-pdf', auth, async (req, res) => {
  try {
    const { specimen_ids } = req.body;
    
    if (!specimen_ids || !Array.isArray(specimen_ids) || specimen_ids.length === 0) {
      return res.status(400).json({ msg: 'Specimen IDs are required' });
    }
    
    // Get specimens with related data
    const specimens = await db.query(
      `SELECT s.*, 
        p.external_id as patient_external_id,
        proj.specimen_type,
        proj.disease as project_disease
       FROM specimens s
       LEFT JOIN patients p ON s.patient_id = p.id
       JOIN projects proj ON s.project_id = proj.id
       WHERE s.id = ANY($1)
       ORDER BY s.specimen_number`,
      [specimen_ids]
    );
    
    if (specimens.rows.length === 0) {
      return res.status(404).json({ msg: 'No specimens found with the provided IDs' });
    }
    
    // Create directory for label files if it doesn't exist
    const labelsDir = path.join(__dirname, '../labels');
    if (!fs.existsSync(labelsDir)) {
      fs.mkdirSync(labelsDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `labels_${Date.now()}.pdf`;
    const filepath = path.join(labelsDir, filename);
    
    // Create PDF document
    const doc = new PDFDocument({ 
      size: 'LETTER',
      margins: { top: 36, bottom: 36, left: 36, right: 36 }
    });
    
    // Pipe to file
    doc.pipe(fs.createWriteStream(filepath));
    
    // PDF Header
    doc.fontSize(16).text('Specimen Labels', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.5);
    
    // Calculate label dimensions (2.5" x 1.25" labels, 3 across, 10 down)
    const labelWidth = 180; // ~2.5 inches
    const labelHeight = 90; // ~1.25 inches
    const labelsPerRow = 3;
    const startX = 36;
    const startY = 100;
    
    specimens.rows.forEach((specimen, index) => {
      const row = Math.floor(index / labelsPerRow);
      const col = index % labelsPerRow;
      
      const x = startX + (col * labelWidth);
      const y = startY + (row * labelHeight);
      
      // Check if we need a new page
      if (y + labelHeight > doc.page.height - 36) {
        doc.addPage();
        const newRow = 0;
        const newY = startY;
        drawLabel(doc, specimen, x, newY, labelWidth, labelHeight);
      } else {
        drawLabel(doc, specimen, x, y, labelWidth, labelHeight);
      }
    });
    
    // Finalize PDF
    doc.end();
    
    // Wait for PDF to be written
    await new Promise((resolve) => {
      doc.on('end', resolve);
    });
    
    // Log the action
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, table_name, record_id, changed_fields) 
      VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'GENERATE_PDF_LABELS',
        'specimens',
        null,
        JSON.stringify({
          specimen_ids,
          filename,
          count: specimens.rows.length
        })
      ]
    );
    
    // Return file information
    res.json({
      msg: `PDF labels generated for ${specimens.rows.length} specimens`,
      filename,
      filepath,
      count: specimens.rows.length
    });
  } catch (err) {
    logger.error('PDF label generation error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// Helper function to draw individual label
function drawLabel(doc, specimen, x, y, width, height) {
  // Draw border
  doc.rect(x, y, width, height).stroke();
  
  // Specimen ID (prominent)
  doc.fontSize(12).font('Helvetica-Bold');
  const specimenId = `SPEC-${specimen.specimen_number?.toString().padStart(3, '0')}`;
  doc.text(specimenId, x + 5, y + 5, { width: width - 10 });
  
  // Patient info
  doc.fontSize(8).font('Helvetica');
  if (specimen.patient_external_id) {
    doc.text(`Patient: ${specimen.patient_external_id}`, x + 5, y + 20, { width: width - 10 });
  }
  
  // Project info
  if (specimen.project_disease) {
    doc.text(`Project: ${specimen.project_disease}`, x + 5, y + 32, { width: width - 10 });
  }
  
  // Sample type
  if (specimen.specimen_type) {
    doc.text(`Type: ${specimen.specimen_type}`, x + 5, y + 44, { width: width - 10 });
  }
  
  // Date collected
  if (specimen.date_collected) {
    const dateStr = new Date(specimen.date_collected).toLocaleDateString();
    doc.text(`Date: ${dateStr}`, x + 5, y + 56, { width: width - 10 });
  }
  
  // Location if available
  if (specimen.position_freezer || specimen.position_rack || specimen.position_box) {
    const location = [specimen.position_freezer, specimen.position_rack, specimen.position_box]
      .filter(Boolean).join('-');
    doc.text(`Loc: ${location}`, x + 5, y + 68, { width: width - 10 });
  }
}

// @route   GET api/labels/download-pdf/:filename
// @desc    Download a generated PDF label file
// @access  Private
router.get('/download-pdf/:filename', auth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../labels', filename);
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ msg: 'PDF file not found' });
    }
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send file
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (err) {
    logger.error('PDF download error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

module.exports = router;