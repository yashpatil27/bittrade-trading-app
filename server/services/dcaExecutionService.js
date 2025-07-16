const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const bitcoinDataService = require('./bitcoinDataService');
const { dcaLogger } = require('../utils/logger');
const socketServer = require('../websocket/socketServer');

class DcaExecutionService {
  constructor() {
    this.isRunning = false;
    this.currentTimeout = null;
    this.executionInProgress = false;
  }

  // Execute pending DCA plans
  async executePendingPlans() {
    if (this.executionInProgress) {
      dcaLogger.warn('DCA execution already in progress, skipping...');
      return;
    }

    this.executionInProgress = true;
    
    try {
      // Get current market rates
      const rates = await bitcoinDataService.getCalculatedRates();
      const currentBuyPrice = rates.buyRate;   // Current buy rate (what users pay)
      const currentSellPrice = rates.sellRate; // Current sell rate (what users receive)
      
      dcaLogger.info(`Checking DCA plans - Current Buy: ₹${currentBuyPrice.toLocaleString()}, Sell: ₹${currentSellPrice.toLocaleString()}`);
      
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
        dcaLogger.debug('No DCA plans ready for execution');
        return;
      }

      dcaLogger.info(`Found ${pendingPlans.length} DCA plans ready for execution`);

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
          dcaLogger.error(`Error executing DCA plan ${plan.id}`, error);
          // Continue processing other plans even if one fails
        }
      }

      // Log execution summary
      if (executedPlans.length > 0) {
        dcaLogger.success(`Executed ${executedPlans.length} DCA plans`);
        executedPlans.forEach(plan => {
          const amount = plan.plan_type === 'DCA_BUY' ? 
            `₹${plan.amount_per_execution.toLocaleString()}` : 
            `${(plan.amount_per_execution / 100000000).toFixed(8)} BTC`;
          dcaLogger.info(`  - ${plan.plan_type} Plan ${plan.id}: ${amount} at ₹${plan.executionPrice.toLocaleString()} for user ${plan.email}`);
        });
      }

      if (completedPlans.length > 0) {
        dcaLogger.success(`Completed ${completedPlans.length} DCA plans`);
      }

      if (pausedPlans.length > 0) {
        dcaLogger.warn(`Paused ${pausedPlans.length} DCA plans (insufficient balance)`);
      }

      return {
        processed: pendingPlans.length,
        executed: executedPlans.length,
        completed: completedPlans.length,
        paused: pausedPlans.length
      };

    } catch (error) {
      dcaLogger.error('Error in DCA execution', error);
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
        dcaLogger.debug(`DCA Buy Plan ${plan.id} skipped: price too high (${currentBuyPrice} > ${plan.max_price})`);
        await this.skipPlanExecution(plan, 'price_too_high', {
          current_price: currentBuyPrice,
          max_price: plan.max_price
        });
        return { executed: false, completed: false, paused: false };
      }
      if (plan.min_price && currentBuyPrice < plan.min_price) {
        dcaLogger.debug(`DCA Buy Plan ${plan.id} skipped: price too low (${currentBuyPrice} < ${plan.min_price})`);
        await this.skipPlanExecution(plan, 'price_too_low', {
          current_price: currentBuyPrice,
          min_price: plan.min_price
        });
        return { executed: false, completed: false, paused: false };
      }
    } else if (plan.plan_type === 'DCA_SELL') {
      if (plan.max_price && currentSellPrice > plan.max_price) {
        dcaLogger.debug(`DCA Sell Plan ${plan.id} skipped: price too high (${currentSellPrice} > ${plan.max_price})`);
        await this.skipPlanExecution(plan, 'price_too_high', {
          current_price: currentSellPrice,
          max_price: plan.max_price
        });
        return { executed: false, completed: false, paused: false };
      }
      if (plan.min_price && currentSellPrice < plan.min_price) {
        dcaLogger.debug(`DCA Sell Plan ${plan.id} skipped: price too low (${currentSellPrice} < ${plan.min_price})`);
        await this.skipPlanExecution(plan, 'price_too_low', {
          current_price: currentSellPrice,
          min_price: plan.min_price
        });
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
        dcaLogger.warn(`DCA Buy Plan ${plan.id} paused: insufficient INR balance`);
        await connection.execute(
          'UPDATE active_plans SET status = ? WHERE id = ?',
          ['PAUSED', plan.id]
        );
        
        // Broadcast DCA plan paused event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_PAUSED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          reason: 'insufficient_balance',
          status: 'PAUSED',
          timestamp: new Date().toISOString()
        });
        
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
        
        dcaLogger.success(`DCA Buy Plan ${plan.id} completed after ${newTotalExecutions} executions`);
        await clearUserCache(plan.user_id);
        
        // Broadcast DCA plan completed event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_COMPLETED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          execution_price: executionPrice,
          inr_amount: plan.amount_per_execution,
          btc_amount: btcAmount,
          total_executions: newTotalExecutions,
          status: 'COMPLETED',
          timestamp: new Date().toISOString()
        });
        
        return { executed: true, completed: true, paused: false, executionPrice };
      } else {
        // Schedule next execution
        await this.updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions);
        
        dcaLogger.success(`DCA Buy Plan ${plan.id} executed: ${(btcAmount/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
        await clearUserCache(plan.user_id);
        
        // Broadcast DCA plan executed event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_EXECUTED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          execution_price: executionPrice,
          inr_amount: plan.amount_per_execution,
          btc_amount: btcAmount,
          total_executions: newTotalExecutions,
          remaining_executions: newRemainingExecutions,
          status: 'ACTIVE',
          timestamp: new Date().toISOString()
        });
        
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
        dcaLogger.warn(`DCA Sell Plan ${plan.id} paused: insufficient BTC balance`);
        await connection.execute(
          'UPDATE active_plans SET status = ? WHERE id = ?',
          ['PAUSED', plan.id]
        );
        
        // Broadcast DCA plan paused event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_PAUSED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          reason: 'insufficient_balance',
          status: 'PAUSED',
          timestamp: new Date().toISOString()
        });
        
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
        
        dcaLogger.success(`DCA Sell Plan ${plan.id} completed after ${newTotalExecutions} executions`);
        await clearUserCache(plan.user_id);
        
        // Broadcast DCA plan completed event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_COMPLETED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          execution_price: executionPrice,
          inr_amount: inrAmount,
          btc_amount: plan.amount_per_execution,
          total_executions: newTotalExecutions,
          status: 'COMPLETED',
          timestamp: new Date().toISOString()
        });
        
        return { executed: true, completed: true, paused: false, executionPrice };
      } else {
        // Schedule next execution
        await this.updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions);
        
        dcaLogger.success(`DCA Sell Plan ${plan.id} executed: ${(plan.amount_per_execution/100000000).toFixed(8)} BTC at ₹${executionPrice.toLocaleString()}`);
        await clearUserCache(plan.user_id);
        
        // Broadcast DCA plan executed event
        this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
          type: 'DCA_EXECUTED',
          plan_id: plan.id,
          plan_type: plan.plan_type,
          execution_price: executionPrice,
          inr_amount: inrAmount,
          btc_amount: plan.amount_per_execution,
          total_executions: newTotalExecutions,
          remaining_executions: newRemainingExecutions,
          status: 'ACTIVE',
          timestamp: new Date().toISOString()
        });
        
        return { executed: true, completed: false, paused: false, executionPrice };
      }
    });
  }

  // Skip plan execution when price conditions aren't met
  async skipPlanExecution(plan, reason = 'price_conditions', additionalData = {}) {
    const nextExecutionAt = new Date(plan.next_execution_at);
    
    if (plan.frequency === 'HOURLY') {
      nextExecutionAt.setHours(nextExecutionAt.getHours() + 1);
    } else if (plan.frequency === 'DAILY') {
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
    
    // Broadcast DCA plan skipped event
    this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
      type: 'DCA_SKIPPED',
      plan_id: plan.id,
      plan_type: plan.plan_type,
      reason: reason,
      next_execution_at: nextExecutionAt.toISOString(),
      status: 'ACTIVE',
      timestamp: new Date().toISOString(),
      ...additionalData
    });
  }

  // Calculate time until next execution for the earliest plan
  async calculateNextExecutionTime() {
    const plans = await query(`
      SELECT MIN(next_execution_at) as next_execution_at 
      FROM active_plans 
      WHERE status = 'ACTIVE' 
      AND plan_type IN ('DCA_BUY', 'DCA_SELL')
    `);

    if (!plans[0] || !plans[0].next_execution_at) {
      // No active plans, default to 1 hour
      dcaLogger.debug('No active DCA plans found, scheduling next check in 1 hour');
      return 60 * 60 * 1000;
    }

    const nextExecutionAt = new Date(plans[0].next_execution_at);
    const now = new Date();
    const diff = nextExecutionAt.getTime() - now.getTime();

    // Ensure we don't wait more than 1 hour, and minimum 1 minute for immediate execution
    const timeToWait = Math.max(Math.min(diff, 60 * 60 * 1000), 60 * 1000);
    
    dcaLogger.info(`Next DCA execution scheduled in ${Math.round(timeToWait / 1000 / 60)} minutes`);
    return timeToWait;
  }

  // Schedule the next service run based on calculated time
  async scheduleService() {
    if (!this.isRunning) {
      return;
    }

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    try {
      const timeUntilNext = await this.calculateNextExecutionTime();
      this.currentTimeout = setTimeout(async () => {
        if (this.isRunning) {
          try {
            await this.executePendingPlans();
          } catch (error) {
            dcaLogger.error('Error in scheduled DCA execution', error);
          }
          // Schedule the next run
          await this.scheduleService();
        }
      }, timeUntilNext);
    } catch (error) {
      dcaLogger.error('Error scheduling next DCA execution', error);
      // Fallback to 1 hour if scheduling fails
      this.currentTimeout = setTimeout(async () => {
        await this.scheduleService();
      }, 60 * 60 * 1000);
    }
  }

  // Update plan for next execution with counters
  async updatePlanForNextExecution(connection, plan, newTotalExecutions, newRemainingExecutions) {
    const nextExecutionAt = new Date(plan.next_execution_at);
    
    if (plan.frequency === 'HOURLY') {
      nextExecutionAt.setHours(nextExecutionAt.getHours() + 1);
    } else if (plan.frequency === 'DAILY') {
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
    
    // Broadcast next execution time update
    this.broadcastDcaPlanUpdate(plan.user_id, plan.id, {
      type: 'DCA_NEXT_EXECUTION_UPDATED',
      plan_id: plan.id,
      plan_type: plan.plan_type,
      next_execution_at: nextExecutionAt.toISOString(),
      total_executions: newTotalExecutions,
      remaining_executions: newRemainingExecutions,
      status: 'ACTIVE',
      timestamp: new Date().toISOString()
    });
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
      dcaLogger.error('Error getting DCA plans summary', error);
      throw error;
    }
  }

  // Start the DCA execution service
  startService() {
    if (this.isRunning) {
      dcaLogger.warn('DCA execution service already running');
      return;
    }

    dcaLogger.info('Starting DCA execution service...');
    this.isRunning = true;

    // Run immediately on startup to handle any missed executions
    this.executePendingPlans()
      .then(() => {
        // After initial execution, start dynamic scheduling
        this.scheduleService();
      })
      .catch(error => {
        dcaLogger.error('Initial DCA execution failed', error);
        // Still start scheduling even if initial execution fails
        this.scheduleService();
      });

    dcaLogger.serviceStarted('DCA Execution Service', {
      mode: 'Dynamic scheduling',
      maxInterval: '1 hour',
      minInterval: '1 minute'
    });
  }

  // Stop the service
  stopService() {
    this.isRunning = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    dcaLogger.info('DCA execution service stopped');
  }

  // Manual execution trigger (for testing/admin)
  async executeNow() {
    dcaLogger.info('Manual DCA execution triggered...');
    return await this.executePendingPlans();
  }

  // Trigger reschedule when plans are modified (for immediate response to changes)
  async triggerReschedule() {
    if (!this.isRunning) {
      return;
    }
    
    dcaLogger.debug('Plan modification detected, rescheduling...');
    // Clear current timeout and reschedule immediately
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    // Reschedule based on current plans
    await this.scheduleService();
  }

  // Broadcast DCA plan update to user and admins
  broadcastDcaPlanUpdate(userId, planId, eventData) {
    try {
      // Broadcast to the specific user
      socketServer.broadcastToUser(userId, 'dca_plan_update', eventData);
      
      // Broadcast to all admins
      socketServer.broadcastToAdmins('dca_plan_update', {
        ...eventData,
        user_id: userId
      });
      
      dcaLogger.debug(`DCA plan update broadcasted: ${eventData.type} for plan ${planId}`);
    } catch (error) {
      dcaLogger.error('Error broadcasting DCA plan update', error);
    }
  }
}

// Export singleton instance
const dcaExecutionService = new DcaExecutionService();
module.exports = dcaExecutionService;
