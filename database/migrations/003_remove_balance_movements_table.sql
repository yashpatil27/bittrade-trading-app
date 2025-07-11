-- Migration: Remove unused balance_movements table
-- Date: 2025-07-11
-- Description: Drop balance_movements table as it's not being used and adds unnecessary complexity

USE bittrade;

-- Check if table exists before dropping
DROP TABLE IF EXISTS balance_movements;

-- Verify the table has been removed
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'bittrade' 
AND TABLE_NAME = 'balance_movements';
