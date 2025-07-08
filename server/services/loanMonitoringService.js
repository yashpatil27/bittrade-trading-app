const loanService = require('./loanService');
const bitcoinDataService = require('./bitcoinDataService');

/**
 * LoanMonitoringService - Background service for interest accrual and liquidation monitoring
 */
class LoanMonitoringService {
  constructor() {
    this.isRunning = false;
    this.interestAccrualInterval = null;
    this.liquidationCheckInterval = null;
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('Loan monitoring service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting loan monitoring service...');

    // Run interest accrual daily at midnight
    this.scheduleInterestAccrual();
    
    // Check for liquidations every 30 seconds
    this.scheduleLiquidationCheck();
    
    console.log('Loan monitoring service started successfully');
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Loan monitoring service is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.interestAccrualInterval) {
      clearInterval(this.interestAccrualInterval);
      this.interestAccrualInterval = null;
    }
    
    if (this.liquidationCheckInterval) {
      clearInterval(this.liquidationCheckInterval);
      this.liquidationCheckInterval = null;
    }
    
    console.log('Loan monitoring service stopped');
  }

  /**
   * Schedule daily interest accrual
   */
  scheduleInterestAccrual() {
    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set initial timeout to run at midnight
    setTimeout(() => {
      this.runInterestAccrual();
      
      // Then run daily
      this.interestAccrualInterval = setInterval(() => {
        this.runInterestAccrual();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);

    console.log(`Interest accrual scheduled to run at midnight (${tomorrow.toISOString()})`);
  }

  /**
   * Schedule liquidation checks every 30 seconds
   */
  scheduleLiquidationCheck() {
    this.liquidationCheckInterval = setInterval(() => {
      this.checkAndExecuteLiquidations();
    }, 30 * 1000); // 30 seconds

    console.log('Liquidation monitoring scheduled every 30 seconds');
  }

  /**
   * Run interest accrual for all active loans
   */
  async runInterestAccrual() {
    try {
      console.log('Running daily interest accrual...');
      const results = await loanService.accrueInterest();
      
      if (results.length > 0) {
        console.log(`Interest accrued for ${results.length} loans:`, results);
      } else {
        console.log('No active loans requiring interest accrual');
      }
    } catch (error) {
      console.error('Error during interest accrual:', error);
    }
  }

  /**
   * Check for loans requiring liquidation and execute them
   */
  async checkAndExecuteLiquidations() {
    try {
      const atRiskLoans = await loanService.checkLiquidationRisk();
      
      for (const loan of atRiskLoans) {
        if (loan.risk_status === 'LIQUIDATE') {
          console.log(`Executing partial liquidation for loan ${loan.id} (User: ${loan.user_id}, LTV: ${loan.current_ltv}%)`);
          
          try {
            const result = await loanService.executePartialLiquidation(loan.id);
            console.log(`Partial liquidation completed for loan ${loan.id}:`, result);
          } catch (liquidationError) {
            console.error(`Failed to liquidate loan ${loan.id}:`, liquidationError);
          }
        } else if (loan.risk_status === 'WARNING') {
          console.log(`Warning: Loan ${loan.id} (User: ${loan.user_id}) is at ${loan.current_ltv}% LTV - approaching liquidation threshold`);
          // Here you could send notifications to users
        }
      }
    } catch (error) {
      console.error('Error during liquidation check:', error);
    }
  }

  /**
   * Get monitoring service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interestAccrualActive: this.interestAccrualInterval !== null,
      liquidationCheckActive: this.liquidationCheckInterval !== null
    };
  }
}

// Create and export singleton instance
const loanMonitoringService = new LoanMonitoringService();
module.exports = loanMonitoringService;
