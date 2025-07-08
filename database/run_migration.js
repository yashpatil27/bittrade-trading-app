const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration (update with your actual credentials)
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'password', // Update with your MySQL password
  database: 'bittrade',
  multipleStatements: true
};

async function runMigration(migrationFile) {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log(`Running migration: ${migrationFile}`);
    const results = await connection.execute(migrationSQL);
    
    console.log('Migration completed successfully');
    console.log('Results:', results);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  const migrationFile = process.argv[2] || '001_add_loan_operation_types.sql';
  runMigration(migrationFile)
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
