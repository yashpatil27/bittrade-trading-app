-- Add sample balance to admin user for testing
USE bittrade;

-- Give admin user ₹100,000 balance for testing
UPDATE users SET available_inr = 100000 WHERE email = 'admin@bittrade.co.in';

-- Add an operation record for this deposit
INSERT INTO operations (user_id, type, status, inr_amount, btc_amount, execution_price, executed_at) 
VALUES (1, 'DEPOSIT_INR', 'EXECUTED', 100000, 0, 0, NOW());
