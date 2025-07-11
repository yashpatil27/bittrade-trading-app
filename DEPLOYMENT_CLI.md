# 🚀 BitTrade Deployment CLI

A comprehensive command-line tool for managing your BitTrade application deployment, development, and maintenance.

## 🎯 Features

- **Process Management**: Start, stop, restart server and client
- **Status Monitoring**: Check app and database status in real-time
- **Database Management**: Setup fresh database with confirmation
- **Dependency Management**: Install server and client dependencies
- **Deployment Tools**: Build and deploy application
- **Full Setup**: Complete fresh installation with one command
- **Safety Features**: Graceful shutdown and process cleanup

## 🛠️ Installation

The CLI tool is already included in your BitTrade project. No additional installation required!

## 🚀 Usage

### Quick Start
```bash
# Method 1: Using npm script (recommended)
npm run cli

# Method 2: Direct execution
node deploy-cli.js

# Method 3: Direct execution (if made executable)
./deploy-cli.js
```

### Available Commands

#### 1. 📊 Show Status
- Checks if server and client are running
- Tests database connection
- Shows port status (3000 for client, 3001 for server)

#### 2. 🚀 Start Application
- Starts both server and client
- Shows colored output for easy monitoring
- Automatically detects when services are ready

#### 3. 🔄 Restart Application
- Safely kills existing processes
- Starts fresh server and client instances
- Useful for applying code changes

#### 4. 🛑 Stop Application
- Gracefully stops all running processes
- Cleans up ports 3000 and 3001
- Kills Node.js processes related to the app

#### 5. 🗄️ Setup Fresh Database
- **⚠️ WARNING**: Deletes all existing data
- Requires explicit "yes" confirmation
- Runs database reset script
- Creates fresh database structure

#### 6. 📦 Install Dependencies
- Installs server dependencies (`server/package.json`)
- Installs client dependencies (`client/package.json`)
- Useful after pulling new code changes

#### 7. 🏗️ Run Deployment Script
- Builds production client bundle
- Optimizes assets for deployment
- Creates `client/build` directory

#### 8. 🆕 Full Fresh Setup
- Complete reinstallation process
- Combines: stop → install deps → fresh DB → build → start
- Perfect for setting up on new machines or after major updates

#### 9. 🚪 Exit
- Safely exits the CLI
- Cleans up any running processes
- Graceful shutdown

## 🎨 Features & Benefits

### 🌈 Colored Output
- **🟢 Green**: Success messages and running status
- **🔴 Red**: Errors and stopped status  
- **🟡 Yellow**: Warnings and in-progress operations
- **🔵 Blue**: Informational messages
- **🟣 Cyan**: Headers and major operations

### 🛡️ Safety Features
- **Confirmation prompts** for destructive operations
- **Process cleanup** on exit (Ctrl+C)
- **Error handling** with descriptive messages
- **Timeout protection** for hanging processes

### 📱 User Experience
- **Interactive menu** with numbered options
- **Clear status indicators** with emojis
- **Progress feedback** for long operations
- **"Press Enter to continue"** flow

## 🔧 Technical Details

### Process Detection
The CLI detects running processes by:
- Checking ports 3000 and 3001 using `lsof`
- Scanning for Node.js processes with app-specific patterns
- Testing database connectivity

### Process Management
- Uses `spawn()` for real-time output streaming
- Implements proper process cleanup
- Handles both SIGINT and manual termination

### Database Integration
- Imports database config from `server/config/database`
- Tests connectivity with simple queries
- Integrates with existing database scripts

## 🚨 Important Notes

### Database Reset Warning
```
⚠️ This will DELETE ALL DATA. Are you sure? (yes/no):
```
- Database reset is **irreversible**
- Always backup important data first
- Requires typing "yes" exactly (case-sensitive)

### Port Conflicts
- Ensures ports 3000 and 3001 are available
- Automatically kills conflicting processes
- May require administrator privileges on some systems

### Dependencies
- Requires Node.js and npm
- Uses existing package.json scripts
- No additional dependencies needed

## 🐛 Troubleshooting

### Common Issues

**"Database connection failed"**
```bash
# Check if MySQL is running
brew services list | grep mysql
# or
sudo systemctl status mysql
```

**"Port already in use"**
```bash
# The CLI automatically handles this, but manually:
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**"Permission denied"**
```bash
# Make the script executable
chmod +x deploy-cli.js
```

**"npm scripts not found"**
```bash
# Ensure you're in the project root directory
cd /path/to/bittrade-trading-app
npm run cli
```

## 🔄 Development Workflow

### Typical Development Session
1. `npm run cli` - Start the deployment CLI
2. Choose `1` - Check current status
3. Choose `2` - Start application for development
4. Make code changes...
5. Choose `3` - Restart to apply changes
6. Choose `4` - Stop when done

### Fresh Environment Setup
1. `npm run cli` - Start the deployment CLI
2. Choose `8` - Full fresh setup
3. Wait for completion
4. Visit http://localhost:3000

### Production Deployment
1. `npm run cli` - Start the deployment CLI
2. Choose `4` - Stop development servers
3. Choose `7` - Run deployment script
4. Deploy `client/build` to production server

## 💡 Tips & Best Practices

- **Always check status first** to understand current state
- **Use restart instead of stop/start** for faster development cycles
- **Run fresh database setup** when switching between dev/test data
- **Keep the CLI running** during development for quick restarts
- **Use full fresh setup** when setting up new development environments

## 🤝 Contributing

The deployment CLI is designed to be easily extensible. To add new features:

1. Add new menu option in `showMenu()`
2. Implement handler in `handleChoice()`
3. Create corresponding async method
4. Follow existing patterns for colored output and error handling

## 📞 Support

If you encounter issues with the deployment CLI:
1. Check the console output for specific error messages
2. Ensure all dependencies are installed
3. Verify database configuration
4. Check that ports 3000 and 3001 are available

---

**Happy deploying! 🚀**
