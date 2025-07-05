-- Migration: Add Bitcoin data tables
-- Drop the old prices table and add comprehensive Bitcoin data tables

USE bittrade;

-- Drop old prices table if it exists
DROP TABLE IF EXISTS prices;

-- Bitcoin data table (comprehensive Bitcoin data updated every 30 seconds)
CREATE TABLE IF NOT EXISTS bitcoin_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Price Data (Updated every 30 seconds)
  btc_usd_price DECIMAL(15,8) NOT NULL,           -- Main price (high precision)
  price_change_24h DECIMAL(15,8) NULL,            -- 24h change amount
  price_change_24h_pct DECIMAL(8,4) NULL,         -- 24h change %
  
  -- Market Data (Updated every 30 seconds, but less critical)
  market_cap_usd BIGINT UNSIGNED NULL,
  volume_24h_usd BIGINT UNSIGNED NULL,
  high_24h_usd DECIMAL(15,8) NULL,
  low_24h_usd DECIMAL(15,8) NULL,
  btc_dominance_pct DECIMAL(5,2) NULL,
  
  -- Price Changes (All Timeframes)
  price_change_1h_pct DECIMAL(8,4) NULL,
  price_change_7d_pct DECIMAL(8,4) NULL,
  price_change_30d_pct DECIMAL(8,4) NULL,
  price_change_60d_pct DECIMAL(8,4) NULL,
  price_change_200d_pct DECIMAL(8,4) NULL,
  price_change_1y_pct DECIMAL(8,4) NULL,
  
  -- All-Time Records
  ath_usd DECIMAL(15,8) NULL,
  ath_date DATE NULL,
  ath_change_pct DECIMAL(8,4) NULL,
  atl_usd DECIMAL(15,8) NULL,
  atl_date DATE NULL,
  atl_change_pct DECIMAL(8,4) NULL,
  
  -- Timestamps
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bitcoin sentiment data (Fear & Greed Index)
CREATE TABLE IF NOT EXISTS bitcoin_sentiment (
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
CREATE TABLE IF NOT EXISTS bitcoin_chart_data (
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

-- Create indexes for better performance

-- Bitcoin data indexes
CREATE INDEX idx_bitcoin_data_last_updated ON bitcoin_data(last_updated);
CREATE INDEX idx_bitcoin_data_btc_usd_price ON bitcoin_data(btc_usd_price);
CREATE INDEX idx_bitcoin_data_created_at ON bitcoin_data(created_at);

-- Bitcoin sentiment indexes
CREATE INDEX idx_bitcoin_sentiment_data_date ON bitcoin_sentiment(data_date);

-- Bitcoin chart data indexes
CREATE INDEX idx_bitcoin_chart_data_timeframe ON bitcoin_chart_data(timeframe);
