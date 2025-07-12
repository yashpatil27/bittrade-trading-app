#!/usr/bin/env node

/**
 * Simple migration runner for liquidation notes conversion
 * Prompts for database credentials if not provided
 */

const mysql = require('mysql2/promise');
const readline = require('readline');

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

// Function to ask for input
const askQuestion = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// Function to ask for password (hidden input)
const askPassword = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    let password = '';
    
    process.stdin.on('data', (char) => {
      char = char.toString();
      
      if (char === '\n' || char === '\r' || char === '\u0004') {
        // Enter pressed
        process.stdin.setRawMode(false);
        process.stdin.pause();
        rl.close();
        console.log();
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C pressed
        process.exit(1);
      } else if (char === '\u007f') {
        // Backspace pressed
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        // Regular character
        password += char;
        process.stdout.write('*');
      }
    });
  });
};

// Function to parse old liquidation notes and extract data
const parseOldLiquidationNotes = (notes, btcAmount, inrAmount, executionPrice) => {
  try {
    // If notes is already JSON, return null (already converted)
    if (notes.trim().startsWith('{')) {
      JSON.parse(notes); // Test if it's valid JSON
      return null;
    }
    
    // Parse old format notes for full liquidations
    if (notes.includes('Manual full liquidation') || notes.includes('full liquidation')) {
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
    
    // For basic liquidation text, create a generic structure
    if (notes.includes('liquidation') || notes.includes('remaining collateral returned')) {
      return {
        description: "Manual full liquidation",
        debtCleared: inrAmount,
        btcSold: btcAmount,
        btcReturned: 0, // We can't determine this from basic text
        originalCollateral: btcAmount, // Estimate
        minimumInterestApplied: true,
        sellRate: executionPrice || 0
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error parsing old liquidation notes:', error);
    return null;
  }
};

// Main migration function
const runMigration = async (dbConfig) => {
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
      logSuccess('All liquidation transactions already have structured JSON notes!');
      return;
    }
    
    logStep(`Found ${liquidationTransactions.length} liquidation transactions to migrate`);
    
    // Show sample transactions
    console.log('\nSample transactions to be converted:');
    liquidationTransactions.slice(0, 3).forEach(tx => {
      console.log(`  Transaction #${tx.id} (${tx.type}): "${tx.notes.substring(0, 60)}..."`);
    });
    
    const proceed = await askQuestion('\nProceed with migration? (y/N): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
      logWarning('Migration cancelled by user');
      return;
    }
    
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
        console.log(`  ⚠ Skipped transaction #${id} - could not parse notes: "${notes}"`);
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

// Main execution
const main = async () => {
  try {
    console.log('🚀 BitTrade Liquidation Notes Migration');
    console.log('=======================================\n');
    
    // Get database credentials
    const host = await askQuestion('Database host (localhost): ') || 'localhost';
    const port = await askQuestion('Database port (3306): ') || '3306';
    const user = await askQuestion('Database user (root): ') || 'root';
    const password = await askPassword('Database password: ');
    const database = await askQuestion('Database name (bittrade): ') || 'bittrade';
    
    const dbConfig = {
      host,
      port: parseInt(port),
      user,
      password,
      database
    };
    
    await runMigration(dbConfig);
    
    logSuccess('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    logError('Migration script failed');
    console.error(error);
    process.exit(1);
  }
};

main();
