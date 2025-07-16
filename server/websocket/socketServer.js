const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

class SocketServer {
  constructor() {
    this.io = null;
    this.connections = new Map(); // userId -> socket
    this.adminConnections = new Set(); // admin sockets
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://bittrade.co.in', 'https://www.bittrade.co.in']
          : true,
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();
    
    console.log('WebSocket server initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        console.log('WebSocket auth middleware - token:', token ? 'present' : 'missing');
        
        if (!token) {
          // Allow connections without token for authentication purposes
          socket.isAuthenticated = false;
          return next();
        }

        console.log('Attempting to verify token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', decoded);
        
        // Get user from database
        const users = await query(
          'SELECT id, email, name, is_admin FROM users WHERE id = ?',
          [decoded.userId]
        );

        console.log('User lookup result:', users.length > 0 ? 'found' : 'not found');
        
        if (users.length === 0) {
          console.log('User not found in database');
          socket.isAuthenticated = false;
          return next();
        }

        socket.userId = users[0].id;
        socket.user = users[0];
        socket.isAuthenticated = true;
        console.log('Authentication successful for user:', users[0].email);
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error.message);
        socket.isAuthenticated = false;
        next();
      }
    });
  }

  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      if (socket.isAuthenticated) {
        console.log(`User ${socket.user.email} connected (ID: ${socket.userId})`);
        
        // Store connection
        this.connections.set(socket.userId, socket);
        
        // Add to admin connections if admin
        if (socket.user.is_admin) {
          this.adminConnections.add(socket);
        }

        // Join user-specific room
        socket.join(`user:${socket.userId}`);
        
        // Join admin room if admin
        if (socket.user.is_admin) {
          socket.join('admin');
        }
      } else {
        console.log('Unauthenticated connection established for auth purposes');
      }

      // Setup event handlers
      this.setupEventHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.isAuthenticated) {
          console.log(`User ${socket.user.email} disconnected`);
          this.connections.delete(socket.userId);
          
          if (socket.user.is_admin) {
            this.adminConnections.delete(socket);
          }
        } else {
          console.log('Unauthenticated connection disconnected');
        }
      });
    });
  }

  setupEventHandlers(socket) {
    // Import and setup handlers
    const authHandlers = require('./handlers/authHandlers');
    const userHandlers = require('./handlers/userHandlers');
    const adminHandlers = require('./handlers/adminHandlers');
    const publicHandlers = require('./handlers/publicHandlers');

    // Register handlers
    authHandlers.register(socket, this);
    userHandlers.register(socket, this);
    adminHandlers.register(socket, this);
    publicHandlers.register(socket, this);

    // Generic request handler
    socket.on('request', async (data) => {
      try {
        const { id, action, payload } = data;
        
        // Route to appropriate handler based on action
        const [module, method] = action.split('.');
        
        let response;
        switch (module) {
          case 'auth':
            response = await authHandlers.handle(method, payload, socket, this);
            break;
          case 'user':
            response = await userHandlers.handle(method, payload, socket, this);
            break;
          case 'admin':
            response = await adminHandlers.handle(method, payload, socket, this);
            break;
          case 'public':
            response = await publicHandlers.handle(method, payload, socket, this);
            break;
          default:
            throw new Error(`Unknown module: ${module}`);
        }

        // Send response
        socket.emit('response', {
          id,
          success: true,
          data: response
        });

      } catch (error) {
        console.error('WebSocket request error:', error);
        socket.emit('response', {
          id: data.id,
          success: false,
          error: error.message
        });
      }
    });
  }

  // Utility methods for broadcasting
  broadcastToUser(userId, event, data) {
    const socket = this.connections.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  broadcastToAdmins(event, data) {
    this.adminConnections.forEach(socket => {
      socket.emit(event, data);
    });
  }

  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Broadcast to specific room
  broadcastToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  // Get connection count
  getConnectionCount() {
    return this.connections.size;
  }

  // Get admin connection count
  getAdminConnectionCount() {
    return this.adminConnections.size;
  }
}

module.exports = new SocketServer();
