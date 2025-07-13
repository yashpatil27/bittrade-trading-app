-- Migration: Add performance indexes
-- Date: 2024-01-15
-- Description: Add strategic database indexes for improved query performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Operations table indexes
CREATE INDEX IF NOT EXISTS idx_operations_loan_id ON operations(loan_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at DESC);

-- Loans table indexes
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_ltv_ratio ON loans(ltv_ratio);

-- Log completion
INSERT INTO migration_log (migration_file, applied_at, notes) VALUES 
('003_add_performance_indexes.sql', NOW(), 'Added performance indexes for users, operations, and loans tables');
