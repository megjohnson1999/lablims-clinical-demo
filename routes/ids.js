const express = require('express');
const router = express.Router();
const idGenerationService = require('../services/idGenerationService');
const authMiddleware = require('../middleware/auth');
const { createErrorResponse, handleDatabaseError, withErrorHandling } = require('../utils/errorHandling');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/ids/next-collaborator
 * Get the next available collaborator ID
 */
router.get('/next-collaborator', async (req, res) => {
  try {
    const username = req.user?.username || req.user?.email;
    const result = await idGenerationService.getNextId('collaborator', username);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorResponse = handleDatabaseError(error, 'generate next collaborator ID', 'collaborator', null, {
      username: req.user?.username || req.user?.email
    });
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/ids/next-project
 * Get the next available project ID
 */
router.get('/next-project', async (req, res) => {
  try {
    const username = req.user?.username || req.user?.email;
    const result = await idGenerationService.getNextId('project', username);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorResponse = handleDatabaseError(error, 'generate next project ID', 'project', null, {
      username: req.user?.username || req.user?.email
    });
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/ids/next-specimen
 * Get the next available specimen ID
 */
router.get('/next-specimen', async (req, res) => {
  try {
    const username = req.user?.username || req.user?.email;
    const result = await idGenerationService.getNextId('specimen', username);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorResponse = handleDatabaseError(error, 'generate next specimen ID', 'specimen', null, {
      username: req.user?.username || req.user?.email,
      projectId: req.query.project_id
    });
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/ids/next-inventory
 * Get the next available inventory ID
 */
router.get('/next-inventory', async (req, res) => {
  try {
    const username = req.user?.username || req.user?.email;
    const result = await idGenerationService.getNextId('inventory', username);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error getting next inventory ID', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate inventory ID'
    });
  }
});

/**
 * GET /api/ids/next-patient
 * Get the next available patient ID
 */
router.get('/next-patient', async (req, res) => {
  try {
    const username = req.user?.username || req.user?.email;
    const result = await idGenerationService.getNextId('patient', username);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorResponse = handleDatabaseError(error, 'generate next patient ID', 'patient', null, {
      username: req.user?.username || req.user?.email
    });
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/ids/peek/:entityType
 * Peek at the next available ID without incrementing the counter
 */
router.get('/peek/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const nextId = await idGenerationService.peekNextId(entityType);
    
    // Add cache-busting headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({
      success: true,
      data: {
        nextId: nextId
      }
    });
  } catch (error) {
    logger.error('Error peeking next entity ID', { entityType: req.params.entityType, error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to peek next ID'
    });
  }
});

/**
 * GET /api/ids/history/:entityType
 * Get the generation history for a specific entity type
 */
router.get('/history/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const history = await idGenerationService.getGenerationHistory(entityType, limit);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error getting ID generation history', { entityType: req.params.entityType, error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get generation history'
    });
  }
});

/**
 * POST /api/ids/check-availability
 * Check if a specific ID is already in use
 */
router.post('/check-availability', async (req, res) => {
  try {
    const { entityType, id } = req.body;
    const validTypes = ['collaborator', 'project', 'specimen', 'inventory', 'patient'];
    
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        error: 'ID must be a positive integer'
      });
    }
    
    const inUse = await idGenerationService.isIdInUse(entityType, id);
    
    res.json({
      success: true,
      data: {
        id: id,
        available: !inUse
      }
    });
  } catch (error) {
    logger.error('Error checking ID availability', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check ID availability'
    });
  }
});

module.exports = router;