#!/bin/bash

# BitTrade Database Setup Script
# This script creates a fresh database with schema and seeds admin user

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="bittrade"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
    echo -e "${GREEN}✓${NC} Loaded environment variables from .env"
else
    echo -e "${YELLOW}⚠${NC} No .env file found, using defaults"
fi

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD}

# Function to check if MySQL is running
check_mysql() {
    if ! command -v mysql &> /dev/null; then
        echo -e "${RED}✗${NC} MySQL is not installed or not in PATH"
        exit 1
    fi
    
    if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
        echo -e "${RED}✗${NC} Cannot connect to MySQL server"
        echo "Please check your database credentials and ensure MySQL is running"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} MySQL connection successful"
}

# Function to drop and recreate database
setup_database() {
    echo -e "${BLUE}🔄${NC} Setting up fresh database..."
    
    # Drop database if exists
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    
    # Create database
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Database '$DB_NAME' created successfully"
    else
        echo -e "${RED}✗${NC} Failed to create database"
        exit 1
    fi
}

# Function to apply schema
apply_schema() {
    echo -e "${BLUE}🔄${NC} Applying database schema..."
    
    if [ ! -f "$SCRIPT_DIR/schema.sql" ]; then
        echo -e "${RED}✗${NC} Schema file not found: $SCRIPT_DIR/schema.sql"
        exit 1
    fi
    
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < "$SCRIPT_DIR/schema.sql"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Schema applied successfully"
    else
        echo -e "${RED}✗${NC} Failed to apply schema"
        exit 1
    fi
}

# Function to seed admin user
seed_admin() {
    echo -e "${BLUE}🔄${NC} Seeding admin user..."
    
    if [ ! -f "$SCRIPT_DIR/seed_admin.sql" ]; then
        echo -e "${RED}✗${NC} Seed file not found: $SCRIPT_DIR/seed_admin.sql"
        exit 1
    fi
    
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < "$SCRIPT_DIR/seed_admin.sql"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Admin user seeded successfully"
    else
        echo -e "${RED}✗${NC} Failed to seed admin user"
        exit 1
    fi
}

# Function to run migrations
run_migrations() {
    echo -e "${BLUE}🔄${NC} Running database migrations..."
    
    if [ -d "$SCRIPT_DIR/migrations" ] && [ "$(ls -A $SCRIPT_DIR/migrations)" ]; then
        for migration in "$SCRIPT_DIR/migrations"/*.sql; do
            if [ -f "$migration" ]; then
                echo -e "${YELLOW}→${NC} Running migration: $(basename "$migration")"
                mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$migration"
                
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✓${NC} Migration completed: $(basename "$migration")"
                else
                    echo -e "${RED}✗${NC} Migration failed: $(basename "$migration")"
                    exit 1
                fi
            fi
        done
    else
        echo -e "${YELLOW}⚠${NC} No migrations found in $SCRIPT_DIR/migrations"
    fi
}

# Function to display final status
display_status() {
    echo -e "\n${GREEN}🎉 Database setup completed successfully!${NC}"
    echo -e "\n${BLUE}📋 Database Details:${NC}"
    echo -e "  Database: $DB_NAME"
    echo -e "  Host: $DB_HOST:$DB_PORT"
    echo -e "  User: $DB_USER"
    echo -e "\n${BLUE}🔐 Admin Credentials:${NC}"
    echo -e "  Email: admin@bittrade.co.in"
    echo -e "  Password: admin123"
    echo -e "  PIN: 1234"
    echo -e "\n${YELLOW}⚠${NC} Remember to change the admin password after first login!"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 BitTrade Database Setup${NC}"
    echo -e "================================\n"
    
    # Check if user wants to proceed
    if [ "$1" != "--force" ]; then
        echo -e "${YELLOW}⚠${NC} This will DROP the existing '$DB_NAME' database and create a fresh one."
        echo -e "Are you sure you want to continue? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}❌${NC} Setup cancelled"
            exit 0
        fi
    fi
    
    # Execute setup steps
    check_mysql
    setup_database
    apply_schema
    seed_admin
    run_migrations
    display_status
    
    echo -e "\n${GREEN}✅ Setup complete! You can now start your application.${NC}"
}

# Handle command line arguments
case "$1" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --force    Skip confirmation prompt"
        echo "  --help     Show this help message"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
