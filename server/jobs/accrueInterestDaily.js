const { query, transaction } = require('../config/database');
const { clearUserCache } = require('../config/redis');
const { systemLogger } = require('../utils/beautifulLogger');

/**
 * Daily Interest Accrual Job
 *
 * This job runs once daily to calculate and apply interest across all loans using a simple daily accrual rate.
 * Optimized with batch operations for better performance.
 */
async function accrueInterestDaily() {
  const startTime = Date.now();
  let processedLoans = 0;
  let totalInterestAccrued = 0;

  try {
    systemLogger.info('Starting daily interest accrual job...');

    // Get today's date in IST for consistency
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    // Fetch all active loans that haven't had interest accrued today
    const loans = await query(`
      SELECT l.id, l.user_id, l.inr_borrowed_amount, l.interest_rate 
      FROM loans l
      WHERE l.status = 'ACTIVE' 
        AND l.inr_borrowed_amount > 0
        AND l.id NOT IN (
          SELECT DISTINCT o.loan_id 
          FROM operations o 
          WHERE o.type = 'INTEREST_ACCRUAL' 
            AND o.loan_id IS NOT NULL
            AND DATE(o.executed_at) = ?
        )
      ORDER BY l.id
    `, [today]);

    if (loans.length === 0) {
      systemLogger.info('No active loans found for interest accrual (may have already been processed today)');
      return { processedLoans: 0, totalInterestAccrued: 0 };
    }

    systemLogger.info(`Processing ${loans.length} active loans...`);

    // Process loans in batches for better performance
    const batchSize = 10;
    const userCacheClears = new Set();

    for (let i = 0; i < loans.length; i += batchSize) {
      const batch = loans.slice(i, i + batchSize);
      
      await transaction(async (connection) => {
        const loanUpdates = [];
        const userUpdates = [];
        const operations = [];
        
        for (const loan of batch) {
          // Skip if no borrowed amount
          if (loan.inr_borrowed_amount <= 0) continue;
          
          // Calculate daily interest using round instead of floor
          const dailyInterest = Math.round((loan.inr_borrowed_amount * loan.interest_rate) / 36500);
          
          // Skip if interest is zero
          if (dailyInterest <= 0) continue;
          
          loanUpdates.push({
            id: loan.id,
            interest: dailyInterest
          });
          
          userUpdates.push({
            user_id: loan.user_id,
            interest: dailyInterest
          });
          
          operations.push({
            user_id: loan.user_id,
            amount: dailyInterest,
            loan_id: loan.id
          });
          
          userCacheClears.add(loan.user_id);
          processedLoans++;
          totalInterestAccrued += dailyInterest;
        }
        
        // Batch update loans
        for (const update of loanUpdates) {
          await connection.execute(
            `UPDATE loans SET inr_borrowed_amount = inr_borrowed_amount + ? WHERE id = ?`,
            [update.interest, update.id]
          );
        }
        
        // Batch update users
        for (const update of userUpdates) {
          await connection.execute(
            `UPDATE users SET interest_accrued = interest_accrued + ? WHERE id = ?`,
            [update.interest, update.user_id]
          );
        }
        
        // Batch insert operations
        if (operations.length > 0) {
          const operationValues = operations.map(op => 
            `(${op.user_id}, 'INTEREST_ACCRUAL', 'EXECUTED', ${op.amount}, ${op.loan_id}, 'Daily interest accrual', NOW())`
          ).join(', ');
          
          await connection.execute(
            `INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) VALUES ${operationValues}`
          );
        }
      });
      
      // Log progress for large batches
      if (loans.length > 50) {
        systemLogger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(loans.length / batchSize)}`);
      }
    }
    
    // Clear user caches in batch
    const cachePromises = Array.from(userCacheClears).map(userId => clearUserCache(userId));
    await Promise.all(cachePromises);
    
    const duration = Date.now() - startTime;
    
    systemLogger.success('Daily interest accrual job completed successfully', {
      processedLoans,
      totalInterestAccrued,
      duration: `${duration}ms`,
      avgTimePerLoan: `${(duration / processedLoans).toFixed(2)}ms`
    });
    
    return {
      processedLoans,
      totalInterestAccrued,
      duration,
      success: true
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    systemLogger.error('Error during daily interest accrual', {
      error: error.message,
      stack: error.stack,
      processedLoans,
      duration: `${duration}ms`
    });
    
    return {
      processedLoans,
      totalInterestAccrued,
      duration,
      success: false,
      error: error.message
    };
  }
}

module.exports = accrueInterestDaily;

