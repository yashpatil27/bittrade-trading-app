-- Migration: Add cancellation tracking columns to operations table
-- This allows tracking when orders are cancelled and why
-- Adjusted for current table structure

USE bittrade;

-- Add cancellation tracking columns to the current operations table
ALTER TABLE operations 
ADD COLUMN cancelled_at TIMESTAMP NULL AFTER updated_at,
ADD COLUMN cancellation_reason VARCHAR(255) NULL AFTER cancelled_at;

-- Add index for cancelled_at for performance
CREATE INDEX idx_operations_cancelled_at ON operations(cancelled_at);

-- Update existing cancelled orders to have cancelled_at timestamp
UPDATE operations 
SET cancelled_at = created_at 
WHERE status = 'cancelled' AND cancelled_at IS NULL;

SELECT 'Migration completed: Added cancellation tracking columns to operations table' as status;
