const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const userService = require('../services/userService');
const bitcoinDataService = require('../services/bitcoinDataService');
const portfolioService = require('../services/portfolioService');
const loanService = require('../services/loanService');

const router = express.Router();

// All user routes require authentication
router.use(verifyToken);

// Get user dashboard data (balances, prices, recent transactions)
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all dashboard data in parallel
    const [balances, rates, recentTransactions] = await Promise.all([
      userService.getUserBalances(userId),
      bitcoinDataService.getCalculatedRates(),
      userService.getRecentTransactions(userId, 5)
    ]);

    const formattedBalances = userService.formatBalancesForDisplay(balances);
    const formattedTransactions = userService.formatTransactionsForDisplay(recentTransactions);

    res.json({
      success: true,
      data: {
        balances: formattedBalances,
        prices: {
          btc_usd: rates.btcUsdPrice,
          buy_rate: rates.buyRate,
          sell_rate: rates.sellRate,
          last_update: rates.lastUpdate
        },
        recent_transactions: formattedTransactions
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

// Get user balances
router.get('/balances', async (req, res) => {
  try {
    const userId = req.user.id;
    const balances = await userService.getUserBalances(userId);
    const formattedBalances = userService.formatBalancesForDisplay(balances);

    res.json({
      success: true,
      data: formattedBalances
    });

  } catch (error) {
    console.error('Balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balances'
    });
  }
});

// Get current prices
router.get('/prices', async (req, res) => {
  try {
    const rates = await bitcoinDataService.getCalculatedRates();

    res.json({
      success: true,
      data: {
        btc_usd: rates.btcUsdPrice,
        buy_rate: rates.buyRate,
        sell_rate: rates.sellRate,
        buy_multiplier: rates.buyMultiplier,
        sell_multiplier: rates.sellMultiplier,
        last_update: rates.lastUpdate,
        market_data: rates.marketData
      }
    });

  } catch (error) {
    console.error('Prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prices'
    });
  }
});

// Get comprehensive Bitcoin market data
router.get('/bitcoin/data', async (req, res) => {
  try {
    const bitcoinData = await bitcoinDataService.getCurrentData();

    res.json({
      success: true,
      data: bitcoinData
    });

  } catch (error) {
    console.error('Bitcoin data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Bitcoin data'
    });
  }
});

// Get Bitcoin sentiment data
router.get('/bitcoin/sentiment', async (req, res) => {
  try {
    const sentimentData = await bitcoinDataService.getSentimentData();

    res.json({
      success: true,
      data: sentimentData
    });

  } catch (error) {
    console.error('Sentiment data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sentiment data'
    });
  }
});

// Get Bitcoin chart data
router.get('/bitcoin/charts', async (req, res) => {
  try {
    const { timeframe } = req.query;
    const chartData = await bitcoinDataService.getChartData(timeframe);

    // If requesting specific timeframe, return single object
    if (timeframe && chartData.length > 0) {
      res.json({
        success: true,
        data: chartData[0]
      });
    } else if (timeframe) {
      // If no data found for specific timeframe, return null
      res.json({
        success: true,
        data: null
      });
    } else {
      // If no timeframe specified, return all chart data
      res.json({
        success: true,
        data: chartData
      });
    }

  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chart data'
    });
  }
});

// Get Bitcoin data history
router.get('/bitcoin/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    if (limit > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 1000'
      });
    }

    const dataHistory = await bitcoinDataService.getDataHistory(limit);

    res.json({
      success: true,
      data: dataHistory
    });

  } catch (error) {
    console.error('Bitcoin data history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Bitcoin data history'
    });
  }
});

// Buy Bitcoin
router.post('/buy', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a whole number (in rupees)'
      });
    }

    const result = await userService.buyBitcoin(userId, amount);

    res.json({
      success: true,
      message: 'Bitcoin purchased successfully',
      data: {
        transaction_id: result.transactionId,
        inr_amount: result.inrAmount,
        btc_amount: result.btcAmount / 100000000, // Convert to BTC
        buy_rate: result.buyRate,
        new_balances: {
          inr: result.newInrBalance,
          btc: result.newBtcBalance / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('Buy error:', error);
    
    let statusCode = 500;
    let message = 'Error processing buy order';
    
    if (error.message === 'Insufficient INR balance') {
      statusCode = 400;
      message = error.message;
    } else if (error.message === 'BTC amount too small') {
      statusCode = 400;
      message = 'Amount too small to buy Bitcoin';
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Sell Bitcoin
router.post('/sell', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Convert BTC amount to satoshis
    const satoshiAmount = Math.floor(amount * 100000000);
    
    if (satoshiAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount too small'
      });
    }

    const result = await userService.sellBitcoin(userId, satoshiAmount);

    res.json({
      success: true,
      message: 'Bitcoin sold successfully',
      data: {
        transaction_id: result.transactionId,
        inr_amount: result.inrAmount,
        btc_amount: result.btcAmount / 100000000, // Convert to BTC
        sell_rate: result.sellRate,
        new_balances: {
          inr: result.newInrBalance,
          btc: result.newBtcBalance / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('Sell error:', error);
    
    let statusCode = 500;
    let message = 'Error processing sell order';
    
    if (error.message === 'Insufficient BTC balance') {
      statusCode = 400;
      message = error.message;
    } else if (error.message === 'INR amount too small') {
      statusCode = 400;
      message = 'Amount too small to sell';
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Place Limit Buy Order
router.post('/limit-buy', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, targetPrice } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!targetPrice || targetPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target price must be greater than 0'
      });
    }

    if (!Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a whole number (in rupees)'
      });
    }

    if (!Number.isInteger(targetPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Target price must be a whole number (in rupees)'
      });
    }

    const result = await userService.placeLimitBuyOrder(userId, amount, targetPrice);

    res.json({
      success: true,
      message: 'Limit buy order placed successfully',
      data: {
        order_id: result.orderId,
        inr_amount: result.inrAmount,
        target_price: result.targetPrice,
        estimated_btc: result.estimatedBtc / 100000000, // Convert to BTC
        new_balances: {
          inr: result.newAvailableBalance,
          btc: result.currentBtcBalance / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('Limit buy error:', error);
    
    let statusCode = 500;
    let message = 'Error placing limit buy order';
    
    if (error.message === 'Insufficient INR balance') {
      statusCode = 400;
      message = error.message;
    } else if (error.message === 'Target price too high') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Place Limit Sell Order
router.post('/limit-sell', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, targetPrice } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!targetPrice || targetPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target price must be greater than 0'
      });
    }

    if (!Number.isInteger(targetPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Target price must be a whole number (in rupees)'
      });
    }

    // Convert BTC amount to satoshis
    const satoshiAmount = Math.floor(amount * 100000000);
    
    if (satoshiAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount too small'
      });
    }

    const result = await userService.placeLimitSellOrder(userId, satoshiAmount, targetPrice);

    res.json({
      success: true,
      message: 'Limit sell order placed successfully',
      data: {
        order_id: result.orderId,
        btc_amount: result.btcAmount / 100000000, // Convert to BTC
        target_price: result.targetPrice,
        estimated_inr: result.estimatedInr,
        new_balances: {
          inr: result.currentInrBalance,
          btc: result.newAvailableBalance / 100000000 // Convert to BTC
        }
      }
    });

  } catch (error) {
    console.error('Limit sell error:', error);
    
    let statusCode = 500;
    let message = 'Error placing limit sell order';
    
    if (error.message === 'Insufficient BTC balance') {
      statusCode = 400;
      message = error.message;
    } else if (error.message === 'Target price too low') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Get recent transactions
router.get('/transactions/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    if (limit > 50) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 50'
      });
    }

    const transactions = await userService.getRecentTransactions(userId, limit);
    const formattedTransactions = userService.formatTransactionsForDisplay(transactions);

    res.json({
      success: true,
      data: formattedTransactions
    });

  } catch (error) {
    console.error('Recent transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent transactions'
    });
  }
});

// Get all transactions with pagination
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 100'
      });
    }

    const transactions = await userService.getAllTransactions(userId, offset, limit);
    const formattedTransactions = userService.formatTransactionsForDisplay(transactions);

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          has_more: transactions.length === limit
        }
      }
    });

  } catch (error) {
    console.error('All transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
});

// Get portfolio metrics
router.get('/portfolio', async (req, res) => {
  try {
    const userId = req.user.id;
    const portfolioData = await portfolioService.calculatePortfolioMetrics(userId);

    res.json({
      success: true,
      data: portfolioData
    });

  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio data'
    });
  }
});

// Get user's pending limit orders
router.get('/limit-orders', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const pendingOrders = await query(`
      SELECT 
        id, type, status, inr_amount, btc_amount, limit_price, 
        created_at, expires_at,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as age_minutes
      FROM operations 
      WHERE user_id = ? 
      AND status = 'PENDING' 
      AND type IN ('LIMIT_BUY', 'LIMIT_SELL')
      ORDER BY created_at DESC
    `, [userId]);

    const formattedOrders = pendingOrders.map(order => ({
      ...order,
      btc_amount: order.btc_amount / 100000000, // Convert to BTC
      age_hours: Math.round(order.age_minutes / 60 * 10) / 10 // Round to 1 decimal
    }));

    res.json({
      success: true,
      data: formattedOrders
    });

  } catch (error) {
    console.error('Get user limit orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching limit orders'
    });
  }
});

// Cancel user's own pending limit order
router.delete('/limit-orders/:orderId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Get order details and verify ownership
    const orders = await query(
      'SELECT * FROM operations WHERE id = ? AND user_id = ? AND status = "PENDING"',
      [orderId, userId]
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
          [order.inr_amount, order.inr_amount, userId]
        );
      } else if (order.type === 'LIMIT_SELL') {
        // Release reserved BTC back to available
        await connection.execute(
          'UPDATE users SET available_btc = available_btc + ?, reserved_btc = reserved_btc - ? WHERE id = ?',
          [order.btc_amount, order.btc_amount, userId]
        );
      }

      // Update operation status
      await connection.execute(
        'UPDATE operations SET status = ?, cancelled_at = NOW(), cancellation_reason = ? WHERE id = ?',
        ['CANCELLED', 'User cancellation', orderId]
      );

      // Clear user cache
      await clearUserCache(userId);
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
    console.error('Cancel user order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order'
    });
  }
});

// Update user profile (name/email)
router.patch('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, currentPassword } = req.body;

    // Validation
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'Name or email must be provided'
      });
    }

    const result = await userService.updateUserProfile(userId, { name, email, currentPassword });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          is_admin: result.is_admin
        }
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    
    let statusCode = 500;
    let message = 'Error updating profile';
    
    if (error.message === 'Invalid current password') {
      statusCode = 401;
      message = error.message;
    } else if (error.message === 'Email already exists') {
      statusCode = 409;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Create DCA Buy Plan
router.post('/dca-buy', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amountPerExecution, frequency, totalExecutions, maxPrice, minPrice } = req.body;

    // Validation
    if (!amountPerExecution || amountPerExecution <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount per execution must be greater than 0'
      });
    }

    if (!frequency || !['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid frequency. Must be HOURLY, DAILY, WEEKLY, or MONTHLY'
      });
    }

    if (!Number.isInteger(amountPerExecution)) {
      return res.status(400).json({
        success: false,
        message: 'Amount per execution must be a whole number (in rupees)'
      });
    }

    const result = await userService.createDcaBuyPlan(userId, {
      amountPerExecution,
      frequency,
      totalExecutions,
      maxPrice,
      minPrice
    });

    res.json({
      success: true,
      message: 'DCA buy plan created successfully',
      data: result
    });

  } catch (error) {
    console.error('DCA buy plan creation error:', error);
    
    let statusCode = 500;
    let message = 'Error creating DCA buy plan';
    
    if (error.message === 'Invalid frequency' || error.message === 'Invalid price limits') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Create DCA Sell Plan
router.post('/dca-sell', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amountPerExecution, frequency, totalExecutions, maxPrice, minPrice } = req.body;

    // Validation
    if (!amountPerExecution || amountPerExecution <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount per execution must be greater than 0'
      });
    }

    if (!frequency || !['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid frequency. Must be HOURLY, DAILY, WEEKLY, or MONTHLY'
      });
    }

    // Convert BTC amount to satoshis
    const satoshiAmount = Math.floor(amountPerExecution * 100000000);
    
    if (satoshiAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount too small'
      });
    }

    const result = await userService.createDcaSellPlan(userId, {
      amountPerExecution: satoshiAmount,
      frequency,
      totalExecutions,
      maxPrice,
      minPrice
    });

    res.json({
      success: true,
      message: 'DCA sell plan created successfully',
      data: result
    });

  } catch (error) {
    console.error('DCA sell plan creation error:', error);
    
    let statusCode = 500;
    let message = 'Error creating DCA sell plan';
    
    if (error.message === 'Invalid frequency' || error.message === 'Invalid price limits') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Get user's DCA plans
router.get('/dca-plans', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const plans = await query(`
      SELECT 
        id, plan_type, status, frequency, amount_per_execution,
        next_execution_at, total_executions, remaining_executions,
        max_price, min_price, created_at
      FROM active_plans 
      WHERE user_id = ? 
      AND status IN ('ACTIVE', 'PAUSED')
      ORDER BY created_at DESC
    `, [userId]);

    const formattedPlans = plans.map(plan => ({
      ...plan,
      amount_per_execution: plan.plan_type === 'DCA_SELL' ? 
        plan.amount_per_execution / 100000000 : plan.amount_per_execution // Convert to BTC for sell plans
    }));

    res.json({
      success: true,
      data: formattedPlans
    });

  } catch (error) {
    console.error('Get DCA plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching DCA plans'
    });
  }
});

// Pause DCA plan
router.patch('/dca-plans/:planId/pause', async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.params;

    // Get plan details and verify ownership
    const plans = await query(
      'SELECT * FROM active_plans WHERE id = ? AND user_id = ? AND status = "ACTIVE"',
      [planId, userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active DCA plan not found'
      });
    }

    const plan = plans[0];

    // Pause the plan
    await query(
      'UPDATE active_plans SET status = ? WHERE id = ?',
      ['PAUSED', planId]
    );

    res.json({
      success: true,
      message: 'DCA plan paused successfully',
      data: {
        plan_id: planId,
        plan_type: plan.plan_type,
        frequency: plan.frequency,
        status: 'PAUSED'
      }
    });

  } catch (error) {
    console.error('Pause DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error pausing DCA plan'
    });
  }
});

// Resume DCA plan
router.patch('/dca-plans/:planId/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.params;

    // Get plan details and verify ownership
    const plans = await query(
      'SELECT * FROM active_plans WHERE id = ? AND user_id = ? AND status = "PAUSED"',
      [planId, userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paused DCA plan not found'
      });
    }

    const plan = plans[0];

    // Calculate next execution time based on frequency
    let nextExecutionQuery;
    switch (plan.frequency) {
      case 'HOURLY':
        nextExecutionQuery = 'DATE_ADD(NOW(), INTERVAL 1 HOUR)';
        break;
      case 'DAILY':
        nextExecutionQuery = 'DATE_ADD(NOW(), INTERVAL 1 DAY)';
        break;
      case 'WEEKLY':
        nextExecutionQuery = 'DATE_ADD(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'MONTHLY':
        nextExecutionQuery = 'DATE_ADD(NOW(), INTERVAL 1 MONTH)';
        break;
      default:
        nextExecutionQuery = 'DATE_ADD(NOW(), INTERVAL 1 DAY)';
    }

    // Resume the plan and set next execution time
    await query(
      `UPDATE active_plans SET status = ?, next_execution_at = ${nextExecutionQuery} WHERE id = ?`,
      ['ACTIVE', planId]
    );

    res.json({
      success: true,
      message: 'DCA plan resumed successfully',
      data: {
        plan_id: planId,
        plan_type: plan.plan_type,
        frequency: plan.frequency,
        status: 'ACTIVE'
      }
    });

  } catch (error) {
    console.error('Resume DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resuming DCA plan'
    });
  }
});

// Delete DCA plan
router.delete('/dca-plans/:planId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.params;

    // Get plan details and verify ownership
    const plans = await query(
      'SELECT * FROM active_plans WHERE id = ? AND user_id = ? AND status IN ("ACTIVE", "PAUSED")',
      [planId, userId]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active DCA plan not found'
      });
    }

    const plan = plans[0];

    // Delete the plan (this will also handle any foreign key constraints)
    // Note: Operations table has parent_id with ON DELETE SET NULL, so they'll be preserved
    await query(
      'DELETE FROM active_plans WHERE id = ?',
      [planId]
    );

    res.json({
      success: true,
      message: 'DCA plan deleted successfully',
      data: {
        plan_id: planId,
        plan_type: plan.plan_type,
        frequency: plan.frequency
      }
    });

  } catch (error) {
    console.error('Delete DCA plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting DCA plan'
    });
  }
});

// Change password
router.patch('/password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    await userService.changeUserPassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    
    let statusCode = 500;
    let message = 'Error changing password';
    
    if (error.message === 'Invalid current password') {
      statusCode = 401;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Verify PIN
router.post('/verify-pin', async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    // Validation
    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required'
      });
    }

    const isValid = await userService.verifyPin(userId, pin);

    res.json({
      success: true,
      data: {
        valid: isValid
      }
    });

  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying PIN'
    });
  }
});

// Change PIN
router.patch('/pin', async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPin, currentPassword } = req.body;

    // Validation
    if (!newPin || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New PIN and current password are required'
      });
    }

    await userService.changeUserPin(userId, newPin, currentPassword);

    res.json({
      success: true,
      message: 'PIN changed successfully'
    });

  } catch (error) {
    console.error('PIN change error:', error);
    
    let statusCode = 500;
    let message = 'Error changing PIN';
    
    if (error.message === 'Invalid current password') {
      statusCode = 401;
      message = error.message;
    } else if (error.message === 'PIN must be exactly 4 digits') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Bitcoin-backed loan APIs
// Deposit BTC as collateral
router.post('/loan/deposit-collateral', async (req, res) => {
  try {
    const userId = req.user.id;
    const { collateralAmount } = req.body;

    // Validate input
    if (!collateralAmount || collateralAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Collateral amount must be greater than 0'
      });
    }

    const result = await loanService.depositCollateral(userId, collateralAmount);

    res.json({
      success: true,
      message: 'Collateral deposited successfully',
      data: result
    });

  } catch (error) {
    console.error('Deposit collateral error:', error);
    res.status(500).json({
      success: false,
      message: 'Error depositing collateral'
    });
  }
});

// Borrow funds against collateral
router.post('/loan/borrow', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Borrow amount must be greater than 0'
      });
    }

    const result = await loanService.borrowFunds(userId, amount);

    res.json({
      success: true,
      message: 'Funds borrowed successfully',
      data: result
    });

  } catch (error) {
    console.error('Borrow funds error:', error);
    res.status(500).json({
      success: false,
      message: 'Error borrowing funds'
    });
  }
});

// Repay borrowed funds
router.post('/loan/repay', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Repay amount must be greater than 0'
      });
    }

    const result = await loanService.repayLoan(userId, amount);

    res.json({
      success: true,
      message: 'Loan repaid successfully',
      data: result
    });

  } catch (error) {
    console.error('Repay loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error repaying loan'
    });
  }
});

// Add collateral to existing loan
router.post('/loan/add-collateral', async (req, res) => {
  try {
    const userId = req.user.id;
    const { collateralAmount } = req.body;

    // Validate input
    if (!collateralAmount || collateralAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Collateral amount must be greater than 0'
      });
    }

    // Convert BTC amount to satoshis
    const satoshiAmount = Math.floor(collateralAmount * 100000000);
    
    if (satoshiAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Collateral amount too small'
      });
    }

    const result = await loanService.addCollateralToLoan(userId, satoshiAmount);

    res.json({
      success: true,
      message: 'Collateral added successfully',
      data: {
        ...result,
        additionalCollateral: result.additionalCollateral / 100000000, // Convert back to BTC
        newTotalCollateral: result.newTotalCollateral / 100000000 // Convert back to BTC
      }
    });

  } catch (error) {
    console.error('Add collateral error:', error);
    
    let statusCode = 500;
    let message = 'Error adding collateral';
    
    if (error.message === 'No active loan found') {
      statusCode = 404;
      message = error.message;
    } else if (error.message === 'Insufficient BTC balance') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Get loan status
router.get('/loan/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await loanService.getLoanStatus(userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No active loan found'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Loan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving loan status'
    });
  }
});

// Get loan history
router.get('/loan/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { loanId } = req.query;
    const result = await loanService.getLoanHistory(userId, loanId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Loan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving loan history'
    });
  }
});

// Execute user-initiated partial liquidation
router.post('/loan/partial-liquidation', async (req, res) => {
  try {
    const userId = req.user.id;
    const { btcAmount } = req.body;

    // Validate input
    if (!btcAmount || btcAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'BTC amount must be greater than 0'
      });
    }

    const result = await loanService.executeUserPartialLiquidation(userId, btcAmount);

    res.json({
      success: true,
      message: result.loanClosed ? 'Loan fully repaid through liquidation' : 'Partial liquidation executed successfully',
      data: {
        ...result,
        btcSold: result.btcSold / 100000000, // Convert back to BTC for frontend
        newCollateralAmount: result.newCollateralAmount / 100000000 // Convert back to BTC for frontend
      }
    });

  } catch (error) {
    console.error('Partial liquidation error:', error);
    
    let statusCode = 500;
    let message = 'Error executing partial liquidation';
    
    if (error.message === 'No active loan found') {
      statusCode = 404;
      message = error.message;
    } else if (error.message === 'Amount exceeds available collateral' || error.message === 'BTC amount must be greater than 0') {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Execute full liquidation
router.post('/loan/full-liquidation', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await loanService.executeFullLiquidation(userId);

    res.json({
      success: true,
      message: 'Full liquidation executed successfully',
      data: result
    });

  } catch (error) {
    console.error('Full liquidation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing full liquidation'
    });
  }
});

// Check liquidation risk (admin-only for monitoring)
router.get('/loan/liquidation-risk', async (req, res) => {
  try {
    const result = await loanService.checkLiquidationRisk();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Liquidation risk check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking liquidation risk'
    });
  }
});

// Export trading data
router.get('/export-data', async (req, res) => {
  try {
    const userId = req.user.id;
    const csvData = await userService.exportUserData(userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bittrade-data.csv"');
    res.send(csvData);

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting data'
    });
  }
});

module.exports = router;
