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

-- Bitcoin data table (comprehensive Bitcoin data updated every 30 seconds)
CREATE TABLE bitcoin_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Price Data (Updated every 30 seconds)
  btc_usd_price INT NOT NULL,                     -- Main price (whole numbers)
  price_change_24h INT DEFAULT NULL,              -- 24h change amount
  price_change_24h_pct DECIMAL(8,2) DEFAULT NULL, -- 24h change %
  
  -- Market Data (Updated every 30 seconds, but less critical)
  market_cap_usd BIGINT UNSIGNED NULL,
  volume_24h_usd BIGINT UNSIGNED NULL,
  high_24h_usd INT DEFAULT NULL,
  low_24h_usd INT DEFAULT NULL,
  btc_dominance_pct DECIMAL(5,2) DEFAULT NULL,
  
  -- Price Changes (All Timeframes)
  price_change_1h_pct DECIMAL(8,2) DEFAULT NULL,
  price_change_7d_pct DECIMAL(8,2) DEFAULT NULL,
  price_change_30d_pct DECIMAL(8,2) DEFAULT NULL,
  price_change_60d_pct DECIMAL(8,2) DEFAULT NULL,
  price_change_200d_pct DECIMAL(8,2) DEFAULT NULL,
  price_change_1y_pct DECIMAL(8,2) DEFAULT NULL,
  
  -- All-Time Records
  ath_usd INT DEFAULT NULL,
  ath_date DATE NULL,
  ath_change_pct DECIMAL(8,2) DEFAULT NULL,
  atl_usd INT DEFAULT NULL,
  atl_date DATE NULL,
  atl_change_pct DECIMAL(8,2) DEFAULT NULL,
  
  -- Timestamps
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bitcoin sentiment data (Fear & Greed Index)
CREATE TABLE bitcoin_sentiment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Fear & Greed Index (Alternative.me)
  fear_greed_value TINYINT UNSIGNED NULL,          -- 0-100
  fear_greed_classification ENUM('Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed') NULL,
  
  -- Timestamps
  data_date DATE NOT NULL,                         -- Daily data
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_date (data_date)
);

-- Bitcoin chart data (historical price data for charts)
CREATE TABLE bitcoin_chart_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  timeframe ENUM('1h', '1d', '7d', '30d', '90d', '365d') NOT NULL,
  price_data JSON NOT NULL,                    -- Only store [[timestamp, price], ...]
  data_points_count INT UNSIGNED NOT NULL,
  
  -- Metadata
  date_from TIMESTAMP NOT NULL,
  date_to TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_timeframe (timeframe)
);

-- Insert default settings
INSERT INTO settings (`key`, value) VALUES 
('buy_multiplier', 91),
('sell_multiplier', 88);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_settings_key ON settings(`key`);

-- Bitcoin data indexes
CREATE INDEX idx_bitcoin_data_last_updated ON bitcoin_data(last_updated);
CREATE INDEX idx_bitcoin_data_btc_usd_price ON bitcoin_data(btc_usd_price);
CREATE INDEX idx_bitcoin_data_created_at ON bitcoin_data(created_at);

-- Bitcoin sentiment indexes
CREATE INDEX idx_bitcoin_sentiment_data_date ON bitcoin_sentiment(data_date);

-- Bitcoin chart data indexes
CREATE INDEX idx_bitcoin_chart_data_timeframe ON bitcoin_chart_data(timeframe);
