const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');

/**
 * LoanService - Manages Bitcoin-backed loans with collateral management
 */
const LoanService = {
  /**
   * Deposit BTC as collateral and create loan facility
   * @param {number} userId - ID of the user
   * @param {number} collateralAmount - Amount of BTC in satoshis
   * @param {number} ltvRatio - Loan-to-value ratio (e.g., 60.00 for 60%)
   * @param {number} interestRate - Annual interest rate (e.g., 12.00 for 12%)
   * @returns {Promise} - Resolves with loan details
   */
  async depositCollateral(userId, collateralAmount, ltvRatio = 60.00, interestRate = 12.00) {
    try {
      if (collateralAmount <= 0) {
        throw new Error('Collateral amount must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get current user balances
        const [userRows] = await connection.execute(
          'SELECT available_btc, collateral_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_btc < collateralAmount) {
          throw new Error('Insufficient BTC balance');
        }

        // Get current BTC price for liquidation calculation
        const rates = await bitcoinDataService.getCalculatedRates();
        const liquidationPrice = Math.floor(rates.btcUsdPrice * (ltvRatio / 90)); // 90% LTV triggers liquidation

        // Update user balances - move BTC from available to collateral
        await connection.execute(
          'UPDATE users SET available_btc = available_btc - ?, collateral_btc = collateral_btc + ? WHERE id = ?',
          [collateralAmount, collateralAmount, userId]
        );

        // Create loan entry
        const [loanResult] = await connection.execute(
          `INSERT INTO loans (user_id, btc_collateral_amount, inr_borrowed_amount, ltv_ratio, interest_rate, liquidation_price, status) 
           VALUES (?, ?, 0, ?, ?, ?, 'ACTIVE')`,
          [userId, collateralAmount, ltvRatio, interestRate, liquidationPrice]
        );

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, btc_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'LOAN_CREATE', 'EXECUTED', collateralAmount, loanResult.insertId, 'Collateral deposit for loan facility']
        );

        // Clear user cache
        await clearUserCache(userId);

        // Calculate max borrowable amount
        const maxBorrowable = Math.floor((collateralAmount * rates.btcUsdPrice * ltvRatio) / (100 * 100000000));

        return {
          loanId: loanResult.insertId,
          collateralAmount,
          maxBorrowable,
          ltvRatio,
          interestRate,
          liquidationPrice,
          currentBtcPrice: rates.btcUsdPrice
        };
      });
    } catch (error) {
      console.error('Error depositing collateral:', error);
      throw error;
    }
  },

  /**
   * Borrow INR against existing collateral
   * @param {number} userId - ID of the user
   * @param {number} borrowAmount - Amount of INR to borrow
   * @returns {Promise} - Resolves with borrowing details
   */
  async borrowFunds(userId, borrowAmount) {
    try {
      if (borrowAmount <= 0) {
        throw new Error('Borrow amount must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get active loan for user
        const [loanRows] = await connection.execute(
          'SELECT * FROM loans WHERE user_id = ? AND status = "ACTIVE"',
          [userId]
        );

        if (loanRows.length === 0) {
          throw new Error('No active loan found. Please deposit collateral first.');
        }

        const loan = loanRows[0];
        
        // Get current BTC price
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Calculate available borrowing capacity
        const maxBorrowable = Math.floor((loan.btc_collateral_amount * rates.btcUsdPrice * loan.ltv_ratio) / (100 * 100000000));
        const availableCapacity = maxBorrowable - loan.inr_borrowed_amount;

        if (borrowAmount > availableCapacity) {
          throw new Error(`Insufficient borrowing capacity. Available: ₹${availableCapacity}`);
        }

        // Get current user balances
        const [userRows] = await connection.execute(
          'SELECT available_inr, borrowed_inr FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        // Update user balances
        await connection.execute(
          'UPDATE users SET available_inr = available_inr + ?, borrowed_inr = borrowed_inr + ? WHERE id = ?',
          [borrowAmount, borrowAmount, userId]
        );

        // Update loan amount
        await connection.execute(
          'UPDATE loans SET inr_borrowed_amount = inr_borrowed_amount + ? WHERE id = ?',
          [borrowAmount, loan.id]
        );

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'LOAN_BORROW', 'EXECUTED', borrowAmount, loan.id, 'Borrowing from loan facility']
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          loanId: loan.id,
          borrowAmount,
          newBorrowedTotal: loan.inr_borrowed_amount + borrowAmount,
          availableCapacity: availableCapacity - borrowAmount,
          currentBtcPrice: rates.btcUsdPrice
        };
      });
    } catch (error) {
      console.error('Error borrowing funds:', error);
      throw error;
    }
  },

  /**
   * Repay borrowed INR
   * @param {number} userId - ID of the user
   * @param {number} repayAmount - Amount of INR to repay
   * @returns {Promise} - Resolves with repayment details
   */
  async repayLoan(userId, repayAmount) {
    try {
      if (repayAmount <= 0) {
        throw new Error('Repay amount must be greater than 0');
      }

      return await transaction(async (connection) => {
        // Get active loan for user
        const [loanRows] = await connection.execute(
          'SELECT * FROM loans WHERE user_id = ? AND status = "ACTIVE"',
          [userId]
        );

        if (loanRows.length === 0) {
          throw new Error('No active loan found');
        }

        const loan = loanRows[0];
        
        if (repayAmount > loan.inr_borrowed_amount) {
          throw new Error('Repay amount exceeds borrowed amount');
        }

        // Get current user balances
        const [userRows] = await connection.execute(
          'SELECT available_inr, borrowed_inr FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_inr < repayAmount) {
          throw new Error('Insufficient INR balance');
        }

        // Update user balances
        await connection.execute(
          'UPDATE users SET available_inr = available_inr - ?, borrowed_inr = borrowed_inr - ? WHERE id = ?',
          [repayAmount, repayAmount, userId]
        );

        // Update loan amount
        const newBorrowedAmount = loan.inr_borrowed_amount - repayAmount;
        await connection.execute(
          'UPDATE loans SET inr_borrowed_amount = ? WHERE id = ?',
          [newBorrowedAmount, loan.id]
        );

        // If fully repaid, update loan status and return collateral
        if (newBorrowedAmount === 0) {
          await connection.execute(
            'UPDATE loans SET status = "REPAID", repaid_at = NOW() WHERE id = ?',
            [loan.id]
          );

          // Return collateral to available BTC
          await connection.execute(
            'UPDATE users SET available_btc = available_btc + ?, collateral_btc = collateral_btc - ? WHERE id = ?',
            [loan.btc_collateral_amount, loan.btc_collateral_amount, userId]
          );
        }

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'LOAN_REPAY', 'EXECUTED', repayAmount, loan.id, newBorrowedAmount === 0 ? 'Complete loan repayment and collateral release' : 'Partial loan repayment']
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          loanId: loan.id,
          repayAmount,
          remainingDebt: newBorrowedAmount,
          loanStatus: newBorrowedAmount === 0 ? 'REPAID' : 'ACTIVE',
          collateralReturned: newBorrowedAmount === 0 ? loan.btc_collateral_amount : 0
        };
      });
    } catch (error) {
      console.error('Error repaying loan:', error);
      throw error;
    }
  },

  /**
   * Get loan status for a user
   * @param {number} userId - ID of the user
   * @returns {Promise} - Resolves with loan status
   */
  async getLoanStatus(userId) {
    try {
      const loanRows = await query(
        `SELECT l.*, u.borrowed_inr, u.interest_accrued, u.collateral_btc
         FROM loans l 
         JOIN users u ON l.user_id = u.id 
         WHERE l.user_id = ? AND l.status = 'ACTIVE'`,
        [userId]
      );

      if (loanRows.length === 0) {
        return null;
      }

      const loan = loanRows[0];
      
      // Get current BTC price
      const rates = await bitcoinDataService.getCalculatedRates();
      
      // Calculate available borrowing capacity
      const maxBorrowable = Math.floor((loan.btc_collateral_amount * rates.btcUsdPrice * loan.ltv_ratio) / (100 * 100000000));
      const availableCapacity = maxBorrowable - loan.inr_borrowed_amount;
      
      // Calculate current LTV
      const currentLtv = (loan.inr_borrowed_amount / ((loan.btc_collateral_amount * rates.btcUsdPrice) / 100000000)) * 100;
      
      return {
        loanId: loan.id,
        collateralAmount: loan.btc_collateral_amount,
        borrowedAmount: loan.inr_borrowed_amount,
        interestRate: loan.interest_rate,
        ltvRatio: loan.ltv_ratio,
        liquidationPrice: loan.liquidation_price,
        maxBorrowable,
        availableCapacity,
        currentLtv,
        currentBtcPrice: rates.btcUsdPrice,
        riskStatus: currentLtv >= 90 ? 'LIQUIDATE' : currentLtv >= 85 ? 'WARNING' : 'SAFE'
      };
    } catch (error) {
      console.error('Error getting loan status:', error);
      throw error;
    }
  },

  /**
   * Accrue daily interest on all active loans
   * @returns {Promise} - Resolves with accrual results
   */
  async accrueInterest() {
    try {
      const activeLoans = await query(
        'SELECT * FROM loans WHERE status = "ACTIVE" AND inr_borrowed_amount > 0'
      );

      const results = [];
      
      for (const loan of activeLoans) {
        // Calculate daily interest: (borrowed_amount * interest_rate) / 365
        const dailyInterest = Math.floor((loan.inr_borrowed_amount * loan.interest_rate) / 365 / 100);
        
        if (dailyInterest > 0) {
          await transaction(async (connection) => {
            // Update user balances
            await connection.execute(
              'UPDATE users SET borrowed_inr = borrowed_inr + ?, interest_accrued = interest_accrued + ? WHERE id = ?',
              [dailyInterest, dailyInterest, loan.user_id]
            );

            // Update loan amount
            await connection.execute(
              'UPDATE loans SET inr_borrowed_amount = inr_borrowed_amount + ? WHERE id = ?',
              [dailyInterest, loan.id]
            );

            // Record the operation
            await connection.execute(
              'INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
              [loan.user_id, 'INTEREST_ACCRUAL', 'EXECUTED', dailyInterest, loan.id, 'Daily interest accrual']
            );
          });

          results.push({
            loanId: loan.id,
            userId: loan.user_id,
            interestAccrued: dailyInterest,
            newBorrowedAmount: loan.inr_borrowed_amount + dailyInterest
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error accruing interest:', error);
      throw error;
    }
  },

  /**
   * Execute partial liquidation for a loan
   * @param {number} loanId - ID of the loan to liquidate
   * @returns {Promise} - Resolves with liquidation details
   */
  async executePartialLiquidation(loanId) {
    try {
      return await transaction(async (connection) => {
        // Get loan details
        const [loanRows] = await connection.execute(
          'SELECT * FROM loans WHERE id = ? AND status = "ACTIVE"',
          [loanId]
        );

        if (loanRows.length === 0) {
          throw new Error('Active loan not found');
        }

        const loan = loanRows[0];
        
        // Get current BTC price
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Calculate BTC to sell to restore 60% LTV
        const targetLtv = 0.60;
        const currentCollateralValue = (loan.btc_collateral_amount * rates.btcUsdPrice) / 100000000;
        const targetBorrowAmount = currentCollateralValue * targetLtv;
        const excessDebt = loan.inr_borrowed_amount - targetBorrowAmount;
        
        if (excessDebt <= 0) {
          throw new Error('No liquidation needed - LTV is within limits');
        }

        // Calculate BTC to sell (add small buffer for slippage)
        const btcToSell = Math.ceil((excessDebt * 1.02 * 100000000) / rates.btcUsdPrice);
        const inrFromSale = Math.floor((btcToSell * rates.sellRate) / 100000000);
        const debtReduction = Math.min(inrFromSale, loan.inr_borrowed_amount);
        const remainingInr = inrFromSale - debtReduction;

        // Update user balances
        await connection.execute(
          'UPDATE users SET borrowed_inr = borrowed_inr - ?, interest_accrued = 0, collateral_btc = collateral_btc - ?, available_inr = available_inr + ? WHERE id = ?',
          [debtReduction, btcToSell, remainingInr, loan.user_id]
        );

        // Update loan
        const newBorrowedAmount = loan.inr_borrowed_amount - debtReduction;
        const newCollateralAmount = loan.btc_collateral_amount - btcToSell;
        
        await connection.execute(
          'UPDATE loans SET inr_borrowed_amount = ?, btc_collateral_amount = ? WHERE id = ?',
          [newBorrowedAmount, newCollateralAmount, loan.id]
        );

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
          [loan.user_id, 'PARTIAL_LIQUIDATION', 'EXECUTED', debtReduction, btcToSell, loan.id, 'Partial liquidation - LTV reduced from 90% to 60%']
        );

        return {
          loanId: loan.id,
          btcSold: btcToSell,
          inrFromSale,
          debtReduction,
          remainingInr,
          newBorrowedAmount,
          newCollateralAmount,
          newLtv: (newBorrowedAmount / ((newCollateralAmount * rates.btcUsdPrice) / 100000000)) * 100
        };
      });
    } catch (error) {
      console.error('Error executing partial liquidation:', error);
      throw error;
    }
  },

  /**
   * Execute full liquidation for a loan
   * @param {number} userId - ID of the user
   * @returns {Promise} - Resolves with liquidation details
   */
  async executeFullLiquidation(userId) {
    try {
      return await transaction(async (connection) => {
        // Get active loan
        const [loanRows] = await connection.execute(
          'SELECT * FROM loans WHERE user_id = ? AND status = "ACTIVE"',
          [userId]
        );

        if (loanRows.length === 0) {
          throw new Error('No active loan found');
        }

        const loan = loanRows[0];
        
        // Get current BTC price
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Calculate BTC to sell to cover entire debt
        const btcToSell = Math.ceil((loan.inr_borrowed_amount * 100000000) / rates.sellRate);
        const remainingCollateral = loan.btc_collateral_amount - btcToSell;
        
        if (remainingCollateral < 0) {
          throw new Error('Insufficient collateral for full liquidation');
        }

        // Update user balances
        await connection.execute(
          'UPDATE users SET borrowed_inr = 0, interest_accrued = 0, collateral_btc = 0, available_btc = available_btc + ? WHERE id = ?',
          [remainingCollateral, userId]
        );

        // Update loan status
        await connection.execute(
          'UPDATE loans SET inr_borrowed_amount = 0, btc_collateral_amount = 0, status = "REPAID", repaid_at = NOW() WHERE id = ?',
          [loan.id]
        );

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'FULL_LIQUIDATION', 'EXECUTED', loan.inr_borrowed_amount, btcToSell, loan.id, 'Manual full liquidation - loan repaid, remaining collateral returned']
        );

        return {
          loanId: loan.id,
          btcSold: btcToSell,
          debtCleared: loan.inr_borrowed_amount,
          collateralReturned: remainingCollateral,
          loanStatus: 'REPAID'
        };
      });
    } catch (error) {
      console.error('Error executing full liquidation:', error);
      throw error;
    }
  },

  /**
   * Get loan history for a user
   * @param {number} userId - ID of the user
   * @param {number} loanId - ID of the loan (optional)
   * @returns {Promise} - Resolves with loan history
   */
  async getLoanHistory(userId, loanId = null) {
    try {
      let query_str = `
        SELECT type, inr_amount, btc_amount, notes, created_at, executed_at
        FROM operations 
        WHERE user_id = ? AND type IN ('LOAN_CREATE', 'LOAN_BORROW', 'LOAN_REPAY', 'INTEREST_ACCRUAL', 'PARTIAL_LIQUIDATION', 'FULL_LIQUIDATION')
      `;
      let params = [userId];
      
      if (loanId) {
        query_str += ' AND loan_id = ?';
        params.push(loanId);
      }
      
      query_str += ' ORDER BY created_at DESC';
      
      const history = await query(query_str, params);
      
      return history;
    } catch (error) {
      console.error('Error getting loan history:', error);
      throw error;
    }
  },

  /**
   * Check loans at risk of liquidation
   * @returns {Promise} - Resolves with at-risk loans
   */
  async checkLiquidationRisk() {
    try {
      const rates = await bitcoinDataService.getCalculatedRates();
      
      const atRiskLoans = await query(`
        SELECT 
          l.id,
          l.user_id,
          l.btc_collateral_amount,
          l.inr_borrowed_amount,
          l.liquidation_price,
          ${rates.btcUsdPrice} as current_btc_price,
          (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.btcUsdPrice} / 100000000)) * 100 as current_ltv,
          CASE 
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.btcUsdPrice} / 100000000)) >= 0.90 THEN 'LIQUIDATE'
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.btcUsdPrice} / 100000000)) >= 0.85 THEN 'WARNING'
            ELSE 'SAFE'
          END as risk_status
        FROM loans l 
        WHERE l.status = 'ACTIVE' AND l.inr_borrowed_amount > 0
        HAVING risk_status IN ('LIQUIDATE', 'WARNING')
        ORDER BY current_ltv DESC
      `);
      
      return atRiskLoans;
    } catch (error) {
      console.error('Error checking liquidation risk:', error);
      throw error;
    }
  }
};

module.exports = LoanService;

