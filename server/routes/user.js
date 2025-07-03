const express = require('express');
const { verifyToken } = require('../middleware/auth');
const userService = require('../services/userService');
const priceService = require('../services/priceService');
const portfolioService = require('../services/portfolioService');

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
      priceService.getCalculatedRates(),
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
    const rates = await priceService.getCalculatedRates();

    res.json({
      success: true,
      data: {
        btc_usd: rates.btcUsdPrice,
        buy_rate: rates.buyRate,
        sell_rate: rates.sellRate,
        buy_multiplier: rates.buyMultiplier,
        sell_multiplier: rates.sellMultiplier,
        last_update: rates.lastUpdate
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
