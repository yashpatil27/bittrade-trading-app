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

### 2025-07-09 05:00:00 UTC
- **Migration**: `002_add_loan_add_collateral_type.sql`
- **Description**: Added LOAN_ADD_COLLATERAL operation type to support adding collateral to existing loans
- **Changes**:
  - Added `LOAN_ADD_COLLATERAL` to operations.type ENUM
- **Reason**: Fixed "Data truncated for column 'type'" error when adding collateral to loans
- **Status**: ✅ Applied successfully

### Notes
- These migrations were required to support the loan management functionality
- The schema.sql file has been updated to include all operation types
- The migrations bring the database in line with the expected schema
