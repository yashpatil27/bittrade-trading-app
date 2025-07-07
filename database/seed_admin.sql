-- Seed admin user for BitTrade application
-- Creates admin user with email: admin@bittrade.co.in and password: admin123

USE bittrade;

-- Insert admin user with hashed password (bcrypt hash of 'admin123')
-- Hash generated using bcryptjs with 10 rounds (Node.js compatible): $2a$10$bfEvjOF2B.HzoKjaPGv7OOiBTEFYqiN35WjGPBl5ripmCcmbfG/om
INSERT INTO users (
    email, 
    name, 
    password_hash, 
    user_pin, 
    is_admin,
    available_inr,
    available_btc,
    reserved_inr,
    reserved_btc,
    collateral_btc,
    borrowed_inr,
    interest_accrued
) VALUES (
    'admin@bittrade.co.in',
    'Admin User',
    '$2a$10$bfEvjOF2B.HzoKjaPGv7OOiBTEFYqiN35WjGPBl5ripmCcmbfG/om',
    '1234',
    true,
    0,      -- available_inr (0 rupees)
    0,      -- available_btc (0 satoshis)
    0,      -- reserved_inr (0 rupees)
    0,      -- reserved_btc (0 satoshis)
    0,      -- collateral_btc (0 satoshis)
    0,      -- borrowed_inr (0 rupees)
    0       -- interest_accrued (0 rupees)
);

SELECT 'Admin user seeded successfully' as status;
SELECT id, email, name, is_admin, available_inr, available_btc FROM users WHERE email = 'admin@bittrade.co.in';
