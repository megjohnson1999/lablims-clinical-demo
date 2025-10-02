const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// @route   POST api/errors
// @desc    Log frontend errors for tracking
// @access  Public (no auth required for error reporting)
router.post('/', async (req, res) => {
  try {
    const {
      id,
      message,
      stack,
      componentStack,
      timestamp,
      userAgent,
      url,
      userId,
      buildVersion,
      errorType = 'CLIENT_ERROR'
    } = req.body;

    // Log the error with structured data
    logger.error('Frontend error reported', {
      errorId: id,
      message,
      stack,
      componentStack,
      timestamp,
      userAgent,
      url,
      userId,
      buildVersion,
      errorType,
      ip: req.ip,
      reportedAt: new Date().toISOString()
    });

    // In a production environment, you might also want to:
    // 1. Store errors in a database for analysis
    // 2. Send alerts for critical errors
    // 3. Forward to external services like Sentry

    res.status(200).json({
      success: true,
      message: 'Error reported successfully',
      errorId: id
    });

  } catch (err) {
    logger.error('Failed to process error report', {
      error: err.message,
      stack: err.stack
    });
    
    // Don't fail error reporting - just log it
    res.status(200).json({
      success: false,
      message: 'Error reporting failed, but logged locally'
    });
  }
});

module.exports = router;