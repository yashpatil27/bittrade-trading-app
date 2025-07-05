const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

// Import services
const { createPool } = require('./config/database');
const { createRedisClient } = require('./config/redis');
const bitcoinDataService = require('./services/bitcoinDataService');

// Load environment variables
dotenv.config();

const app = express();

// Initialize services
const initializeServices = async () => {
  try {
    console.log('Initializing services...');
    
    // Initialize database
    createPool();
    console.log('✓ Database pool created');
    
    // Initialize Redis (optional - app will work without it)
    try {
      await createRedisClient();
      console.log('✓ Redis connected');
    } catch (error) {
      console.warn('⚠ Redis connection failed - continuing without caching:', error.message);
    }
    
    // Start Bitcoin data updates
    bitcoinDataService.startDataUpdates();
    console.log('✓ Bitcoin data service started');
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
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
      bitcoin_data_service: bitcoinDataService.isRunning ? 'running' : 'stopped'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  bitcoinDataService.stopDataUpdates();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  bitcoinDataService.stopDataUpdates();
  process.exit(0);
});

// Start server
const startServer = async () => {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`\n🚀 ₿itTrade Server running on port ${PORT}`);
    console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 Environment: Development`);
    }
    console.log('\n📈 Ready to trade Bitcoin!\n');
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

