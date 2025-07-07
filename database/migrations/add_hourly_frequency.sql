-- Migration: Add HOURLY frequency option to DCA plans
-- Date: 2025-07-07
-- Description: Adds HOURLY as a new frequency option for DCA plans

USE bittrade;

-- Add HOURLY to the frequency ENUM in active_plans table
ALTER TABLE active_plans 
MODIFY COLUMN frequency ENUM('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL;

-- Verify the change
DESCRIBE active_plans;
