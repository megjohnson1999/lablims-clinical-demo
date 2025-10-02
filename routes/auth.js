const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const db = require('../db');
const logger = require('../utils/logger');
require('dotenv').config();

// Security configuration
const LOCKOUT_DURATION_MINUTES = 15; // Account lockout duration
const MAX_FAILED_ATTEMPTS = 5; // Maximum failed login attempts before lockout

// Helper function to validate password complexity
function validatePasswordComplexity(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
}

// Helper function to check if account is locked
function isAccountLocked(user) {
  if (!user.locked_until) return false;
  return new Date() < new Date(user.locked_until);
}

// Helper function to lock account
async function lockAccount(userId) {
  const lockUntil = new Date();
  lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
  
  await db.query(`
    UPDATE users 
    SET locked_until = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $2
  `, [lockUntil, userId]);
}

// Helper function to increment failed attempts
async function incrementFailedAttempts(userId) {
  const result = await db.query(`
    UPDATE users 
    SET failed_login_attempts = failed_login_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 
    RETURNING failed_login_attempts
  `, [userId]);
  
  const attempts = result.rows[0].failed_login_attempts;
  
  // Lock account if max attempts reached
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await lockAccount(userId);
  }
  
  return attempts;
}

// Helper function to reset failed attempts
async function resetFailedAttempts(userId) {
  await db.query(`
    UPDATE users 
    SET failed_login_attempts = 0, 
        locked_until = NULL,
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [userId]);
}

// @route   POST api/auth/register
// @desc    Register a user - DISABLED IN PRODUCTION
// @access  Disabled
router.post(
  '/register',
  [
    check('username', 'Username is required').not().isEmpty().isLength({ min: 3, max: 50 }).trim(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password is required').not().isEmpty(),
    check('role', 'Role is required').isIn(['admin', 'lab_manager', 'lab_technician', 'bioinformatician', 'researcher']),
    check('first_name', 'First name must be 1-100 characters').optional().isLength({ min: 1, max: 100 }).trim(),
    check('last_name', 'Last name must be 1-100 characters').optional().isLength({ min: 1, max: 100 }).trim()
  ],
  async (req, res) => {
    // SECURITY: Disable public registration in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        msg: 'Public registration is disabled. Please contact your lab manager for an account.' 
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, first_name, last_name, role } = req.body;

    try {
      // Validate password complexity
      const passwordErrors = validatePasswordComplexity(password);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors.map(msg => ({ msg })) });
      }

      // Check if user already exists
      const userCheck = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (userCheck.rows.length > 0) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = await db.query(`
        INSERT INTO users (username, email, password, first_name, last_name, role) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, username, email, role, active, force_password_change
      `, [username, email, hashedPassword, first_name, last_name, role]);

      // Create JWT payload
      const payload = {
        user: {
          id: newUser.rows[0].id,
          username: newUser.rows[0].username,
          role: newUser.rows[0].role
        }
      };

      // Sign token
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token,
            user: {
              id: newUser.rows[0].id,
              username: newUser.rows[0].username,
              role: newUser.rows[0].role,
              force_password_change: newUser.rows[0].force_password_change
            }
          });
        }
      );
    } catch (err) {
      logger.error('Registration error:', err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('username', 'Username is required').not().isEmpty().trim().isLength({ min: 1, max: 50 }),
    check('password', 'Password is required').not().isEmpty().isLength({ min: 1, max: 50 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // Check if user exists and get security fields
      const userRes = await db.query(`
        SELECT id, username, password, role, active, force_password_change, 
               failed_login_attempts, locked_until, first_name, last_name, email
        FROM users 
        WHERE username = $1
      `, [username]);

      if (userRes.rows.length === 0) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      const user = userRes.rows[0];

      // Check if account is active
      if (!user.active) {
        logger.warn('Login attempt on deactivated account', { username });
        return res.status(400).json({ msg: 'Account is deactivated. Please contact your lab manager.' });
      }

      // Check if account is locked
      if (isAccountLocked(user)) {
        const lockUntil = new Date(user.locked_until);
        const remainingMinutes = Math.ceil((lockUntil - new Date()) / 60000);
        logger.warn('Login attempt on locked account', { username, remainingMinutes });
        return res.status(400).json({ 
          msg: `Account is locked due to multiple failed login attempts. Try again in ${remainingMinutes} minutes.` 
        });
      }

      // Compare password using bcrypt
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        // Increment failed attempts
        const attempts = await incrementFailedAttempts(user.id);
        const remainingAttempts = MAX_FAILED_ATTEMPTS - attempts;
        
        logger.warn('Failed login attempt', { 
          username, 
          attempts, 
          remainingAttempts: Math.max(0, remainingAttempts)
        });

        if (remainingAttempts <= 0) {
          return res.status(400).json({ 
            msg: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.` 
          });
        } else {
          return res.status(400).json({ 
            msg: `Invalid credentials. ${remainingAttempts} attempts remaining before account lockout.` 
          });
        }
      }

      // Successful login - reset failed attempts
      await resetFailedAttempts(user.id);

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };

      // Sign token
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err;
          
          logger.info('Successful login', { username: user.username, role: user.role });
          
          res.json({ 
            token,
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              force_password_change: user.force_password_change
            }
          });
        }
      );
    } catch (err) {
      logger.error('Login error:', err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET api/auth/user
// @desc    Get authenticated user
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const userRes = await db.query(`
      SELECT id, username, email, first_name, last_name, role, 
             force_password_change, last_login, password_changed_at
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    res.json(userRes.rows[0]);
  } catch (err) {
    logger.error('Get user error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/change-password
// @desc    Change user password
// @access  Private
router.post(
  '/change-password',
  [
    auth,
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      // Validate new password complexity
      const passwordErrors = validatePasswordComplexity(newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors.map(msg => ({ msg })) });
      }

      // Get current user data
      const userRes = await db.query(
        'SELECT password FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Current password is incorrect' });
      }

      // Check if new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, userRes.rows[0].password);
      if (isSamePassword) {
        return res.status(400).json({ msg: 'New password must be different from current password' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password and clear force_password_change flag
      await db.query(`
        UPDATE users 
        SET password = $1, 
            force_password_change = FALSE,
            password_changed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [hashedPassword, req.user.id]);

      logger.info('Password changed', { userId: req.user.id, username: req.user.username });

      res.json({ msg: 'Password changed successfully' });
    } catch (err) {
      logger.error('Change password error:', err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
