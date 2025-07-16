const { query, transaction } = require('../../config/database');
const { clearUserCache, clearAllCache } = require('../../config/redis');
const userService = require('../../services/userService');
const bitcoinDataService = require('../../services/bitcoinDataService');
const settingsService = require('../../services/settingsService');
const bcrypt = require('bcryptjs');

const adminHandlers = {
  register(socket, socketServer) {
    // Setup any specific admin event listeners here
    // Start periodic admin stats broadcasting
    this.startAdminStatsBroadcasting(socketServer);
  },

  // Broadcast admin stats periodically
  startAdminStatsBroadcasting(socketServer) {
    // Only start if not already running
    if (this.adminStatsBroadcastInterval) {
      return;
    }

    // Broadcast admin stats every 30 seconds
    this.adminStatsBroadcastInterval = setInterval(async () => {
      try {
        const stats = await this.getAdminStats();
        socketServer.broadcastToAdmins('admin_stats_update', {
          type: 'STATS_UPDATE',
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error broadcasting admin stats:', error);
      }
    }, 30000); // 30 seconds
  },

  // Stop admin stats broadcasting
  stopAdminStatsBroadcasting() {
    if (this.adminStatsBroadcastInterval) {
      clearInterval(this.adminStatsBroadcastInterval);
      this.adminStatsBroadcastInterval = null;
    }
  },

  // Get comprehensive admin stats
  async getAdminStats() {
    const [
      totalUsers,
      totalTransactions,
      totalVolume,
      totalBtcVolume,
      pendingOrders,
      activeLoans,
      activeDcaPlans,
      last24hTransactions,
      last24hVolume,
      last24hUsers
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED"'),
      query('SELECT COALESCE(SUM(inr_amount), 0) as total FROM operations WHERE status = "EXECUTED"'),
      query('SELECT COALESCE(SUM(btc_amount), 0) as total FROM operations WHERE status = "EXECUTED"'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "PENDING" AND type IN ("LIMIT_BUY", "LIMIT_SELL")'),
      query('SELECT COUNT(*) as count FROM loans WHERE status = "ACTIVE"'),
      query('SELECT COUNT(*) as count FROM active_plans WHERE status = "ACTIVE"'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
      query('SELECT COALESCE(SUM(inr_amount), 0) as total FROM operations WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
      query('SELECT COUNT(DISTINCT user_id) as count FROM operations WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)')
    ]);

    return {
      total_users: totalUsers[0].count,
      total_transactions: totalTransactions[0].count,
      total_volume_inr: totalVolume[0].total,
      total_volume_btc: totalBtcVolume[0].total / 100000000,
      pending_orders: pendingOrders[0].count,
      active_loans: activeLoans[0].count,
      active_dca_plans: activeDcaPlans[0].count,
      last_24h_transactions: last24hTransactions[0].count,
      last_24h_volume: last24hVolume[0].total,
      last_24h_active_users: last24hUsers[0].count
    };
  },

  // Helper function to check admin authentication
  requireAdminAuth(socket) {
    if (!socket.isAuthenticated) {
      throw new Error('Authentication required');
    }
    if (!socket.user.is_admin) {
      throw new Error('Admin access required');
    }
  },

  async handle(method, payload, socket, socketServer) {
    // Verify admin access for all admin methods
    this.requireAdminAuth(socket);

    switch (method) {
      // Dashboard and overview
      case 'dashboard':
        return await this.handleDashboard(payload, socket, socketServer);
      case 'system-status':
        return await this.handleSystemStatus(payload, socket, socketServer);
      case 'system-health':
        return await this.handleSystemHealth(payload, socket, socketServer);
      case 'get-system-health':
        return await this.handleSystemHealth(payload, socket, socketServer);
      
      // User management
      case 'get-users':
        return await this.handleGetUsers(payload, socket, socketServer);
      case 'create-user':
        return await this.handleCreateUser(payload, socket, socketServer);
      case 'update-user':
        return await this.handleUpdateUser(payload, socket, socketServer);
      case 'delete-user':
        return await this.handleDeleteUser(payload, socket, socketServer);
      case 'change-user-password':
        return await this.handleChangeUserPassword(payload, socket, socketServer);
      case 'deposit-inr':
        return await this.handleDepositINR(payload, socket, socketServer);
      case 'withdraw-inr':
        return await this.handleWithdrawINR(payload, socket, socketServer);
      case 'deposit-btc':
        return await this.handleDepositBTC(payload, socket, socketServer);
      case 'withdraw-btc':
        return await this.handleWithdrawBTC(payload, socket, socketServer);
      case 'external-buy':
        return await this.handleExternalBuy(payload, socket, socketServer);
      
      // Settings management
      case 'get-settings':
        return await this.handleGetSettings(payload, socket, socketServer);
      case 'update-settings':
        return await this.handleUpdateSettings(payload, socket, socketServer);
      
      // Transaction management
      case 'get-transactions':
        return await this.handleGetTransactions(payload, socket, socketServer);
      case 'get-all-transactions':
        return await this.handleGetAllTransactions(payload, socket, socketServer);
      
      // Limit order management
      case 'get-limit-orders-summary':
        return await this.handleGetLimitOrdersSummary(payload, socket, socketServer);
      case 'get-pending-limit-orders':
        return await this.handleGetPendingLimitOrders(payload, socket, socketServer);
      case 'execute-limit-orders':
        return await this.handleExecuteLimitOrders(payload, socket, socketServer);
      case 'cancel-limit-order':
        return await this.handleCancelLimitOrder(payload, socket, socketServer);
      case 'control-limit-order-service':
        return await this.handleControlLimitOrderService(payload, socket, socketServer);
      
      // DCA management
      case 'get-dca-plans':
        return await this.handleGetDcaPlans(payload, socket, socketServer);
      case 'pause-dca-plan':
        return await this.handlePauseDcaPlan(payload, socket, socketServer);
      case 'resume-dca-plan':
        return await this.handleResumeDcaPlan(payload, socket, socketServer);
      case 'delete-dca-plan':
        return await this.handleDeleteDcaPlan(payload, socket, socketServer);
      
      // Liquidation management
      case 'trigger-manual-liquidation':
        return await this.handleTriggerManualLiquidation(payload, socket, socketServer);
      case 'get-liquidation-risks':
        return await this.handleGetLiquidationRisks(payload, socket, socketServer);
      
      // Job management
      case 'trigger-interest-accrual':
        return await this.handleTriggerInterestAccrual(payload, socket, socketServer);
      
      default:
        throw new Error(`Unknown admin method: ${method}`);
    }
  },

  // Dashboard and overview handlers
  async handleDashboard(payload, socket, socketServer) {
    const [
      totalUsers,
      totalTransactions,
      totalInrBalances,
      totalBtcBalances,
      currentPrices
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED"'),
      query('SELECT SUM(available_inr + reserved_inr) as total FROM users'),
      query('SELECT SUM(available_btc + reserved_btc) as total FROM users'),
      bitcoinDataService.getCalculatedRates()
    ]);

    return {
      stats: {
        total_users: totalUsers[0].count,
        total_trades: totalTransactions[0].count,
        total_inr_on_platform: totalInrBalances[0].total || 0,
        total_btc_on_platform: (totalBtcBalances[0].total || 0) / 100000000
      },
      current_prices: {
        btc_usd: currentPrices.btcUsdPrice,
        buy_rate: currentPrices.buyRate,
        sell_rate: currentPrices.sellRate,
        buy_multiplier: currentPrices.buyMultiplier,
        sell_multiplier: currentPrices.sellMultiplier,
        last_update: currentPrices.lastUpdate
      }
    };
  },

  async handleSystemStatus(payload, socket, socketServer) {
    const services = {
      database: 'connected',
      bitcoin_data_service: 'running',
      limit_order_execution: 'running',
      dca_execution: 'running',
      loan_monitoring: 'running',
      liquidation_monitoring: 'running',
      websocket_server: 'running'
    };

    const connectionStats = {
      total_connections: socketServer.getConnectionCount(),
      admin_connections: socketServer.getAdminConnectionCount()
    };

    return {
      services,
      connections: connectionStats,
      timestamp: new Date().toISOString()
    };
  },

  async handleSystemHealth(payload, socket, socketServer) {
    return await this.getSystemHealthData();
  },

  async getSystemHealthData() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };
  },

  // User management handlers
  async handleGetUsers(payload, socket, socketServer) {
    const { page = 1, limit = 20 } = payload || {};
    const pageInt = Math.max(1, parseInt(page) || 1);
    const limitInt = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const offset = (pageInt - 1) * limitInt;


    const [users, totalCount] = await Promise.all([
      query(`
        SELECT id, email, name, is_admin, available_inr, available_btc, 
               reserved_inr, reserved_btc, created_at
        FROM users 
        ORDER BY created_at DESC 
        LIMIT ${limitInt} OFFSET ${offset}
      `),
      query('SELECT COUNT(*) as count FROM users')
    ]);

    return {
      users: users.map(user => ({
        ...user,
        inr_balance: user.available_inr + user.reserved_inr,
        btc_balance: (user.available_btc + user.reserved_btc) / 100000000
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    };
  },

  async handleCreateUser(payload, socket, socketServer) {
    const { email, name, password, is_admin = false } = payload;

    // Validation
    if (!email || !name || !password) {
      throw new Error('Email, name, and password are required');
    }

    // Check if user already exists
    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPin = '0000';

    // Create user
    const result = await query(
      'INSERT INTO users (email, name, password_hash, user_pin, is_admin, available_inr, available_btc) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email.toLowerCase(), name, hashedPassword, defaultPin, is_admin, 0, 0]
    );

    // Broadcast to all admins
    socketServer.broadcastToAdmins('user_created', {
      userId: result.insertId,
      email: email.toLowerCase(),
      name,
      is_admin,
      created_by: socket.user.email
    });

    return {
      message: 'User created successfully',
      user: {
        id: result.insertId,
        email: email.toLowerCase(),
        name,
        is_admin
      }
    };
  },

  async handleDeleteUser(payload, socket, socketServer) {
    const { userId } = payload;

    // Get user info before deletion
    const users = await query('SELECT email, name FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Delete user
    await query('DELETE FROM users WHERE id = ?', [userId]);

    // Clear user cache
    await clearUserCache(userId);

    // Broadcast to all admins
    socketServer.broadcastToAdmins('user_deleted', {
      userId,
      email: user.email,
      name: user.name,
      deleted_by: socket.user.email
    });

    return {
      message: 'User deleted successfully'
    };
  },

  async handleChangeUserPassword(payload, socket, socketServer) {
    const { userId, password } = payload;

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    // Clear user cache
    await clearUserCache(userId);

    return {
      message: 'User password changed successfully'
    };
  },

  async handleDepositINR(payload, socket, socketServer) {
    const { userId, amount } = payload;

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    await transaction(async (connection) => {
      // Update user balance
      await connection.execute(
        'UPDATE users SET available_inr = available_inr + ? WHERE id = ?',
        [amount, userId]
      );

      // Record transaction
      await connection.execute(`
        INSERT INTO operations (user_id, type, inr_amount, btc_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, 'DEPOSIT_INR', amount, 0, 'EXECUTED']);

      await clearUserCache(userId);
    });

    // Broadcast balance update to user
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(userId, 'balance_update', formattedBalances);

    return {
      message: 'INR deposited successfully',
      amount
    };
  },

  async handleWithdrawINR(payload, socket, socketServer) {
    const { userId, amount } = payload;

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    await transaction(async (connection) => {
      // Check balance
      const [user] = await connection.execute(
        'SELECT available_inr FROM users WHERE id = ?',
        [userId]
      );

      if (user.length === 0) {
        throw new Error('User not found');
      }

      if (user[0].available_inr < amount) {
        throw new Error('Insufficient balance');
      }

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_inr = available_inr - ? WHERE id = ?',
        [amount, userId]
      );

      // Record transaction
      await connection.execute(`
        INSERT INTO operations (user_id, type, inr_amount, btc_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, 'WITHDRAW_INR', amount, 0, 'EXECUTED']);

      await clearUserCache(userId);
    });

    // Broadcast balance update to user
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(userId, 'balance_update', formattedBalances);

    return {
      message: 'INR withdrawn successfully',
      amount
    };
  },

  async handleDepositBTC(payload, socket, socketServer) {
    const { userId, amount } = payload;

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const satoshiAmount = Math.floor(amount * 100000000);

    await transaction(async (connection) => {
      // Update user balance
      await connection.execute(
        'UPDATE users SET available_btc = available_btc + ? WHERE id = ?',
        [satoshiAmount, userId]
      );

      // Record transaction
      await connection.execute(`
        INSERT INTO operations (user_id, type, inr_amount, btc_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, 'DEPOSIT_BTC', 0, satoshiAmount, 'EXECUTED']);

      await clearUserCache(userId);
    });

    // Broadcast balance update to user
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(userId, 'balance_update', formattedBalances);

    return {
      message: 'BTC deposited successfully',
      amount
    };
  },

  async handleWithdrawBTC(payload, socket, socketServer) {
    const { userId, amount } = payload;

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const satoshiAmount = Math.floor(amount * 100000000);

    await transaction(async (connection) => {
      // Check balance
      const [user] = await connection.execute(
        'SELECT available_btc FROM users WHERE id = ?',
        [userId]
      );

      if (user.length === 0) {
        throw new Error('User not found');
      }

      if (user[0].available_btc < satoshiAmount) {
        throw new Error('Insufficient balance');
      }

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_btc = available_btc - ? WHERE id = ?',
        [satoshiAmount, userId]
      );

      // Record transaction
      await connection.execute(`
        INSERT INTO operations (user_id, type, inr_amount, btc_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, 'WITHDRAW_BTC', 0, satoshiAmount, 'EXECUTED']);

      await clearUserCache(userId);
    });

    // Broadcast balance update to user
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(userId, 'balance_update', formattedBalances);

    return {
      message: 'BTC withdrawn successfully',
      amount
    };
  },

  async handleExternalBuy(payload, socket, socketServer) {
    const { userId, inrAmount, btcAmount } = payload;

    if (!inrAmount || !btcAmount || inrAmount <= 0 || btcAmount <= 0) {
      throw new Error('Valid INR and BTC amounts are required');
    }

    const satoshiAmount = Math.floor(btcAmount * 100000000);

    await transaction(async (connection) => {
      // Check INR balance
      const [user] = await connection.execute(
        'SELECT available_inr FROM users WHERE id = ?',
        [userId]
      );

      if (user.length === 0) {
        throw new Error('User not found');
      }

      if (user[0].available_inr < inrAmount) {
        throw new Error('Insufficient INR balance');
      }

      // Update balances
      await connection.execute(
        'UPDATE users SET available_inr = available_inr - ?, available_btc = available_btc + ? WHERE id = ?',
        [inrAmount, satoshiAmount, userId]
      );

      // Record transaction
      await connection.execute(`
        INSERT INTO operations (user_id, type, inr_amount, btc_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, 'MARKET_BUY', inrAmount, satoshiAmount, 'EXECUTED']);

      await clearUserCache(userId);
    });

    // Broadcast balance update to user
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(userId, 'balance_update', formattedBalances);

    return {
      message: 'External buy transaction completed',
      inrAmount,
      btcAmount
    };
  },

  // Settings management
  async handleGetSettings(payload, socket, socketServer) {
    const settings = await settingsService.getSettings();
    return settings;
  },

  async handleUpdateSettings(payload, socket, socketServer) {
    const { buy_multiplier, sell_multiplier, loan_interest_rate } = payload;
    
    await settingsService.updateSettings({
      buy_multiplier,
      sell_multiplier,
      loan_interest_rate
    });

    // Clear cache to force refresh
    await clearAllCache();

    // Broadcast settings update to all admins
    socketServer.broadcastToAdmins('settings_updated', {
      buy_multiplier,
      sell_multiplier,
      loan_interest_rate,
      updated_by: socket.user.email
    });

    return {
      message: 'Settings updated successfully'
    };
  },

  // Transaction management
  async handleGetTransactions(payload, socket, socketServer) {
    const { page = 1, limit = 50 } = payload;
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 50;
    const offset = (pageInt - 1) * limitInt;

    const [transactions, totalCount] = await Promise.all([
      query(`
        SELECT o.*, u.email, u.name 
        FROM operations o 
        JOIN users u ON o.user_id = u.id 
        ORDER BY o.created_at DESC 
        LIMIT ${limitInt} OFFSET ${offset}
      `),
      query('SELECT COUNT(*) as count FROM operations')
    ]);

    return {
      transactions: userService.formatTransactionsForDisplay(transactions),
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    };
  },

  async handleGetAllTransactions(payload, socket, socketServer) {
    return await this.handleGetTransactions(payload, socket, socketServer);
  },

  // Limit order management
  async handleGetLimitOrdersSummary(payload, socket, socketServer) {
    const [buyOrders, sellOrders] = await Promise.all([
      query('SELECT COUNT(*) as count, SUM(inr_amount) as total FROM operations WHERE type = "LIMIT_BUY" AND status = "PENDING"'),
      query('SELECT COUNT(*) as count, SUM(btc_amount) as total FROM operations WHERE type = "LIMIT_SELL" AND status = "PENDING"')
    ]);

    return {
      pending_buy_orders: buyOrders[0].count,
      pending_sell_orders: sellOrders[0].count,
      total_buy_amount: buyOrders[0].total || 0,
      total_sell_amount: (sellOrders[0].total || 0) / 100000000
    };
  },

  async handleGetPendingLimitOrders(payload, socket, socketServer) {
    const orders = await query(`
      SELECT o.*, u.email, u.name 
      FROM operations o 
      JOIN users u ON o.user_id = u.id 
      WHERE o.status = 'PENDING' AND o.type IN ('LIMIT_BUY', 'LIMIT_SELL')
      ORDER BY o.created_at DESC
    `);

    return userService.formatTransactionsForDisplay(orders);
  },

  async handleExecuteLimitOrders(payload, socket, socketServer) {
    // This would trigger the limit order execution service
    // For now, return a placeholder response
    return {
      message: 'Limit order execution triggered'
    };
  },

  async handleCancelLimitOrder(payload, socket, socketServer) {
    const { orderId, reason } = payload;

    const orders = await query('SELECT * FROM operations WHERE id = ? AND status = "PENDING"', [orderId]);
    if (orders.length === 0) {
      throw new Error('Pending order not found');
    }

    const order = orders[0];

    await transaction(async (connection) => {
      // Release funds
      if (order.type === 'LIMIT_BUY') {
        await connection.execute(
          'UPDATE users SET available_inr = available_inr + ?, reserved_inr = reserved_inr - ? WHERE id = ?',
          [order.inr_amount, order.inr_amount, order.user_id]
        );
      } else if (order.type === 'LIMIT_SELL') {
        await connection.execute(
          'UPDATE users SET available_btc = available_btc + ?, reserved_btc = reserved_btc - ? WHERE id = ?',
          [order.btc_amount, order.btc_amount, order.user_id]
        );
      }

      // Update order status
      await connection.execute(
        'UPDATE operations SET status = ?, cancelled_at = NOW() WHERE id = ?',
        ['CANCELLED', orderId]
      );

      await clearUserCache(order.user_id);
    });

    // Broadcast to user
    const balances = await userService.getUserBalances(order.user_id);
    const formattedBalances = userService.formatBalancesForDisplay(balances);
    socketServer.broadcastToUser(order.user_id, 'balance_update', formattedBalances);

    return {
      message: 'Limit order cancelled successfully',
      orderId,
      reason
    };
  },

  async handleControlLimitOrderService(payload, socket, socketServer) {
    const { action } = payload;
    
    // This would control the limit order execution service
    // For now, return a placeholder response
    return {
      message: `Limit order service ${action} request processed`
    };
  },

  // DCA management
  async handleGetDcaPlans(payload, socket, socketServer) {
    const { page = 1, limit = 50 } = payload;
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 50;
    const offset = (pageInt - 1) * limitInt;

    const [plans, totalCount] = await Promise.all([
      query(`
        SELECT ap.*, u.email, u.name 
        FROM active_plans ap 
        JOIN users u ON ap.user_id = u.id 
        ORDER BY ap.created_at DESC 
        LIMIT ${limitInt} OFFSET ${offset}
      `),
      query('SELECT COUNT(*) as count FROM active_plans')
    ]);

    return {
      dcaPlans: plans.map(plan => ({
        ...plan,
        amount_per_execution: plan.plan_type === 'DCA_SELL' ? 
          plan.amount_per_execution / 100000000 : plan.amount_per_execution
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    };
  },

  async handlePauseDcaPlan(payload, socket, socketServer) {
    const { planId } = payload;

    await query('UPDATE active_plans SET status = "PAUSED" WHERE id = ?', [planId]);

    return {
      message: 'DCA plan paused successfully'
    };
  },

  async handleResumeDcaPlan(payload, socket, socketServer) {
    const { planId } = payload;

    await query('UPDATE active_plans SET status = "ACTIVE" WHERE id = ?', [planId]);

    return {
      message: 'DCA plan resumed successfully'
    };
  },

  async handleDeleteDcaPlan(payload, socket, socketServer) {
    const { planId } = payload;

    await query('DELETE FROM active_plans WHERE id = ?', [planId]);

    return {
      message: 'DCA plan deleted successfully'
    };
  },

  // Liquidation management
  async handleTriggerManualLiquidation(payload, socket, socketServer) {
    // This would trigger manual liquidation
    // For now, return a placeholder response
    return {
      message: 'Manual liquidation triggered'
    };
  },

  async handleGetLiquidationRisks(payload, socket, socketServer) {
    const risks = await query(`
      SELECT l.*, u.email, u.name,
             (l.borrowed_amount + l.accrued_interest) as total_debt,
             (l.collateral_amount / 100000000) as collateral_btc,
             ((l.borrowed_amount + l.accrued_interest) / (l.collateral_amount / 100000000)) as ltv_ratio
      FROM loans l
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'ACTIVE'
      ORDER BY ltv_ratio DESC
    `);

    return risks;
  },

  // Job management
  async handleTriggerInterestAccrual(payload, socket, socketServer) {
    // This would trigger interest accrual
    // For now, return a placeholder response
    return {
      message: 'Interest accrual triggered'
    };
  }
};

module.exports = adminHandlers;
