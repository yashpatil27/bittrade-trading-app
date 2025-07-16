-- Migration: Add performance indexes
-- Date: 2024-01-15
-- Description: Add strategic database indexes for improved query performance

-- Users table indexes
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'bittrade' AND table_name = 'users' AND index_name = 'idx_users_created_at') = 0,
    'CREATE INDEX idx_users_created_at ON users(created_at DESC);',
    'SELECT "Index idx_users_created_at already exists" as message;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Operations table indexes
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'bittrade' AND table_name = 'operations' AND index_name = 'idx_operations_loan_id') = 0,
    'CREATE INDEX idx_operations_loan_id ON operations(loan_id);',
    'SELECT "Index idx_operations_loan_id already exists" as message;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'bittrade' AND table_name = 'operations' AND index_name = 'idx_operations_created_at') = 0,
    'CREATE INDEX idx_operations_created_at ON operations(created_at DESC);',
    'SELECT "Index idx_operations_created_at already exists" as message;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Loans table indexes
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'bittrade' AND table_name = 'loans' AND index_name = 'idx_loans_user') = 0,
    'CREATE INDEX idx_loans_user ON loans(user_id);',
    'SELECT "Index idx_loans_user already exists" as message;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'bittrade' AND table_name = 'loans' AND index_name = 'idx_loans_ltv_ratio') = 0,
    'CREATE INDEX idx_loans_ltv_ratio ON loans(ltv_ratio);',
    'SELECT "Index idx_loans_ltv_ratio already exists" as message;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Log completion
INSERT INTO migration_log (migration_file, applied_at, notes) VALUES 
('003_add_performance_indexes.sql', NOW(), 'Added performance indexes for users, operations, and loans tables');
