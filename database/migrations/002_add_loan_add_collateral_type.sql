-- Migration: Add LOAN_ADD_COLLATERAL operation type
-- Date: 2025-07-09
-- Description: Add LOAN_ADD_COLLATERAL operation type to support adding collateral to existing loans

USE bittrade;

-- Add LOAN_ADD_COLLATERAL operation type to the operations table
ALTER TABLE operations MODIFY type ENUM(
  'MARKET_BUY', 'MARKET_SELL', 
  'LIMIT_BUY', 'LIMIT_SELL', 
  'DCA_BUY', 'DCA_SELL', 
  'LOAN_CREATE', 'LOAN_BORROW', 'LOAN_REPAY', 'LOAN_ADD_COLLATERAL', 'LIQUIDATION', 
  'PARTIAL_LIQUIDATION', 'FULL_LIQUIDATION',
  'INTEREST_ACCRUAL',
  'DEPOSIT_INR', 'WITHDRAW_INR', 'DEPOSIT_BTC', 'WITHDRAW_BTC'
) NOT NULL;

-- Verify the changes
SELECT COLUMN_NAME, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'bittrade' 
AND TABLE_NAME = 'operations' 
AND COLUMN_NAME = 'type';
