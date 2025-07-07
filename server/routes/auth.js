const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const { clearUserCache } = require('../config/redis');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, name, password, pin } = req.body;

    // Validation
    if (!email || !name || !password || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, password, and PIN are required'
      });
    }

    // PIN validation
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with initial balances (new schema)
    const result = await transaction(async (connection) => {
      // Insert user with zero balances
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, name, password_hash, user_pin, is_admin, available_inr, available_btc) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [email.toLowerCase(), name, hashedPassword, pin, false, 0, 0]
      );

      const userId = userResult.insertId;

      // Create SETUP operation
      await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, executed_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [userId, 'DEPOSIT_INR', 'EXECUTED', 0, 0]
      );

      return { userId };
    });

    // Generate JWT token
    const token = generateToken(result.userId);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: result.userId,
          email: email.toLowerCase(),
          name,
          is_admin: false
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get user from database
    const users = await query(
      'SELECT id, email, name, password_hash, is_admin FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          is_admin: req.user.is_admin,
          created_at: req.user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout (client-side token removal, server-side cache clearing)
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Clear user cache
    await clearUserCache(req.user.id);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
});

module.exports = router;
