#!/usr/bin/env node

/**
 * Migration: Convert old liquidation transaction notes to structured JSON format
 * 
 * This migration converts legacy liquidation transaction notes that contain
 * plain text descriptions into structured JSON format with detailed breakdown.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password', // Default for local development
  database: process.env.DB_NAME || 'bittrade'
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logStep = (message) => log(`🔄 ${message}`, 'blue');
const logSuccess = (message) => log(`✓ ${message}`, 'green');
const logError = (message) => log(`✗ ${message}`, 'red');
const logWarning = (message) => log(`⚠ ${message}`, 'yellow');

// Function to parse old liquidation notes and extract data
const parseOldLiquidationNotes = (notes, btcAmount, inrAmount, executionPrice) => {
  try {
    // If notes is already JSON, return as is
    if (notes.trim().startsWith('{')) {
      JSON.parse(notes); // Test if it's valid JSON
      return null; // Already converted
    }
    
    // Parse old format notes for full liquidations
    if (notes.includes('Manual full liquidation')) {
      // Extract BTC amounts from the text
      const btcSoldMatch = notes.match(/(\d+(?:\.\d+)?)\s*BTC\s*sold/i);
      const btcReturnedMatch = notes.match(/(\d+(?:\.\d+)?)\s*BTC.*?returned/i);
      const originalCollateralMatch = notes.match(/original.*?collateral.*?(\d+(?:\.\d+)?)\s*BTC/i);
      
      // Convert to satoshis if needed
      const btcSold = btcSoldMatch ? Math.round(parseFloat(btcSoldMatch[1]) * 100000000) : btcAmount;
      const btcReturned = btcReturnedMatch ? Math.round(parseFloat(btcReturnedMatch[1]) * 100000000) : 0;
      const originalCollateral = originalCollateralMatch ? Math.round(parseFloat(originalCollateralMatch[1]) * 100000000) : (btcSold + btcReturned);
      
      return {
        description: "Manual full liquidation",
        debtCleared: inrAmount,
        btcSold: btcSold,
        btcReturned: btcReturned,
        originalCollateral: originalCollateral,
        minimumInterestApplied: true,
        sellRate: executionPrice || 0
      };
    }
    
    // Parse old format notes for partial liquidations
    if (notes.includes('Manual partial liquidation') || notes.includes('partial liquidation')) {
      return {
        description: "Manual partial liquidation",
        debtReduced: inrAmount,
        btcSold: btcAmount,
        sellRate: executionPrice || 0
      };
    }
    
    // If we can't parse the old format, return null
    return null;
    
  } catch (error) {
    console.error('Error parsing old liquidation notes:', error);
    return null;
  }
};

// Main migration function
const runMigration = async () => {
  let connection;
  
  try {
    logStep('Starting liquidation notes migration...');
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    logSuccess('Connected to database');
    
    // Find all liquidation transactions with old format notes
    const [liquidationTransactions] = await connection.execute(`
      SELECT id, notes, btc_amount, inr_amount, execution_price, btc_price, type
      FROM operations 
      WHERE type IN ('FULL_LIQUIDATION', 'PARTIAL_LIQUIDATION')
      AND notes IS NOT NULL 
      AND notes != ''
      AND notes NOT LIKE '{%'
    `);
    
    if (liquidationTransactions.length === 0) {
      logWarning('No liquidation transactions found with old format notes');
      return;
    }
    
    logStep(`Found ${liquidationTransactions.length} liquidation transactions to migrate`);
    
    let converted = 0;
    let skipped = 0;
    let failed = 0;
    
    // Process each liquidation transaction
    for (const transaction of liquidationTransactions) {
      const { id, notes, btc_amount, inr_amount, execution_price, btc_price, type } = transaction;
      
      // Parse the old notes
      const structuredData = parseOldLiquidationNotes(
        notes, 
        btc_amount, 
        inr_amount, 
        execution_price || btc_price
      );
      
      if (structuredData) {
        try {
          // Update the transaction with structured JSON notes
          await connection.execute(
            'UPDATE operations SET notes = ? WHERE id = ?',
            [JSON.stringify(structuredData), id]
          );
          
          console.log(`  ✓ Converted transaction #${id} (${type})`);
          converted++;
        } catch (error) {
          console.error(`  ✗ Failed to update transaction #${id}:`, error.message);
          failed++;
        }
      } else {
        console.log(`  ⚠ Skipped transaction #${id} - could not parse notes`);
        skipped++;
      }
    }
    
    // Summary
    logSuccess(`Migration completed:`);
    console.log(`  - Converted: ${converted} transactions`);
    console.log(`  - Skipped: ${skipped} transactions`);
    console.log(`  - Failed: ${failed} transactions`);
    
    if (failed > 0) {
      logWarning('Some transactions failed to convert. Please check the logs above.');
    }
    
  } catch (error) {
    logError('Migration failed:');
    console.error(error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      logStep('Database connection closed');
    }
  }
};

// Rollback function (in case we need to revert)
const rollbackMigration = async () => {
  let connection;
  
  try {
    logStep('Starting liquidation notes rollback...');
    
    connection = await mysql.createConnection(dbConfig);
    logSuccess('Connected to database');
    
    // Find all liquidation transactions with JSON notes
    const [liquidationTransactions] = await connection.execute(`
      SELECT id, notes, type
      FROM operations 
      WHERE type IN ('FULL_LIQUIDATION', 'PARTIAL_LIQUIDATION')
      AND notes IS NOT NULL 
      AND notes LIKE '{%'
    `);
    
    if (liquidationTransactions.length === 0) {
      logWarning('No liquidation transactions found with JSON format notes');
      return;
    }
    
    logStep(`Found ${liquidationTransactions.length} liquidation transactions to rollback`);
    
    let reverted = 0;
    
    // Process each liquidation transaction
    for (const transaction of liquidationTransactions) {
      const { id, notes, type } = transaction;
      
      try {
        const jsonData = JSON.parse(notes);
        
        // Convert back to simple text format
        let simpleNote = '';
        if (type === 'FULL_LIQUIDATION') {
          simpleNote = `Manual full liquidation executed. ${jsonData.btcSold / 100000000} BTC sold at ₹${jsonData.sellRate}. Debt of ₹${jsonData.debtCleared} cleared.`;
          if (jsonData.btcReturned > 0) {
            simpleNote += ` ${jsonData.btcReturned / 100000000} BTC remaining collateral returned to user.`;
          }
        } else if (type === 'PARTIAL_LIQUIDATION') {
          simpleNote = `Manual partial liquidation executed. ${jsonData.btcSold / 100000000} BTC sold at ₹${jsonData.sellRate}. Debt reduced by ₹${jsonData.debtReduced}.`;
        }
        
        // Update the transaction with simple text notes
        await connection.execute(
          'UPDATE operations SET notes = ? WHERE id = ?',
          [simpleNote, id]
        );
        
        console.log(`  ✓ Reverted transaction #${id} (${type})`);
        reverted++;
      } catch (error) {
        console.error(`  ✗ Failed to revert transaction #${id}:`, error.message);
      }
    }
    
    logSuccess(`Rollback completed: ${reverted} transactions reverted`);
    
  } catch (error) {
    logError('Rollback failed:');
    console.error(error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Command line interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node 002_convert_liquidation_notes.js [OPTIONS]');
  console.log('');
  console.log('Options:');
  console.log('  --rollback    Rollback the migration (convert JSON back to text)');
  console.log('  --help        Show this help message');
  process.exit(0);
}

// Main execution
const main = async () => {
  try {
    if (args.includes('--rollback')) {
      await rollbackMigration();
    } else {
      await runMigration();
    }
    
    logSuccess('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    logError('Migration script failed');
    console.error(error);
    process.exit(1);
  }
};

main();
