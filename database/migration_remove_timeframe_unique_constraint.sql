-- Migration: Remove unique constraint on timeframe to allow multiple records per timeframe
-- This enables fallback resilience by keeping 2 records per timeframe

USE bittrade;

-- Remove the unique constraint on timeframe
ALTER TABLE bitcoin_chart_data DROP INDEX unique_timeframe;

-- Add optimized indexes for the new pattern
CREATE INDEX idx_bitcoin_chart_data_timeframe_updated ON bitcoin_chart_data(timeframe, last_updated DESC);
CREATE INDEX idx_bitcoin_chart_data_last_updated ON bitcoin_chart_data(last_updated DESC);

-- Show updated schema
DESCRIBE bitcoin_chart_data;
SHOW INDEX FROM bitcoin_chart_data;
