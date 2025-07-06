-- Migration: Remove 1h timeframe from bitcoin_chart_data table
-- This migration removes the '1h' option from the timeframe ENUM

USE bittrade;

-- First delete any existing 1h data
DELETE FROM bitcoin_chart_data WHERE timeframe = '1h';

-- Modify the timeframe column to remove '1h' from the enum
ALTER TABLE bitcoin_chart_data 
MODIFY COLUMN timeframe ENUM('1d', '7d', '30d', '90d', '365d') NOT NULL;

-- Verify the updated schema
DESCRIBE bitcoin_chart_data;
SHOW INDEX FROM bitcoin_chart_data;
