const { query } = require('../config/database');
const { getRedisClient } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');
const limitOrderExecutionService = require('./limitOrderExecutionService');
const dcaExecutionService = require('./dcaExecutionService');
const liquidationMonitoringService = require('./liquidationMonitoringService');
const { systemLogger } = require('../utils/beautifulLogger');
const socketServer = require('../websocket/socketServer');

/**
 * System Monitoring Service
 * Monitors system health and broadcasts updates to connected clients
 */
class SystemMonitoringService {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.intervalMs = 60000; // 1 minute
    this.lastHealthData = null;
  }

  /**
   * Start the system monitoring service
   */
  start() {
    if (this.isRunning) {
      systemLogger.warn('System monitoring service is already running');
      return;
    }

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.checkSystemHealth();
    }, this.intervalMs);

    systemLogger.serviceStarted('System monitoring service', { 
      checkInterval: '1 minute',
      healthChecks: 'Database, Redis, Services, Memory, Disk'
    });

    // Initial health check
    this.checkSystemHealth();
  }

  /**
   * Stop the system monitoring service
   */
  stop() {
    if (!this.isRunning) {
      systemLogger.warn('System monitoring service is not running');
      return;
    }

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    systemLogger.info('System monitoring service stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      lastHealthData: this.lastHealthData
    };
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const result = await query('SELECT 1 as test');
      return {
        status: 'healthy',
        response_time: Date.now(),
        connected: true,
        test_result: result[0]?.test === 1
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  async checkRedis() {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return {
          status: 'unavailable',
          message: 'Redis client not initialized'
        };
      }

      const startTime = Date.now();
      await redisClient.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        response_time: responseTime,
        connected: true,
        is_ready: redisClient.isReady
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Check service statuses
   */
  async checkServices() {
    const services = {};

    // Check Bitcoin data service
    try {
      const bitcoinData = await bitcoinDataService.getCurrentData();
      services.bitcoin_data_service = {
        status: 'running',
        last_update: bitcoinData ? new Date(bitcoinData.created_at) : null,
        current_price: bitcoinData?.btc_usd_price || null
      };
    } catch (error) {
      services.bitcoin_data_service = {
        status: 'error',
        error: error.message
      };
    }

    // Check limit order execution service
    try {
      // Check if service is running by trying to get pending orders summary
      const summary = await limitOrderExecutionService.getPendingOrdersSummary();
      services.limit_order_execution = {
        status: 'running',
        execution_in_progress: limitOrderExecutionService.executionInProgress,
        pending_orders: summary.total_orders || 0
      };
    } catch (error) {
      services.limit_order_execution = {
        status: 'error',
        error: error.message
      };
    }

    // Check DCA execution service
    try {
      const dcaStatus = dcaExecutionService.getStatus();
      services.dca_execution = {
        status: dcaStatus.isRunning ? 'running' : 'stopped',
        execution_in_progress: dcaStatus.executionInProgress,
        next_execution: dcaStatus.nextExecutionTime
      };
    } catch (error) {
      services.dca_execution = {
        status: 'error',
        error: error.message
      };
    }

    // Check liquidation monitoring service
    try {
      const liquidationStatus = liquidationMonitoringService.getStatus();
      services.liquidation_monitoring = {
        status: liquidationStatus.isRunning ? 'running' : 'stopped',
        liquidation_in_progress: liquidationStatus.liquidationInProgress
      };
    } catch (error) {
      services.liquidation_monitoring = {
        status: 'error',
        error: error.message
      };
    }

    return services;
  }

  /**
   * Check system resources
   */
  async checkSystemResources() {
    const resources = {};

    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      resources.memory = {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
      };

      // Process uptime
      resources.uptime = {
        process: Math.floor(process.uptime()), // seconds
        system: Math.floor(require('os').uptime()) // seconds
      };

      // CPU usage (approximation)
      const cpuUsage = process.cpuUsage();
      resources.cpu = {
        user: cpuUsage.user,
        system: cpuUsage.system
      };

      // Node.js version
      resources.node_version = process.version;

    } catch (error) {
      resources.error = error.message;
    }

    return resources;
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    try {
      const [
        totalUsers,
        activeUsers,
        totalTransactions,
        totalVolume,
        activeLoans,
        pendingOrders
      ] = await Promise.all([
        query('SELECT COUNT(*) as count FROM users'),
        query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
        query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED"'),
        query('SELECT COALESCE(SUM(inr_amount), 0) as total FROM operations WHERE status = "EXECUTED"'),
        query('SELECT COUNT(*) as count FROM loans WHERE status = "ACTIVE"'),
        query('SELECT COUNT(*) as count FROM operations WHERE status = "PENDING" AND type IN ("LIMIT_BUY", "LIMIT_SELL")')
      ]);

      return {
        total_users: totalUsers[0].count,
        active_users_24h: activeUsers[0].count,
        total_transactions: totalTransactions[0].count,
        total_volume: totalVolume[0].total,
        active_loans: activeLoans[0].count,
        pending_orders: pendingOrders[0].count
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Perform comprehensive system health check
   */
  async checkSystemHealth() {
    try {
      const startTime = Date.now();
      
      const [
        database,
        redis,
        services,
        resources,
        platform
      ] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkServices(),
        this.checkSystemResources(),
        this.getPlatformStats()
      ]);

      const healthData = {
        timestamp: new Date().toISOString(),
        overall_status: this.calculateOverallStatus(database, redis, services),
        check_duration: Date.now() - startTime,
        database,
        redis,
        services,
        resources,
        platform
      };

      // Store the health data
      this.lastHealthData = healthData;

      // Broadcast to admins if there are any significant changes
      this.broadcastHealthUpdate(healthData);

      return healthData;
    } catch (error) {
      systemLogger.error('Error during system health check:', error);
      const errorHealth = {
        timestamp: new Date().toISOString(),
        overall_status: 'error',
        error: error.message
      };
      this.lastHealthData = errorHealth;
      return errorHealth;
    }
  }

  /**
   * Calculate overall system status
   */
  calculateOverallStatus(database, redis, services) {
    // Database is critical
    if (database.status !== 'healthy') {
      return 'critical';
    }

    // Check if any critical services are down
    const criticalServices = ['bitcoin_data_service', 'limit_order_execution'];
    for (const serviceName of criticalServices) {
      if (services[serviceName] && services[serviceName].status === 'error') {
        return 'degraded';
      }
    }

    // Redis is important but not critical
    if (redis.status === 'unhealthy') {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Broadcast health update to admins
   */
  async broadcastHealthUpdate(healthData) {
    try {
      // Only broadcast if there are actual changes or if it's a critical/degraded status
      if (healthData.overall_status !== 'healthy' || this.shouldBroadcastUpdate(healthData)) {
        socketServer.broadcastToAdmins('system_health_update', {
          type: 'HEALTH_CHECK',
          status: healthData.overall_status,
          timestamp: healthData.timestamp,
          check_duration: healthData.check_duration,
          database: healthData.database,
          redis: healthData.redis,
          services: healthData.services,
          resources: healthData.resources,
          platform: healthData.platform
        });

        systemLogger.debug('System health update broadcasted to admins');
      }
    } catch (broadcastError) {
      systemLogger.error('Error broadcasting health update:', broadcastError);
    }
  }

  /**
   * Determine if we should broadcast this update
   */
  shouldBroadcastUpdate(newHealthData) {
    if (!this.lastHealthData) return true;
    
    // Always broadcast if overall status changed
    if (this.lastHealthData.overall_status !== newHealthData.overall_status) {
      return true;
    }

    // Broadcast every 5 minutes for regular updates
    const lastBroadcast = new Date(this.lastHealthData.timestamp);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return lastBroadcast < fiveMinutesAgo;
  }

  /**
   * Get current system health data
   */
  getCurrentHealth() {
    return this.lastHealthData;
  }

  /**
   * Force a health check and return results
   */
  async forceHealthCheck() {
    return await this.checkSystemHealth();
  }
}

// Export singleton instance
const systemMonitoringService = new SystemMonitoringService();
module.exports = systemMonitoringService;
