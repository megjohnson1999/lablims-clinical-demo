const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const db = require('../db');
const logger = require('../utils/logger');

// Password complexity requirements
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};

// Helper function to validate password complexity
function validatePasswordComplexity(password) {
  const errors = [];
  
  if (password.length < passwordRequirements.minLength) {
    errors.push(`Password must be at least ${passwordRequirements.minLength} characters long`);
  }
  
  if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (passwordRequirements.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (passwordRequirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
}

// Helper function to generate secure temporary password
function generateTemporaryPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill remaining characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// @route   GET /api/users
// @desc    Get all users (lab manager and admin only)
// @access  Private
router.get('/', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role, 
        u.active,
        u.force_password_change,
        u.last_login,
        u.created_at,
        u.updated_at,
        creator.username as created_by_username
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching users:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user by ID
// @access  Private
router.get('/:id', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role, 
        u.active,
        u.force_password_change,
        u.last_login,
        u.password_changed_at,
        u.created_at,
        u.updated_at,
        creator.username as created_by_username
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      WHERE u.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user (lab manager and admin only)
// @access  Private
router.post('/', [
  auth, 
  roleCheck(['admin', 'lab_manager']),
  check('username', 'Username is required and must be 3-50 characters').isLength({ min: 3, max: 50 }).trim(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('role', 'Role is required').isIn(['admin', 'lab_manager', 'lab_technician', 'bioinformatician', 'researcher']),
  check('first_name', 'First name must be 1-100 characters').isLength({ min: 1, max: 100 }).trim(),
  check('last_name', 'Last name must be 1-100 characters').isLength({ min: 1, max: 100 }).trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, first_name, last_name, role } = req.body;

  try {
    // Check if user already exists
    const userCheck = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    
    // Hash temporary password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    // Create new user
    const newUser = await db.query(`
      INSERT INTO users (
        username, email, password, first_name, last_name, role, 
        force_password_change, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7) 
      RETURNING id, username, email, first_name, last_name, role, active, force_password_change, created_at
    `, [username, email, hashedPassword, first_name, last_name, role, req.user.id]);

    // Log the user creation
    logger.info('New user created', { 
      newUserId: newUser.rows[0].id,
      username: newUser.rows[0].username,
      role: newUser.rows[0].role,
      createdBy: req.user.username 
    });

    res.status(201).json({
      user: newUser.rows[0],
      temporaryPassword: temporaryPassword,
      message: 'User created successfully. Temporary password must be changed on first login.'
    });
  } catch (err) {
    logger.error('Error creating user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (lab manager and admin only)
// @access  Private
router.put('/:id', [
  auth, 
  roleCheck(['admin', 'lab_manager']),
  check('username', 'Username must be 3-50 characters').optional().isLength({ min: 3, max: 50 }).trim(),
  check('email', 'Please include a valid email').optional().isEmail().normalizeEmail(),
  check('role', 'Invalid role').optional().isIn(['admin', 'lab_manager', 'lab_technician', 'bioinformatician', 'researcher']),
  check('first_name', 'First name must be 1-100 characters').optional().isLength({ min: 1, max: 100 }).trim(),
  check('last_name', 'Last name must be 1-100 characters').optional().isLength({ min: 1, max: 100 }).trim(),
  check('active', 'Active status must be boolean').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, first_name, last_name, role, active } = req.body;

  try {
    // Check if user exists
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if username or email is already taken by another user
    if (username || email) {
      const duplicateCheck = await db.query(
        'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [username || '', email || '', req.params.id]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ msg: 'Username or email already exists' });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;

    if (username) {
      updateFields.push(`username = $${valueIndex++}`);
      updateValues.push(username);
    }
    if (email) {
      updateFields.push(`email = $${valueIndex++}`);
      updateValues.push(email);
    }
    if (first_name) {
      updateFields.push(`first_name = $${valueIndex++}`);
      updateValues.push(first_name);
    }
    if (last_name) {
      updateFields.push(`last_name = $${valueIndex++}`);
      updateValues.push(last_name);
    }
    if (role) {
      updateFields.push(`role = $${valueIndex++}`);
      updateValues.push(role);
    }
    if (typeof active === 'boolean') {
      updateFields.push(`active = $${valueIndex++}`);
      updateValues.push(active);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(req.params.id);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING id, username, email, first_name, last_name, role, active, updated_at
    `;

    const result = await db.query(updateQuery, updateValues);

    logger.info('User updated', { 
      userId: req.params.id,
      updatedBy: req.user.username,
      changes: req.body 
    });

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/users/:id/reset-password
// @desc    Reset user password (lab manager and admin only)
// @access  Private
router.post('/:id/reset-password', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  try {
    // Check if user exists
    const userCheck = await db.query('SELECT username FROM users WHERE id = $1', [req.params.id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Generate new temporary password
    const temporaryPassword = generateTemporaryPassword();
    
    // Hash temporary password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    // Update user with new password and force change
    await db.query(`
      UPDATE users 
      SET password = $1, 
          force_password_change = TRUE, 
          password_changed_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, req.params.id]);

    logger.info('Password reset for user', { 
      userId: req.params.id,
      username: userCheck.rows[0].username,
      resetBy: req.user.username 
    });

    res.json({
      temporaryPassword: temporaryPassword,
      message: 'Password reset successfully. User must change password on next login.'
    });
  } catch (err) {
    logger.error('Error resetting password:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Deactivate user (admin only - we don't actually delete users)
// @access  Private
router.delete('/:id', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Check if user exists and is not the requesting user
    const userCheck = await db.query('SELECT username, active FROM users WHERE id = $1', [req.params.id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: 'Cannot deactivate your own account' });
    }

    // Deactivate user instead of deleting
    await db.query(`
      UPDATE users 
      SET active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.params.id]);

    logger.info('User deactivated', { 
      userId: req.params.id,
      username: userCheck.rows[0].username,
      deactivatedBy: req.user.username 
    });

    res.json({ msg: 'User deactivated successfully' });
  } catch (err) {
    logger.error('Error deactivating user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/users/roles/available
// @desc    Get available user roles
// @access  Private
router.get('/roles/available', [auth, roleCheck(['admin', 'lab_manager'])], async (req, res) => {
  const roles = [
    { value: 'admin', label: 'System Administrator', description: 'Full system access and user management' },
    { value: 'lab_manager', label: 'Lab Manager', description: 'Full lab access and user management' },
    { value: 'lab_technician', label: 'Lab Technician', description: 'Full CRUD on specimens, protocols, experiments, inventory' },
    { value: 'bioinformatician', label: 'Bioinformatician', description: 'Full access to sequencing data and experiments' },
    { value: 'researcher', label: 'Researcher', description: 'Read-only access to assigned projects' }
  ];
  
  res.json(roles);
});

module.exports = router;