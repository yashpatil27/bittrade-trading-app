#!/usr/bin/env node

/**
 * BitTrade Database Setup Script (Node.js)
 * This script creates a fresh database with schema and seeds admin user
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bittrade'
};

const scriptDir = __dirname;
const projectRoot = path.dirname(scriptDir);

// Utility functions
const log = (message, color = 'reset') => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

const logStep = (message) => log(`🔄 ${message}`, 'blue');
const logSuccess = (message) => log(`✓ ${message}`, 'green');
const logError = (message) => log(`✗ ${message}`, 'red');
const logWarning = (message) => log(`⚠ ${message}`, 'yellow');

// Function to ask for user confirmation
const askConfirmation = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${colors.yellow}⚠${colors.reset} ${question} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
};

// Function to check MySQL connection
const checkMySQLConnection = async () => {
    logStep('Checking MySQL connection...');
    
    try {
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        logSuccess('MySQL connection successful');
        return true;
    } catch (error) {
        logError('Cannot connect to MySQL server');
        console.error('Error:', error.message);
        return false;
    }
};

// Function to setup database
const setupDatabase = async () => {
    logStep('Setting up fresh database...');
    
    const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password
    });
    
    try {
        // Drop database if exists
        await connection.execute(`DROP DATABASE IF EXISTS ${config.database}`);
        
        // Create database
        await connection.execute(`CREATE DATABASE ${config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        
        logSuccess(`Database '${config.database}' created successfully`);
        return true;
    } catch (error) {
        logError('Failed to create database');
        console.error('Error:', error.message);
        return false;
    } finally {
        await connection.end();
    }
};

// Function to apply schema
const applySchema = async () => {
    logStep('Applying database schema...');
    
    const schemaPath = path.join(scriptDir, 'schema.sql');
    
    try {
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            multipleStatements: true
        });
        
        await connection.execute(schemaContent);
        await connection.end();
        
        logSuccess('Schema applied successfully');
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logError(`Schema file not found: ${schemaPath}`);
        } else {
            logError('Failed to apply schema');
            console.error('Error:', error.message);
        }
        return false;
    }
};

// Function to seed admin user
const seedAdmin = async () => {
    logStep('Seeding admin user...');
    
    const seedPath = path.join(scriptDir, 'seed_admin.sql');
    
    try {
        const seedContent = await fs.readFile(seedPath, 'utf8');
        
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            multipleStatements: true
        });
        
        await connection.execute(seedContent);
        await connection.end();
        
        logSuccess('Admin user seeded successfully');
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logError(`Seed file not found: ${seedPath}`);
        } else {
            logError('Failed to seed admin user');
            console.error('Error:', error.message);
        }
        return false;
    }
};

// Function to run migrations
const runMigrations = async () => {
    logStep('Running database migrations...');
    
    const migrationsDir = path.join(scriptDir, 'migrations');
    
    try {
        const files = await fs.readdir(migrationsDir);
        const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();
        
        if (sqlFiles.length === 0) {
            logWarning(`No migrations found in ${migrationsDir}`);
            return true;
        }
        
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            multipleStatements: true
        });
        
        for (const file of sqlFiles) {
            const migrationPath = path.join(migrationsDir, file);
            const migrationContent = await fs.readFile(migrationPath, 'utf8');
            
            log(`→ Running migration: ${file}`, 'yellow');
            
            try {
                await connection.execute(migrationContent);
                logSuccess(`Migration completed: ${file}`);
            } catch (error) {
                logError(`Migration failed: ${file}`);
                console.error('Error:', error.message);
                await connection.end();
                return false;
            }
        }
        
        await connection.end();
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logWarning(`No migrations directory found: ${migrationsDir}`);
            return true;
        } else {
            logError('Failed to run migrations');
            console.error('Error:', error.message);
            return false;
        }
    }
};

// Function to display final status
const displayStatus = () => {
    log('\n🎉 Database setup completed successfully!', 'green');
    log('\n📋 Database Details:', 'blue');
    console.log(`  Database: ${config.database}`);
    console.log(`  Host: ${config.host}:${config.port}`);
    console.log(`  User: ${config.user}`);
    log('\n🔐 Admin Credentials:', 'blue');
    console.log('  Email: admin@bittrade.co.in');
    console.log('  Password: admin123');
    console.log('  PIN: 1234');
    logWarning('\nRemember to change the admin password after first login!');
};

// Main execution function
const main = async () => {
    log('🚀 BitTrade Database Setup', 'blue');
    log('================================\n');
    
    // Check for force flag
    const forceFlag = process.argv.includes('--force');
    
    // Check if user wants to proceed
    if (!forceFlag) {
        const proceed = await askConfirmation(
            `This will DROP the existing '${config.database}' database and create a fresh one.\\nAre you sure you want to continue?`
        );
        
        if (!proceed) {
            log('❌ Setup cancelled', 'yellow');
            process.exit(0);
        }
    }
    
    // Execute setup steps
    const steps = [
        checkMySQLConnection,
        setupDatabase,
        applySchema,
        seedAdmin,
        runMigrations
    ];
    
    for (const step of steps) {
        const success = await step();
        if (!success) {
            process.exit(1);
        }
    }
    
    displayStatus();
    log('\n✅ Setup complete! You can now start your application.', 'green');
};

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node setup_fresh_db.js [OPTIONS]');
    console.log('');
    console.log('Options:');
    console.log('  --force    Skip confirmation prompt');
    console.log('  --help     Show this help message');
    process.exit(0);
}

// Run the main function
main().catch((error) => {
    logError('Setup failed with error:');
    console.error(error);
    process.exit(1);
});
