-- ₿itTrade Database Schema
-- MySQL Implementation

-- Create database
CREATE DATABASE IF NOT EXISTS bittrade;
USE bittrade;

-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_pin VARCHAR(4) NOT NULL DEFAULT '1234',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table (stores balance snapshots after each transaction)
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('SETUP', 'DEPOSIT_INR', 'BUY', 'SELL', 'WITHDRAW_INR', 'DEPOSIT_BTC', 'WITHDRAW_BTC') NOT NULL,
  inr_amount INT NOT NULL, -- 1 = 1 rupee
  btc_amount BIGINT NOT NULL, -- 1 = 1 satoshi
  btc_price INT NOT NULL, -- 1 = 1 INR per BTC (calculated price used for transaction)
  inr_balance INT NOT NULL, -- user's INR balance after this transaction
  btc_balance BIGINT NOT NULL, -- user's BTC balance after this transaction (in satoshis)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System settings (for buy/sell multipliers)
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  `key` VARCHAR(100) UNIQUE NOT NULL, -- 'buy_multiplier' or 'sell_multiplier'
  value INT NOT NULL, -- 91 for buy_multiplier, 88 for sell_multiplier
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Price table (only stores raw BTC/USD price from CoinGecko API every 30 seconds)
CREATE TABLE prices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  btc_usd_price INT NOT NULL, -- Raw BTC/USD price from CoinGecko
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (`key`, value) VALUES 
('buy_multiplier', 91),
('sell_multiplier', 88);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_prices_created_at ON prices(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_settings_key ON settings(`key`);
