-- ₿itTrade Database Seed Data
-- Clean seed with only admin account

USE bittrade;

-- Insert a current Bitcoin price (around $100,000 USD)
INSERT INTO prices (btc_usd_price) VALUES (100000);

-- Create the admin account
-- Password: admin123
-- Hashed password: $2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O
INSERT INTO users (id, email, name, password_hash, user_pin, is_admin, created_at) VALUES 
(1, 'admin@bittrade.co.in', 'Admin', '$2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O', '1234', true, NOW());

-- SETUP transaction for admin account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(1, 'SETUP', 0, 0, 0, 0, 0);
