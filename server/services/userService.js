const { query, transaction } = require('../config/database');
const { setCache, getCache, clearUserCache } = require('../config/redis');
const priceService = require('./priceService');

class UserService {
  async getUserBalances(userId) {
    try {
      // Try cache first
      const cacheKey = `user:${userId}:balances`;
      const cachedBalances = await getCache(cacheKey);
      if (cachedBalances) {
        return cachedBalances;
      }

      // Get latest transaction for user to get current balances
      const transactions = await query(
        'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );

      let balances = {
        inr_balance: 0,
        btc_balance: 0
      };

      if (transactions.length > 0) {
        balances = transactions[0];
      }

      // Cache balances for 30 seconds
      await setCache(cacheKey, balances, 30);
      
      return balances;
    } catch (error) {
      console.error('Error fetching user balances:', error);
      throw error;
    }
  }

  async getRecentTransactions(userId, limit = 5) {
    try {
      const cacheKey = `user:${userId}:recent_transactions`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return cached;
      }

      const transactions = await query(
        `SELECT id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ${parseInt(limit)}`,
        [userId]
      );

      // Cache for 30 seconds
      await setCache(cacheKey, transactions, 30);
      
      return transactions;
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  async getAllTransactions(userId, offset = 0, limit = 50) {
    try {
      const transactions = await query(
        `SELECT id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        [userId]
      );
      
      return transactions;
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      throw error;
    }
  }

  async buyBitcoin(userId, inrAmount) {
    try {
      if (inrAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get current balances
        const [balanceRows] = await connection.execute(
          'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [userId]
        );

        if (balanceRows.length === 0) {
          throw new Error('User not found or no transactions');
        }

        const currentBalances = balanceRows[0];
        
        if (currentBalances.inr_balance < inrAmount) {
          throw new Error('Insufficient INR balance');
        }

        // Get current rates
        const rates = await priceService.getCalculatedRates();
        const btcAmount = Math.floor((inrAmount / rates.buyRate) * 100000000); // Convert to satoshis

        if (btcAmount <= 0) {
          throw new Error('BTC amount too small');
        }

        const newInrBalance = currentBalances.inr_balance - inrAmount;
        const newBtcBalance = currentBalances.btc_balance + btcAmount;

        // Create BUY transaction
        const [result] = await connection.execute(
          'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, 'BUY', inrAmount, btcAmount, rates.buyRate, newInrBalance, newBtcBalance]
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          transactionId: result.insertId,
          inrAmount,
          btcAmount,
          buyRate: rates.buyRate,
          newInrBalance,
          newBtcBalance
        };
      });
    } catch (error) {
      console.error('Error buying bitcoin:', error);
      throw error;
    }
  }

  async sellBitcoin(userId, btcAmount) {
    try {
      if (btcAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get current balances
        const [balanceRows] = await connection.execute(
          'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [userId]
        );

        if (balanceRows.length === 0) {
          throw new Error('User not found or no transactions');
        }

        const currentBalances = balanceRows[0];
        
        if (currentBalances.btc_balance < btcAmount) {
          throw new Error('Insufficient BTC balance');
        }

        // Get current rates
        const rates = await priceService.getCalculatedRates();
        const inrAmount = Math.floor((btcAmount / 100000000) * rates.sellRate); // Convert from satoshis

        if (inrAmount <= 0) {
          throw new Error('INR amount too small');
        }

        const newInrBalance = currentBalances.inr_balance + inrAmount;
        const newBtcBalance = currentBalances.btc_balance - btcAmount;

        // Create SELL transaction
        const [result] = await connection.execute(
          'INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, 'SELL', inrAmount, btcAmount, rates.sellRate, newInrBalance, newBtcBalance]
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          transactionId: result.insertId,
          inrAmount,
          btcAmount,
          sellRate: rates.sellRate,
          newInrBalance,
          newBtcBalance
        };
      });
    } catch (error) {
      console.error('Error selling bitcoin:', error);
      throw error;
    }
  }

  formatBalancesForDisplay(balances) {
    return {
      inr: balances.inr_balance,
      btc: balances.btc_balance / 100000000 // Convert satoshis to BTC
    };
  }

  formatTransactionForDisplay(transaction) {
    return {
      id: transaction.id,
      type: transaction.type,
      inr_amount: transaction.inr_amount,
      btc_amount: transaction.btc_amount / 100000000, // Convert satoshis to BTC
      btc_price: transaction.btc_price,
      inr_balance: transaction.inr_balance,
      btc_balance: transaction.btc_balance / 100000000, // Convert satoshis to BTC
      created_at: transaction.created_at
    };
  }

  formatTransactionsForDisplay(transactions) {
    return transactions.map(transaction => this.formatTransactionForDisplay(transaction));
  }
}

// Export singleton instance
const userService = new UserService();
module.exports = userService;
