-- Migration: Update bitcoin_data table schema to use integer types for price columns
-- This migration converts price columns from decimal to integer for cleaner price display

USE bittrade;

-- Disable foreign key checks during schema modification
SET FOREIGN_KEY_CHECKS = 0;

-- Update price columns to INTEGER (for USD prices that should be whole numbers)
ALTER TABLE bitcoin_data 
  MODIFY COLUMN btc_usd_price INT NOT NULL,
  MODIFY COLUMN price_change_24h INT DEFAULT NULL,
  MODIFY COLUMN high_24h_usd INT DEFAULT NULL,
  MODIFY COLUMN low_24h_usd INT DEFAULT NULL,
  MODIFY COLUMN ath_usd INT DEFAULT NULL,
  MODIFY COLUMN atl_usd INT DEFAULT NULL;

-- Keep percentage columns as DECIMAL but with fewer decimal places (2 decimal places is sufficient)
ALTER TABLE bitcoin_data 
  MODIFY COLUMN price_change_24h_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN btc_dominance_pct DECIMAL(5,2) DEFAULT NULL,
  MODIFY COLUMN price_change_1h_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN price_change_7d_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN price_change_30d_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN price_change_60d_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN price_change_200d_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN price_change_1y_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN ath_change_pct DECIMAL(8,2) DEFAULT NULL,
  MODIFY COLUMN atl_change_pct DECIMAL(8,2) DEFAULT NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Show updated schema
DESCRIBE bitcoin_data;
