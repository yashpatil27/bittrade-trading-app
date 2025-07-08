# ₿itTrade - Advanced Bitcoin Paper Trading Platform

<div align="center">

![BitTrade Logo](https://img.shields.io/badge/₿itTrade-Trading%20Platform-orange?style=for-the-badge&logo=bitcoin)

**A modern, feature-rich Bitcoin paper trading application with advanced trading features, real-time data, and comprehensive admin controls.**

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)](https://mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

*Stay Humble, Stack Sats* 🚀

</div>

## 🎯 Overview

BitTrade is a comprehensive Bitcoin paper trading platform that simulates real Bitcoin trading with virtual money. It's designed for educational purposes, trading practice, and learning Bitcoin market dynamics without financial risk.

## ✨ Core Features

### 🏠 **User Features**

#### **1. Trading System**
- **Market Orders**: Instant buy/sell at current market rates
- **Limit Orders**: Set target prices for automatic execution
- **Dollar-Cost Averaging (DCA)**: Automated recurring purchases/sales
  - Hourly, Daily, Weekly, or Monthly frequency
  - Customizable execution limits and price ranges
  - Smart price threshold controls

#### **2. Real-Time Market Data**
- **Live Bitcoin Prices**: Updated every 30 seconds from CoinGecko API
- **Interactive Charts**: Multi-timeframe Bitcoin price charts (1D, 7D, 30D, 90D, 365D)
- **Market Analytics**: 
  - 24h price changes and percentages
  - Market cap and volume data
  - All-time high/low tracking
  - Fear & Greed Index integration

#### **3. Portfolio Management**
- **Real-time Balances**: INR and BTC holdings with live valuations
- **Transaction History**: Detailed records of all trading activities
- **Portfolio Analytics**: Performance tracking and profit/loss calculations
- **Balance Segregation**: Available vs. reserved funds for pending orders

#### **4. User Security & Profile**
- **PIN Protection**: 4-digit PIN for transaction confirmations
- **Profile Management**: Update name, email, and security settings
- **Secure Authentication**: JWT-based session management
- **Password Security**: bcrypt hashing with salt rounds

### 🔧 **Admin Features**

#### **1. Admin Dashboard**
- **Platform Statistics**: Total users, trades, and platform balances
- **Real-time Monitoring**: Current prices and system health
- **Service Status**: Monitor Bitcoin data service, limit order execution, and DCA services

#### **2. User Management**
- **User Overview**: Complete list of all platform users
- **Balance Management**: 
  - Deposit/withdraw INR for users
  - Deposit/withdraw Bitcoin for users
  - View detailed user portfolios
- **User Creation**: Create new user accounts
- **Admin Controls**: User search, filtering, and management tools

#### **3. Transaction Monitoring**
- **Global Transaction View**: All platform transactions across users
- **Transaction Details**: Complete audit trail with balance snapshots
- **Advanced Filtering**: Filter by user, type, date range, and amount

#### **4. System Settings**
- **Rate Configuration**: Adjust buy/sell multipliers
  - Buy Rate = BTC_USD_Price × Buy_Multiplier (default: 91)
  - Sell Rate = BTC_USD_Price × Sell_Multiplier (default: 88)
- **Platform Parameters**: Configure trading spreads and fees

## 🏗️ Technical Architecture

### **Frontend Stack**
- **React 18** with TypeScript for type safety
- **Tailwind CSS** for modern, responsive design
- **Lucide React** for consistent iconography
- **Recharts** for interactive Bitcoin price charts
- **React Router** for client-side routing
- **Axios** for API communication
- **Context API** for state management

### **Backend Stack**
- **Node.js** with Express.js framework
- **MySQL** for reliable data persistence
- **Redis** for high-performance caching
- **JWT** for secure authentication
- **bcrypt** for password hashing
- **Helmet** for security headers
- **CORS** for cross-origin requests
- **Rate limiting** for API protection

### **External Services**
- **CoinGecko API** for real-time Bitcoin data
- **Alternative.me API** for Fear & Greed Index
- **PM2** for production process management

### **Advanced Services**

#### **1. Bitcoin Data Service**
- Fetches comprehensive Bitcoin data every 30 seconds
- Caches price data in Redis for optimal performance
- Stores historical data for charts and analytics
- Manages multiple timeframe chart data

#### **2. Limit Order Execution Service**
- Monitors pending limit orders continuously
- Executes orders when market conditions are met
- Handles order expiration and cancellation
- Maintains proper balance segregation

#### **3. DCA Execution Service**
- Automated execution of Dollar-Cost Averaging plans
- Supports multiple frequency options
- Price threshold validation
- Smart plan management (pause/resume/complete)

## 📊 Database Schema

### **Core Tables**

#### **Users Table**
- **id**: Primary key, auto-increment
- **email**: Unique, not null
- **password_hash**: Secure password hashing
- **balance segregation**: INR and BTC balances, reserved funds, collateral

#### **Operations Table**
- **type**: ENUM for transaction types (e.g., MARKET_BUY, LIMIT_SELL)
- **status**: Tracks the operation status (PENDING, EXECUTED, etc.)
- **relationships**: Links to users and related operations

#### **Active Plans Table**
- **plan_type**: Supports 'DCA_BUY' and 'DCA_SELL'
- **status**: Track active, paused, or completed plans
- **execution**: Configures frequency and amount per execution

#### **Loans Table**
- **collateral management**: BTC collateral and INR borrowings
- **status**: Tracks loan status (ACTIVE, REPAID, LIQUIDATED)
- **interest management**: Handles interest rate and liquidation price

#### **Additional Entity Tables**
- **balance_movements**: Tracks all balance changes
- **bitcoin_data**: Stores real-time and historical Bitcoin market data
- **settings**: Application-wide configuration settings

## 🚀 Quick Start Guide

### **Prerequisites**

Ensure you have the following installed on your system:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v8 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Redis** (optional but recommended) - [Download](https://redis.io/download)
- **Git** for cloning the repository

### **Step 1: Clone the Repository**

```bash
# Clone the repository
git clone <repository-url>
cd bittrade-trading-app

# Install all dependencies (both server and client)
npm run install-all
```

### **Step 2: Database Setup**

```bash
# Start MySQL service (varies by OS)
# For macOS with Homebrew:
brew services start mysql

# For Ubuntu/Debian:
sudo systemctl start mysql

# Connect to MySQL
mysql -u root -p

# Create database and import schema
CREATE DATABASE bittrade;
USE bittrade;
source database/schema.sql;

# Seed admin user (optional)
source database/seed_admin.sql;
```

### **Step 3: Environment Configuration**

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

**Required Environment Variables:**
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bittrade

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server Configuration
PORT=3001
NODE_ENV=development

# API Configuration
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Step 4: Frontend Setup**

```bash
# Create React public directory (if missing)
mkdir -p client/public

# Create basic index.html (if missing)
cat > client/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="BitTrade - Modern Bitcoin Trading Platform" />
    <title>BitTrade</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
```

### **Step 5: Start the Application**

```bash
# Option 1: Start both frontend and backend together
npm run dev

# Option 2: Start them separately
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

### **Step 6: Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### **Step 7: Default Admin Access**

Use these credentials to access the admin panel:
- **Email**: admin@bittrade.co.in
- **Password**: admin123
- **Admin Panel**: http://localhost:3000/admin

## 🔧 Development Commands

```bash
# Install dependencies
npm run install-all          # Install both server and client dependencies

# Development
npm run dev                   # Start both frontend and backend
npm run server               # Start backend only
npm run client               # Start frontend only

# Production
npm run build                # Build frontend for production
npm start                    # Start production server

# Package Management
npm install <package>        # Install server dependency
cd client && npm install <package>  # Install client dependency
```

## 📡 API Documentation

### **Authentication Endpoints**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/verify-pin` - Verify user PIN

### **User Trading Endpoints**
- `GET /api/user/dashboard` - Get dashboard data with balances and recent transactions
- `GET /api/user/balances` - Get current user balances
- `GET /api/user/prices` - Get current Bitcoin prices and rates
- `POST /api/user/buy` - Execute market buy order
- `POST /api/user/sell` - Execute market sell order
- `GET /api/user/transactions` - Get transaction history with pagination

### **Advanced Trading Endpoints**
- `POST /api/user/limit-buy` - Place limit buy order
- `POST /api/user/limit-sell` - Place limit sell order
- `GET /api/user/limit-orders` - Get active limit orders
- `DELETE /api/user/limit-orders/:id` - Cancel limit order
- `POST /api/user/dca-buy` - Create DCA buy plan
- `POST /api/user/dca-sell` - Create DCA sell plan
- `GET /api/user/dca-plans` - Get active DCA plans
- `PATCH /api/user/dca-plans/:id/pause` - Pause DCA plan
- `PATCH /api/user/dca-plans/:id/resume` - Resume DCA plan
- `DELETE /api/user/dca-plans/:id` - Cancel DCA plan

### **Profile Management Endpoints**
- `PATCH /api/user/profile/name` - Update user name
- `PATCH /api/user/profile/email` - Update user email
- `PATCH /api/user/profile/password` - Change password
- `PATCH /api/user/profile/pin` - Change user PIN

### **Admin Endpoints**
- `GET /api/admin/dashboard` - Admin dashboard statistics
- `GET /api/admin/users` - Get all users with pagination
- `POST /api/admin/users` - Create new user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/deposit-inr` - Deposit INR to user account
- `POST /api/admin/users/:id/withdraw-inr` - Withdraw INR from user account
- `POST /api/admin/users/:id/deposit-btc` - Deposit Bitcoin to user account
- `POST /api/admin/users/:id/withdraw-btc` - Withdraw Bitcoin from user account
- `GET /api/admin/transactions` - Get all platform transactions
- `GET /api/admin/limit-orders` - Get all limit orders summary
- `PATCH /api/admin/settings` - Update system settings (buy/sell multipliers)

### **Public Endpoints**
- `GET /api/public/prices` - Get current Bitcoin prices (no auth required)
- `GET /api/public/chart/:timeframe` - Get chart data for timeframe
- `GET /health` - System health check

## 🏭 Production Deployment

### **Option 1: Manual Deployment**

```bash
# 1. Build the frontend
npm run build

# 2. Set production environment variables
export NODE_ENV=production
export DB_PASSWORD=your_production_password
export JWT_SECRET=your_production_jwt_secret
# ... set other environment variables

# 3. Start the production server
npm start
```

### **Option 2: PM2 Deployment**

```bash
# Install PM2 globally
npm install -g pm2

# Build the application
npm run build

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js

# PM2 management commands
pm2 status                    # Check app status
pm2 logs bittrade            # View logs
pm2 restart bittrade         # Restart app
pm2 stop bittrade            # Stop app
pm2 delete bittrade          # Delete app from PM2
```

### **Production Environment Setup**

1. **Create production environment file:**
```bash
cp .env.example .env.production
# Edit with production values
```

2. **Set up log directory:**
```bash
sudo mkdir -p /var/log/bittrade
sudo chown $USER:$USER /var/log/bittrade
```

3. **Configure reverse proxy (Nginx example):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔒 Security Features

### **Authentication & Authorization**
- JWT-based authentication with configurable expiration
- Role-based access control (Admin vs. User)
- PIN-based transaction confirmation
- Secure password hashing with bcrypt

### **API Security**
- Rate limiting to prevent abuse
- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization

### **Data Protection**
- Environment variable configuration
- Database connection security
- Redis password protection
- Secure session management

## 🎛️ Configuration Options

### **Trading Parameters**
- **Buy Multiplier**: Adjust the premium above USD price for buying (default: 91)
- **Sell Multiplier**: Adjust the discount below USD price for selling (default: 88)
- **Rate Limiting**: Configure API request limits per IP

### **System Settings**
- **Data Update Frequency**: Bitcoin price updates (default: 30 seconds)
- **Order Execution Frequency**: Limit order checks (default: every minute)
- **DCA Execution Frequency**: DCA plan checks (default: every minute)
- **Cache Expiration**: Redis cache durations

### **User Limits**
- **Transaction Minimums**: Set minimum trade amounts
- **Order Limits**: Configure maximum pending orders per user
- **DCA Plan Limits**: Set maximum active DCA plans per user

## 🔄 Business Logic

### **User Registration Flow**
1. User registers with email, name, and password
2. System creates user with 0 INR and 0 BTC balances
3. Admin deposits physical cash to user's INR balance
4. User can start trading Bitcoin

### **Trading Process**
1. **Market Orders**: Execute immediately at current rates
2. **Limit Orders**: Queue for execution when price conditions are met
3. **DCA Plans**: Schedule recurring trades based on frequency settings
4. **Balance Updates**: All trades update both available and reserved balances

### **Transaction Types**
- `SETUP` - Initial user account creation
- `DEPOSIT_INR` - Admin deposits INR cash to user account
- `WITHDRAW_INR` - Admin withdraws INR cash from user account
- `MARKET_BUY` - User buys Bitcoin at market rate
- `MARKET_SELL` - User sells Bitcoin at market rate
- `LIMIT_BUY` - User places limit buy order
- `LIMIT_SELL` - User places limit sell order
- `DCA_BUY` - Automated DCA buy execution
- `DCA_SELL` - Automated DCA sell execution
- `DEPOSIT_BTC` - Admin deposits Bitcoin to user account
- `WITHDRAW_BTC` - Admin withdraws Bitcoin from user account

### **Rate Calculation**
```javascript
// Current rates calculation
BTC_USD_Price = Latest price from CoinGecko API
Buy_Rate = BTC_USD_Price × Buy_Multiplier  // Default: × 91
Sell_Rate = BTC_USD_Price × Sell_Multiplier  // Default: × 88
```

## 🛠️ Troubleshooting

### **Common Issues**

#### **Database Connection Errors**
```bash
# Check MySQL service status
sudo systemctl status mysql

# Restart MySQL
sudo systemctl restart mysql

# Check database exists
mysql -u root -p -e "SHOW DATABASES;"
```

#### **Redis Connection Issues**
```bash
# Check Redis status
sudo systemctl status redis

# Test Redis connection
redis-cli ping

# If Redis is not available, the app will work without caching
```

#### **Port Already in Use**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change port in .env file
PORT=3002
```

#### **Frontend Build Issues**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild frontend
cd client
rm -rf node_modules package-lock.json build
npm install
npm run build
```

### **Environment Issues**

#### **Missing Environment Variables**
```bash
# Verify all required variables are set
node -e "
const required = ['DB_PASSWORD', 'JWT_SECRET'];
required.forEach(key => {
  if (!process.env[key]) console.error(\`Missing: \${key}\`);
});
"
```

#### **Database Schema Issues**
```bash
# Re-import schema
mysql -u root -p bittrade < database/schema.sql

# Check table structure
mysql -u root -p -e "USE bittrade; SHOW TABLES;"
```

## 📚 Learning Resources

### **Bitcoin Trading Concepts**
- **Market Orders**: Immediate execution at current market price
- **Limit Orders**: Conditional orders that execute when price targets are met
- **Dollar-Cost Averaging**: Strategy of buying fixed amounts at regular intervals
- **Spread Trading**: Profit from buy/sell price differences

### **Technical Concepts**
- **Satoshis**: Smallest unit of Bitcoin (1 BTC = 100,000,000 satoshis)
- **Order Books**: System for matching buy and sell orders
- **Balance Segregation**: Separating available and reserved funds
- **Real-time Data**: Live price feeds and market updates

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Create a Pull Request

### **Code Style Guidelines**
- Follow existing TypeScript/JavaScript conventions
- Use meaningful variable and function names
- Add comments for complex business logic
- Write unit tests for new features
- Ensure all tests pass before submitting

### **Feature Requests**
We welcome feature requests! Please open an issue with:
- Clear description of the feature
- Use case and benefits
- Any relevant mockups or examples

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **CoinGecko** for providing reliable Bitcoin price data
- **Alternative.me** for Fear & Greed Index data
- **React** and **Node.js** communities for excellent documentation
- **Bitcoin** community for inspiration and education

---

<div align="center">

**₿itTrade - Empowering Bitcoin Education Through Safe Trading Practice**

*Built with ❤️ for the Bitcoin community*

[Report Bug](https://github.com/your-repo/issues) • [Request Feature](https://github.com/your-repo/issues) • [Documentation](https://github.com/your-repo/wiki)

</div>
