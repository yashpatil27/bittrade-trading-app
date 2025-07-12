const { query } = require('../config/database');

/**
 * Daily Interest Accrual Job
 *
 * This job runs once daily to calculate and apply interest across all loans using a simple daily accrual rate.
 */
async function accrueInterestDaily() {
  try {
    console.log('Starting daily interest accrual job...');

    // Fetch all active loans
    const loans = await query(`SELECT id, user_id, inr_borrowed_amount, interest_rate FROM loans WHERE status = 'ACTIVE'`);

    for (const loan of loans) {
      // Calculate daily interest using round instead of floor
      const dailyInterest = Math.round((loan.inr_borrowed_amount * loan.interest_rate) / 36500);
      
      // Update loan inr_borrowed_amount and user interest accrual
      await query(`UPDATE loans SET inr_borrowed_amount = inr_borrowed_amount + ? WHERE id = ?`, [dailyInterest, loan.id]);
      await query(`UPDATE users SET interest_accrued = interest_accrued + ? WHERE id = ?`, [dailyInterest, loan.user_id]);

      // Log the operation
      await query(
        `INSERT INTO operations (user_id, type, status, inr_amount, loan_id, notes, executed_at) 
         VALUES (?, 'INTEREST_ACCRUAL', 'EXECUTED', ?, ?, 'Daily interest accrual', NOW())`,
        [loan.user_id, dailyInterest, loan.id]
      );

      console.log(`Interest accrued for Loan ID: ${loan.id}, Amount: ₹${dailyInterest}`);
    }
    
    console.log('Daily interest accrual job completed successfully.');

  } catch (error) {
    console.error('Error during daily interest accrual:', error);
  }
}

module.exports = accrueInterestDaily;

