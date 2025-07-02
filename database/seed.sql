-- ₿itTrade Database Seed Data
-- This file creates example users and demonstrates all transaction types

USE bittrade;

-- Insert a current Bitcoin price (around $100,000 USD for demo)
INSERT INTO prices (btc_usd_price) VALUES (100000);

-- Create additional test users (Admin already exists from schema.sql)
-- Password for all test users: password123
-- Hashed password: $2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O

-- Test User 1: Alice (Regular user)
INSERT INTO users (email, name, password_hash, is_admin) VALUES 
('alice@example.com', 'Alice Johnson', '$2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O', false);

-- Test User 2: Bob (Regular user)
INSERT INTO users (email, name, password_hash, is_admin) VALUES 
('bob@example.com', 'Bob Smith', '$2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O', false);

-- Test User 3: Charlie (Regular user)
INSERT INTO users (email, name, password_hash, is_admin) VALUES 
('charlie@example.com', 'Charlie Brown', '$2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O', false);

-- Test User 4: Diana (Regular user)
INSERT INTO users (email, name, password_hash, is_admin) VALUES 
('diana@example.com', 'Diana Prince', '$2a$10$ZlKfOsqGwFd5PQQUOFbEBuCrF8FcSU8jzWtEGl5L0YfOUNb4QzB8O', false);

-- ============================================================================
-- TRANSACTION SCENARIOS - Demonstrating ALL transaction types
-- ============================================================================

-- User IDs: 1=Admin, 2=Alice, 3=Bob, 4=Charlie, 5=Diana
-- Current BTC price: $100,000 USD
-- Buy rate: 100000 * 91 = 9,100,000 INR/BTC
-- Sell rate: 100000 * 88 = 8,800,000 INR/BTC

-- ============================================================================
-- ALICE'S TRADING JOURNEY (User ID: 2)
-- ============================================================================

-- 1. SETUP - Alice creates account (automatic 0 balances)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'SETUP', 0, 0, 0, 0, 0);

-- 2. DEPOSIT_INR - Admin deposits ₹50,000 INR to Alice's account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'DEPOSIT_INR', 50000, 0, 0, 50000, 0);

-- 3. BUY - Alice buys ₹27,300 worth of Bitcoin (0.003 BTC at 9,100,000 INR/BTC)
-- 0.003 BTC = 300,000 satoshis
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'BUY', 27300, 300000, 9100000, 22700, 300000);

-- 4. BUY - Alice buys more Bitcoin: ₹18,200 worth (0.002 BTC)
-- 0.002 BTC = 200,000 satoshis
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'BUY', 18200, 200000, 9100000, 4500, 500000);

-- 5. DEPOSIT_BTC - Admin deposits 0.001 BTC (100,000 satoshis) to Alice's account
-- For accounting: 0.001 BTC at sell rate = 100,000 * 8,800,000 / 100,000,000 = 8,800 INR equivalent
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'DEPOSIT_BTC', 8800, 100000, 8800000, 4500, 600000);

-- 6. SELL - Alice sells 0.0015 BTC (150,000 satoshis) for ₹13,200 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'SELL', 13200, 150000, 8800000, 17700, 450000);

-- 7. WITHDRAW_INR - Admin withdraws ₹5,000 INR from Alice's account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(2, 'WITHDRAW_INR', 5000, 0, 0, 12700, 450000);

-- ============================================================================
-- BOB'S TRADING JOURNEY (User ID: 3)
-- ============================================================================

-- 1. SETUP - Bob creates account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(3, 'SETUP', 0, 0, 0, 0, 0);

-- 2. DEPOSIT_INR - Admin deposits ₹75,000 INR to Bob's account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(3, 'DEPOSIT_INR', 75000, 0, 0, 75000, 0);

-- 3. BUY - Bob buys ₹45,500 worth of Bitcoin (0.005 BTC = 500,000 satoshis)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(3, 'BUY', 45500, 500000, 9100000, 29500, 500000);

-- 4. SELL - Bob sells 0.002 BTC (200,000 satoshis) for ₹17,600 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(3, 'SELL', 17600, 200000, 8800000, 47100, 300000);

-- 5. BUY - Bob buys more: ₹27,300 worth (0.003 BTC = 300,000 satoshis)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(3, 'BUY', 27300, 300000, 9100000, 19800, 600000);

-- ============================================================================
-- CHARLIE'S JOURNEY (User ID: 4) - Heavy Trading Activity
-- ============================================================================

-- 1. SETUP - Charlie creates account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'SETUP', 0, 0, 0, 0, 0);

-- 2. DEPOSIT_INR - Admin deposits ₹100,000 INR to Charlie's account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'DEPOSIT_INR', 100000, 0, 0, 100000, 0);

-- 3. BUY - Charlie buys ₹91,000 worth of Bitcoin (0.01 BTC = 1,000,000 satoshis)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'BUY', 91000, 1000000, 9100000, 9000, 1000000);

-- 4. SELL - Charlie sells 0.0025 BTC (250,000 satoshis) for ₹22,000 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'SELL', 22000, 250000, 8800000, 31000, 750000);

-- 5. DEPOSIT_INR - Admin adds more funds: ₹25,000 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'DEPOSIT_INR', 25000, 0, 0, 56000, 750000);

-- 6. BUY - Charlie buys ₹45,500 worth (0.005 BTC = 500,000 satoshis)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(4, 'BUY', 45500, 500000, 9100000, 10500, 1250000);

-- ============================================================================
-- DIANA'S JOURNEY (User ID: 5) - BTC Deposits/Withdrawals Focus
-- ============================================================================

-- 1. SETUP - Diana creates account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'SETUP', 0, 0, 0, 0, 0);

-- 2. DEPOSIT_BTC - Admin deposits 0.005 BTC (500,000 satoshis) to Diana's account
-- Equivalent INR value: 0.005 * 8,800,000 = ₹44,000
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'DEPOSIT_BTC', 44000, 500000, 8800000, 0, 500000);

-- 3. SELL - Diana sells 0.002 BTC (200,000 satoshis) for ₹17,600 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'SELL', 17600, 200000, 8800000, 17600, 300000);

-- 4. DEPOSIT_INR - Admin deposits ₹20,000 INR to Diana's account
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'DEPOSIT_INR', 20000, 0, 0, 37600, 300000);

-- 5. BUY - Diana buys ₹18,200 worth (0.002 BTC = 200,000 satoshis)
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'BUY', 18200, 200000, 9100000, 19400, 500000);

-- 6. WITHDRAW_BTC - Admin withdraws 0.0015 BTC (150,000 satoshis) from Diana's account
-- Equivalent INR value: 0.0015 * 8,800,000 = ₹13,200
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'WITHDRAW_BTC', 13200, 150000, 8800000, 19400, 350000);

-- 7. SELL - Diana sells remaining 0.0035 BTC (350,000 satoshis) for ₹30,800 INR
INSERT INTO transactions (user_id, type, inr_amount, btc_amount, btc_price, inr_balance, btc_balance) VALUES 
(5, 'SELL', 30800, 350000, 8800000, 50200, 0);

-- ============================================================================
-- ADD MORE PRICE HISTORY DATA (for charts and history)
-- ============================================================================

INSERT INTO prices (btc_usd_price, created_at) VALUES 
(99500, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(100200, DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
(99800, DATE_SUB(NOW(), INTERVAL 20 MINUTE)),
(100100, DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
(100300, DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
(99900, DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
(100000, NOW());

-- ============================================================================
-- SUMMARY OF FINAL BALANCES:
-- ============================================================================
-- Admin (ID: 1): INR: ₹0, BTC: 0 BTC
-- Alice (ID: 2): INR: ₹12,700, BTC: 0.0045 BTC (450,000 sats)
-- Bob (ID: 3): INR: ₹19,800, BTC: 0.006 BTC (600,000 sats) 
-- Charlie (ID: 4): INR: ₹10,500, BTC: 0.0125 BTC (1,250,000 sats)
-- Diana (ID: 5): INR: ₹50,200, BTC: 0 BTC

-- ALL TRANSACTION TYPES DEMONSTRATED:
-- ✅ SETUP - Account initialization
-- ✅ DEPOSIT_INR - Admin deposits INR to user accounts
-- ✅ BUY - Users buy Bitcoin with INR
-- ✅ SELL - Users sell Bitcoin for INR
-- ✅ WITHDRAW_INR - Admin withdraws INR from user accounts
-- ✅ DEPOSIT_BTC - Admin deposits Bitcoin to user accounts
-- ✅ WITHDRAW_BTC - Admin withdraws Bitcoin from user accounts
