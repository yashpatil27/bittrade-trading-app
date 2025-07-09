-- Add loan interest rate setting to settings table
INSERT INTO settings (`key`, value) VALUES ('loan_interest_rate', 15)
ON DUPLICATE KEY UPDATE value = 15;
