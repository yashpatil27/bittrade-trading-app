-- Fix database column precision issues
USE bittrade;

-- Increase precision for percentage columns that might have large values
ALTER TABLE bitcoin_data MODIFY COLUMN ath_change_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN atl_change_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_1h_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_7d_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_30d_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_60d_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_200d_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_1y_pct DECIMAL(10,4) NULL;
ALTER TABLE bitcoin_data MODIFY COLUMN price_change_24h_pct DECIMAL(10,4) NULL;
