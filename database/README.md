# BitTrade Database Setup

This directory contains scripts and files for setting up and managing the BitTrade database.

## Quick Start

### Option 1: Using Bash Script (Recommended)
```bash
# Make sure you have a .env file in the project root
cd /path/to/bittrade-trading-app
./database/setup_fresh_db.sh
```

### Option 2: Using Node.js Script
```bash
# Make sure you have a .env file in the project root
cd /path/to/bittrade-trading-app
node database/setup_fresh_db.js
```

## Files Overview

### Core Files
- `schema.sql` - Complete database schema with all tables and indexes
- `seed_admin.sql` - Creates the default admin user
- `setup_fresh_db.sh` - Bash script for complete database setup
- `setup_fresh_db.js` - Node.js script for complete database setup

### Migration Files
- `migrations/` - Directory containing database migration files
- `run_migration.js` - Script to run individual migrations
- `MIGRATION_LOG.md` - Log of all applied migrations

## Setup Process

Both setup scripts perform the following steps:

1. **Check MySQL Connection** - Verifies connection to MySQL server
2. **Drop/Create Database** - Drops existing database and creates fresh one
3. **Apply Schema** - Runs the complete schema.sql file
4. **Seed Admin User** - Creates default admin user
5. **Run Migrations** - Applies any pending migrations

## Prerequisites

### System Requirements
- MySQL 5.7+ or MariaDB 10.3+
- Node.js 14+ (for Node.js script)
- Bash shell (for Bash script)

### Environment Variables
Create a `.env` file in the project root with:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bittrade
```

## Script Options

### Bash Script
```bash
./database/setup_fresh_db.sh [OPTIONS]

Options:
  --force    Skip confirmation prompt
  --help     Show help message
```

### Node.js Script
```bash
node database/setup_fresh_db.js [OPTIONS]

Options:
  --force    Skip confirmation prompt
  --help     Show help message
```

## Default Admin Credentials

After setup, you can login with:
- **Email**: admin@bittrade.co.in
- **Password**: admin123
- **PIN**: 1234

⚠️ **Important**: Change the admin password after first login!

## Manual Setup (Alternative)

If you prefer to run the setup manually:

1. **Create Database**:
   ```sql
   CREATE DATABASE bittrade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Apply Schema**:
   ```bash
   mysql -u root -p bittrade < database/schema.sql
   ```

3. **Seed Admin User**:
   ```bash
   mysql -u root -p bittrade < database/seed_admin.sql
   ```

4. **Run Migrations** (if any):
   ```bash
   # Run each migration file in order
   mysql -u root -p bittrade < database/migrations/001_add_loan_operation_types.sql
   ```

## Migration Management

### Adding New Migrations
1. Create a new SQL file in `database/migrations/`
2. Use naming convention: `XXX_description.sql`
3. Update `MIGRATION_LOG.md` with details

### Running Migrations
Migrations are automatically run by the setup scripts. To run manually:
```bash
node database/run_migration.js
```

## Database Schema Overview

The database includes these main tables:

### Core Tables
- `users` - User accounts with balance segregation
- `operations` - Unified activity log for all operations
- `loans` - Overcollateralized loan management
- `active_plans` - DCA and recurring operations
- `balance_movements` - Audit trail for balance changes

### Configuration Tables
- `settings` - Application settings
- `bitcoin_data` - Bitcoin price and market data
- `bitcoin_sentiment` - Fear & Greed index data

## Troubleshooting

### Common Issues

1. **Permission Denied**:
   ```bash
   chmod +x database/setup_fresh_db.sh
   ```

2. **MySQL Connection Failed**:
   - Check if MySQL is running
   - Verify credentials in `.env` file
   - Ensure user has CREATE/DROP privileges

3. **Schema Already Exists**:
   - Use `--force` flag to skip confirmation
   - Or manually drop the database first

4. **Migration Errors**:
   - Check migration file syntax
   - Ensure migrations are run in order
   - Verify database state before migration

### Getting Help

For issues with the setup scripts, check:
1. Environment variables are correct
2. MySQL server is running and accessible
3. User has necessary privileges
4. All required files are present

## Security Notes

- Never commit `.env` files to version control
- Change default admin credentials immediately
- Use strong database passwords
- Consider using database users with limited privileges for production
- Regularly backup your database before running migrations

## Backup and Restore

### Creating Backups
```bash
mysqldump -u root -p bittrade > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restoring from Backup
```bash
mysql -u root -p bittrade < backup_file.sql
```
