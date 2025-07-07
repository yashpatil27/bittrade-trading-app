const cron = require('node-cron');
const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');

class DcaExecutionService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.executionInProgress = false;
  }

  // Execute pending DCA plans
  async executePendingPlans() {
    if (this.executionInProgress) {
      console.log('DCA execution already in progress, skipping...');
      return;
    }

    this.executionInProgress = true;
    
    try {
      // Get current market rates
      const rates = await bitcoinDataService.getCalculatedRates();
      const currentBuyPrice = rates.buyRate;   // Current buy rate (what users pay)
      const currentSellPrice = rates.sellRate; // Current sell rate (what users receive)
      
      console.log(`Checking DCA plans - Current Buy: ₹${currentBuyPrice.toLocaleString()}, Sell: ₹${currentSellPrice.toLocaleString()}`);
      
      // Get all active DCA plans that are due for execution
      const pendingPlans = await query(`
        SELECT ap.*, u.email, u.name 
        FROM active_plans ap 
        JOIN users u ON ap.user_id = u.id 
        WHERE ap.status = 'ACTIVE' 
        AND ap.plan_type IN ('DCA_BUY', 'DCA_SELL')
        AND ap.next_execution_at <= NOW()
        ORDER BY ap.next_execution_at ASC
      `);

      if (pendingPlans.length === 0) {
        console.log('No DCA plans ready for execution');
        return;
      }

      console.log(`Found ${pendingPlans.length} DCA plans ready for execution`);

      // Process each pending plan
      const executedPlans = [];
      const completedPlans = [];
      const pausedPlans = [];

      for (const plan of pendingPlans) {
        try {
          const result = await this.executePlan(plan, currentBuyPrice, currentSellPrice);
          if (result.executed) {
            executedPlans.push({ ...plan, executionPrice: result.executionPrice });
          }
          if (result.completed) {
            completedPlans.push(plan);
          }
          if (result.paused) {
            pausedPlans.push(plan);
          }
        } catch (error) {
          console.error(`Error executing DCA plan ${plan.id}:`, error.message);
          // Continue processing other plans even if one fails
        }
      }

      // Log execution summary
      if (executedPlans.length > 0) {
        console.log(`✅ Executed ${executedPlans.length} DCA plans:`);
        executedPlans.forEach(plan => {
          const amount = plan.plan_type === 'DCA_BUY' ? 
            `₹${plan.amount_per_execution.toLocaleString()}` : 
            `${(plan.amount_per_execution / 100000000).toFixed(8)} BTC`;
          console.log(`  - ${plan.plan_type} Plan ${plan.id}: ${amount} at ₹${plan.executionPrice.toLocaleString()} for user ${plan.email}`);
        });
      }

      if (completedPlans.length > 0) {
        console.log(`🏁 Completed ${completedPlans.length} DCA plans`);
      }

      if (pausedPlans.length > 0) {
        console.log(`⏸️ Paused ${pausedPlans.length} DCA plans (insufficient balance)`);
      }

      return {
        processed: pendingPlans.length,
        executed: executedPlans.length,
        completed: completedPlans.length,
        paused: pausedPlans.length
      };

    } catch (error) {
      console.error('Error in DCA execution:', error.message);
      throw error;
    } finally {
      this.executionInProgress = false;
    }
  }

  // Execute individual DCA plan
  async executePlan(plan, currentBuyPrice, currentSellPrice) {
    // Check price limits if set
    if (plan.plan_type === 'DCA_BUY') {
      if (plan.max_price && currentBuyPrice > plan.max_price) {
        console.log(`DCA Buy Plan ${plan.id} skipped: price too high (${currentBuyPrice} > ${plan.max_price})`);
        await this.scheduleNextExecution(plan);
        return { executed: false, completed: false, paused: false };
      }
      if (plan.min_price && currentBuyPrice < plan.min_price) {
        console.log(`DCA Buy Plan ${plan.id} skipped: price too low (${currentBuyPrice} < ${plan.min_price})`);
        await this.scheduleNextExecution(plan);
        return { executed: false, completed: false, paused: false };
      }
    } else if (plan.plan_type === 'DCA_SELL') {
      if (plan.max_price && currentSellPrice > plan.max_price) {
        console.log(`DCA Sell Plan ${plan.id} skipped: price too high (${currentSellPrice} > ${plan.max_price})`);
        await this.scheduleNextExecution(plan);
        return { executed: false, completed: false, paused: false };
      }
      if (plan.min_price && currentSellPrice < plan.min_price) {
        console.log(`DCA Sell Plan ${plan.id} skipped: price too low (${currentSellPrice} < ${plan.min_price})`);
        await this.scheduleNextExecution(plan);
        return { executed: false, completed: false, paused: false };
      }
    }

    if (plan.plan_type === 'DCA_BUY') {
      return await this.executeDcaBuyPlan(plan, currentBuyPrice);
    } else if (plan.plan_type === 'DCA_SELL') {
      return await this.executeDcaSellPlan(plan, currentSellPrice);
    }

    return { executed: false, completed: false, paused: false };
  }

  // Execute DCA buy plan
  async executeDcaBuyPlan(plan, executionPrice) {
    return await transaction(async (connection) => {
      // Get current user balances
      const [userRows] = await connection.execute(
        'SELECT available_inr, available_btc FROM users WHERE id = ?',
        [plan.user_id]
      );

      if (userRows.length === 0) {
        throw new Error(`User ${plan.user_id} not found`);
      }

      const user = userRows[0];

      // Check if user has sufficient balance
      if (user.available_inr < plan.amount_per_execution) {
        console.log(`DCA Buy Plan ${plan.id} paused: insufficient INR balance`);
        await connection.execute(
          'UPDATE active_plans SET status = ? WHERE id = ?',
          ['PAUSED', plan.id]
        );
        return { executed: false, completed: false, paused: true };
      }

      // Calculate BTC amount
      const btcAmount = Math.floor((plan.amount_per_execution / executionPrice) * 100000000); // Convert to satoshis

      if (btcAmount <= 0) {
        throw new Error('Calculated BTC amount too small');
      }

      // Update user balances
      const newInrBalance = user.available_inr - plan.amount_per_execution;
      const newBtcBalance = user.available_btc + btcAmount;

      await connection.execute(
        'UPDATE users SET available_inr = ?, available_btc = ? WHERE id = ?',
        [newInrBalance, newBtcBalance, plan.user_id]
      );

      // Record the operation
      await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, parent_id, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [plan.user_id, 'DCA_BUY', 'EXECUTED', plan.amount_per_execution, btcAmount, executionPrice, plan.id]
      );

      // Update plan execution counts
      const newTotalExecutions = plan.total_executions + 1;
      const newRemainingExecutions = plan.remaining_executions ? plan.remaining_executions - 1 : null;

      // Check if plan is completed
      if (newRemainingExecutions === 0) {
        await connection.execute(
          'UPDATE active_plans SET status = ?, total_executions = ?, remaining_executions = ?, completed_at = NOW() WHERE id = ?',
          ['COMPLETED', newTotalExecutions, newRemainingExecutions, plan.id]
        );
        
        console.log(`✅ DCA Buy Plan ${plan.id} completed after ${newTotalExecutions} executions`);
        await clearUserCache(plan.user_id);
        return { executed: true, completed: true, paused: false, executionPrice };
      } else {
        // Schedule next execution
        await this.updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions);
        
        console.log(`✅ DCA Buy Plan ${plan.id} executed: ${(btcAmount/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
        await clearUserCache(plan.user_id);
        return { executed: true, completed: false, paused: false, executionPrice };
      }
    });
  }

  // Execute DCA sell plan
  async executeDcaSellPlan(plan, executionPrice) {
    return await transaction(async (connection) => {
      // Get current user balances
      const [userRows] = await connection.execute(
        'SELECT available_inr, available_btc FROM users WHERE id = ?',
        [plan.user_id]
      );

      if (userRows.length === 0) {
        throw new Error(`User ${plan.user_id} not found`);
      }

      const user = userRows[0];

      // Check if user has sufficient balance
      if (user.available_btc < plan.amount_per_execution) {
        console.log(`DCA Sell Plan ${plan.id} paused: insufficient BTC balance`);
        await connection.execute(
          'UPDATE active_plans SET status = ? WHERE id = ?',
          ['PAUSED', plan.id]
        );
        return { executed: false, completed: false, paused: true };
      }

      // Calculate INR amount
      const inrAmount = Math.floor((plan.amount_per_execution / 100000000) * executionPrice);

      if (inrAmount <= 0) {
        throw new Error('Calculated INR amount too small');
      }

      // Update user balances
      const newBtcBalance = user.available_btc - plan.amount_per_execution;
      const newInrBalance = user.available_inr + inrAmount;

      await connection.execute(
        'UPDATE users SET available_btc = ?, available_inr = ? WHERE id = ?',
        [newBtcBalance, newInrBalance, plan.user_id]
      );

      // Record the operation
      await connection.execute(
        'INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, parent_id, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [plan.user_id, 'DCA_SELL', 'EXECUTED', inrAmount, plan.amount_per_execution, executionPrice, plan.id]
      );

      // Update plan execution counts
      const newTotalExecutions = plan.total_executions + 1;
      const newRemainingExecutions = plan.remaining_executions ? plan.remaining_executions - 1 : null;

      // Check if plan is completed
      if (newRemainingExecutions === 0) {
        await connection.execute(
          'UPDATE active_plans SET status = ?, total_executions = ?, remaining_executions = ?, completed_at = NOW() WHERE id = ?',
          ['COMPLETED', newTotalExecutions, newRemainingExecutions, plan.id]
        );
        
        console.log(`✅ DCA Sell Plan ${plan.id} completed after ${newTotalExecutions} executions`);
        await clearUserCache(plan.user_id);
        return { executed: true, completed: true, paused: false, executionPrice };
      } else {
        // Schedule next execution
        await this.updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions);
        
        console.log(`✅ DCA Sell Plan ${plan.id} executed: ${(plan.amount_per_execution/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
        await clearUserCache(plan.user_id);
        return { executed: true, completed: false, paused: false, executionPrice };
      }
    });
  }

  // Schedule next execution for a plan
  async scheduleNextExecution(plan) {
    const nextExecutionAt = new Date(plan.next_execution_at);
    
    if (plan.frequency === 'DAILY') {
      nextExecutionAt.setDate(nextExecutionAt.getDate() + 1);
    } else if (plan.frequency === 'WEEKLY') {
      nextExecutionAt.setDate(nextExecutionAt.getDate() + 7);
    } else if (plan.frequency === 'MONTHLY') {
      nextExecutionAt.setMonth(nextExecutionAt.getMonth() + 1);
    }

    await query(
      'UPDATE active_plans SET next_execution_at = ? WHERE id = ?',
      [nextExecutionAt, plan.id]
    );
  }

  // Update plan for next execution with counters
  async updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions) {
    const nextExecutionAt = new Date(plan.next_execution_at);
    
    if (plan.frequency === 'DAILY') {
      nextExecutionAt.setDate(nextExecutionAt.getDate() + 1);
    } else if (plan.frequency === 'WEEKLY') {
      nextExecutionAt.setDate(nextExecutionAt.getDate() + 7);
    } else if (plan.frequency === 'MONTHLY') {
      nextExecutionAt.setMonth(nextExecutionAt.getMonth() + 1);
    }

    await connection.execute(
      'UPDATE active_plans SET next_execution_at = ?, total_executions = ?, remaining_executions = ? WHERE id = ?',
      [nextExecutionAt, newTotalExecutions, newRemainingExecutions, plan.id]
    );
  }

  // Get DCA plans summary
  async getDcaPlansSummary() {
    try {
      const summary = await query(`
        SELECT 
          COUNT(*) as total_plans,
          SUM(CASE WHEN plan_type = 'DCA_BUY' THEN 1 ELSE 0 END) as buy_plans,
          SUM(CASE WHEN plan_type = 'DCA_SELL' THEN 1 ELSE 0 END) as sell_plans,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_plans,
          SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) as paused_plans
        FROM active_plans 
        WHERE plan_type IN ('DCA_BUY', 'DCA_SELL')
        AND status IN ('ACTIVE', 'PAUSED')
      `);

      return summary[0] || {
        total_plans: 0,
        buy_plans: 0,
        sell_plans: 0,
        active_plans: 0,
        paused_plans: 0
      };
    } catch (error) {
      console.error('Error getting DCA plans summary:', error.message);
      throw error;
    }
  }

  // Start the DCA execution service
  startService() {
    if (this.isRunning) {
      console.log('DCA execution service already running');
      return;
    }

    console.log('Starting DCA execution service...');
    this.isRunning = true;

    // Run immediately on startup
    this.executePendingPlans().catch(error => {
      console.error('Initial DCA execution failed:', error.message);
    });

    // Schedule to run every 2 minutes (same as price updates)
    this.cronJob = cron.schedule('*/2 * * * *', async () => {
      if (this.isRunning) {
        try {
          await this.executePendingPlans();
        } catch (error) {
          console.error('Scheduled DCA execution failed:', error.message);
        }
      }
    });

    console.log('✅ DCA execution service started (runs every 2 minutes)');
  }

  // Stop the service
  stopService() {
    this.isRunning = false;
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    console.log('DCA execution service stopped');
  }

  // Manual execution trigger (for testing/admin)
  async executeNow() {
    console.log('Manual DCA execution triggered...');
    return await this.executePendingPlans();
  }
}

// Export singleton instance
const dcaExecutionService = new DcaExecutionService();
module.exports = dcaExecutionService;
