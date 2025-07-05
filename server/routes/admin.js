const express = require('express');
const bcrypt = require('bcryptjs');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('../services/bitcoinDataService');

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(verifyToken);
router.use(requireAdmin);

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get platform statistics
    const [userCount, totalTrades, platformBalances] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users WHERE is_admin = false'),
      query('SELECT COUNT(*) as count FROM transactions WHERE type IN (?, ?)', ['BUY', 'SELL']),
      query(`
        SELECT 
          SUM(inr_balance) as total_inr,
          SUM(btc_balance) as total_btc
        FROM (
          SELECT DISTINCT user_id, 
            FIRST_VALUE(inr_balance) OVER (PARTITION BY user_id ORDER BY id DESC) as inr_balance,
            FIRST_VALUE(btc_balance) OVER (PARTITION BY user_id ORDER BY id DESC) as btc_balance
          FROM transactions
        ) as latest_balances
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
        u.id, u.email, u.name, u.is_admin, u.created_at,
        COALESCE(latest.inr_balance, 0) as inr_balance,
        COALESCE(latest.btc_balance, 0) as btc_balance
      FROM users u
      LEFT JOIN (
        SELECT DISTINCT user_id,
          FIRST_VALUE(inr_balance) OVER (PARTITION BY user_id ORDER BY id DESC) as inr_balance,
          FIRST_VALUE(btc_balance) OVER (PARTITION BY user_id ORDER BY id DESC) as btc_balance
        FROM transactions
      ) latest ON u.id = latest.user_id
      ORDER BY u.created_at DESC
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

    // Create user and setup transaction
    const result = await transaction(async (connection) => {
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, ?)',
        [email.toLowerCase(), name, hashedPassword, is_admin]
      );

      const userId = userResult.insertId;

      // Create SETUP transaction
      await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'SETUP', 0, 0, 0, 0, 0]
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

    // Check if user exists
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      // Get current balances
      const [balanceRows] = await connection.execute(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User has no transactions');
      }

      const currentBalances = balanceRows[0];
      const newInrBalance = currentBalances.inr_balance + amount;

      // Create DEPOSIT_INR transaction
      const [transactionResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_INR', amount, 0, 0, newInrBalance, currentBalances.btc_balance]
      );

      return { transactionId: transactionResult.insertId, newInrBalance, btcBalance: currentBalances.btc_balance };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'INR deposited successfully',
      data: {
        transaction_id: result.transactionId,
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

    const result = await transaction(async (connection) => {
      // Get current balances
      const [balanceRows] = await connection.execute(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User has no transactions');
      }

      const currentBalances = balanceRows[0];
      
      if (currentBalances.inr_balance < amount) {
        throw new Error('Insufficient INR balance');
      }

      const newInrBalance = currentBalances.inr_balance - amount;

      // Create WITHDRAW_INR transaction
      const [transactionResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'WITHDRAW_INR', amount, 0, 0, newInrBalance, currentBalances.btc_balance]
      );

      return { transactionId: transactionResult.insertId, newInrBalance, btcBalance: currentBalances.btc_balance };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'INR withdrawn successfully',
      data: {
        transaction_id: result.transactionId,
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

    // Check if user exists
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      // Get current balances
      const [balanceRows] = await connection.execute(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User has no transactions');
      }

      const currentBalances = balanceRows[0];
      const btcAmountSatoshi = Math.round(amount * 100000000); // Convert BTC to satoshi
      const newBtcBalance = currentBalances.btc_balance + btcAmountSatoshi;

      // Get current BTC price for INR amount calculation
      const rates = await bitcoinDataService.getCalculatedRates();
      const inrAmount = Math.round(amount * rates.sellRate); // Use sell rate for internal calculations

      // Create DEPOSIT_BTC transaction
      const [transactionResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_BTC', inrAmount, btcAmountSatoshi, rates.sellRate, currentBalances.inr_balance, newBtcBalance]
      );

      return { 
        transactionId: transactionResult.insertId, 
        newBtcBalance, 
        inrBalance: currentBalances.inr_balance,
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
        transaction_id: result.transactionId,
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

    const result = await transaction(async (connection) => {
      // Get current balances
      const [balanceRows] = await connection.execute(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User has no transactions');
      }

      const currentBalances = balanceRows[0];
      const btcAmountSatoshi = Math.round(amount * 100000000); // Convert BTC to satoshi
      
      if (currentBalances.btc_balance < btcAmountSatoshi) {
        throw new Error('Insufficient BTC balance');
      }

      const newBtcBalance = currentBalances.btc_balance - btcAmountSatoshi;

      // Get current BTC price for INR amount calculation
      const rates = await bitcoinDataService.getCalculatedRates();
      const inrAmount = Math.round(amount * rates.sellRate); // Use sell rate for internal calculations

      // Create WITHDRAW_BTC transaction
      const [transactionResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'WITHDRAW_BTC', inrAmount, btcAmountSatoshi, rates.sellRate, currentBalances.inr_balance, newBtcBalance]
      );

      return { 
        transactionId: transactionResult.insertId, 
        newBtcBalance, 
        inrBalance: currentBalances.inr_balance,
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
        transaction_id: result.transactionId,
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

// Update system settings (buy/sell multipliers)
router.patch('/settings', async (req, res) => {
  try {
    const { buy_multiplier, sell_multiplier } = req.body;

    if (!buy_multiplier && !sell_multiplier) {
      return res.status(400).json({
        success: false,
        message: 'At least one multiplier must be provided'
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

// External buy transaction (creates DEPOSIT_INR and BUY transactions)
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
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const result = await transaction(async (connection) => {
      // Get current balances
      const [balanceRows] = await connection.execute(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User has no transactions');
      }

      const currentBalances = balanceRows[0];
      
      // Calculate BTC price from INR and BTC amounts
      const btcPrice = inrAmount / btcAmount;
      const btcAmountSatoshi = Math.round(btcAmount * 100000000); // Convert BTC to satoshi
      
      // Create deposit timestamp (a few seconds earlier)
      const depositTime = new Date(Date.now() - 5000); // 5 seconds earlier
      
      // Create DEPOSIT_INR transaction first
      const newInrBalanceAfterDeposit = currentBalances.inr_balance + inrAmount;
      const [depositResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, 'DEPOSIT_INR', inrAmount, 0, 0, newInrBalanceAfterDeposit, currentBalances.btc_balance, depositTime]
      );
      
      // Create BUY transaction (current time)
      const newInrBalanceAfterBuy = newInrBalanceAfterDeposit - inrAmount;
      const newBtcBalanceAfterBuy = currentBalances.btc_balance + btcAmountSatoshi;
      const [buyResult] = await connection.execute(
        'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'BUY', inrAmount, btcAmountSatoshi, btcPrice, newInrBalanceAfterBuy, newBtcBalanceAfterBuy]
      );

      return {
        depositTransactionId: depositResult.insertId,
        buyTransactionId: buyResult.insertId,
        inrAmount,
        btcAmount,
        btcPrice,
        finalBalances: {
          inr: newInrBalanceAfterBuy,
          btc: newBtcBalanceAfterBuy
        }
      };
    });

    // Clear user cache
    await clearUserCache(userId);

    res.json({
      success: true,
      message: 'External buy transaction created successfully',
      data: {
        deposit_transaction_id: result.depositTransactionId,
        buy_transaction_id: result.buyTransactionId,
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

    const transactions = await query(`
      SELECT 
        t.id, t.user_id, t.type, t.inr_amount, t.btc_amount, t.btc_price,
        t.inr_balance, t.btc_balance, t.created_at,
        u.email, u.name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const formattedTransactions = transactions.map(transaction => ({
      ...transaction,
      btc_amount: transaction.btc_amount / 100000000,
      btc_balance: transaction.btc_balance / 100000000
    }));

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
    console.error('Get all transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
});

module.exports = router;
