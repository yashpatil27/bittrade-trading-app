# ₿itTrade - Bitcoin Paper Trading App

A modern, mobile-first Bitcoin paper trading application built with React.js and Node.js.

## Features

- 📱 **Mobile-First Design** - Optimized for mobile devices with dark theme
- 💰 **Paper Trading** - Trade Bitcoin with virtual money
- 📊 **Real-Time Prices** - Live Bitcoin prices from CoinGecko API
- 👤 **User Management** - Complete authentication and user accounts
- 🔧 **Admin Dashboard** - Full admin interface for user and system management
- ⚡ **Fast & Cached** - Redis caching for optimal performance
- 🔒 **Secure** - JWT authentication with bcrypt password hashing

## Tech Stack

**Frontend:**
- React.js with TypeScript
- Tailwind CSS for styling
- Lucide React for icons
- Axios for API calls

**Backend:**
- Node.js with Express.js
- MySQL database
- Redis for caching
- JWT authentication
- bcrypt for password hashing
- CoinGecko API for Bitcoin prices

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MySQL (v8 or higher)
- Redis (optional but recommended)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd bittrade-trading-app
npm run install-all
```

2. **Set up the database:**
```bash
# Create MySQL database and import schema
mysql -u root -p
CREATE DATABASE bittrade;
USE bittrade;
source database/schema.sql;
```

3. **Configure environment:**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Update DB_PASSWORD with your MySQL password
```

4. **Start the application:**
```bash
# Development mode (runs both frontend and backend)
npm run dev

# Or run separately:
npm run server  # Backend only
npm run client  # Frontend only
```

5. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## Default Admin Account

- **Email:** admin@bittrade.co.in
- **Password:** admin123

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout user

### User Endpoints
- `GET /api/user/dashboard` - Get dashboard data
- `GET /api/user/balances` - Get user balances
- `GET /api/user/prices` - Get current Bitcoin prices
- `POST /api/user/buy` - Buy Bitcoin
- `POST /api/user/sell` - Sell Bitcoin
- `GET /api/user/transactions` - Get transaction history

### Admin Endpoints
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/deposit-inr` - Deposit INR to user
- `POST /api/admin/users/:id/withdraw-inr` - Withdraw INR from user
- `PATCH /api/admin/settings` - Update system settings

## Database Schema

The application uses the following main tables:

- **users** - User accounts and authentication
- **transactions** - All trading transactions with balance snapshots
- **settings** - System settings (buy/sell multipliers)
- **prices** - Bitcoin price history from CoinGecko

## Business Logic

1. **User Registration:** Users register and receive 0 balances
2. **Cash Deposits:** Admin deposits physical INR cash to user accounts
3. **Trading:** Users buy/sell Bitcoin at calculated rates:
   - Buy Rate = BTC_USD_price × buy_multiplier (default: 91)
   - Sell Rate = BTC_USD_price × sell_multiplier (default: 88)
4. **Balance Tracking:** Every transaction stores updated balance snapshots

## Transaction Types

- `SETUP` - Initial user setup (0 balances)
- `DEPOSIT_INR` - Admin deposits INR to user account
- `BUY` - User buys Bitcoin with INR
- `SELL` - User sells Bitcoin for INR
- `WITHDRAW_INR` - Admin withdraws INR from user account
- `DEPOSIT_BTC` - Admin deposits Bitcoin to user account
- `WITHDRAW_BTC` - Admin withdraws Bitcoin from user account

## Production Deployment

1. **Build the frontend:**
```bash
npm run build
```

2. **Set environment variables:**
```bash
export NODE_ENV=production
# Set all other environment variables
```

3. **Start the production server:**
```bash
npm start
```

## Configuration

### Environment Variables

- `DB_HOST` - MySQL host (default: localhost)
- `DB_PORT` - MySQL port (default: 3306)
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name (default: bittrade)
- `JWT_SECRET` - Secret key for JWT tokens
- `REDIS_HOST` - Redis host (optional)
- `PORT` - Server port (default: 5000)

### System Settings

Admins can configure:
- Buy multiplier (default: 91)
- Sell multiplier (default: 88)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
