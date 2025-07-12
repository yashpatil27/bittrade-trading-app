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

      // Get current balances from users table (new schema)
      const users = await query(
        'SELECT available_inr as inr_balance, available_btc as btc_balance FROM users WHERE id = ?',
        [userId]
      );

      let balances = {
        inr_balance: 0,
        btc_balance: 0
      };

      if (users.length > 0) {
        balances = users[0];
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

      // Get recent operations (including pending limit orders)
      const operations = await query(
        `SELECT id, type, status, inr_amount, btc_amount, execution_price, limit_price, loan_id, notes, executed_at, created_at FROM operations WHERE user_id = ? ORDER BY id DESC LIMIT ${parseInt(limit)}`,
        [userId]
      );

      // Format transactions (removed balance fields since we're not storing historical snapshots)
      const transactions = operations.map(op => ({
        ...op,
        // Use limit_price for pending orders, execution_price for executed orders
        btc_price: op.status === 'PENDING' ? op.limit_price : op.execution_price
      }));

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
      // Get operations (including pending limit orders)
      const operations = await query(
        `SELECT id, type, status, inr_amount, btc_amount, execution_price, limit_price, loan_id, notes, executed_at, created_at FROM operations WHERE user_id = ? ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        [userId]
      );
      
      // Format transactions (removed balance fields since we're not storing historical snapshots)
      const transactions = operations.map(op => ({
        ...op,
        // Use limit_price for pending orders, execution_price for executed orders
        btc_price: op.status === 'PENDING' ? op.limit_price : op.execution_price
      }));
      
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
        // Get current balances using users table
        const [userRows] = await connection.execute(
          'SELECT available_inr, available_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_inr < inrAmount) {
          throw new Error('Insufficient INR balance');
        }

        // Get current rates
        const rates = await bitcoinDataService.getCalculatedRates();
        const btcAmount = Math.floor((inrAmount / rates.buyRate) * 100000000); // Convert to satoshis

        if (btcAmount <= 0) {
          throw new Error('BTC amount too small');
        }

        const newInrBalance = currentBalances.available_inr - inrAmount;
        const newBtcBalance = currentBalances.available_btc + btcAmount;

        // Update balances in users table
        await connection.execute(
          'UPDATE users SET available_inr = ?, available_btc = ? WHERE id = ?',
          [newInrBalance, newBtcBalance, userId]
        );

        // Create operation entry
        const [result] = await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'MARKET_BUY', 'EXECUTED', inrAmount, btcAmount, rates.buyRate]
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
        // Get current balances using users table
        const [userRows] = await connection.execute(
          'SELECT available_inr, available_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_btc < btcAmount) {
          throw new Error('Insufficient BTC balance');
        }

        // Get current rates
        const rates = await bitcoinDataService.getCalculatedRates();
        const inrAmount = Math.floor((btcAmount / 100000000) * rates.sellRate); // Convert from satoshis

        if (inrAmount <= 0) {
          throw new Error('INR amount too small');
        }

        const newInrBalance = currentBalances.available_inr + inrAmount;
        const newBtcBalance = currentBalances.available_btc - btcAmount;

        // Update balances in users table
        await connection.execute(
          'UPDATE users SET available_inr = ?, available_btc = ? WHERE id = ?',
          [newInrBalance, newBtcBalance, userId]
        );

        // Create operation entry
        const [result] = await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'MARKET_SELL', 'EXECUTED', inrAmount, btcAmount, rates.sellRate]
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

  async placeLimitBuyOrder(userId, inrAmount, targetPrice) {
    try {
      if (inrAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (targetPrice <= 0) {
        throw new Error('Target price must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get current balances
        const [userRows] = await connection.execute(
          'SELECT available_inr, available_btc, reserved_inr FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_inr < inrAmount) {
          throw new Error('Insufficient INR balance');
        }

        // Get current market price for validation
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Prevent placing buy orders too far above market price (protection)
        if (targetPrice > rates.buyRate * 1.5) {
          throw new Error('Target price too high');
        }

        // Calculate estimated BTC amount
        const estimatedBtc = Math.floor((inrAmount / targetPrice) * 100000000); // Convert to satoshis

        if (estimatedBtc <= 0) {
          throw new Error('Estimated BTC amount too small');
        }

        // Move INR from available to reserved
        const newAvailableInr = currentBalances.available_inr - inrAmount;
        const newReservedInr = currentBalances.reserved_inr + inrAmount;

        // Update balances
        await connection.execute(
          'UPDATE users SET available_inr = ?, reserved_inr = ? WHERE id = ?',
          [newAvailableInr, newReservedInr, userId]
        );

        // Create limit buy operation with 24-hour expiration
        const [result] = await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, limit_price, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
          [userId, 'LIMIT_BUY', 'PENDING', inrAmount, estimatedBtc, targetPrice]
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          orderId: result.insertId,
          inrAmount,
          targetPrice,
          estimatedBtc,
          newAvailableBalance: newAvailableInr,
          currentBtcBalance: currentBalances.available_btc
        };
      });
    } catch (error) {
      console.error('Error placing limit buy order:', error);
      throw error;
    }
  }

  async placeLimitSellOrder(userId, btcAmount, targetPrice) {
    try {
      if (btcAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (targetPrice <= 0) {
        throw new Error('Target price must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get current balances
        const [userRows] = await connection.execute(
          'SELECT available_inr, available_btc, reserved_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_btc < btcAmount) {
          throw new Error('Insufficient BTC balance');
        }

        // Get current market price for validation
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Prevent placing sell orders too far below market price (protection)
        if (targetPrice < rates.sellRate * 0.5) {
          throw new Error('Target price too low');
        }

        // Calculate estimated INR amount
        const estimatedInr = Math.floor((btcAmount / 100000000) * targetPrice);

        if (estimatedInr <= 0) {
          throw new Error('Estimated INR amount too small');
        }

        // Move BTC from available to reserved
        const newAvailableBtc = currentBalances.available_btc - btcAmount;
        const newReservedBtc = currentBalances.reserved_btc + btcAmount;

        // Update balances
        await connection.execute(
          'UPDATE users SET available_btc = ?, reserved_btc = ? WHERE id = ?',
          [newAvailableBtc, newReservedBtc, userId]
        );

        // Create limit sell operation with 24-hour expiration
        const [result] = await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, limit_price, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
          [userId, 'LIMIT_SELL', 'PENDING', estimatedInr, btcAmount, targetPrice]
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          orderId: result.insertId,
          btcAmount,
          targetPrice,
          estimatedInr,
          newAvailableBalance: newAvailableBtc,
          currentInrBalance: currentBalances.available_inr
        };
      });
    } catch (error) {
      console.error('Error placing limit sell order:', error);
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
      status: transaction.status || 'EXECUTED', // Default to EXECUTED for backward compatibility
      inr_amount: transaction.inr_amount,
      btc_amount: transaction.btc_amount / 100000000, // Convert satoshis to BTC
      btc_price: transaction.btc_price,
      execution_price: transaction.execution_price,
      loan_id: transaction.loan_id,
      notes: transaction.notes,
      executed_at: transaction.executed_at,
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

      // Get all operations
      const operations = await query(
        'SELECT * FROM operations WHERE user_id = ? AND status = "EXECUTED" ORDER BY created_at ASC',
        [userId]
      );

      // Format as CSV
      const csvHeader = 'Date,Type,INR Amount,BTC Amount (Satoshis),Execution Price\n';
      
      const csvRows = operations.map(op => {
        const date = new Date(op.created_at).toISOString();
        return `${date},${op.type},${op.inr_amount},${op.btc_amount},${op.execution_price || ''}`;
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

  async createDcaBuyPlan(userId, planConfig) {
    const {
      amountPerExecution,
      frequency,
      totalExecutions,
      maxPrice,
      minPrice
    } = planConfig;

    // Validate price limits
    if (maxPrice && minPrice && maxPrice <= minPrice) {
      throw new Error('Invalid price limits');
    }

    try {
      return await transaction(async (connection) => {  
        const [userRows] = await connection.execute(
          'SELECT available_inr FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];

        // Check if user has enough balance for at least one execution
        if (currentBalances.available_inr < amountPerExecution) {
          throw new Error('Insufficient INR balance for DCA plan');
        }

        const nextExecutionAt = new Date();
        if (frequency === 'HOURLY') {
          nextExecutionAt.setHours(nextExecutionAt.getHours() + 1);
        } else if (frequency === 'DAILY') {
          nextExecutionAt.setDate(nextExecutionAt.getDate() + 1);
        } else if (frequency === 'WEEKLY') {
          nextExecutionAt.setDate(nextExecutionAt.getDate() + 7);
        } else if (frequency === 'MONTHLY') {
          nextExecutionAt.setMonth(nextExecutionAt.getMonth() + 1);
        }

        const [result] = await connection.execute(
          'INSERT INTO active_plans (user_id, plan_type, status, frequency, amount_per_execution, next_execution_at, remaining_executions, max_price, min_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userId, 
            'DCA_BUY', 
            'ACTIVE', 
            frequency, 
            amountPerExecution, 
            nextExecutionAt, 
            totalExecutions || null, 
            maxPrice || null, 
            minPrice || null
          ]
        );

        await clearUserCache(userId);

        return {
          planId: result.insertId,
          amountPerExecution,
          frequency,
          nextExecutionAt,
        };
      });
    } catch (error) {
      console.error('Error creating DCA buy plan:', error);
      throw error;
    }
  }

  async createDcaSellPlan(userId, planConfig) {
    const {
      amountPerExecution,
      frequency,
      totalExecutions,
      maxPrice,
      minPrice
    } = planConfig;

    // Validate price limits
    if (maxPrice && minPrice && maxPrice <= minPrice) {
      throw new Error('Invalid price limits');
    }

    try {
      return await transaction(async (connection) => {  
        const [userRows] = await connection.execute(
          'SELECT available_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];

        // Check if user has enough balance for at least one execution
        if (currentBalances.available_btc < amountPerExecution) {
          throw new Error('Insufficient BTC balance for DCA plan');
        }

        const nextExecutionAt = new Date();
        if (frequency === 'HOURLY') {
          nextExecutionAt.setHours(nextExecutionAt.getHours() + 1);
        } else if (frequency === 'DAILY') {
          nextExecutionAt.setDate(nextExecutionAt.getDate() + 1);
        } else if (frequency === 'WEEKLY') {
          nextExecutionAt.setDate(nextExecutionAt.getDate() + 7);
        } else if (frequency === 'MONTHLY') {
          nextExecutionAt.setMonth(nextExecutionAt.getMonth() + 1);
        }

        const [result] = await connection.execute(
          'INSERT INTO active_plans (user_id, plan_type, status, frequency, amount_per_execution, next_execution_at, remaining_executions, max_price, min_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userId, 
            'DCA_SELL', 
            'ACTIVE', 
            frequency, 
            amountPerExecution, 
            nextExecutionAt, 
            totalExecutions || null, 
            maxPrice || null, 
            minPrice || null
          ]
        );

        await clearUserCache(userId);

        return {
          planId: result.insertId,
          amountPerExecution,
          frequency,
          nextExecutionAt,
        };
      });
    } catch (error) {
      console.error('Error creating DCA sell plan:', error);
      throw error;
    }
  }
}

// Export singleton instance
const userService = new UserService();
module.exports = userService;
