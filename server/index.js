const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
    systemLogger.serviceStarted('DCA execution service', { checkInterval: '60s' });
    
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

const PORT = process.env.PORT || 3001;

// Graceful shutdown
process.on('SIGINT', () => {
  systemLogger.warn('Received SIGINT. Graceful shutdown...');
  
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
  
  systemLogger.success('All services stopped gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  systemLogger.warn('Received SIGTERM. Graceful shutdown...');
  
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
  
  systemLogger.success('All services stopped gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  await initializeServices();
  
  app.listen(PORT, () => {
    systemLogger.table('Server Information', [
      { icon: '🚀', label: 'Server Status', value: 'Running' },
      { icon: '🌐', label: 'Port', value: PORT },
      { icon: '📊', label: 'API Base URL', value: `http://localhost:${PORT}/api` },
      { icon: '🏥', label: 'Health Check', value: `http://localhost:${PORT}/health` },
      { icon: '🔧', label: 'Environment', value: process.env.NODE_ENV || 'development' }
    ]);
    
    systemLogger.success('BitTrade Server is ready to trade Bitcoin!');
  });
};

startServer().catch(error => {
  systemLogger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});

