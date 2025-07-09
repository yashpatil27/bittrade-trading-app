const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('../services/bitcoinDataService');
const limitOrderExecutionService = require('../services/limitOrderExecutionService');

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(verifyToken);
router.use(requireAdmin);

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get platform statistics (including admin users)
    const [userCount, totalTrades, platformBalances] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM operations WHERE type IN (?, ?, ?, ?, ?, ?) AND status = ?', ['MARKET_BUY', 'MARKET_SELL', 'LIMIT_BUY', 'LIMIT_SELL', 'DCA_BUY', 'DCA_SELL', 'EXECUTED']),
      query(`
        SELECT 
          COALESCE(SUM(available_inr), 0) as total_inr,
          COALESCE(SUM(available_btc), 0) as total_btc
        FROM users
      `)
    ]);

    // Get current prices
    const rates = await bitcoinDataService.getCalculatedRates();

    res.json({
      success: true,
      data: {
        stats: {
          total_users: userCount[0].count,
          total_trades: totalTrades[0].count,
          total_inr_on_platform: platformBalances[0].total_inr || 0,
          total_btc_on_platform: (platformBalances[0].total_btc || 0) / 100000000 // Convert to BTC
        },
        current_prices: {
          btc_usd: rates.btcUsdPrice,
          buy_rate: rates.buyRate,
          sell_rate: rates.sellRate,
          buy_multiplier: rates.buyMultiplier,
          sell_multiplier: rates.sellMultiplier
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin dashboard data'
    });
  }
});

// Get all users with their balances
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const users = await query(`
      SELECT 
        id, email, name, is_admin, created_at,
        COALESCE(available_inr, 0) as inr_balance,
        COALESCE(available_btc, 0) as btc_balance
      FROM users
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const formattedUsers = users.map(user => ({
      ...user,
      btc_balance: user.btc_balance / 100000000 // Convert to BTC
    }));

    res.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          has_more: users.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Create new user
router.post('/users', async (req, res) => {
  try {
    const { email, name, password, is_admin = false } = req.body;

    // Validation
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, and password are required'
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
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default balances
    const result = await transaction(async (connection) => {
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, name, password_hash, is_admin, available_inr, available_btc, reserved_inr, reserved_btc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [email.toLowerCase(), name, hashedPassword, is_admin, 0, 0, 0, 0]
      );

      const userId = userResult.insertId;

      // Create SETUP operation for tracking
      await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'SETUP', 'EXECUTED', 0, 0, 0, new Date()]
      );

      return { userId };
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user_id: result.userId,
        email: email.toLowerCase(),
        name,
        is_admin
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
});

// Delete user
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const users = await query('SELECT id, is_admin FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting admin users
    if (users[0].is_admin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    // Delete user (CASCADE will delete transactions)
    await query('DELETE FROM users WHERE id = ?', [userId]);
    
    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

// Change user password
router.patch('/users/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// Deposit INR to user account
router.post('/users/:userId/deposit-inr', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a whole number'
      });
    }

    // Check if user exists and get current balances
    const users = await query('SELECT id, available_inr, available_btc FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      const currentUser = users[0];
      const newInrBalance = currentUser.available_inr + amount;

      // Create DEPOSIT_INR operation
      const [operationResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_INR', 'EXECUTED', amount, 0, 0, new Date()]
      );

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_inr = ? WHERE id = ?',
        [newInrBalance, userId]
      );

      return { 
        operationId: operationResult.insertId, 
        newInrBalance, 
        btcBalance: currentUser.available_btc 
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'INR deposited successfully',
      data: {
        operation_id: result.operationId,
        deposited_amount: amount,
        new_balances: {
          inr: result.newInrBalance,
          btc: result.btcBalance / 100000000
        }
      }
    });

  } catch (error) {
    console.error('Deposit INR error:', error);
    res.status(500).json({
      success: false,
      message: 'Error depositing INR'
    });
  }
});

// Withdraw INR from user account
router.post('/users/:userId/withdraw-inr', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Check if user exists and get current balances
    const users = await query('SELECT id, available_inr, available_btc FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      const currentUser = users[0];
      
      if (currentUser.available_inr < amount) {
        throw new Error('Insufficient INR balance');
      }

      const newInrBalance = currentUser.available_inr - amount;

      // Create WITHDRAW_INR operation
      const [operationResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'WITHDRAW_INR', 'EXECUTED', amount, 0, 0, new Date()]
      );

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_inr = ? WHERE id = ?',
        [newInrBalance, userId]
      );

      return { 
        operationId: operationResult.insertId, 
        newInrBalance, 
        btcBalance: currentUser.available_btc 
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'INR withdrawn successfully',
      data: {
        operation_id: result.operationId,
        withdrawn_amount: amount,
        new_balances: {
          inr: result.newInrBalance,
          btc: result.btcBalance / 100000000
        }
      }
    });

  } catch (error) {
    console.error('Withdraw INR error:', error);
    
    let statusCode = 500;
    let message = 'Error withdrawing INR';
    
    if (error.message === 'Insufficient INR balance') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Deposit BTC to user account
router.post('/users/:userId/deposit-btc', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Check if user exists and get current balances
    const users = await query('SELECT id, available_inr, available_btc FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      const currentUser = users[0];
      const btcAmountSatoshi = Math.round(amount * 100000000); // Convert BTC to satoshi
      const newBtcBalance = currentUser.available_btc + btcAmountSatoshi;

      // Get current BTC price for INR amount calculation
      const rates = await bitcoinDataService.getCalculatedRates();
      const inrAmount = Math.round(amount * rates.sellRate); // Use sell rate for internal calculations

      // Create DEPOSIT_BTC operation
      const [operationResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_BTC', 'EXECUTED', inrAmount, btcAmountSatoshi, rates.sellRate, new Date()]
      );

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_btc = ? WHERE id = ?',
        [newBtcBalance, userId]
      );

      return { 
        operationId: operationResult.insertId, 
        newBtcBalance, 
        inrBalance: currentUser.available_inr,
        inrAmount,
        sellRate: rates.sellRate
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'BTC deposited successfully',
      data: {
        operation_id: result.operationId,
        deposited_amount: amount,
        inr_equivalent: result.inrAmount,
        btc_price: result.sellRate,
        new_balances: {
          inr: result.inrBalance,
          btc: result.newBtcBalance / 100000000
        }
      }
    });

  } catch (error) {
    console.error('Deposit BTC error:', error);
    res.status(500).json({
      success: false,
      message: 'Error depositing BTC'
    });
  }
});

// Withdraw BTC from user account
router.post('/users/:userId/withdraw-btc', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Check if user exists and get current balances
    const users = await query('SELECT id, available_inr, available_btc FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      const currentUser = users[0];
      const btcAmountSatoshi = Math.round(amount * 100000000); // Convert BTC to satoshi
      
      if (currentUser.available_btc < btcAmountSatoshi) {
        throw new Error('Insufficient BTC balance');
      }

      const newBtcBalance = currentUser.available_btc - btcAmountSatoshi;

      // Get current BTC price for INR amount calculation
      const rates = await bitcoinDataService.getCalculatedRates();
      const inrAmount = Math.round(amount * rates.sellRate); // Use sell rate for internal calculations

      // Create WITHDRAW_BTC operation
      const [operationResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'WITHDRAW_BTC', 'EXECUTED', inrAmount, btcAmountSatoshi, rates.sellRate, new Date()]
      );

      // Update user balance
      await connection.execute(
        'UPDATE users SET available_btc = ? WHERE id = ?',
        [newBtcBalance, userId]
      );

      return { 
        operationId: operationResult.insertId, 
        newBtcBalance, 
        inrBalance: currentUser.available_inr,
        inrAmount,
        sellRate: rates.sellRate
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'BTC withdrawn successfully',
      data: {
        operation_id: result.operationId,
        withdrawn_amount: amount,
        inr_equivalent: result.inrAmount,
        btc_price: result.sellRate,
        new_balances: {
          inr: result.inrBalance,
          btc: result.newBtcBalance / 100000000
        }
      }
    });

  } catch (error) {
    console.error('Withdraw BTC error:', error);
    
    let statusCode = 500;
    let message = 'Error withdrawing BTC';
    
    if (error.message === 'Insufficient BTC balance') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Update system settings (buy/sell multipliers and loan interest rate)
router.patch('/settings', async (req, res) => {
  try {
    const { buy_multiplier, sell_multiplier, loan_interest_rate } = req.body;

    if (!buy_multiplier && !sell_multiplier && !loan_interest_rate) {
      return res.status(400).json({
        success: false,
        message: 'At least one setting must be provided'
      });
    }

    const updates = [];
    if (buy_multiplier !== undefined) {
      if (buy_multiplier <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Buy multiplier must be greater than 0'
        });
      }
      updates.push(['buy_multiplier', buy_multiplier]);
    }

    if (sell_multiplier !== undefined) {
      if (sell_multiplier <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Sell multiplier must be greater than 0'
        });
      }
      updates.push(['sell_multiplier', sell_multiplier]);
    }

    if (loan_interest_rate !== undefined) {
      if (loan_interest_rate <= 0 || loan_interest_rate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Loan interest rate must be between 0 and 100'
        });
      }
      updates.push(['loan_interest_rate', loan_interest_rate]);
    }

    // Update settings
    for (const [key, value] of updates) {
      await query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = CURRENT_TIMESTAMP',
        [key, value, value]
      );
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        updated_settings: Object.fromEntries(updates)
      }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
});

// Get current system settings
router.get('/settings', async (req, res) => {
  try {
    const settingsRows = await query('SELECT `key`, value FROM settings');
    
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = parseInt(row.value);
    });
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving settings'
    });
  }
});

// External buy transaction (creates cash top-up and Bitcoin purchase operations)
router.post('/users/:userId/external-buy', async (req, res) => {
  try {
    const { userId } = req.params;
    const { inrAmount, btcAmount } = req.body;

    if (!inrAmount || !btcAmount || inrAmount <= 0 || btcAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Both INR and BTC amounts must be greater than 0'
      });
    }

    if (!Number.isInteger(inrAmount)) {
      return res.status(400).json({
        success: false,
        message: 'INR amount must be a whole number'
      });
    }

    // Check if user exists
    const users = await query('SELECT id, available_inr, available_btc FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      const currentUser = users[0];
      
      // Calculate BTC price from INR and BTC amounts
      const btcPrice = inrAmount / btcAmount;
      const btcAmountSatoshi = Math.round(btcAmount * 100000000); // Convert BTC to satoshi
      
      // Create deposit timestamp (a few seconds earlier)
      const depositTime = new Date(Date.now() - 5000); // 5 seconds earlier
      
      // Step 1: Create DEPOSIT_INR operation (cash top-up)
      const [depositResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_INR', 'EXECUTED', inrAmount, 0, 0, depositTime, depositTime]
      );
      
      // Step 2: Update user balance after deposit
      const newInrBalanceAfterDeposit = currentUser.available_inr + inrAmount;
      await connection.execute(
        'UPDATE users SET available_inr = ? WHERE id = ?',
        [newInrBalanceAfterDeposit, userId]
      );
      
      // Step 3: Create MARKET_BUY operation (Bitcoin purchase)
      const [buyResult] = await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'MARKET_BUY', 'EXECUTED', inrAmount, btcAmountSatoshi, btcPrice, new Date()]
      );
      
      // Step 4: Update user balances after buy
      const finalInrBalance = newInrBalanceAfterDeposit - inrAmount;
      const finalBtcBalance = currentUser.available_btc + btcAmountSatoshi;
      await connection.execute(
        'UPDATE users SET available_inr = ?, available_btc = ? WHERE id = ?',
        [finalInrBalance, finalBtcBalance, userId]
      );

      return {
        depositOperationId: depositResult.insertId,
        buyOperationId: buyResult.insertId,
        inrAmount,
        btcAmount,
        btcPrice,
        finalBalances: {
          inr: finalInrBalance,
          btc: finalBtcBalance
        }
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'External buy transaction created successfully',
      data: {
        deposit_operation_id: result.depositOperationId,
        buy_operation_id: result.buyOperationId,
        inr_amount: result.inrAmount,
        btc_amount: result.btcAmount,
        btc_price: result.btcPrice,
        new_balances: {
          inr: result.finalBalances.inr,
          btc: result.finalBalances.btc / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('External buy error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating external buy transaction'
    });
  }
});

// Get all transactions across platform
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const operations = await query(`
      SELECT 
        o.id, o.user_id, o.type, o.status, o.inr_amount, o.btc_amount, 
        o.execution_price, o.limit_price, o.executed_at, o.created_at,
        u.email, u.name
      FROM operations o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const formattedOperations = operations.map(operation => ({
      ...operation,
      btc_amount: operation.btc_amount / 100000000,
      execution_price: operation.execution_price,
      limit_price: operation.limit_price
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedOperations, // Keep the same field name for frontend compatibility
        pagination: {
          page,
          limit,
          has_more: operations.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get all operations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching operations'
    });
  }
});

// ========== LIMIT ORDER EXECUTION ENDPOINTS ==========

// Get pending orders summary
router.get('/limit-orders/summary', async (req, res) => {
  try {
    const summary = await limitOrderExecutionService.getPendingOrdersSummary();
    const serviceStatus = {
      is_running: limitOrderExecutionService.isRunning,
      execution_in_progress: limitOrderExecutionService.executionInProgress
    };

    res.json({
      success: true,
      data: {
        service_status: serviceStatus,
        pending_orders: {
          total_orders: parseInt(summary.total_orders),
          buy_orders: parseInt(summary.buy_orders),
          sell_orders: parseInt(summary.sell_orders),
          total_buy_inr: parseInt(summary.total_buy_inr),
          total_sell_btc: parseInt(summary.total_sell_btc) / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('Get pending orders summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending orders summary'
    });
  }
});

// Get all pending orders with details
router.get('/limit-orders/pending', async (req, res) => {
  try {
    const pendingOrders = await query(`
      SELECT 
        o.id, o.user_id, o.type, o.status, o.inr_amount, o.btc_amount, 
        o.limit_price, o.created_at,
        u.email, u.name,
        TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) as age_minutes
      FROM operations o
      JOIN users u ON o.user_id = u.id
      WHERE o.status = 'PENDING' 
      AND o.type IN ('LIMIT_BUY', 'LIMIT_SELL')
      ORDER BY o.created_at ASC
    `);

    const formattedOrders = pendingOrders.map(order => ({
      ...order,
      btc_amount: order.btc_amount / 100000000, // Convert to BTC
      limit_price: order.limit_price,
      age_hours: Math.round(order.age_minutes / 60 * 10) / 10 // Round to 1 decimal
    }));

    res.json({
      success: true,
      data: formattedOrders
    });

  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending orders'
    });
  }
});

// Manually trigger limit order execution
router.post('/limit-orders/execute', async (req, res) => {
  try {
    const result = await limitOrderExecutionService.executeNow();

    res.json({
      success: true,
      message: 'Manual limit order execution completed',
      data: result
    });

  } catch (error) {
    console.error('Manual limit order execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing limit orders'
    });
  }
});

// Cancel a specific pending order (admin override)
router.delete('/limit-orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Get order details
    const orders = await query(
      'SELECT * FROM operations WHERE id = ? AND status = "PENDING"',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending order not found'
      });
    }

    const order = orders[0];

    // Cancel the order and release funds
    await transaction(async (connection) => {
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

      // Update operation status with admin cancellation
      await connection.execute(
        'UPDATE operations SET status = ?, cancelled_at = NOW(), cancellation_reason = ? WHERE id = ?',
        ['CANCELLED', reason || 'Admin cancellation', orderId]
      );

      // Clear user cache
      await clearUserCache(order.user_id);
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order_id: orderId,
        order_type: order.type,
        released_amount: order.type === 'LIMIT_BUY' ? order.inr_amount : order.btc_amount / 100000000
      }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order'
    });
  }
});

// Start/stop limit order execution service
router.post('/limit-orders/service/:action', async (req, res) => {
  try {
    const { action } = req.params;

    if (action === 'start') {
      if (limitOrderExecutionService.isRunning) {
        return res.json({
          success: true,
          message: 'Service is already running'
        });
      }
      limitOrderExecutionService.startService();
      res.json({
        success: true,
        message: 'Limit order execution service started'
      });
    } else if (action === 'stop') {
      if (!limitOrderExecutionService.isRunning) {
        return res.json({
          success: true,
          message: 'Service is already stopped'
        });
      }
      limitOrderExecutionService.stopService();
      res.json({
        success: true,
        message: 'Limit order execution service stopped'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Use "start" or "stop"'
      });
    }

  } catch (error) {
    console.error('Service control error:', error);
    res.status(500).json({
      success: false,
      message: 'Error controlling service'
    });
  }
});

// ========== DCA PLANS MANAGEMENT ENDPOINTS ==========

// Get all DCA plans across platform (with pagination)
router.get('/dca-plans', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Get DCA plans with enhanced data
    const dcaPlans = await query(`
      SELECT 
        ap.id, ap.user_id, ap.plan_type, ap.status, ap.frequency,
        ap.amount_per_execution, ap.next_execution_at, ap.total_executions,
        ap.remaining_executions, ap.max_price, ap.min_price, ap.created_at,
        u.email, u.name,
        -- Calculate additional metrics
        COALESCE((
          SELECT SUM(CASE 
            WHEN o.type = 'DCA_BUY' THEN o.inr_amount 
            WHEN o.type = 'DCA_SELL' THEN o.btc_amount / 100000000 * o.execution_price 
            ELSE 0 
          END)
          FROM operations o 
          WHERE o.parent_id = ap.id AND o.status = 'EXECUTED'
        ), 0) as total_invested,
        COALESCE((
          SELECT COUNT(*) 
          FROM operations o 
          WHERE o.parent_id = ap.id AND o.status = 'EXECUTED'
        ), 0) as executions_count
      FROM active_plans ap
      JOIN users u ON ap.user_id = u.id
      ORDER BY ap.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Format the DCA plans with proper field mapping
    const formattedPlans = dcaPlans.map(plan => ({
      ...plan,
      amount: plan.amount_per_execution, // Map for admin UI compatibility
      amount_per_execution: plan.plan_type === 'DCA_SELL' ? 
        plan.amount_per_execution / 100000000 : plan.amount_per_execution, // Convert to BTC for sell plans
      total_invested: parseFloat(plan.total_invested) || 0,
      executions_count: parseInt(plan.executions_count) || 0
    }));

    res.json({
      success: true,
      data: {
        dcaPlans: formattedPlans,
        pagination: {
          page,
          limit,
          has_more: dcaPlans.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get all DCA plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching DCA plans'
    });
  }
});

// Pause DCA plan (admin)
router.patch('/dca-plans/:planId/pause', async (req, res) => {
  try {
    const { planId } = req.params;

    // Check if plan exists and is active
    const plans = await query('SELECT * FROM active_plans WHERE id = ? AND status = ?', [planId, 'ACTIVE']);
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active DCA plan not found'
      });
    }

    // Pause the plan
    await query('UPDATE active_plans SET status = ? WHERE id = ?', ['PAUSED', planId]);

    res.json({
      success: true,
      message: 'DCA plan paused successfully'
    });

  } catch (error) {
    console.error('Pause DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error pausing DCA plan'
    });
  }
});

// Resume DCA plan (admin)
router.patch('/dca-plans/:planId/resume', async (req, res) => {
  try {
    const { planId } = req.params;

    // Check if plan exists and is paused
    const plans = await query('SELECT * FROM active_plans WHERE id = ? AND status = ?', [planId, 'PAUSED']);
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paused DCA plan not found'
      });
    }

    const plan = plans[0];

    // Calculate next execution time based on frequency
    const now = new Date();
    let nextExecution;
    
    switch (plan.frequency) {
      case 'HOURLY':
        nextExecution = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'DAILY':
        nextExecution = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'WEEKLY':
        nextExecution = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'MONTHLY':
        nextExecution = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        nextExecution = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // Resume the plan
    await query(
      'UPDATE active_plans SET status = ?, next_execution_at = ? WHERE id = ?',
      ['ACTIVE', nextExecution, planId]
    );

    res.json({
      success: true,
      message: 'DCA plan resumed successfully'
    });

  } catch (error) {
    console.error('Resume DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resuming DCA plan'
    });
  }
});

// Delete DCA plan (admin)
router.delete('/dca-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;

    // Check if plan exists
    const plans = await query('SELECT * FROM active_plans WHERE id = ?', [planId]);
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DCA plan not found'
      });
    }

    // Delete the plan
    await query('DELETE FROM active_plans WHERE id = ?', [planId]);

    res.json({
      success: true,
      message: 'DCA plan deleted successfully'
    });

  } catch (error) {
    console.error('Delete DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting DCA plan'
    });
  }
});

// ========== JOB MANAGEMENT ENDPOINTS ==========

// Manually trigger interest accrual (for testing)
router.post('/jobs/accrue-interest', async (req, res) => {
  try {
    const JobScheduler = require('../schedulers/jobScheduler');
    await JobScheduler.runInterestAccrual();
    
    res.json({
      success: true,
      message: 'Interest accrual job triggered successfully'
    });
  } catch (error) {
    console.error('Manual interest accrual error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering interest accrual job'
    });
  }
});

// Liquidation monitoring service
router.post('/liquidation/manual', async (req, res) => {
  try {
    const liquidationMonitoringService = require('../services/liquidationMonitoringService');
    const result = await liquidationMonitoringService.executeLiquidationNow();

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Manual liquidation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering manual liquidation'
    });
  }
});

// Get liquidation risks for all loans
router.get('/liquidation/risks', async (req, res) => {
  try {
    const liquidationMonitoringService = require('../services/liquidationMonitoringService');
    const risks = await liquidationMonitoringService.getLiquidationRisks();

    res.json({
      success: true,
      data: risks
    });
  } catch (error) {
    console.error('Get liquidation risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching liquidation risks'
    });
  }
});

module.exports = router;
