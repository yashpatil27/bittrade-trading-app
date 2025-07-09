const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');
const settingsService = require('./settingsService');

/**
 * Liquidation Monitoring Service
 * Monitors active loans and automatically triggers liquidations when LTV exceeds 90%
 */
class LiquidationMonitoringService {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.intervalMs = 30000; // 30 seconds
    this.liquidationInProgress = false;
  }

  /**
   * Start the liquidation monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('Liquidation monitoring service is already running');
      return;
    }

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.checkAndExecuteLiquidations();
    }, this.intervalMs);

    console.log('✓ Liquidation monitoring service started (checking every 30 seconds)');
  }

  /**
   * Stop the liquidation monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Liquidation monitoring service is not running');
      return;
    }

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✓ Liquidation monitoring service stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      liquidationInProgress: this.liquidationInProgress,
      intervalMs: this.intervalMs
    };
  }

  /**
   * Check all active loans and execute liquidations if needed
   */
  async checkAndExecuteLiquidations() {
    if (this.liquidationInProgress) {
      console.log('Liquidation already in progress, skipping this cycle');
      return;
    }

    try {
      this.liquidationInProgress = true;
      
      // Get current BTC rates
      const rates = await bitcoinDataService.getCalculatedRates();
      if (!rates || !rates.sellRate) {
        console.log('Unable to get current BTC rates for liquidation check');
        return;
      }

      // Get all active loans that need liquidation check
      const loansAtRisk = await this.getLoansAtRisk(rates.sellRate);
      
      if (loansAtRisk.length === 0) {
        return; // No loans at risk
      }

      console.log(`Found ${loansAtRisk.length} loans requiring liquidation check`);

      // Process each loan at risk
      for (const loan of loansAtRisk) {
        try {
          if (loan.risk_status === 'LIQUIDATE') {
            console.log(`Executing liquidation for Loan ID: ${loan.id}, User: ${loan.user_id}, LTV: ${loan.current_ltv.toFixed(2)}%`);
            await this.executePartialLiquidation(loan, rates.sellRate);
          } else if (loan.risk_status === 'WARNING') {
            console.log(`Loan ID: ${loan.id} is at warning level - LTV: ${loan.current_ltv.toFixed(2)}%`);
            // TODO: Send warning notification to user
          }
        } catch (error) {
          console.error(`Error processing loan ${loan.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error in liquidation monitoring:', error);
    } finally {
      this.liquidationInProgress = false;
    }
  }

  /**
   * Get loans that are at risk of liquidation
   */
  async getLoansAtRisk(currentBtcPrice) {
    const loans = await query(`
      SELECT 
        l.id,
        l.user_id,
        l.btc_collateral_amount,
        l.inr_borrowed_amount,
        l.ltv_ratio,
        l.liquidation_price,
        l.interest_rate,
        u.borrowed_inr,
        u.interest_accrued,
        u.collateral_btc,
        -- Calculate current LTV
        (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) * 100 as current_ltv,
        -- Determine risk status
        CASE 
          WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) >= 0.90 THEN 'LIQUIDATE'
          WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) >= 0.85 THEN 'WARNING'
          ELSE 'SAFE'
        END as risk_status
      FROM loans l 
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'ACTIVE' 
        AND l.btc_collateral_amount > 0
        AND l.inr_borrowed_amount > 0
        AND (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) >= 0.85
      ORDER BY current_ltv DESC
    `, [currentBtcPrice, currentBtcPrice, currentBtcPrice, currentBtcPrice]);

    return loans;
  }

  /**
   * Execute partial liquidation to restore LTV to 60%
   */
  async executePartialLiquidation(loan, currentBtcPrice) {
    try {
      return await transaction(async (connection) => {
        // Calculate how much BTC to sell to restore LTV to 60%
        const targetLtv = 0.60;
        const targetBorrowedAmount = (loan.btc_collateral_amount * currentBtcPrice * targetLtv) / 100000000;
        const excessDebt = loan.inr_borrowed_amount - targetBorrowedAmount;
        
        // Calculate BTC amount to sell (with small buffer for safety)
        const btcToSell = Math.ceil((excessDebt * 100000000) / currentBtcPrice);
        const inrFromSale = Math.floor((btcToSell * currentBtcPrice) / 100000000);
        
        // Ensure we don't sell more than available collateral
        const maxBtcToSell = Math.min(btcToSell, loan.btc_collateral_amount);
        const actualInrFromSale = Math.floor((maxBtcToSell * currentBtcPrice) / 100000000);
        
        // Debt reduction is limited by actual sale proceeds
        const debtReduction = Math.min(actualInrFromSale, loan.inr_borrowed_amount);
        const remainingCollateral = loan.btc_collateral_amount - maxBtcToSell;
        const remainingDebt = loan.inr_borrowed_amount - debtReduction;
        const excessInr = actualInrFromSale - debtReduction;

        console.log(`Liquidation calculation for Loan ${loan.id}:`);
        console.log(`  Current LTV: ${((loan.inr_borrowed_amount / (loan.btc_collateral_amount * currentBtcPrice / 100000000)) * 100).toFixed(2)}%`);
        console.log(`  BTC to sell: ${maxBtcToSell / 100000000} BTC`);
        console.log(`  INR from sale: ₹${actualInrFromSale}`);
        console.log(`  Debt reduction: ₹${debtReduction}`);
        console.log(`  Remaining collateral: ${remainingCollateral / 100000000} BTC`);
        console.log(`  Remaining debt: ₹${remainingDebt}`);

        // Update users table
        await connection.execute(
          `UPDATE users SET 
            borrowed_inr = borrowed_inr - ?,
            interest_accrued = GREATEST(0, interest_accrued - ?),
            collateral_btc = collateral_btc - ?,
            available_inr = available_inr + ?
          WHERE id = ?`,
          [debtReduction, Math.min(loan.interest_accrued, debtReduction), maxBtcToSell, excessInr, loan.user_id]
        );

        // Update loans table
        if (remainingDebt <= 0 || remainingCollateral <= 0) {
          // Full liquidation - close the loan
          await connection.execute(
            `UPDATE loans SET 
              inr_borrowed_amount = 0,
              btc_collateral_amount = 0,
              status = 'LIQUIDATED',
              liquidated_at = NOW()
            WHERE id = ?`,
            [loan.id]
          );
        } else {
          // Partial liquidation - update amounts
          await connection.execute(
            `UPDATE loans SET 
              inr_borrowed_amount = ?,
              btc_collateral_amount = ?
            WHERE id = ?`,
            [remainingDebt, remainingCollateral, loan.id]
          );
        }

        // Record the liquidation operation
        await connection.execute(
          `INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, loan_id, notes, executed_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            loan.user_id,
            remainingDebt <= 0 ? 'FULL_LIQUIDATION' : 'PARTIAL_LIQUIDATION',
            'EXECUTED',
            debtReduction,
            maxBtcToSell,
            currentBtcPrice,
            loan.id,
            `Automatic liquidation - LTV reduced from ${((loan.inr_borrowed_amount / (loan.btc_collateral_amount * currentBtcPrice / 100000000)) * 100).toFixed(2)}% to ${remainingDebt > 0 ? ((remainingDebt / (remainingCollateral * currentBtcPrice / 100000000)) * 100).toFixed(2) : 0}%`
          ]
        );

        // Clear user cache
        await clearUserCache(loan.user_id);

        console.log(`✓ Liquidation completed for Loan ID: ${loan.id}`);
        
        return {
          loanId: loan.id,
          userId: loan.user_id,
          btcSold: maxBtcToSell / 100000000,
          inrReceived: actualInrFromSale,
          debtReduction,
          remainingCollateral: remainingCollateral / 100000000,
          remainingDebt,
          newLtv: remainingDebt > 0 ? ((remainingDebt / (remainingCollateral * currentBtcPrice / 100000000)) * 100) : 0,
          liquidationType: remainingDebt <= 0 ? 'FULL' : 'PARTIAL'
        };
      });

    } catch (error) {
      console.error(`Error executing liquidation for loan ${loan.id}:`, error);
      throw error;
    }
  }

  /**
   * Manual liquidation trigger (for admin use)
   */
  async executeLiquidationNow() {
    console.log('Manual liquidation check triggered');
    await this.checkAndExecuteLiquidations();
    return { message: 'Liquidation check completed' };
  }

  /**
   * Get current liquidation risks for all active loans
   */
  async getLiquidationRisks() {
    try {
      const rates = await bitcoinDataService.getCalculatedRates();
      if (!rates || !rates.sellRate) {
        throw new Error('Unable to get current BTC rates');
      }

      const allLoans = await query(`
        SELECT 
          l.id,
          l.user_id,
          l.btc_collateral_amount,
          l.inr_borrowed_amount,
          l.ltv_ratio,
          l.liquidation_price,
          u.email,
          u.name,
          -- Calculate current LTV
          (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) * 100 as current_ltv,
          -- Calculate liquidation distance
          ((l.inr_borrowed_amount / (l.btc_collateral_amount * 0.90 / 100000000)) - ?) as liquidation_distance,
          -- Determine risk status
          CASE 
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) >= 0.90 THEN 'LIQUIDATE'
            WHEN (l.inr_borrowed_amount / (l.btc_collateral_amount * ? / 100000000)) >= 0.85 THEN 'WARNING'
            ELSE 'SAFE'
          END as risk_status
        FROM loans l 
        JOIN users u ON l.user_id = u.id
        WHERE l.status = 'ACTIVE' 
          AND l.btc_collateral_amount > 0
          AND l.inr_borrowed_amount > 0
        ORDER BY current_ltv DESC
      `, [rates.sellRate, rates.sellRate, rates.sellRate, rates.sellRate]);

      return allLoans.map(loan => ({
        ...loan,
        btc_collateral_amount: loan.btc_collateral_amount / 100000000,
        current_btc_price: rates.sellRate,
        liquidation_price_needed: Math.ceil(loan.inr_borrowed_amount / (loan.btc_collateral_amount / 100000000 * 0.90))
      }));

    } catch (error) {
      console.error('Error getting liquidation risks:', error);
      throw error;
    }
  }
}

// Export singleton instance
const liquidationMonitoringService = new LiquidationMonitoringService();
module.exports = liquidationMonitoringService;
