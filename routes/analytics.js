const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');
const logger = require('../utils/logger');

// @route   GET api/analytics/overview
// @desc    Get overview statistics
// @access  Private
router.get('/overview', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM specimens) as total_specimens,
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM collaborators) as total_collaborators,
        (SELECT COUNT(*) FROM specimens WHERE created_at >= NOW() - INTERVAL '30 days') as specimens_last_30_days,
        (SELECT COUNT(*) FROM specimens WHERE extracted = true) as specimens_extracted,
        (SELECT COUNT(*) FROM specimens WHERE used_up = true) as specimens_used_up
    `);

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching overview analytics:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/specimens-by-site
// @desc    Get specimen count by specimen site/type (uses project specimen_type)
// @access  Private
router.get('/specimens-by-site', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(NULLIF(p.specimen_type, ''), 'Not Specified') as name,
        COUNT(*) as value
      FROM specimens s
      LEFT JOIN projects p ON s.project_id = p.id
      GROUP BY p.specimen_type
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching specimens by site:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/specimens-by-disease
// @desc    Get specimen count by disease (via projects)
// @access  Private
router.get('/specimens-by-disease', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(p.disease, 'Not Specified') as name,
        COUNT(s.id) as value
      FROM specimens s
      JOIN projects p ON s.project_id = p.id
      WHERE p.disease IS NOT NULL AND p.disease != ''
      GROUP BY p.disease
      ORDER BY COUNT(s.id) DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching specimens by disease:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/specimens-by-institution
// @desc    Get specimen count by institution (via collaborators)
// @access  Private
router.get('/specimens-by-institution', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(c.pi_institute, 'Not Specified') as name,
        COUNT(s.id) as value
      FROM specimens s
      JOIN projects p ON s.project_id = p.id
      JOIN collaborators c ON p.collaborator_id = c.id
      WHERE c.pi_institute IS NOT NULL AND c.pi_institute != ''
      GROUP BY c.pi_institute
      ORDER BY COUNT(s.id) DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching specimens by institution:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/specimens-by-status
// @desc    Get specimen count by activity status
// @access  Private
router.get('/specimens-by-status', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(activity_status, 'Not Specified') as name,
        COUNT(*) as value
      FROM specimens
      GROUP BY activity_status
      ORDER BY COUNT(*) DESC
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching specimens by status:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/specimens-timeline
// @desc    Get specimen collection timeline (monthly)
// @access  Private
router.get('/specimens-timeline', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        TO_CHAR(date_collected, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM specimens
      WHERE date_collected IS NOT NULL
      GROUP BY TO_CHAR(date_collected, 'YYYY-MM')
      ORDER BY month ASC
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching specimens timeline:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/storage-distribution
// @desc    Get specimen count by freezer location
// @access  Private
router.get('/storage-distribution', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(position_freezer, 'Not Specified') as name,
        COUNT(*) as value
      FROM specimens
      WHERE position_freezer IS NOT NULL AND position_freezer != ''
      GROUP BY position_freezer
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching storage distribution:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/project-volumes
// @desc    Get top projects by specimen count
// @access  Private
router.get('/project-volumes', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.project_number,
        COALESCE(p.disease, 'Not Specified') as disease,
        COALESCE(c.pi_name, 'Unknown') as pi_name,
        COUNT(s.id) as specimen_count
      FROM projects p
      LEFT JOIN specimens s ON s.project_id = p.id
      LEFT JOIN collaborators c ON p.collaborator_id = c.id
      GROUP BY p.project_number, p.disease, c.pi_name
      HAVING COUNT(s.id) > 0
      ORDER BY COUNT(s.id) DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching project volumes:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/extraction-status
// @desc    Get extraction status breakdown
// @access  Private
router.get('/extraction-status', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        CASE
          WHEN extracted = true THEN 'Extracted'
          ELSE 'Not Extracted'
        END as name,
        COUNT(*) as value
      FROM specimens
      GROUP BY extracted
      ORDER BY value DESC
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching extraction status:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// @route   GET api/analytics/availability-status
// @desc    Get specimen availability breakdown
// @access  Private
router.get('/availability-status', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        CASE
          WHEN used_up = true THEN 'Used Up'
          ELSE 'Available'
        END as name,
        COUNT(*) as value
      FROM specimens
      GROUP BY used_up
      ORDER BY value DESC
    `);

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching availability status:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

module.exports = router;
