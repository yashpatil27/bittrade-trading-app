#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class BitTradeDeploymentCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.serverProcess = null;
    this.clientProcess = null;
  }

  // Utility functions
  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}`);
    console.log(`${colors.bright}${colors.white}${message}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(`${colors.yellow}${prompt}${colors.reset}`, resolve);
    });
  }

  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stderr });
        } else {
          resolve(stdout);
        }
      });
    });
  }

  // Check if processes are running
  async checkProcessStatus() {
    try {
      // Check for Node.js processes running our app
      const processes = await this.execCommand('ps aux | grep node');
      const serverRunning = processes.includes('server/index.js') || processes.includes('npm run server');
      const clientRunning = processes.includes('npm start') || processes.includes('react-scripts start');
      
      return { serverRunning, clientRunning };
    } catch (error) {
      return { serverRunning: false, clientRunning: false };
    }
  }

  // Kill existing processes
  async killProcesses() {
    this.log('🔄 Killing existing processes...', 'yellow');
    
    try {
      // Kill processes by port
      await this.execCommand('lsof -ti:3001 | xargs kill -9 2>/dev/null || true');
      await this.execCommand('lsof -ti:3000 | xargs kill -9 2>/dev/null || true');
      
      // Kill by process name
      await this.execCommand('pkill -f "node.*server/index.js" 2>/dev/null || true');
      await this.execCommand('pkill -f "react-scripts start" 2>/dev/null || true');
      
      this.log('✅ Processes killed successfully', 'green');
    } catch (error) {
      this.log('⚠️  Some processes might still be running', 'yellow');
    }
  }

  // Check database connection
  async checkDatabase() {
    this.log('🔄 Checking database connection...', 'yellow');
    
    try {
      // Try to connect to database
      const { query } = require('./server/config/database');
      await query('SELECT 1');
      this.log('✅ Database connection successful', 'green');
      return true;
    } catch (error) {
      this.log('❌ Database connection failed', 'red');
      this.log(`Error: ${error.message}`, 'red');
      return false;
    }
  }

  // Get database tables
  async getDatabaseTables() {
    try {
      const { query } = require('./server/config/database');
      const tables = await query('SHOW TABLES');
      return tables.map(row => Object.values(row)[0]);
    } catch (error) {
      this.log('❌ Failed to get database tables', 'red');
      this.log(`Error: ${error.message}`, 'red');
      return [];
    }
  }

  // Get table structure
  async getTableStructure(tableName) {
    try {
      const { query } = require('./server/config/database');
      const structure = await query(`DESCRIBE ${tableName}`);
      return structure;
    } catch (error) {
      this.log(`❌ Failed to get structure for table ${tableName}`, 'red');
      this.log(`Error: ${error.message}`, 'red');
      return [];
    }
  }

  // Get table data with pagination
  async getTableData(tableName, limit = 10, offset = 0) {
    try {
      const { query } = require('./server/config/database');
      const data = await query(`SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`);
      const countResult = await query(`SELECT COUNT(*) as total FROM ${tableName}`);
      const total = countResult[0].total;
      return { data, total };
    } catch (error) {
      this.log(`❌ Failed to get data from table ${tableName}`, 'red');
      this.log(`Error: ${error.message}`, 'red');
      return { data: [], total: 0 };
    }
  }

  // Format table data for display
  formatTableData(data, structure) {
    if (data.length === 0) {
      return 'No data found';
    }

    // Get column names and types
    const columns = structure.map(col => ({ 
      name: col.Field, 
      type: col.Type,
      maxWidth: Math.max(col.Field.length, 15)
    }));

    // Calculate max width for each column based on data
    data.forEach(row => {
      columns.forEach(col => {
        const value = String(row[col.name] || '');
        col.maxWidth = Math.max(col.maxWidth, Math.min(value.length, 30));
      });
    });

    // Create table header
    let result = '\n';
    const separator = columns.map(col => '-'.repeat(col.maxWidth)).join('-+-');
    const header = columns.map(col => col.name.padEnd(col.maxWidth)).join(' | ');
    
    result += `${colors.cyan}${header}${colors.reset}\n`;
    result += `${colors.cyan}${separator}${colors.reset}\n`;

    // Add data rows
    data.forEach(row => {
      const rowStr = columns.map(col => {
        let value = String(row[col.name] || '');
        if (value.length > 30) {
          value = value.substring(0, 27) + '...';
        }
        return value.padEnd(col.maxWidth);
      }).join(' | ');
      result += `${rowStr}\n`;
    });

    return result;
  }

  // Database inspection menu
  async showDatabaseMenu() {
    while (true) {
      this.logHeader('🗄️ DATABASE INSPECTOR');
      
      console.log(`${colors.bright}${colors.white}Database Operations:${colors.reset}`);
      console.log(`${colors.green}1.${colors.reset} List All Tables`);
      console.log(`${colors.green}2.${colors.reset} Show Table Structure`);
      console.log(`${colors.green}3.${colors.reset} View Table Data`);
      console.log(`${colors.green}4.${colors.reset} Quick Overview (All Tables)`);
      console.log(`${colors.green}5.${colors.reset} Execute Custom Query`);
      console.log(`${colors.red}6.${colors.reset} Back to Main Menu`);
      console.log();

      const choice = await this.question('Select an option (1-6): ');
      console.log();

      switch (choice) {
        case '1':
          await this.listAllTables();
          break;
        case '2':
          await this.showTableStructure();
          break;
        case '3':
          await this.viewTableData();
          break;
        case '4':
          await this.quickDatabaseOverview();
          break;
        case '5':
          await this.executeCustomQuery();
          break;
        case '6':
          return;
        default:
          this.log('❌ Invalid choice. Please try again.', 'red');
      }

      if (choice !== '6') {
        console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
        await this.question('');
        console.clear();
      }
    }
  }

  // List all tables
  async listAllTables() {
    this.log('📋 Fetching database tables...', 'yellow');
    
    const tables = await this.getDatabaseTables();
    
    if (tables.length === 0) {
      this.log('❌ No tables found or database connection failed', 'red');
      return;
    }

    this.log('\n📊 Database Tables:', 'cyan');
    tables.forEach((table, index) => {
      console.log(`${colors.green}${index + 1}.${colors.reset} ${table}`);
    });
    
    // Get row counts for each table
    this.log('\n📈 Row Counts:', 'cyan');
    for (const table of tables) {
      try {
        const { query } = require('./server/config/database');
        const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result[0].count;
        console.log(`${colors.white}${table}:${colors.reset} ${colors.yellow}${count} rows${colors.reset}`);
      } catch (error) {
        console.log(`${colors.white}${table}:${colors.reset} ${colors.red}Error getting count${colors.reset}`);
      }
    }
  }

  // Show table structure
  async showTableStructure() {
    const tables = await this.getDatabaseTables();
    
    if (tables.length === 0) {
      this.log('❌ No tables found', 'red');
      return;
    }

    this.log('Available tables:', 'cyan');
    tables.forEach((table, index) => {
      console.log(`${colors.green}${index + 1}.${colors.reset} ${table}`);
    });

    const tableChoice = await this.question('\nEnter table name or number: ');
    const tableName = isNaN(tableChoice) ? tableChoice : tables[parseInt(tableChoice) - 1];

    if (!tableName || !tables.includes(tableName)) {
      this.log('❌ Invalid table selection', 'red');
      return;
    }

    this.log(`\n🏗️ Structure of table '${tableName}':`, 'cyan');
    const structure = await this.getTableStructure(tableName);
    
    if (structure.length === 0) {
      this.log('❌ Failed to get table structure', 'red');
      return;
    }

    console.log(`\n${colors.cyan}Field${' '.repeat(20)} | Type${' '.repeat(20)} | Null | Key | Default${colors.reset}`);
    console.log(`${colors.cyan}${'-'.repeat(75)}${colors.reset}`);
    
    structure.forEach(col => {
      const field = String(col.Field).padEnd(24);
      const type = String(col.Type).padEnd(24);
      const nullVal = String(col.Null).padEnd(4);
      const key = String(col.Key).padEnd(3);
      const def = String(col.Default || 'NULL').substring(0, 10);
      console.log(`${field} | ${type} | ${nullVal} | ${key} | ${def}`);
    });
  }

  // View table data
  async viewTableData() {
    const tables = await this.getDatabaseTables();
    
    if (tables.length === 0) {
      this.log('❌ No tables found', 'red');
      return;
    }

    this.log('Available tables:', 'cyan');
    tables.forEach((table, index) => {
      console.log(`${colors.green}${index + 1}.${colors.reset} ${table}`);
    });

    const tableChoice = await this.question('\nEnter table name or number: ');
    const tableName = isNaN(tableChoice) ? tableChoice : tables[parseInt(tableChoice) - 1];

    if (!tableName || !tables.includes(tableName)) {
      this.log('❌ Invalid table selection', 'red');
      return;
    }

    const limit = await this.question('Number of rows to display (default 10): ') || '10';
    const offset = await this.question('Offset/Skip rows (default 0): ') || '0';

    this.log(`\n📋 Data from table '${tableName}':`, 'cyan');
    
    const structure = await this.getTableStructure(tableName);
    const { data, total } = await this.getTableData(tableName, parseInt(limit), parseInt(offset));
    
    if (data.length === 0) {
      this.log('❌ No data found in this table', 'yellow');
      return;
    }

    console.log(this.formatTableData(data, structure));
    this.log(`\n📊 Showing ${data.length} of ${total} total rows`, 'cyan');

    if (parseInt(offset) + parseInt(limit) < total) {
      this.log(`💡 Use offset ${parseInt(offset) + parseInt(limit)} to see more rows`, 'yellow');
    }
  }

  // Quick database overview
  async quickDatabaseOverview() {
    this.log('📊 Generating database overview...', 'yellow');
    
    const tables = await this.getDatabaseTables();
    
    if (tables.length === 0) {
      this.log('❌ No tables found', 'red');
      return;
    }

    this.log('\n📈 Database Overview:', 'cyan');
    
    for (const table of tables) {
      try {
        const { query } = require('./server/config/database');
        const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = countResult[0].count;
        
        // Get a sample row to show structure
        const sampleResult = await query(`SELECT * FROM ${table} LIMIT 1`);
        const columnCount = sampleResult.length > 0 ? Object.keys(sampleResult[0]).length : 0;
        
        console.log(`\n${colors.bright}${colors.white}📋 ${table}${colors.reset}`);
        console.log(`   Rows: ${colors.yellow}${count}${colors.reset}`);
        console.log(`   Columns: ${colors.yellow}${columnCount}${colors.reset}`);
        
        if (sampleResult.length > 0) {
          const columns = Object.keys(sampleResult[0]).slice(0, 5); // Show first 5 columns
          console.log(`   Sample columns: ${colors.cyan}${columns.join(', ')}${columnCount > 5 ? '...' : ''}${colors.reset}`);
        }
      } catch (error) {
        console.log(`\n${colors.bright}${colors.white}📋 ${table}${colors.reset}`);
        console.log(`   ${colors.red}Error: ${error.message}${colors.reset}`);
      }
    }
  }

  // Execute custom query
  async executeCustomQuery() {
    this.log('⚠️  Custom Query Execution', 'yellow');
    this.log('🔍 You can run SELECT queries to inspect data', 'cyan');
    this.log('❌ Modifying queries (INSERT, UPDATE, DELETE) are not allowed for safety', 'red');
    
    const query = await this.question('\nEnter your SELECT query: ');
    
    if (!query.trim()) {
      this.log('❌ Empty query', 'red');
      return;
    }

    // Safety check - only allow SELECT queries
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('SHOW') && !trimmedQuery.startsWith('DESCRIBE')) {
      this.log('❌ Only SELECT, SHOW, and DESCRIBE queries are allowed for safety', 'red');
      return;
    }

    try {
      const { query: dbQuery } = require('./server/config/database');
      const result = await dbQuery(query);
      
      if (result.length === 0) {
        this.log('✅ Query executed successfully - No results returned', 'green');
        return;
      }

      this.log(`\n✅ Query executed successfully - ${result.length} rows returned:`, 'green');
      
      // Format results
      if (result.length > 0) {
        const columns = Object.keys(result[0]);
        const maxWidth = Math.max(...columns.map(col => col.length), 15);
        
        // Header
        const header = columns.map(col => col.padEnd(maxWidth)).join(' | ');
        const separator = columns.map(() => '-'.repeat(maxWidth)).join('-+-');
        
        console.log(`\n${colors.cyan}${header}${colors.reset}`);
        console.log(`${colors.cyan}${separator}${colors.reset}`);
        
        // Data (limit to first 20 rows for readability)
        const displayData = result.slice(0, 20);
        displayData.forEach(row => {
          const rowStr = columns.map(col => {
            let value = String(row[col] || '');
            if (value.length > maxWidth) {
              value = value.substring(0, maxWidth - 3) + '...';
            }
            return value.padEnd(maxWidth);
          }).join(' | ');
          console.log(rowStr);
        });
        
        if (result.length > 20) {
          this.log(`\n... and ${result.length - 20} more rows`, 'yellow');
        }
      }
    } catch (error) {
      this.log('❌ Query failed', 'red');
      this.log(`Error: ${error.message}`, 'red');
    }
  }

  // Setup fresh database
  async setupFreshDatabase() {
    this.log('🔄 Setting up fresh database...', 'yellow');
    
    const confirm = await this.question('⚠️  This will DELETE ALL DATA. Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      this.log('❌ Database setup cancelled', 'yellow');
      return false;
    }

    try {
      // Run the database setup script
      await this.execCommand('cd server && npm run db:reset', { stdio: 'inherit' });
      this.log('✅ Fresh database setup completed', 'green');
      return true;
    } catch (error) {
      this.log('❌ Database setup failed', 'red');
      this.log(`Error: ${error.stderr || error.message}`, 'red');
      return false;
    }
  }

  // Install dependencies
  async installDependencies() {
    this.log('🔄 Installing dependencies...', 'yellow');
    
    try {
      // Install server dependencies
      this.log('📦 Installing server dependencies...', 'blue');
      await this.execCommand('cd server && npm install');
      
      // Install client dependencies
      this.log('📦 Installing client dependencies...', 'blue');
      await this.execCommand('cd client && npm install');
      
      this.log('✅ Dependencies installed successfully', 'green');
      return true;
    } catch (error) {
      this.log('❌ Failed to install dependencies', 'red');
      this.log(`Error: ${error.stderr || error.message}`, 'red');
      return false;
    }
  }

  // Start server
  async startServer() {
    this.log('🔄 Starting server...', 'yellow');
    
    return new Promise((resolve) => {
      this.serverProcess = spawn('npm', ['run', 'server'], {
        cwd: process.cwd(),
        stdio: ['inherit', 'pipe', 'pipe'],
        detached: false
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on port 3001')) {
          this.log('✅ Server started successfully on port 3001', 'green');
          resolve(true);
        }
        process.stdout.write(`${colors.blue}[SERVER] ${output}${colors.reset}`);
      });

      this.serverProcess.stderr.on('data', (data) => {
        process.stderr.write(`${colors.red}[SERVER ERROR] ${data}${colors.reset}`);
      });

      this.serverProcess.on('close', (code) => {
        this.log(`Server process exited with code ${code}`, code === 0 ? 'green' : 'red');
        this.serverProcess = null;
      });

      // Resolve after 5 seconds even if no success message
      setTimeout(() => resolve(true), 5000);
    });
  }

  // Start client
  async startClient() {
    this.log('🔄 Starting client...', 'yellow');
    
    return new Promise((resolve) => {
      this.clientProcess = spawn('npm', ['start'], {
        cwd: path.join(process.cwd(), 'client'),
        stdio: ['inherit', 'pipe', 'pipe'],
        detached: false
      });

      this.clientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('webpack compiled') || output.includes('Local:')) {
          this.log('✅ Client started successfully on port 3000', 'green');
          resolve(true);
        }
        process.stdout.write(`${colors.green}[CLIENT] ${output}${colors.reset}`);
      });

      this.clientProcess.stderr.on('data', (data) => {
        process.stderr.write(`${colors.red}[CLIENT ERROR] ${data}${colors.reset}`);
      });

      this.clientProcess.on('close', (code) => {
        this.log(`Client process exited with code ${code}`, code === 0 ? 'green' : 'red');
        this.clientProcess = null;
      });

      // Resolve after 10 seconds even if no success message
      setTimeout(() => resolve(true), 10000);
    });
  }

  // Deploy script
  async runDeployScript() {
    this.log('🔄 Running deployment script...', 'yellow');
    
    try {
      // Build client
      this.log('📦 Building client...', 'blue');
      await this.execCommand('cd client && npm run build');
      
      this.log('✅ Deployment completed successfully', 'green');
      return true;
    } catch (error) {
      this.log('❌ Deployment failed', 'red');
      this.log(`Error: ${error.stderr || error.message}`, 'red');
      return false;
    }
  }

  // Show status
  async showStatus() {
    this.logHeader('📊 BITTRADE APP STATUS');
    
    const { serverRunning, clientRunning } = await this.checkProcessStatus();
    
    this.log(`Server (Port 3001): ${serverRunning ? '🟢 RUNNING' : '🔴 STOPPED'}`, serverRunning ? 'green' : 'red');
    this.log(`Client (Port 3000): ${clientRunning ? '🟢 RUNNING' : '🔴 STOPPED'}`, clientRunning ? 'green' : 'red');
    
    const dbStatus = await this.checkDatabase();
    this.log(`Database: ${dbStatus ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`, dbStatus ? 'green' : 'red');
    
    console.log();
  }

  // Main menu
  async showMenu() {
    this.logHeader('🚀 BITTRADE DEPLOYMENT CLI');
    
    console.log(`${colors.bright}${colors.white}Available Commands:${colors.reset}`);
    console.log(`${colors.green}1.${colors.reset} Show Status`);
    console.log(`${colors.green}2.${colors.reset} Start Application`);
    console.log(`${colors.green}3.${colors.reset} Restart Application`);
    console.log(`${colors.green}4.${colors.reset} Stop Application`);
    console.log(`${colors.green}5.${colors.reset} Database Inspector`);
    console.log(`${colors.green}6.${colors.reset} Setup Fresh Database`);
    console.log(`${colors.green}7.${colors.reset} Install Dependencies`);
    console.log(`${colors.green}8.${colors.reset} Run Deployment Script`);
    console.log(`${colors.green}9.${colors.reset} Full Fresh Setup`);
    console.log(`${colors.red}10.${colors.reset} Exit`);
    console.log();
  }

  // Handle user choice
  async handleChoice(choice) {
    switch (choice) {
      case '1':
        await this.showStatus();
        break;
        
      case '2':
        this.log('🚀 Starting application...', 'cyan');
        await this.startServer();
        await this.startClient();
        this.log('✅ Application started! Visit http://localhost:3000', 'green');
        break;
        
      case '3':
        this.log('🔄 Restarting application...', 'cyan');
        await this.killProcesses();
        await this.startServer();
        await this.startClient();
        this.log('✅ Application restarted! Visit http://localhost:3000', 'green');
        break;
        
      case '4':
        this.log('🛑 Stopping application...', 'cyan');
        await this.killProcesses();
        this.log('✅ Application stopped', 'green');
        break;
        
      case '5':
        await this.showDatabaseMenu();
        break;
        
      case '6':
        await this.setupFreshDatabase();
        break;
        
      case '7':
        await this.installDependencies();
        break;
        
      case '8':
        await this.runDeployScript();
        break;
        
      case '9':
        this.log('🔄 Running full fresh setup...', 'cyan');
        await this.killProcesses();
        await this.installDependencies();
        await this.setupFreshDatabase();
        await this.runDeployScript();
        await this.startServer();
        await this.startClient();
        this.log('✅ Full fresh setup completed! Visit http://localhost:3000', 'green');
        break;
        
      case '10':
        this.log('👋 Goodbye!', 'cyan');
        await this.killProcesses();
        process.exit(0);
        break;
        
      default:
        this.log('❌ Invalid choice. Please try again.', 'red');
    }
  }

  // Main loop
  async run() {
    console.clear();
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
      this.log('\n🛑 Shutting down...', 'yellow');
      await this.killProcesses();
      process.exit(0);
    });
    
    while (true) {
      await this.showMenu();
      const choice = await this.question('Select an option (1-10): ');
      console.log();
      
      await this.handleChoice(choice);
      
      if (choice !== '10') {
        console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
        await this.question('');
        console.clear();
      }
    }
  }
}

// Run the CLI
if (require.main === module) {
  const cli = new BitTradeDeploymentCLI();
  cli.run().catch(console.error);
}

module.exports = BitTradeDeploymentCLI;
