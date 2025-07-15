const express = require('express');
const cors = require('cors');
const http = require('http');
const SocketServer = require('./websocket/socketServer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const { systemLogger } = require('./utils/beautifulLogger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

// Import services
const { createPool } = require('./config/database');
const { createRedisClient } = require('./config/redis');
const bitcoinDataService = require('./services/bitcoinDataService');
const limitOrderExecutionService = require('./services/limitOrderExecutionService');
const dcaExecutionService = require('./services/dcaExecutionService');
const loanMonitoringService = require('./services/loanMonitoringService');
const liquidationMonitoringService = require('./services/liquidationMonitoringService');
const JobScheduler = require('./schedulers/jobScheduler');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize services
const initializeServices = async () => {
  try {
    systemLogger.startupBanner();
    systemLogger.info('Initializing services...');
    
    // Initialize database
    createPool();
    systemLogger.serviceStarted('Database pool created');
    
    // Initialize Redis (optional - app will work without it)
    try {
      await createRedisClient();
      systemLogger.serviceStarted('Redis connected');
      
      // Initialize rate limit store after Redis is connected
      await initializeRateLimitStore();
    } catch (error) {
      systemLogger.warn('Redis connection failed - continuing without caching', { error: error.message });
    }
    
    // Start Bitcoin data updates
    bitcoinDataService.startDataUpdates();
    systemLogger.serviceStarted('Bitcoin data service', { updateInterval: '30s' });
    
    // Start limit order execution service
    limitOrderExecutionService.startService();
    systemLogger.serviceStarted('Limit order execution service', { checkInterval: '30s' });

    // Start DCA execution service
    dcaExecutionService.startService();
    systemLogger.serviceStarted('DCA execution service', { mode: 'Dynamic scheduling', maxInterval: '1 hour' });
    
    // Start loan monitoring service
    loanMonitoringService.start();
    systemLogger.serviceStarted('Loan monitoring service');
    
    // Start liquidation monitoring service
    liquidationMonitoringService.start();
    systemLogger.serviceStarted('Liquidation monitoring service', { checkInterval: '30s', ltvThreshold: '90%' });
    
    // Start job scheduler for daily tasks
    JobScheduler.start();
    systemLogger.serviceStarted('Job scheduler', { interestAccrual: 'Daily at 12:01 AM IST' });
    
    // Show service status
    const services = {
      database: 'running',
      bitcoin_data_service: 'running',
      limit_order_execution: 'running',
      dca_execution: 'running',
      loan_monitoring: 'running',
      liquidation_monitoring: 'running',
      job_scheduler: 'running'
    };
    
    systemLogger.serviceStatus(services);
    systemLogger.success('All services initialized successfully');
  } catch (error) {
    systemLogger.error('Failed to initialize services', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Trust proxy configuration for development
if (process.env.NODE_ENV === 'development') {
  app.set('trust proxy', 'loopback');
} else {
  app.set('trust proxy', 1);
}

// Performance Middleware
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fall back to standard filter function
    return compression.filter(req, res);
  }
})); // Enable gzip compression with optimizations

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.coingecko.com", "https://api.alternative.me"]
    }
  }
}));

// CORS with caching headers
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bittrade.co.in', 'https://www.bittrade.co.in']
    : true,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Advanced rate limiting with tiered limits
const RedisStore = require('rate-limit-redis');

// Create Redis store for rate limiting (fallback to memory if Redis unavailable)
let redisStore;

// Initialize Redis store after services are ready
const initializeRateLimitStore = async () => {
  try {
    const { getRedisClient } = require('./config/redis');
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isReady) {
      redisStore = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
      });
      systemLogger.info('Redis store initialized for rate limiting');
    } else {
      systemLogger.warn('Redis not available for rate limiting, using memory store');
      redisStore = undefined;
    }
  } catch (error) {
    systemLogger.warn('Redis unavailable for rate limiting, using memory store', { error: error.message });
    redisStore = undefined;
  }
};

// Initialize with undefined store (will use memory store)
redisStore = undefined;

// General API rate limiter
const generalLimiter = rateLimit({
  store: redisStore,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || req.path.startsWith('/static/');
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  }
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  store: redisStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    return req.body?.email || req.ip; // Rate limit by email or IP
  }
});

// Moderate limiter for trading operations
const tradingLimiter = rateLimit({
  store: redisStore,
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 trading operations per minute
  message: {
    success: false,
    message: 'Too many trading operations, please wait before placing more orders.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Relaxed limiter for public endpoints
const publicLimiter = rateLimit({
  store: redisStore,
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for public data
  message: {
    success: false,
    message: 'Too many requests for public data, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/user/buy', tradingLimiter);
app.use('/api/user/sell', tradingLimiter);
app.use('/api/user/place-limit-order', tradingLimiter);
app.use('/api/user/cancel-limit-order', tradingLimiter);
app.use('/api/public/', publicLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Skip logging for static files and health checks
  if (req.path.includes('.') || req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }
  
  // Override res.json to log response details
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const userId = req.user?.id ? `user:${req.user.id}` : 'anon';
    const status = res.statusCode >= 400 ? '❌' : '✅';
    
    // Import chalk for colors
    const chalk = require('chalk');
    
    // User-friendly action mapping
    const getActionDescription = (method, path) => {
      const route = `${method} ${path}`;
      
      // Authentication actions
      if (path.includes('/auth/login')) return 'User login';
      if (path.includes('/auth/register')) return 'User registration';
      if (path.includes('/auth/logout')) return 'User logout';
      if (path.includes('/auth/refresh')) return 'Token refresh';
      if (path.includes('/auth/verify')) return 'Email verification';
      if (path.includes('/auth/forgot-password')) return 'Password reset request';
      if (path.includes('/auth/reset-password')) return 'Password reset';
      
      // User dashboard and profile
      if (path.includes('/user/dashboard')) return 'Dashboard loaded';
      if (path.includes('/user/profile')) {
        if (method === 'GET') return 'Profile viewed';
        if (method === 'PUT') return 'Profile updated';
      }
      if (path.includes('/user/settings')) {
        if (method === 'GET') return 'Settings viewed';
        if (method === 'PUT') return 'Settings updated';
      }
      
      // Trading actions
      if (path.includes('/user/buy')) return 'Bitcoin purchase';
      if (path.includes('/user/sell')) return 'Bitcoin sale';
      if (path.includes('/user/place-limit-order')) return 'Limit order placed';
      if (path.includes('/user/cancel-limit-order')) return 'Limit order cancelled';
      if (path.includes('/user/orders')) return 'Orders viewed';
      if (path.includes('/user/order-history')) return 'Order history viewed';
      if (path.includes('/user/trade-history')) return 'Trade history viewed';
      
      // Portfolio and balance
      if (path.includes('/user/portfolio')) return 'Portfolio viewed';
      if (path.includes('/user/balance')) return 'Balance checked';
      if (path.includes('/user/transactions')) return 'Transactions viewed';
      
      // DCA (Dollar Cost Averaging)
      if (path.includes('/user/dca')) {
        if (method === 'POST') return 'DCA plan created';
        if (method === 'PUT') return 'DCA plan updated';
        if (method === 'DELETE') return 'DCA plan deleted';
        if (method === 'GET') return 'DCA plans viewed';
      }
      
      // Loans and lending
      if (path.includes('/user/loans')) {
        if (method === 'POST') return 'Loan requested';
        if (method === 'GET') return 'Loans viewed';
      }
      if (path.includes('/user/repay-loan')) return 'Loan repayment';
      if (path.includes('/user/loan-history')) return 'Loan history viewed';
      
      // Public data
      if (path.includes('/public/bitcoin-price')) return 'Bitcoin price fetched';
      if (path.includes('/public/market-data')) return 'Market data fetched';
      if (path.includes('/public/fear-greed-index')) return 'Fear & Greed index fetched';
      
      // Admin actions
      if (path.includes('/admin/users')) return 'User management';
      if (path.includes('/admin/trades')) return 'Trade management';
      if (path.includes('/admin/system')) return 'System management';
      if (path.includes('/admin/reports')) return 'Reports accessed';
      
      // Notifications
      if (path.includes('/user/notifications')) {
        if (method === 'GET') return 'Notifications viewed';
        if (method === 'PUT') return 'Notification updated';
      }
      
      // Default fallback
      return `${method} request`;
    };
    
    const action = getActionDescription(req.method, req.originalUrl);
    
    // User-friendly log format: [SYSTEM] STATUS ACTION (USER) - DURATION
    console.log(`${chalk.blue('[SYSTEM]')} ${status} ${action} (${userId}) - ${duration}ms`);
    
    return originalJson.call(this, data);
  };
  
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  // Optimized static asset serving with CDN-ready configuration
  app.use(express.static(path.join(__dirname, '../client/build'), {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    lastModified: true,
    immutable: true, // Assets are immutable (webpack hashes ensure uniqueness)
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      // HTML files - no caching
      if (ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // JS and CSS files with hash - long-term caching
      else if (ext === '.js' || ext === '.css') {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Images and fonts - medium-term caching
      else if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
      }
      // JSON files - short-term caching
      else if (ext === '.json') {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      }
      
      // Security headers for all assets
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Enable compression for all files
      res.setHeader('Vary', 'Accept-Encoding');
      
      // Add CDN-friendly headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Running',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      bitcoin_data_service: bitcoinDataService.isRunning ? 'running' : 'stopped',
      limit_order_execution: limitOrderExecutionService.isRunning ? 'running' : 'stopped',
      dca_execution: dcaExecutionService.isRunning ? 'running' : 'stopped',
      loan_monitoring: loanMonitoringService.getStatus().isRunning ? 'running' : 'stopped',
      liquidation_monitoring: liquidationMonitoringService.getStatus().isRunning ? 'running' : 'stopped'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  // Generate error ID for tracking
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  // Determine error type and status code
  let statusCode = 500;
  let message = 'Internal server error';
  let errorType = 'INTERNAL_ERROR';
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errorType = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError' || error.message.includes('token')) {
    statusCode = 401;
    message = 'Unauthorized access';
    errorType = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden access';
    errorType = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    errorType = 'NOT_FOUND';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorType = 'SERVICE_UNAVAILABLE';
  } else if (error.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry';
    errorType = 'DUPLICATE_ENTRY';
  } else if (error.message.includes('rate limit')) {
    statusCode = 429;
    message = 'Rate limit exceeded';
    errorType = 'RATE_LIMIT';
  }
  
  // Log error with comprehensive details
  systemLogger.error(`${errorType} - ${errorId}`, {
    errorId,
    errorType,
    statusCode,
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestBody: req.method === 'POST' ? JSON.stringify(req.body) : undefined
  });
  
  // Send error response
  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      message: message,
      errorId: errorId,
      timestamp: new Date().toISOString()
    }
  };
  
  // Include more details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = error.message;
    errorResponse.error.stack = error.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Process monitoring for uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  systemLogger.error(`UNCAUGHT_EXCEPTION - ${errorId}`, {
    errorId,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
  
  // Graceful shutdown after uncaught exception
  systemLogger.warn('Initiating graceful shutdown due to uncaught exception...');
  gracefulShutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  systemLogger.error(`UNHANDLED_REJECTION - ${errorId}`, {
    errorId,
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
  
  // Don't exit for unhandled promise rejections in production
  if (process.env.NODE_ENV !== 'production') {
    systemLogger.warn('Initiating graceful shutdown due to unhandled promise rejection...');
    gracefulShutdown(1);
  }
});

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const totalMemMB = Math.round(memUsage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  // Log memory usage if it exceeds threshold
  if (totalMemMB > 500) { // 500MB threshold
    systemLogger.warn('High memory usage detected', {
      totalMemoryMB: totalMemMB,
      heapUsedMB: heapUsedMB,
      heapTotalMB: heapTotalMB,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }
}, 60000); // Check every minute

// Graceful shutdown function
const gracefulShutdown = (exitCode = 0) => {
  systemLogger.info('Stopping Bitcoin data service...');
  bitcoinDataService.stopDataUpdates();
  
  systemLogger.info('Stopping limit order execution service...');
  limitOrderExecutionService.stopService();
  
  systemLogger.info('Stopping DCA execution service...');
  dcaExecutionService.stopService();
  
  systemLogger.info('Stopping loan monitoring service...');
  loanMonitoringService.stop();
  
  systemLogger.info('Stopping liquidation monitoring service...');
  liquidationMonitoringService.stop();
  
  systemLogger.info('Stopping job scheduler...');
  JobScheduler.stop();
  
  systemLogger.success('All services stopped gracefully');
  process.exit(exitCode);
};

// Graceful shutdown on signals
process.on('SIGINT', () => {
  systemLogger.warn('Received SIGINT. Graceful shutdown...');
  gracefulShutdown(0);
});

process.on('SIGTERM', () => {
  systemLogger.warn('Received SIGTERM. Graceful shutdown...');
  gracefulShutdown(0);
});

// Start server
const startServer = async () => {
  await initializeServices();
  
  // Initialize WebSocket server
  SocketServer.initialize(server);
  systemLogger.serviceStarted('WebSocket server initialized');
  
  server.listen(PORT, HOST, () => {
    systemLogger.table('Server Information', [
      { icon: '🚀', label: 'Server Status', value: 'Running' },
      { icon: '🌐', label: 'Port', value: PORT },
      { icon: '📊', label: 'API Base URL', value: `http://${HOST}:${PORT}/api` },
      { icon: '🏥', label: 'Health Check', value: `http://${HOST}:${PORT}/health` },
      { icon: '🔧', label: 'Environment', value: process.env.NODE_ENV || 'development' }
    ]);
    
    systemLogger.success('BitTrade Server is ready to trade Bitcoin!');
  });
};

startServer().catch(error => {
  systemLogger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});

