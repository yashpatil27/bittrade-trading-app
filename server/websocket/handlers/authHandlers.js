const bcrypt = require('bcryptjs');
const { query, transaction } = require('../../config/database');
const { generateToken } = require('../../middleware/auth');
const { clearUserCache } = require('../../config/redis');
const socketServer = require('../socketServer');

const authHandlers = {
  register(socket, socketServer) {
    // Auth handlers are mostly handled during connection
    // But we can add specific auth-related events here
  },

  async handle(method, payload, socket, socketServer) {
    switch (method) {
      case 'register':
        return await this.handleRegister(payload, socket, socketServer);
      case 'login':
        return await this.handleLogin(payload, socket, socketServer);
      case 'profile':
        return await this.handleProfile(payload, socket, socketServer);
      case 'logout':
        return await this.handleLogout(payload, socket, socketServer);
      default:
        throw new Error(`Unknown auth method: ${method}`);
    }
  },

  async handleRegister(payload, socket, socketServer) {
    const { email, name, password, pin } = payload;

    // Validation
    if (!email || !name || !password || !pin) {
      throw new Error('Email, name, password, and PIN are required');
    }

    // PIN validation
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please provide a valid email address');
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with initial balances
    const result = await transaction(async (connection) => {
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, name, password_hash, user_pin, is_admin, available_inr, available_btc) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [email.toLowerCase(), name, hashedPassword, pin, false, 0, 0]
      );

      const userId = userResult.insertId;
      return { userId };
    });

    // Generate JWT token
    const token = generateToken(result.userId);

    // Broadcast user activity update to admins
    try {
      socketServer.broadcastToAdmins('user_activity_update', {
        type: 'USER_REGISTERED',
        user: {
          id: result.userId,
          email: email.toLowerCase(),
          name,
          is_admin: false
        },
        timestamp: new Date().toISOString()
      });
    } catch (broadcastError) {
      console.error('Error broadcasting user activity update:', broadcastError);
    }

    return {
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
    };
  },

  async handleLogin(payload, socket, socketServer) {
    const { email, password } = payload;

    // Validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Get user from database
    const users = await query(
      'SELECT id, email, name, password_hash, is_admin FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Broadcast user activity update to admins
    try {
      socketServer.broadcastToAdmins('user_activity_update', {
        type: 'USER_LOGIN',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin
        },
        timestamp: new Date().toISOString()
      });
    } catch (broadcastError) {
      console.error('Error broadcasting user activity update:', broadcastError);
    }

    return {
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
    };
  },

  async handleProfile(payload, socket, socketServer) {
    return {
      user: {
        id: socket.user.id,
        email: socket.user.email,
        name: socket.user.name,
        is_admin: socket.user.is_admin
      }
    };
  },

  async handleLogout(payload, socket, socketServer) {
    // Clear user cache
    await clearUserCache(socket.userId);
    
    // Broadcast user activity update to admins
    try {
      socketServer.broadcastToAdmins('user_activity_update', {
        type: 'USER_LOGOUT',
        user: {
          id: socket.user.id,
          email: socket.user.email,
          name: socket.user.name,
          is_admin: socket.user.is_admin
        },
        timestamp: new Date().toISOString()
      });
    } catch (broadcastError) {
      console.error('Error broadcasting user activity update:', broadcastError);
    }
    
    // Disconnect the socket
    socket.disconnect();

    return {
      message: 'Logged out successfully'
    };
  }
};

module.exports = authHandlers;
