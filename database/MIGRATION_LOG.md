# Database Migration Log

## Applied Migrations

### 2025-07-08 23:28:30 UTC
- **Migration**: `001_add_loan_operation_types.sql`
- **Description**: Added missing ENUM values to operations table type column
- **Changes**:
  - Added `LOAN_BORROW` to operations.type ENUM
  - Added `PARTIAL_LIQUIDATION` to operations.type ENUM  
  - Added `FULL_LIQUIDATION` to operations.type ENUM
- **Reason**: Fixed "Data truncated for column 'type'" error when borrowing funds
- **Status**: ✅ Applied successfully

### Notes
- This migration was required to support the loan management functionality
- The schema.sql file already contained the correct ENUM definition
- The migration brings the database in line with the expected schema
