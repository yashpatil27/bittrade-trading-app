const cron = require('node-cron');
const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');
const { limitOrderLogger } = require('../utils/logger');
const socketServer = require('../websocket/socketServer');

class LimitOrderExecutionService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.executionInProgress = false;
  }

  // Execute pending limit orders based on current market price
  async executePendingOrders() {
    if (this.executionInProgress) {
      limitOrderLogger.warn('Order execution already in progress, skipping...');
      return;
    }

    this.executionInProgress = true;
    
    try {
      // Get current market rates
      const rates = await bitcoinDataService.getCalculatedRates();
      const currentBuyPrice = rates.buyRate;   // Current buy rate (what users pay)
      const currentSellPrice = rates.sellRate; // Current sell rate (what users receive)
      
      limitOrderLogger.info(`Checking pending orders - Current Buy: ₹${currentBuyPrice.toLocaleString()}, Sell: ₹${currentSellPrice.toLocaleString()}`);
      
      // Get all pending orders
      const pendingOrders = await query(`
        SELECT o.*, u.email, u.name 
        FROM operations o 
        JOIN users u ON o.user_id = u.id 
        WHERE o.status = 'PENDING' 
        AND o.type IN ('LIMIT_BUY', 'LIMIT_SELL')
        ORDER BY o.created_at ASC
      `);

      if (pendingOrders.length === 0) {
        limitOrderLogger.debug('No pending limit orders to process');
        return;
      }

      limitOrderLogger.info(`Found ${pendingOrders.length} pending limit orders`);

      // Process each pending order
      const executedOrders = [];
      const expiredOrders = [];

      for (const order of pendingOrders) {
        try {
          const result = await this.processOrder(order, currentBuyPrice, currentSellPrice);
          if (result.executed) {
            executedOrders.push({ ...order, executionPrice: result.executionPrice });
          } else if (result.expired) {
            expiredOrders.push(order);
          }
        } catch (error) {
          limitOrderLogger.error(`Error processing order ${order.id}`, error);
          // Continue processing other orders even if one fails
        }
      }

      // Log execution summary
      if (executedOrders.length > 0) {
        limitOrderLogger.success(`Executed ${executedOrders.length} limit orders`);
        executedOrders.forEach(order => {
          const btcAmount = (order.btc_amount / 100000000).toFixed(8);
          limitOrderLogger.info(`  - ${order.type} Order ${order.id}: ${btcAmount} BTC at ₹${order.executionPrice.toLocaleString()} for user ${order.email}`);
        });
      }

      if (expiredOrders.length > 0) {
        limitOrderLogger.warn(`Cancelled ${expiredOrders.length} expired orders`);
      }

      return {
        processed: pendingOrders.length,
        executed: executedOrders.length,
        expired: expiredOrders.length
      };

    } catch (error) {
      limitOrderLogger.error('Error in limit order execution', error);
      throw error;
    } finally {
      this.executionInProgress = false;
    }
  }

  // Process individual order
  async processOrder(order, currentBuyPrice, currentSellPrice) {
    // Check if order has expired using expires_at field
    const now = new Date();
    const expiresAt = order.expires_at ? new Date(order.expires_at) : null;
    
    if (expiresAt && now > expiresAt) {
      await this.cancelExpiredOrder(order);
      return { executed: false, expired: true };
    }

    if (order.type === 'LIMIT_BUY') {
      // For limit buy orders: execute when current buy price <= target price
      if (currentBuyPrice <= order.limit_price) {
        const executionPrice = Math.min(currentBuyPrice, order.limit_price);
        await this.executeLimitBuyOrder(order, executionPrice);
        return { executed: true, executionPrice };
      }
    } else if (order.type === 'LIMIT_SELL') {
      // For limit sell orders: execute when current sell price >= target price
      if (currentSellPrice >= order.limit_price) {
        const executionPrice = Math.max(currentSellPrice, order.limit_price);
        await this.executeLimitSellOrder(order, executionPrice);
        return { executed: true, executionPrice };
      }
    }

    return { executed: false, expired: false };
  }

  // Execute a limit buy order
  async executeLimitBuyOrder(order, executionPrice) {
    return await transaction(async (connection) => {
      // Get current user balances
      const [userRows] = await connection.execute(
        'SELECT available_inr, available_btc, reserved_inr FROM users WHERE id = ?',
        [order.user_id]
      );

      if (userRows.length === 0) {
        throw new Error(`User ${order.user_id} not found`);
      }

      const user = userRows[0];

      // Calculate actual amounts based on execution price
      const actualInrAmount = order.inr_amount;
      const actualBtcAmount = Math.floor((actualInrAmount / executionPrice) * 100000000); // Convert to satoshis

      if (actualBtcAmount <= 0) {
        throw new Error('Calculated BTC amount too small');
      }

      // Check if user still has reserved INR
      if (user.reserved_inr < actualInrAmount) {
        throw new Error('Insufficient reserved INR balance');
      }

      // Update user balances: move INR from reserved to spend, add BTC
      const newReservedInr = user.reserved_inr - actualInrAmount;
      const newBtcBalance = user.available_btc + actualBtcAmount;

      await connection.execute(
        'UPDATE users SET reserved_inr = ?, available_btc = ? WHERE id = ?',
        [newReservedInr, newBtcBalance, order.user_id]
      );

      // Update operation status
      await connection.execute(
        'UPDATE operations SET status = ?, execution_price = ?, btc_amount = ?, executed_at = NOW() WHERE id = ?',
        ['EXECUTED', executionPrice, actualBtcAmount, order.id]
      );

      // Clear user cache
      await clearUserCache(order.user_id);

      // Broadcast limit order update to user
      try {
        socketServer.broadcastToUser(order.user_id, 'limit_order_update', {
          type: 'ORDER_EXECUTED',
          order: {
            id: order.id,
            type: 'LIMIT_BUY',
            status: 'EXECUTED',
            inr_amount: actualInrAmount,
            btc_amount: actualBtcAmount,
            execution_price: executionPrice,
            executed_at: new Date().toISOString()
          }
        });

        // Also broadcast transaction notification for recent activity
        socketServer.broadcastToUser(order.user_id, 'transaction_notification', {
          type: 'LIMIT_BUY',
          amount: actualBtcAmount / 100000000,
          price: executionPrice,
          status: 'EXECUTED',
          timestamp: new Date().toISOString()
        });
      } catch (broadcastError) {
        console.error('Error broadcasting limit order update:', broadcastError);
      }

      limitOrderLogger.success(`Limit buy order ${order.id} executed: ${(actualBtcAmount/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
    });
  }

  // Execute a limit sell order
  async executeLimitSellOrder(order, executionPrice) {
    return await transaction(async (connection) => {
      // Get current user balances
      const [userRows] = await connection.execute(
        'SELECT available_inr, available_btc, reserved_btc FROM users WHERE id = ?',
        [order.user_id]
      );

      if (userRows.length === 0) {
        throw new Error(`User ${order.user_id} not found`);
      }

      const user = userRows[0];

      // Calculate actual amounts based on execution price
      const actualBtcAmount = order.btc_amount;
      const actualInrAmount = Math.floor((actualBtcAmount / 100000000) * executionPrice);

      if (actualInrAmount <= 0) {
        throw new Error('Calculated INR amount too small');
      }

      // Check if user still has reserved BTC
      if (user.reserved_btc < actualBtcAmount) {
        throw new Error('Insufficient reserved BTC balance');
      }

      // Update user balances: move BTC from reserved to spend, add INR
      const newReservedBtc = user.reserved_btc - actualBtcAmount;
      const newInrBalance = user.available_inr + actualInrAmount;

      await connection.execute(
        'UPDATE users SET reserved_btc = ?, available_inr = ? WHERE id = ?',
        [newReservedBtc, newInrBalance, order.user_id]
      );

      // Update operation status
      await connection.execute(
        'UPDATE operations SET status = ?, execution_price = ?, inr_amount = ?, executed_at = NOW() WHERE id = ?',
        ['EXECUTED', executionPrice, actualInrAmount, order.id]
      );

      // Clear user cache
      await clearUserCache(order.user_id);

      // Broadcast limit order update to user
      try {
        socketServer.broadcastToUser(order.user_id, 'limit_order_update', {
          type: 'ORDER_EXECUTED',
          order: {
            id: order.id,
            type: 'LIMIT_SELL',
            status: 'EXECUTED',
            inr_amount: actualInrAmount,
            btc_amount: actualBtcAmount,
            execution_price: executionPrice,
            executed_at: new Date().toISOString()
          }
        });

        // Also broadcast transaction notification for recent activity
        socketServer.broadcastToUser(order.user_id, 'transaction_notification', {
          type: 'LIMIT_SELL',
          amount: actualBtcAmount / 100000000,
          price: executionPrice,
          status: 'EXECUTED',
          timestamp: new Date().toISOString()
        });
      } catch (broadcastError) {
        console.error('Error broadcasting limit order update:', broadcastError);
      }

      limitOrderLogger.success(`Limit sell order ${order.id} executed: ${(actualBtcAmount/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
    });
  }

  // Cancel expired order and release reserved funds
  async cancelExpiredOrder(order) {
    return await transaction(async (connection) => {
      if (order.type === 'LIMIT_BUY') {
        // Release reserved INR back to available
        await connection.execute(
          'UPDATE users SET available_inr = available_inr + ?, reserved_inr = reserved_inr - ? WHERE id = ?',
          [order.inr_amount, order.inr_amount, order.user_id]
        );
      } else if (order.type === 'LIMIT_SELL') {
        // Release reserved BTC back to available
        await connection.execute(
          'UPDATE users SET available_btc = available_btc + ?, reserved_btc = reserved_btc - ? WHERE id = ?',
          [order.btc_amount, order.btc_amount, order.user_id]
        );
      }

      // Update operation status
      await connection.execute(
        'UPDATE operations SET status = ?, cancelled_at = NOW(), cancellation_reason = ? WHERE id = ?',
        ['EXPIRED', 'Order expired after 24 hours', order.id]
      );

      // Clear user cache
      await clearUserCache(order.user_id);

      // Broadcast limit order update to user
      try {
        socketServer.broadcastToUser(order.user_id, 'limit_order_update', {
          type: 'ORDER_EXPIRED',
          order: {
            id: order.id,
            type: order.type,
            status: 'EXPIRED',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Order expired after 24 hours'
          }
        });
      } catch (broadcastError) {
        console.error('Error broadcasting limit order update:', broadcastError);
      }

      limitOrderLogger.warn(`Expired order ${order.id} cancelled and funds released`);
    });
  }

  // Get pending orders summary
  async getPendingOrdersSummary() {
    try {
      const pendingOrders = await query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN type = 'LIMIT_BUY' THEN 1 ELSE 0 END) as buy_orders,
          SUM(CASE WHEN type = 'LIMIT_SELL' THEN 1 ELSE 0 END) as sell_orders,
          SUM(CASE WHEN type = 'LIMIT_BUY' THEN inr_amount ELSE 0 END) as total_buy_inr,
          SUM(CASE WHEN type = 'LIMIT_SELL' THEN btc_amount ELSE 0 END) as total_sell_btc
        FROM operations 
        WHERE status = 'PENDING' 
        AND type IN ('LIMIT_BUY', 'LIMIT_SELL')
      `);

      return pendingOrders[0] || {
        total_orders: 0,
        buy_orders: 0,
        sell_orders: 0,
        total_buy_inr: 0,
        total_sell_btc: 0
      };
    } catch (error) {
      limitOrderLogger.error('Error getting pending orders summary', error);
      throw error;
    }
  }

  // Start the limit order execution service
  startService() {
    if (this.isRunning) {
      limitOrderLogger.warn('Limit order execution service already running');
      return;
    }

    limitOrderLogger.info('Starting limit order execution service...');
    this.isRunning = true;

    // Run immediately on startup
    this.executePendingOrders().catch(error => {
      limitOrderLogger.error('Initial limit order execution failed', error);
    });

    // Schedule to run every 30 seconds
    this.cronJob = cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        try {
          await this.executePendingOrders();
        } catch (error) {
          limitOrderLogger.error('Scheduled limit order execution failed', error);
        }
      }
    });

    limitOrderLogger.serviceStarted('Limit Order Execution Service', {
      interval: 'Every 30 seconds',
      expiration: '24 hours after placement'
    });
  }

  // Stop the service
  stopService() {
    this.isRunning = false;
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    limitOrderLogger.info('Limit order execution service stopped');
  }

  // Manual execution trigger (for testing/admin)
  async executeNow() {
    limitOrderLogger.info('Manual limit order execution triggered...');
    return await this.executePendingOrders();
  }
}

// Export singleton instance
const limitOrderExecutionService = new LimitOrderExecutionService();
module.exports = limitOrderExecutionService;
