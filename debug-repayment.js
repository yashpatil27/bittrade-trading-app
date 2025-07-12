const { query, transaction } = require('./server/config/database');
const LoanService = require('./server/services/loanService');

async function debugFullRepayment() {
  console.log('=== DEBUG FULL REPAYMENT LOGIC ===\n');
  
  const userId = 1;
  
  try {
    // Get loan details
    const [loanRows] = await query('SELECT * FROM loans WHERE user_id = ? AND status = "ACTIVE"', [userId]);
    if (loanRows.length === 0) {
      console.log('No active loan found');
      return;
    }
    
    const loan = loanRows[0];
    console.log('Loan details:', {
      id: loan.id,
      inr_borrowed_amount: loan.inr_borrowed_amount,
      created_at: loan.created_at
    });
    
    // Calculate minimum interest due
    const minimumInterestDue = await LoanService.calculateMinimumInterestDue(loan);
    console.log('Minimum interest due:', minimumInterestDue);
    
    // Get original borrowed amount
    const borrowOperations = await query(
      'SELECT SUM(inr_amount) as total_borrowed FROM operations WHERE loan_id = ? AND type = "LOAN_BORROW"',
      [loan.id]
    );
    const originalBorrowedAmount = borrowOperations[0]?.total_borrowed || 0;
    console.log('Original borrowed amount:', originalBorrowedAmount);
    
    // Calculate current interest accrued
    const currentInterestAccrued = loan.inr_borrowed_amount - originalBorrowedAmount;
    console.log('Current interest accrued:', currentInterestAccrued);
    
    // Calculate total amount due
    const interestDue = Math.max(minimumInterestDue, currentInterestAccrued);
    const totalAmountDue = originalBorrowedAmount + interestDue;
    console.log('Total amount due:', totalAmountDue);
    
    // Test repayment amount
    const repayAmount = totalAmountDue;
    console.log('Repay amount:', repayAmount);
    
    // Check if this is a full repayment
    const isFullRepayment = repayAmount === totalAmountDue;
    console.log('Is full repayment:', isFullRepayment);
    
    // Calculate additional interest needed
    const additionalInterestNeeded = Math.max(0, minimumInterestDue - currentInterestAccrued);
    console.log('Additional interest needed:', additionalInterestNeeded);
    
    // Check condition for INTEREST_ACCRUAL creation
    console.log('Will create INTEREST_ACCRUAL?', isFullRepayment && additionalInterestNeeded > 0);
    
    // Show what operations should be created
    console.log('\n=== EXPECTED OPERATIONS ===');
    if (isFullRepayment && additionalInterestNeeded > 0) {
      console.log('1. INTEREST_ACCRUAL:', additionalInterestNeeded);
      console.log('2. LOAN_REPAY:', repayAmount - minimumInterestDue);
    } else {
      console.log('1. LOAN_REPAY:', repayAmount);
    }
    
  } catch (error) {
    console.error('Error in debug:', error);
  }
}

// Run the debug
debugFullRepayment();
