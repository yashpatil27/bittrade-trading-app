const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');
const settingsService = require('./settingsService');

/**
 * LoanService - Manages Bitcoin-backed loans with collateral management
 */
const LoanService = {
  /**
   * Deposit BTC as collateral and create loan facility
   * @param {number} userId - ID of the user
   * @param {number} collateralAmount - Amount of BTC in satoshis
   * @param {number} ltvRatio - Loan-to-value ratio (e.g., 60.00 for 60%)
   * @returns {Promise} - Resolves with loan details
   */
  async depositCollateral(userId, collateralAmount, ltvRatio = 60.00) {
    try {
      if (collateralAmount <= 0) {
        throw new Error('Collateral amount must be greater than 0');
      }

      // Get interest rate from settings
      const interestRate = await settingsService.getLoanInterestRate();
      
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
        // Calculate liquidation price as sell rate when LTV reaches 90%
        // At 90% LTV: loan_amount / (collateral_amount * sell_rate / 100000000) = 0.9
        // Therefore: sell_rate = (loan_amount * 100000000) / (collateral_amount * 0.9)
        // But since we don't know loan_amount yet, we'll update this after borrowing
        const liquidationPrice = 0; // Will be calculated dynamically based on actual borrowed amount

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

        // Calculate max borrowable amount using sell rate (what user would actually get)
        const maxBorrowable = Math.floor((collateralAmount * rates.sellRate * ltvRatio) / (100 * 100000000));

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
        
        // Calculate available borrowing capacity using sell rate (what user would actually get)
        const maxBorrowable = Math.floor((loan.btc_collateral_amount * rates.sellRate * loan.ltv_ratio) / (100 * 100000000));
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

        // Calculate and update liquidation price based on actual borrowed amount
        const newBorrowedAmount = loan.inr_borrowed_amount + borrowAmount;
        const liquidationSellRate = Math.floor((newBorrowedAmount * 100000000) / (loan.btc_collateral_amount * 0.9));
        await connection.execute(
          'UPDATE loans SET liquidation_price = ? WHERE id = ?',
          [liquidationSellRate, loan.id]
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
   * Calculate minimum interest due for a loan (30-day minimum policy)
   * @param {Object} loan - Loan object with created_at, borrowed_amount, and interest_rate
   * @returns {number} - Minimum interest amount in INR
   */
  async calculateMinimumInterestDue(loan) {
    try {
      // Get the original borrowed amount by finding all borrow operations
      const borrowOperations = await query(
        'SELECT SUM(inr_amount) as total_borrowed FROM operations WHERE loan_id = ? AND type = "LOAN_BORROW"',
        [loan.id]
      );
      
      const originalBorrowedAmount = borrowOperations[0]?.total_borrowed || 0;
      
      if (originalBorrowedAmount === 0) {
        return 0;
      }
      
      const loanCreatedAt = new Date(loan.created_at);
      const currentTime = new Date();
      const daysSinceCreation = Math.floor((currentTime - loanCreatedAt) / (1000 * 60 * 60 * 24));
      
      // Calculate minimum 30-day interest
      const minimumDaysToCharge = 30;
      const daysToCharge = Math.max(daysSinceCreation, minimumDaysToCharge);
      
      // Calculate interest: (original_borrowed_amount * interest_rate / 100) * days / 365
      const minimumInterest = Math.round((originalBorrowedAmount * loan.interest_rate / 100) * daysToCharge / 365);
      
      return minimumInterest;
    } catch (error) {
      console.error('Error calculating minimum interest due:', error);
      return 0;
    }
  },

  /**
   * Repay borrowed INR with 30-day minimum interest policy
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
        
        // Calculate minimum interest due (30-day minimum policy)
        const minimumInterestDue = await this.calculateMinimumInterestDue(loan);
        
        // Get original borrowed amount to calculate current interest accrued
        const borrowOperations = await query(
          'SELECT SUM(inr_amount) as total_borrowed FROM operations WHERE loan_id = ? AND type = "LOAN_BORROW"',
          [loan.id]
        );
        const originalBorrowedAmount = borrowOperations[0]?.total_borrowed || 0;
        const currentInterestAccrued = loan.inr_borrowed_amount - originalBorrowedAmount;
        
        // Calculate total amount due including minimum interest
        const interestDue = Math.max(minimumInterestDue, currentInterestAccrued);
        const totalAmountDue = originalBorrowedAmount + interestDue;
        
        if (repayAmount > totalAmountDue) {
          throw new Error(`Repay amount exceeds total amount due. Maximum repayment: ₹${totalAmountDue}`);
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

        // If repaying full amount, ensure minimum interest is collected
        let actualRepayAmount = repayAmount;
        let isFullRepayment = false;
        let additionalInterestNeeded = 0;
        
        if (repayAmount === totalAmountDue) {
          // Full repayment - ensure minimum interest is charged
          additionalInterestNeeded = Math.max(0, minimumInterestDue - currentInterestAccrued);
          
          if (additionalInterestNeeded > 0) {
            // Add the additional interest to the loan amount
            await connection.execute(
              'UPDATE loans SET inr_borrowed_amount = inr_borrowed_amount + ? WHERE id = ?',
              [additionalInterestNeeded, loan.id]
            );
            
            // Update user borrowed amount to match loan amount
            await connection.execute(
              'UPDATE users SET borrowed_inr = borrowed_inr + ?, interest_accrued = interest_accrued + ? WHERE id = ?',
              [additionalInterestNeeded, additionalInterestNeeded, userId]
            );
            
            // Record the additional interest charge
            await connection.execute(
              'INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
              [userId, 'INTEREST_ACCRUAL', 'EXECUTED', additionalInterestNeeded, loan.id, '30-day minimum interest charge applied']
            );
          }
          
          isFullRepayment = true;
        }
        
        // Update loan amount first to determine if it's fully repaid
        let newBorrowedAmount = loan.inr_borrowed_amount + additionalInterestNeeded - actualRepayAmount;
        
        // For full repayments, ensure the borrowed amount is exactly 0 (handle rounding issues)
        if (isFullRepayment || newBorrowedAmount <= 0) {
          newBorrowedAmount = 0;
        }
        
        // Update user balances - if fully repaid, set borrowed_inr to 0
        if (newBorrowedAmount === 0) {
          await connection.execute(
            'UPDATE users SET available_inr = available_inr - ?, borrowed_inr = 0 WHERE id = ?',
            [actualRepayAmount, userId]
          );
        } else {
          await connection.execute(
            'UPDATE users SET available_inr = available_inr - ?, borrowed_inr = borrowed_inr - ? WHERE id = ?',
            [actualRepayAmount, actualRepayAmount, userId]
          );
        }
        
        await connection.execute(
          'UPDATE loans SET inr_borrowed_amount = ? WHERE id = ?',
          [newBorrowedAmount, loan.id]
        );

        // Update liquidation price based on new borrowed amount
        if (newBorrowedAmount > 0) {
          const liquidationSellRate = Math.floor((newBorrowedAmount * 100000000) / (loan.btc_collateral_amount * 0.9));
          await connection.execute(
            'UPDATE loans SET liquidation_price = ? WHERE id = ?',
            [liquidationSellRate, loan.id]
          );
        }

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
          [userId, 'LOAN_REPAY', 'EXECUTED', actualRepayAmount, loan.id, newBorrowedAmount === 0 ? 'Complete loan repayment and collateral release' : 'Partial loan repayment']
        );

        // Clear user cache
        await clearUserCache(userId);

        return {
          loanId: loan.id,
          repayAmount: actualRepayAmount,
          remainingDebt: newBorrowedAmount,
          loanStatus: newBorrowedAmount === 0 ? 'REPAID' : 'ACTIVE',
          collateralReturned: newBorrowedAmount === 0 ? loan.btc_collateral_amount : 0,
          minimumInterestDue,
          minimumInterestApplied: isFullRepayment ? Math.max(0, minimumInterestDue - currentInterestAccrued) : 0
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
      
      // Calculate available borrowing capacity using sell rate (what user would actually get)
      const maxBorrowable = Math.floor((loan.btc_collateral_amount * rates.sellRate * loan.ltv_ratio) / (100 * 100000000));
      const availableCapacity = maxBorrowable - loan.inr_borrowed_amount;
      
      // Calculate current LTV using sell rate (actual liquidation value)
      const currentLtv = (loan.inr_borrowed_amount / ((loan.btc_collateral_amount * rates.sellRate) / 100000000)) * 100;
      
      // Calculate minimum interest due for display
      const minimumInterestDue = await this.calculateMinimumInterestDue(loan);
      
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
        currentBtcPrice: rates.sellRate, // Use sell rate for collateral display
        riskStatus: currentLtv >= 90 ? 'LIQUIDATE' : currentLtv >= 85 ? 'WARNING' : 'SAFE',
        minimumInterestDue
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
        const dailyInterest = Math.round((loan.inr_borrowed_amount * loan.interest_rate) / 365 / 100);
        
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
        
        // Calculate BTC to sell to restore 60% LTV using sell rate
        const targetLtv = 0.60;
        const currentCollateralValue = (loan.btc_collateral_amount * rates.sellRate) / 100000000;
        const targetBorrowAmount = currentCollateralValue * targetLtv;
        const excessDebt = loan.inr_borrowed_amount - targetBorrowAmount;
        
        if (excessDebt <= 0) {
          throw new Error('No liquidation needed - LTV is within limits');
        }

        // Calculate BTC to sell (add small buffer for slippage)
        const btcToSell = Math.ceil((excessDebt * 1.02 * 100000000) / rates.sellRate);
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
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [loan.user_id, 'PARTIAL_LIQUIDATION', 'EXECUTED', debtReduction, btcToSell, rates.sellRate, loan.id, 'Partial liquidation - LTV reduced from 90% to 60%']
        );

        return {
          loanId: loan.id,
          btcSold: btcToSell,
          inrFromSale,
          debtReduction,
          remainingInr,
          newBorrowedAmount,
          newCollateralAmount,
          newLtv: (newBorrowedAmount / ((newCollateralAmount * rates.sellRate) / 100000000)) * 100
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
        
        // Calculate minimum interest due (30-day minimum policy)
        const minimumInterestDue = await this.calculateMinimumInterestDue(loan);
        
        // Get original borrowed amount to calculate current interest accrued
        const borrowOperations = await query(
          'SELECT SUM(inr_amount) as total_borrowed FROM operations WHERE loan_id = ? AND type = "LOAN_BORROW"',
          [loan.id]
        );
        const originalBorrowedAmount = borrowOperations[0]?.total_borrowed || 0;
        const currentInterestAccrued = loan.inr_borrowed_amount - originalBorrowedAmount;
        
        // Calculate additional interest needed to meet minimum
        const additionalInterestNeeded = Math.max(0, minimumInterestDue - currentInterestAccrued);
        
        // Apply additional interest if needed
        let finalDebtAmount = loan.inr_borrowed_amount;
        if (additionalInterestNeeded > 0) {
          finalDebtAmount = loan.inr_borrowed_amount + additionalInterestNeeded;
          
          // Update loan and user balances with additional interest
          await connection.execute(
            'UPDATE loans SET inr_borrowed_amount = ? WHERE id = ?',
            [finalDebtAmount, loan.id]
          );
          
          await connection.execute(
            'UPDATE users SET borrowed_inr = borrowed_inr + ?, interest_accrued = interest_accrued + ? WHERE id = ?',
            [additionalInterestNeeded, additionalInterestNeeded, userId]
          );
          
          // Record the additional interest charge
          await connection.execute(
            'INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [userId, 'INTEREST_ACCRUAL', 'EXECUTED', additionalInterestNeeded, loan.id, '30-day minimum interest charge applied before full liquidation']
          );
        }
        
        // Get current BTC price
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Calculate BTC to sell to cover entire debt (including minimum interest)
        const btcToSell = Math.ceil((finalDebtAmount * 100000000) / rates.sellRate);
        const remainingCollateral = loan.btc_collateral_amount - btcToSell;
        
        if (remainingCollateral < 0) {
          throw new Error('Insufficient collateral for full liquidation including minimum interest');
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

        // Record the operation with detailed structured notes
        const liquidationNotes = JSON.stringify({
          description: 'Manual full liquidation',
          debtCleared: finalDebtAmount,
          btcSold: btcToSell,
          btcReturned: remainingCollateral,
          originalCollateral: loan.btc_collateral_amount,
          minimumInterestApplied: additionalInterestNeeded,
          sellRate: rates.sellRate
        });
        
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'FULL_LIQUIDATION', 'EXECUTED', finalDebtAmount, btcToSell, rates.sellRate, loan.id, liquidationNotes]
        );

        return {
          loanId: loan.id,
          btcSold: btcToSell,
          debtCleared: finalDebtAmount,
          collateralReturned: remainingCollateral,
          loanStatus: 'REPAID',
          minimumInterestApplied: additionalInterestNeeded
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
        SELECT type, inr_amount, btc_amount, execution_price, notes, created_at, executed_at
        FROM operations 
        WHERE user_id = ? AND type IN ('LOAN_CREATE', 'LOAN_BORROW', 'LOAN_REPAY', 'LOAN_ADD_COLLATERAL', 'INTEREST_ACCRUAL', 'PARTIAL_LIQUIDATION', 'FULL_LIQUIDATION')
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
   * Add more BTC collateral to existing loan
   * @param {number} userId - ID of the user
   * @param {number} additionalCollateral - Additional BTC amount in satoshis
   * @returns {Promise} - Resolves with updated loan details
   */
  async addCollateralToLoan(userId, additionalCollateral) {
    try {
      if (additionalCollateral <= 0) {
        throw new Error('Additional collateral amount must be greater than 0');
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
        
        // Get current user balances
        const [userRows] = await connection.execute(
          'SELECT available_btc, collateral_btc FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalances = userRows[0];
        
        if (currentBalances.available_btc < additionalCollateral) {
          throw new Error('Insufficient BTC balance');
        }

        // Get current BTC price for updated liquidation calculation
        const rates = await bitcoinDataService.getCalculatedRates();
        const newTotalCollateral = loan.btc_collateral_amount + additionalCollateral;
        // Calculate liquidation price as sell rate based on current borrowed amount and new collateral
        const liquidationPrice = loan.inr_borrowed_amount > 0 ? 
          Math.floor((loan.inr_borrowed_amount * 100000000) / (newTotalCollateral * 0.9)) : 0;

        // Update user balances - move BTC from available to collateral
        await connection.execute(
          'UPDATE users SET available_btc = available_btc - ?, collateral_btc = collateral_btc + ? WHERE id = ?',
          [additionalCollateral, additionalCollateral, userId]
        );

        // Update loan with new collateral amount and recalculated liquidation price
        await connection.execute(
          'UPDATE loans SET btc_collateral_amount = ?, liquidation_price = ? WHERE id = ?',
          [newTotalCollateral, liquidationPrice, loan.id]
        );

        // Record the operation
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, btc_amount, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [userId, 'LOAN_ADD_COLLATERAL', 'EXECUTED', additionalCollateral, loan.id, 'Additional collateral added to improve LTV ratio']
        );

        // Clear user cache
        await clearUserCache(userId);

        // Calculate new borrowing capacity using sell rate
        const newMaxBorrowable = Math.floor((newTotalCollateral * rates.sellRate * loan.ltv_ratio) / (100 * 100000000));
        const newAvailableCapacity = newMaxBorrowable - loan.inr_borrowed_amount;
        
        // Calculate new current LTV
        const newCurrentLtv = (loan.inr_borrowed_amount / ((newTotalCollateral * rates.sellRate) / 100000000)) * 100;

        return {
          loanId: loan.id,
          additionalCollateral,
          newTotalCollateral,
          newMaxBorrowable,
          newAvailableCapacity,
          newCurrentLtv,
          newLiquidationPrice: liquidationPrice,
          currentBtcPrice: rates.btcUsdPrice
        };
      });
    } catch (error) {
      console.error('Error adding collateral to loan:', error);
      throw error;
    }
  },

  /**
   * User-initiated partial liquidation
   * @param {number} userId - ID of the user
   * @param {number} btcAmount - Amount of BTC to liquidate
   * @returns {Promise} - Resolves with liquidation details
   */
  async executeUserPartialLiquidation(userId, btcAmount) {
    try {
      if (btcAmount <= 0) {
        throw new Error('BTC amount must be greater than 0');
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
        const btcToSell = Math.floor(btcAmount * 100000000); // Convert to satoshis
        
        if (btcToSell > loan.btc_collateral_amount) {
          throw new Error('Amount exceeds available collateral');
        }
        
        // Get current BTC price
        const rates = await bitcoinDataService.getCalculatedRates();
        
        // Calculate INR proceeds from BTC sale
        const inrFromSale = Math.round((btcToSell * rates.sellRate) / 100000000);
        
        // Calculate total debt including minimum interest
        const minimumInterestDue = await this.calculateMinimumInterestDue(loan);
        const totalDebt = loan.inr_borrowed_amount + minimumInterestDue;
        
        // Apply proceeds to debt first, then to user balance
        const debtReduction = Math.min(inrFromSale, totalDebt);
        const remainingInr = inrFromSale - debtReduction;
        
        // Update user balances
        await connection.execute(
          'UPDATE users SET borrowed_inr = GREATEST(0, borrowed_inr - ?), interest_accrued = GREATEST(0, interest_accrued - ?), collateral_btc = collateral_btc - ?, available_inr = available_inr + ? WHERE id = ?',
          [debtReduction, debtReduction, btcToSell, remainingInr, userId]
        );

        // Update loan
        const newBorrowedAmount = Math.max(0, loan.inr_borrowed_amount - debtReduction);
        const newCollateralAmount = loan.btc_collateral_amount - btcToSell;
        
        // If loan is fully paid off, close it
        if (newBorrowedAmount === 0) {
          await connection.execute(
            'UPDATE loans SET status = "REPAID", inr_borrowed_amount = 0, btc_collateral_amount = ?, repaid_at = NOW() WHERE id = ?',
            [newCollateralAmount, loan.id]
          );
          
          // Move remaining collateral back to available balance if any
          if (newCollateralAmount > 0) {
            await connection.execute(
              'UPDATE users SET available_btc = available_btc + ?, collateral_btc = collateral_btc - ? WHERE id = ?',
              [newCollateralAmount, newCollateralAmount, userId]
            );
          }
        } else {
          await connection.execute(
            'UPDATE loans SET inr_borrowed_amount = ?, btc_collateral_amount = ? WHERE id = ?',
            [newBorrowedAmount, newCollateralAmount, loan.id]
          );
        }

        // Record the operation
        const operationType = newBorrowedAmount === 0 ? 'FULL_LIQUIDATION' : 'PARTIAL_LIQUIDATION';
        const operationNotes = newBorrowedAmount === 0 ? 
          `User-initiated full liquidation - loan fully repaid. Original collateral: ${(loan.btc_collateral_amount / 100000000).toFixed(8)} BTC, liquidated: ${btcAmount} BTC, remaining: ${(newCollateralAmount / 100000000).toFixed(8)} BTC` :
          `User-initiated partial liquidation - debt reduced by ₹${debtReduction.toLocaleString()}`;
          
        await connection.execute(
          'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, loan_id, notes, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [userId, operationType, 'EXECUTED', debtReduction, btcToSell, rates.sellRate, loan.id, operationNotes]
        );

        // Clear user cache
        await clearUserCache(userId);
        
        // Calculate new LTV if loan is still active
        let newLtv = 0;
        if (newBorrowedAmount > 0 && newCollateralAmount > 0) {
          newLtv = (newBorrowedAmount / ((newCollateralAmount * rates.sellRate) / 100000000)) * 100;
        }

        return {
          loanId: loan.id,
          btcSold: btcToSell,
          btcSoldFormatted: btcAmount,
          inrFromSale,
          debtReduction,
          remainingInr,
          newBorrowedAmount,
          newCollateralAmount,
          newLtv,
          loanClosed: newBorrowedAmount === 0,
          executionPrice: rates.sellRate
        };
      });
    } catch (error) {
      console.error('Error executing user partial liquidation:', error);
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
          ${rates.sellRate} as current_btc_price,
          (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.sellRate} / 100000000)) * 100 as current_ltv,
          CASE 
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.sellRate} / 100000000)) >= 0.90 THEN 'LIQUIDATE'
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ${rates.sellRate} / 100000000)) >= 0.85 THEN 'WARNING'
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

