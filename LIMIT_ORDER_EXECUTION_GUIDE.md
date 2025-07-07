# ₿itTrade Limit Order Execution System

## 🎯 Overview

The Limit Order Execution System is a comprehensive solution that automatically executes pending limit orders when market conditions are met. It runs independently of the Bitcoin price update service and checks for execution opportunities every 30 seconds.

## ✅ What's Been Implemented

### 1. **Limit Order Execution Service** (`limitOrderExecutionService.js`)
- **Automated execution** every 30 seconds
- **Smart price matching** for buy/sell orders
- **Order expiration** handling (24-hour default)
- **Comprehensive logging** with execution details
- **Error resilience** - continues processing other orders if one fails
- **Transaction safety** with proper rollback on errors

### 2. **Enhanced Database Schema**
- **Operations table** with limit order support
- **Balance segregation** (available vs reserved funds)
- **Cancellation tracking** with timestamps and reasons
- **Comprehensive indexes** for performance

### 3. **API Endpoints**

#### **User Endpoints** (`/api/user/`)
- `GET /limit-orders` - Get user's pending orders
- `DELETE /limit-orders/:orderId` - Cancel own order
- `POST /limit-buy` - Place limit buy order
- `POST /limit-sell` - Place limit sell order

#### **Admin Endpoints** (`/api/admin/`)
- `GET /limit-orders/summary` - Service status & order summary
- `GET /limit-orders/pending` - All pending orders with details
- `POST /limit-orders/execute` - Manual execution trigger
- `DELETE /limit-orders/:orderId` - Cancel any order (admin)
- `POST /limit-orders/service/start` - Start execution service
- `POST /limit-orders/service/stop` - Stop execution service

## 🔧 Implementation Details

### **Service Architecture**

```javascript
// Service runs every 30 seconds
limitOrderExecutionService.startService();

// Execution logic:
1. Get current market rates (buy & sell prices)
2. Fetch all pending LIMIT_BUY and LIMIT_SELL orders
3. Check each order against market conditions:
   - LIMIT_BUY: Execute when market_buy_price <= target_price
   - LIMIT_SELL: Execute when market_sell_price >= target_price
4. Execute qualifying orders with proper fund transfers
5. Log execution results
```

### **Order Execution Logic**

#### **Limit Buy Orders**
```
User wants to buy BTC when price drops to ₹X or below
- Execution condition: current_buy_rate <= limit_price
- Execution price: MIN(current_buy_rate, limit_price)
- Fund movement: reserved_inr → spent, available_btc += calculated_btc
```

#### **Limit Sell Orders**
```
User wants to sell BTC when price rises to ₹X or above  
- Execution condition: current_sell_rate >= limit_price
- Execution price: MAX(current_sell_rate, limit_price)
- Fund movement: reserved_btc → spent, available_inr += calculated_inr
```

### **Order Lifecycle**

1. **Order Placement**
   - User places limit order via API
   - Funds moved from `available` to `reserved`
   - Order created with `PENDING` status

2. **Execution Checking** (every 30 seconds)
   - Service checks market conditions
   - Executes qualifying orders
   - Updates status to `EXECUTED`

3. **Order Completion**
   - Funds transferred appropriately
   - Execution price and timestamp recorded
   - User cache cleared for updated balances

4. **Order Cancellation**
   - User or admin cancels order
   - Funds released back to `available`
   - Status updated to `CANCELLED`

5. **Order Expiration** (24 hours)
   - Orders automatically cancelled after 24 hours
   - Funds released automatically
   - Status updated to `CANCELLED`

## 📊 Database Schema

### **Operations Table**
```sql
CREATE TABLE operations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('LIMIT_BUY', 'LIMIT_SELL', ...),
  status ENUM('PENDING', 'EXECUTED', 'CANCELLED', 'EXPIRED'),
  btc_amount BIGINT NOT NULL,      -- BTC amount in satoshis
  inr_amount INT NOT NULL,         -- INR amount in rupees
  execution_price INT,             -- Actual execution price
  limit_price INT,                 -- Target price for limit orders
  executed_at TIMESTAMP,           -- When executed
  cancelled_at TIMESTAMP,          -- When cancelled
  cancellation_reason VARCHAR(255), -- Why cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Users Table (Balance Segregation)**
```sql
available_inr INT DEFAULT 0,     -- Liquid INR balance
available_btc BIGINT DEFAULT 0,  -- Liquid BTC balance  
reserved_inr INT DEFAULT 0,      -- INR locked in pending orders
reserved_btc BIGINT DEFAULT 0,   -- BTC locked in pending orders
```

## 🚀 Getting Started

### **1. Database Migration**
```bash
# Run the migration to add cancellation columns
mysql -u root -p bittrade < database/migration_add_cancellation_columns.sql
```

### **2. Start the Server**
```bash
npm run server
```

The limit order execution service will start automatically and you'll see:
```
✓ Bitcoin data service started
✓ Limit order execution service started (runs every 30 seconds)
```

### **3. Test the System**

#### **Place a Limit Buy Order**
```bash
curl -X POST http://localhost:3001/api/user/limit-buy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 10000,
    "targetPrice": 9000000
  }'
```

#### **Check Service Status**
```bash
curl http://localhost:3001/api/admin/limit-orders/summary \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

#### **View Pending Orders**
```bash
curl http://localhost:3001/api/user/limit-orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔍 Monitoring & Administration

### **Health Check**
```bash
curl http://localhost:3001/health
```

Response includes service status:
```json
{
  "status": "Running",
  "services": {
    "database": "connected",
    "bitcoin_data_service": "running",
    "limit_order_execution": "running"
  }
}
```

### **Admin Dashboard Data**
```bash
# Get comprehensive summary
curl http://localhost:3001/api/admin/limit-orders/summary \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Get all pending orders
curl http://localhost:3001/api/admin/limit-orders/pending \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Manually trigger execution
curl -X POST http://localhost:3001/api/admin/limit-orders/execute \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### **Service Control**
```bash
# Stop service
curl -X POST http://localhost:3001/api/admin/limit-orders/service/stop \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Start service  
curl -X POST http://localhost:3001/api/admin/limit-orders/service/start \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## 📈 Performance & Optimization

### **Execution Frequency**
- **Service runs every 30 seconds** (configurable)
- **Bitcoin price updates every 2 minutes**
- **Orders checked shortly after price updates**

### **Rate Limiting Protection**
- **No external API calls** during order execution
- **Uses cached Bitcoin price data** from bitcoinDataService
- **Database-only operations** for maximum speed

### **Error Handling**
- **Individual order failures** don't stop batch processing
- **Transaction rollback** on database errors
- **Comprehensive logging** for troubleshooting
- **Service continues** even if some executions fail

### **Database Performance**
- **Optimized indexes** for pending order queries
- **Efficient balance updates** with single transactions
- **Automatic cleanup** of expired orders

## ⚡ Integration Points

### **With Bitcoin Data Service**
```javascript
// Gets current market rates for execution decisions
const rates = await bitcoinDataService.getCalculatedRates();
const currentBuyPrice = rates.buyRate;
const currentSellPrice = rates.sellRate;
```

### **With User Service**
- **Leverages existing** limit order placement functions
- **Uses same balance** segregation system
- **Maintains cache consistency** via clearUserCache()

### **With Admin System**
- **Full admin control** over pending orders
- **Service start/stop** capabilities
- **Order cancellation** with admin override

## 🎯 Key Benefits

1. **✅ Automatic Execution** - No manual intervention required
2. **🔒 Fund Safety** - Proper reserve/release mechanisms  
3. **⚡ Fast Response** - 30-second execution cycles
4. **📊 Full Visibility** - Comprehensive admin monitoring
5. **🛡️ Error Resilient** - Continues operating despite individual failures
6. **💾 Audit Trail** - Complete execution and cancellation history
7. **🎛️ User Control** - Users can cancel their own orders
8. **⚙️ Admin Control** - Full administrative oversight

## 🔧 Configuration Options

### **Execution Frequency**
```javascript
// In limitOrderExecutionService.js
// Change '*/30 * * * * *' to adjust frequency
cron.schedule('*/30 * * * * *', executionCallback);
```

### **Order Expiration Time**
```javascript
// In limitOrderExecutionService.js  
const maxOrderAge = 24 * 60 * 60 * 1000; // 24 hours
```

### **Price Protection Limits**
```javascript
// In userService.js limit order placement
if (targetPrice > rates.buyRate * 1.5) {
  throw new Error('Target price too high');
}
```

---

## ✨ Ready to Trade!

Your Bitcoin trading app now has a complete, production-ready limit order execution system. Users can place limit orders with confidence knowing they'll be executed automatically when market conditions are met, while admins have full visibility and control over the system.

**The system runs automatically once the server starts - no additional setup required!**
