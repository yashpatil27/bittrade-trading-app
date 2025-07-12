const { query, transaction } = require('./server/config/database');
const LoanService = require('./server/services/loanService');

async function testLoanScenarios() {
  console.log('=== TESTING LOAN SCENARIOS ===\n');
  
  const userId = 1;
  
  try {
    // Step 1: Check initial state
    console.log('1. Initial user state:');
    const initialUser = await query('SELECT available_btc, collateral_btc, available_inr, borrowed_inr, interest_accrued FROM users WHERE id = ?', [userId]);
    console.log(initialUser[0]);
    
    // Step 2: Create a loan with some collateral
    console.log('\n2. Creating loan with 300000 satoshis collateral...');
    const collateralAmount = 300000; // 0.003 BTC
    const loanResult = await LoanService.depositCollateral(userId, collateralAmount);
    console.log('Loan created:', loanResult);
    
    // Step 3: Borrow some INR
    console.log('\n3. Borrowing 10000 INR...');
    const borrowResult = await LoanService.borrowFunds(userId, 10000);
    console.log('Borrow result:', borrowResult);
    
    // Step 4: Check current loan state
    console.log('\n4. Current loan state:');
    const loanStatus = await LoanService.getLoanStatus(userId);
    console.log(loanStatus);
    
    // Step 5: Check initial operations
    console.log('\n5. Initial operations created:');
    const initialOps = await query('SELECT id, type, inr_amount, btc_amount, notes, created_at FROM operations WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [userId]);
    console.log(initialOps);
    
    console.log('\n=== SETUP COMPLETE ===');
    console.log('Now we have:');
    console.log('- Loan with 300000 satoshis collateral');
    console.log('- 10000 INR borrowed');
    console.log('- Zero interest accrued (new loan)');
    console.log('- Ready to test different scenarios\n');
    
  } catch (error) {
    console.error('Error in test setup:', error);
  }
}

async function testPartialRepayment() {
  console.log('=== TESTING PARTIAL REPAYMENT ===\n');
  
  const userId = 1;
  
  try {
    // Test 50% repayment
    console.log('Testing 50% repayment (5062 INR)...');
    
    // Check operations before repayment
    const opsBefore = await query('SELECT COUNT(*) as count FROM operations WHERE user_id = ?', [userId]);
    console.log('Operations before repayment:', opsBefore[0].count);
    
    // Perform partial repayment
    const repayResult = await LoanService.repayLoan(userId, 5062);
    console.log('Repayment result:', repayResult);
    
    // Check operations after repayment
    const opsAfter = await query('SELECT type, inr_amount, btc_amount, notes, created_at FROM operations WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
    console.log('New operations created:');
    opsAfter.forEach(op => console.log(`- ${op.type}: ₹${op.inr_amount || 0} / ${op.btc_amount || 0} sats - ${op.notes}`));
    
    // Check final loan state
    const finalLoan = await LoanService.getLoanStatus(userId);
    console.log('Final loan state:', finalLoan);
    
  } catch (error) {
    console.error('Error in partial repayment test:', error);
  }
}

async function testFullRepayment() {
  console.log('=== TESTING FULL REPAYMENT ===\n');
  
  const userId = 1;
  
  try {
    // Get current loan state
    const loanStatus = await LoanService.getLoanStatus(userId);
    console.log('Current loan state:', loanStatus);
    
    // Calculate full repayment amount (remaining debt + minimum interest)
    const fullRepaymentAmount = loanStatus.borrowedAmount + loanStatus.minimumInterestDue;
    console.log(`Full repayment amount: ₹${fullRepaymentAmount} (₹${loanStatus.borrowedAmount} debt + ₹${loanStatus.minimumInterestDue} minimum interest)`);
    
    // Check operations before repayment
    const opsBefore = await query('SELECT COUNT(*) as count FROM operations WHERE user_id = ?', [userId]);
    console.log('Operations before repayment:', opsBefore[0].count);
    
    // Perform full repayment
    const repayResult = await LoanService.repayLoan(userId, fullRepaymentAmount);
    console.log('Repayment result:', repayResult);
    
    // Check operations after repayment
    const opsAfter = await query('SELECT type, inr_amount, btc_amount, notes, created_at FROM operations WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
    console.log('New operations created:');
    opsAfter.forEach(op => console.log(`- ${op.type}: ₹${op.inr_amount || 0} / ${op.btc_amount || 0} sats - ${op.notes}`));
    
    // Check final loan state
    const finalLoan = await LoanService.getLoanStatus(userId);
    console.log('Final loan state:', finalLoan);
    
  } catch (error) {
    console.error('Error in full repayment test:', error);
  }
}

async function cleanupAndExit() {
  console.log('\n=== CLEANUP ===');
  // Close any active loans
  try {
    const activeLoan = await query('SELECT * FROM loans WHERE user_id = ? AND status = "ACTIVE"', [1]);
    if (activeLoan.length > 0) {
      console.log('Closing active loan...');
      await LoanService.executeFullLiquidation(1);
    }
  } catch (error) {
    console.log('No active loan to close');
  }
  
  process.exit(0);
}

// Run the test
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'setup') {
    testLoanScenarios();
  } else if (args[0] === 'partial-repay') {
    testPartialRepayment();
  } else if (args[0] === 'full-repay') {
    testFullRepayment();
  } else if (args[0] === 'cleanup') {
    cleanupAndExit();
  } else {
    console.log('Usage:');
    console.log('  node test-loan-scenarios.js setup');
    console.log('  node test-loan-scenarios.js partial-repay');
    console.log('  node test-loan-scenarios.js full-repay');
    console.log('  node test-loan-scenarios.js cleanup');
  }
}
