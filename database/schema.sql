-- ₿itTrade Database Schema v2.0
-- Comprehensive schema for limit orders, DCA, and overcollateralized loans
-- MySQL Implementation

-- Create database
CREATE DATABASE IF NOT EXISTS bittrade;
USE bittrade;

-- Users table (Enhanced with balance segregation)
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_pin VARCHAR(4) NOT NULL DEFAULT '1234',
  is_admin BOOLEAN DEFAULT false,
  
  -- Balance segregation (INR amounts in rupees, BTC amounts in satoshis)
  available_inr INT DEFAULT 0,           -- Liquid INR balance (rupees)
  available_btc BIGINT DEFAULT 0,        -- Liquid BTC balance (satoshis)
  reserved_inr INT DEFAULT 0,            -- INR locked in pending orders (rupees)
  reserved_btc BIGINT DEFAULT 0,         -- BTC locked in pending orders (satoshis)
  collateral_btc BIGINT DEFAULT 0,       -- BTC locked as loan collateral (satoshis)
  borrowed_inr INT DEFAULT 0,            -- Total INR borrowed against collateral (rupees)
  interest_accrued INT DEFAULT 0,        -- Accumulated loan interest (rupees)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Operations table (Unified activity log for all operations)
CREATE TABLE operations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM(
    'MARKET_BUY', 'MARKET_SELL', 
    'LIMIT_BUY', 'LIMIT_SELL', 
    'DCA_BUY', 'DCA_SELL', 
    'LOAN_CREATE', 'LOAN_BORROW', 'LOAN_REPAY', 'LOAN_ADD_COLLATERAL', 'LIQUIDATION', 
    'PARTIAL_LIQUIDATION', 'FULL_LIQUIDATION',
    'INTEREST_ACCRUAL',
    'DEPOSIT_INR', 'WITHDRAW_INR', 'DEPOSIT_BTC', 'WITHDRAW_BTC'
  ) NOT NULL,
  status ENUM('PENDING', 'EXECUTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  
  -- Amount fields
  btc_amount BIGINT NOT NULL DEFAULT 0,  -- BTC amount in satoshis
  inr_amount INT NOT NULL DEFAULT 0,     -- INR amount in rupees
  execution_price INT,                   -- Actual execution price (INR per BTC)
  limit_price INT,                       -- Target price for limit orders (INR per BTC)
  
  -- Relationships
  parent_id INT,                         -- For DCA installments or related operations
  loan_id INT,                          -- Reference to loan for loan operations
  
  -- Scheduling
  scheduled_at TIMESTAMP,               -- When operation should execute
  executed_at TIMESTAMP,                -- When operation was executed
  expires_at TIMESTAMP,                 -- When operation expires
  cancelled_at TIMESTAMP,
  cancellation_reason VARCHAR(255) NULL,

  -- Metadata
  notes TEXT,                           -- Additional operation details
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES operations(id) ON DELETE SET NULL,
  INDEX idx_user_operations (user_id, created_at DESC),
  INDEX idx_status_scheduled (status, scheduled_at),
  INDEX idx_type_status (type, status),
  INDEX idx_operations_loan_id (loan_id),
  INDEX idx_operations_created_at (created_at DESC)
);

-- Active Plans table (For recurring operations like DCA)
CREATE TABLE active_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_type ENUM('DCA_BUY', 'DCA_SELL') NOT NULL,
  status ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  
  -- Plan configuration
  frequency ENUM('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
  amount_per_execution INT NOT NULL,     -- INR amount per execution (rupees)
  next_execution_at TIMESTAMP NOT NULL,
  
  -- Execution tracking
  total_executions INT DEFAULT 0,
  remaining_executions INT,              -- NULL for unlimited
  max_price INT,                        -- Max price per BTC (optional)
  min_price INT,                        -- Min price per BTC (optional)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_active_plans_execution (status, next_execution_at)
);

-- Loans table (Overcollateralized loan management)
CREATE TABLE loans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  
  -- Loan amounts
  btc_collateral_amount BIGINT NOT NULL,        -- BTC locked as collateral (satoshis)
  inr_borrowed_amount INT NOT NULL,             -- INR borrowed (rupees)
  ltv_ratio DECIMAL(5,2) NOT NULL,             -- e.g., 60.00 for 60% LTV
  interest_rate DECIMAL(5,2) NOT NULL,         -- Annual interest rate
  
  -- Risk management
  liquidation_price DECIMAL(10,2),             -- BTC price triggering liquidation
  
  status ENUM('ACTIVE', 'REPAID', 'LIQUIDATED') NOT NULL DEFAULT 'ACTIVE',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  repaid_at TIMESTAMP,
  liquidated_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_loans_status (status),
  INDEX idx_loans_user (user_id),
  INDEX idx_loans_liquidation (status, liquidation_price),
  INDEX idx_loans_ltv_ratio (ltv_ratio)
);


-- Settings table (unchanged)
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  value INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bitcoin data table (unchanged)
CREATE TABLE bitcoin_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Price Data (Updated every 30 seconds)
  btc_usd_price INT NOT NULL,
  price_change_24h INT DEFAULT NULL,
  price_change_24h_pct DECIMAL(8,2) DEFAULT NULL,
  
  -- Market Data
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

-- Bitcoin sentiment table (unchanged)
CREATE TABLE bitcoin_sentiment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  fear_greed_value TINYINT UNSIGNED NULL,
  fear_greed_classification ENUM('Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed') NULL,
  
  data_date DATE NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_date (data_date)
);

-- Bitcoin chart data table (unchanged)
CREATE TABLE bitcoin_chart_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  timeframe ENUM('1d', '7d', '30d', '90d', '365d') NOT NULL,
  price_data JSON NOT NULL,
  data_points_count INT UNSIGNED NOT NULL,
  
  date_from TIMESTAMP NOT NULL,
  date_to TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (`key`, value) VALUES 
('buy_multiplier', 91),
('sell_multiplier', 88);

-- Create additional indexes for performance
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
CREATE INDEX idx_bitcoin_chart_data_timeframe_updated ON bitcoin_chart_data(timeframe, last_updated DESC);
CREATE INDEX idx_bitcoin_chart_data_last_updated ON bitcoin_chart_data(last_updated DESC);

