# ₿itTrade Bitcoin Data Service - Update Schedule

## 📊 **Complete Update Frequency Overview**

### **🔴 HIGH FREQUENCY UPDATES (Real-Time Trading Data)**

| **Data Type** | **Frequency** | **Cron Expression** | **What Gets Updated** |
|---------------|---------------|---------------------|----------------------|
| **🏠 Bitcoin Data** | **Every 30 seconds** | `*/30 * * * * *` | • Current BTC/USD price<br>• Market cap, 24h volume<br>• 24h high/low prices<br>• Price changes (1h, 7d, 30d, 60d, 200d, 1y)<br>• All-time high/low data<br>• BTC dominance percentage |

### **🟡 MEDIUM FREQUENCY UPDATES (Chart Data)**

| **Data Type** | **Frequency** | **Cron Expression** | **What Gets Updated** |
|---------------|---------------|---------------------|----------------------|
| **📈 1d Chart Data** | **Every hour** | `0 * * * *` | • Intraday price points for 24-hour chart<br>• ~288 data points (5-minute intervals) |
| **📈 Long-term Charts** | **Daily at 01:00** | `0 1 * * *` | • **7d chart**: ~168 data points (hourly)<br>• **30d chart**: ~720 data points (hourly)<br>• **90d chart**: ~90 data points (daily)<br>• **365d chart**: ~365 data points (daily) |

### **🟢 LOW FREQUENCY UPDATES (Market Sentiment)**

| **Data Type** | **Frequency** | **Cron Expression** | **What Gets Updated** |
|---------------|---------------|---------------------|----------------------|
| **😰 Fear & Greed Index** | **Daily at 00:05** | `5 0 * * *` | • Fear & Greed value (0-100)<br>• Classification (Extreme Fear → Extreme Greed)<br>• Market sentiment indicator |

---

## 🎯 **Detailed Data Breakdown**

### **30-Second Bitcoin Data Updates Include:**

#### **💰 Price Information**
- `btc_usd_price` - Current Bitcoin price in USD (rounded to whole numbers)
- `price_change_24h` - 24-hour price change amount
- `price_change_24h_pct` - 24-hour price change percentage

#### **📊 Market Data**
- `market_cap_usd` - Total Bitcoin market capitalization
- `volume_24h_usd` - 24-hour trading volume
- `high_24h_usd` - 24-hour high price
- `low_24h_usd` - 24-hour low price
- `btc_dominance_pct` - Bitcoin's market dominance percentage

#### **📈 Multi-Timeframe Price Changes**
- `price_change_1h_pct` - 1-hour change percentage
- `price_change_7d_pct` - 7-day change percentage
- `price_change_30d_pct` - 30-day change percentage
- `price_change_60d_pct` - 60-day change percentage
- `price_change_200d_pct` - 200-day change percentage
- `price_change_1y_pct` - 1-year change percentage

#### **🏆 All-Time Records**
- `ath_usd` - All-time high price
- `ath_date` - Date of all-time high
- `ath_change_pct` - Change from all-time high
- `atl_usd` - All-time low price
- `atl_date` - Date of all-time low
- `atl_change_pct` - Change from all-time low

---

## 🚀 **API Rate Usage Analysis**

### **Updated Rate Consumption:**

| **Service** | **Frequency** | **Calls/Hour** | **Calls/Day** | **API Endpoint** |
|-------------|---------------|----------------|---------------|------------------|
| **Bitcoin Data** | 30 seconds | 120 | **2,880** | `/coins/bitcoin` |
| **Fear & Greed** | Daily | 0.04 | **1** | `alternative.me/fng` |
| **1d Chart** | Hourly | 1 | **24** | `/coins/bitcoin/market_chart` |
| **Long-term Charts** | Daily | 0.17 | **4** | `/coins/bitcoin/market_chart` |
| **Global Data** | 30 seconds | 120 | **2,880** | `/global` |
| **TOTAL** | - | **241.21** | **5,789** | - |

### **CoinGecko Free Tier Limits:**
- **Monthly limit**: ~10,000-20,000 calls
- **Daily usage**: 5,789 calls 
- **Monthly usage**: ~173,670 calls

⚠️ **WARNING**: This exceeds the free tier limits. Consider:
1. **Upgrading to CoinGecko Pro** ($129/month for 500k calls)
2. **Reducing frequency** to 1-2 minutes for Bitcoin data
3. **Implementing smart caching** to reduce redundant calls

---

## 💾 **Database Storage & Caching**

### **Storage Strategy:**
| **Table** | **Records Kept** | **Cleanup Strategy** |
|-----------|------------------|---------------------|
| `bitcoin_data` | Last 10 records | Auto-delete older records |
| `bitcoin_sentiment` | Last 10 records | Auto-delete older records |
| `bitcoin_chart_data` | 2 per timeframe | Keep latest 2 for fallback |

### **Caching Strategy:**
- **Redis cache duration**: 35 seconds (just longer than update interval)
- **Cache key**: `current_bitcoin_data`
- **Fallback**: Database → API call if cache miss

---

## ⚡ **Integration with Limit Orders**

### **Perfect Synchronization:**
- **Price updates**: Every 30 seconds
- **Order execution**: Every 30 seconds  
- **Execution delay**: 0-30 seconds maximum

### **Execution Flow:**
1. **00:00** - Bitcoin data updated
2. **00:00** - Limit order service checks orders  
3. **00:30** - Bitcoin data updated
4. **00:30** - Limit order service checks orders
5. **Repeat...**

---

## 🔧 **Configuration Options**

### **Frequency Adjustment:**
```javascript
// In bitcoinDataService.js - Change update frequency
cron.schedule('*/30 * * * * *', updateBitcoinData);  // Every 30 seconds
cron.schedule('*/60 * * * * *', updateBitcoinData);  // Every 60 seconds  
cron.schedule('*/2 * * * *', updateBitcoinData);     // Every 2 minutes
```

### **Cache Duration:**
```javascript
// In updateBitcoinData() and getCurrentData()
await setCache('current_bitcoin_data', bitcoinData, 35); // 35 seconds
```

### **Data Retention:**
```javascript
// Keep more historical records
'SELECT id FROM bitcoin_data ORDER BY created_at DESC LIMIT 10'  // Keep 10
'SELECT id FROM bitcoin_data ORDER BY created_at DESC LIMIT 50'  // Keep 50
```

---

## 📈 **Performance Impact**

### **Benefits of 30-Second Updates:**
✅ **Real-time trading** - Orders execute within 30 seconds  
✅ **Better UX** - Users see live price updates  
✅ **Competitive edge** - Faster than most retail platforms  
✅ **Accurate execution** - Reduced slippage on limit orders  

### **Considerations:**
⚠️ **Higher API costs** - May require paid CoinGecko plan  
⚠️ **Increased database writes** - 2,880 records/day  
⚠️ **More network traffic** - 120 API calls/hour  
⚠️ **Potential rate limiting** - Monitor for 429 errors  

---

## 🎯 **Alternative Frequency Recommendations**

### **Option 1: Conservative (Free Tier Friendly)**
- **Bitcoin Data**: Every 2 minutes (720 calls/day)
- **Charts**: Current schedule
- **Total**: ~750 calls/day ✅ Within free limits

### **Option 2: Balanced (Light Pro Plan)**
- **Bitcoin Data**: Every 1 minute (1,440 calls/day)  
- **Charts**: Current schedule
- **Total**: ~1,470 calls/day ✅ Good balance

### **Option 3: Real-time (Current)**
- **Bitcoin Data**: Every 30 seconds (2,880 calls/day)
- **Charts**: Current schedule  
- **Total**: ~5,789 calls/day ⚠️ Requires Pro plan

---

## ✅ **Current Status**

**✅ IMPLEMENTED**: 30-second Bitcoin data updates  
**✅ INTEGRATED**: With limit order execution service  
**✅ OPTIMIZED**: Caching and database retention  
**✅ MONITORED**: Comprehensive logging

Your Bitcoin trading platform now has **real-time price updates every 30 seconds**, providing users with the most current market data for informed trading decisions and ensuring limit orders execute promptly when conditions are met.
