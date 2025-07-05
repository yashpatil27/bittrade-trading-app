const { query, transaction } = require('../config/database');
const { setCache, getCache, clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');

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
        const rates = await bitcoinDataService.getCalculatedRates();
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
        const rates = await bitcoinDataService.getCalculatedRates();
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

  async updateUserProfile(userId, { name, email, currentPassword }) {
    try {
      return await transaction(async (connection) => {
        // Get current user
        const [userRows] = await connection.execute(
          'SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const user = userRows[0];

        // Verify current password
        const bcrypt = require('bcryptjs');
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
          throw new Error('Invalid current password');
        }

        // Prepare update data
        const updateData = {};
        const updateFields = [];
        const updateValues = [];

        if (name && name !== user.name) {
          updateData.name = name;
          updateFields.push('name = ?');
          updateValues.push(name);
        }

        if (email && email !== user.email) {
          // Check if email already exists
          const [emailCheckRows] = await connection.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email.toLowerCase(), userId]
          );

          if (emailCheckRows.length > 0) {
            throw new Error('Email already exists');
          }

          updateData.email = email.toLowerCase();
          updateFields.push('email = ?');
          updateValues.push(email.toLowerCase());
        }

        // Update user if there are changes
        if (updateFields.length > 0) {
          updateValues.push(userId);
          await connection.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
          );
        }

        return {
          id: user.id,
          name: updateData.name || user.name,
          email: updateData.email || user.email,
          is_admin: user.is_admin
        };
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async changeUserPassword(userId, currentPassword, newPassword) {
    try {
      return await transaction(async (connection) => {
        // Get current user
        const [userRows] = await connection.execute(
          'SELECT id, password_hash FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const user = userRows[0];

        // Verify current password
        const bcrypt = require('bcryptjs');
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
          throw new Error('Invalid current password');
        }

        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await connection.execute(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [hashedPassword, userId]
        );

        return { success: true };
      });
    } catch (error) {
      console.error('Error changing user password:', error);
      throw error;
    }
  }

  async verifyPin(userId, pin) {
    try {
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        throw new Error('PIN must be exactly 4 digits');
      }

      const userRows = await query(
        'SELECT user_pin FROM users WHERE id = ?',
        [userId]
      );

      if (userRows.length === 0) {
        throw new Error('User not found');
      }

      return userRows[0].user_pin === pin;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      throw error;
    }
  }

  async changeUserPin(userId, newPin, currentPassword) {
    try {
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        throw new Error('PIN must be exactly 4 digits');
      }

      return await transaction(async (connection) => {
        // Get current user
        const [userRows] = await connection.execute(
          'SELECT id, password_hash FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const user = userRows[0];

        // Verify current password
        const bcrypt = require('bcryptjs');
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
          throw new Error('Invalid current password');
        }

        // Update PIN
        await connection.execute(
          'UPDATE users SET user_pin = ? WHERE id = ?',
          [newPin, userId]
        );

        return { success: true };
      });
    } catch (error) {
      console.error('Error changing user PIN:', error);
      throw error;
    }
  }

  async exportUserData(userId) {
    try {
      // Get user info
      const userRows = await query(
        'SELECT email, name, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (userRows.length === 0) {
        throw new Error('User not found');
      }

      const user = userRows[0];

      // Get all transactions
      const transactions = await query(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at ASC',
        [userId]
      );

      // Format as CSV
      const csvHeader = 'Date,Type,INR Amount,BTC Amount (Satoshis),BTC Price,INR Balance,BTC Balance (Satoshis)\n';
      
      const csvRows = transactions.map(tx => {
        const date = new Date(tx.created_at).toISOString();
        return `${date},${tx.type},${tx.inr_amount},${tx.btc_amount},${tx.btc_price},${tx.inr_balance},${tx.btc_balance}`;
      }).join('\n');

      const csvData = `# ₿itTrade Data Export\n`
        + `# User: ${user?.name || 'Unknown'} (${user?.email || 'Unknown'})\n`
        + `# Account Created: ${user?.created_at ? new Date(user.created_at).toISOString() : 'Unknown'}\n`
        + `# Export Date: ${new Date().toISOString()}\n`
        + `#\n`
        + csvHeader
        + csvRows;

      return csvData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }
}

// Export singleton instance
const userService = new UserService();
module.exports = userService;
