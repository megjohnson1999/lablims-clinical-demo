const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');

// @route   GET api/audit
// @desc    Get recent audit logs
// @access  Private (admin and lab_manager)
router.get('/', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.username
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC
       LIMIT 50`
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Audit log error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   GET api/audit/user/:id
// @desc    Get audit logs for a specific user
// @access  Private (admin and lab_manager)
router.get('/user/:id', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.username
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.user_id = $1
       ORDER BY a.timestamp DESC`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Audit log error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

// @route   GET api/audit/:table/:id
// @desc    Get audit logs for a specific record
// @access  Private (admin and lab_manager)
router.get('/:table/:id', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.username
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.table_name = $1 AND a.record_id = $2
       ORDER BY a.timestamp DESC`,
      [req.params.table, req.params.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Audit log error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error');
  }
});

module.exports = router;