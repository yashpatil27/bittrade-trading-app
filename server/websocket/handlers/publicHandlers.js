const bitcoinDataService = require('../../services/bitcoinDataService');
const settingsService = require('../../services/settingsService');
const { query } = require('../../config/database');

const publicHandlers = {
  register(socket, socketServer) {
    // Setup any specific public event listeners here
    // No authentication required for public handlers
  },

  async handle(method, payload, socket, socketServer) {
    switch (method) {
      // Bitcoin data and prices
      case 'bitcoin-price':
        return await this.handleBitcoinPrice(payload, socket, socketServer);
      case 'bitcoin-data':
        return await this.handleBitcoinData(payload, socket, socketServer);
      case 'bitcoin-sentiment':
        return await this.handleBitcoinSentiment(payload, socket, socketServer);
      case 'bitcoin-charts':
        return await this.handleBitcoinCharts(payload, socket, socketServer);
      case 'bitcoin-history':
        return await this.handleBitcoinHistory(payload, socket, socketServer);
      case 'market-data':
        return await this.handleMarketData(payload, socket, socketServer);
      case 'fear-greed-index':
        return await this.handleFearGreedIndex(payload, socket, socketServer);
      
      // Trading rates and fees
      case 'trading-rates':
        return await this.handleTradingRates(payload, socket, socketServer);
      case 'trading-fees':
        return await this.handleTradingFees(payload, socket, socketServer);
      
      // Platform statistics
      case 'platform-stats':
        return await this.handlePlatformStats(payload, socket, socketServer);
      case 'volume-stats':
        return await this.handleVolumeStats(payload, socket, socketServer);
      
      // System information
      case 'system-info':
        return await this.handleSystemInfo(payload, socket, socketServer);
      case 'server-time':
        return await this.handleServerTime(payload, socket, socketServer);
      
      default:
        throw new Error(`Unknown public method: ${method}`);
    }
  },

  // Bitcoin data and price handlers
  async handleBitcoinPrice(payload, socket, socketServer) {
    const rates = await bitcoinDataService.getCalculatedRates();
    
    return {
      btc_usd: rates.btcUsdPrice,
      buy_rate: rates.buyRate,
      sell_rate: rates.sellRate,
      last_update: rates.lastUpdate,
      price_change_24h: rates.marketData?.price_change_percentage_24h || 0,
      market_cap: rates.marketData?.market_cap || 0,
      volume_24h: rates.marketData?.total_volume || 0
    };
  },

  async handleBitcoinData(payload, socket, socketServer) {
    const data = await bitcoinDataService.getCurrentData();
    
    return {
      price: data.price,
      market_cap: data.market_cap,
      volume_24h: data.volume_24h,
      price_change_24h: data.price_change_24h,
      price_change_percentage_24h: data.price_change_percentage_24h,
      circulating_supply: data.circulating_supply,
      total_supply: data.total_supply,
      max_supply: data.max_supply,
      last_updated: data.last_updated
    };
  },

  async handleBitcoinSentiment(payload, socket, socketServer) {
    const sentiment = await bitcoinDataService.getSentimentData();
    
    return {
      fear_greed_index: sentiment.fear_greed_index,
      fear_greed_classification: sentiment.fear_greed_classification,
      last_updated: sentiment.last_updated,
      next_update: sentiment.next_update
    };
  },

  async handleBitcoinCharts(payload, socket, socketServer) {
    const { timeframe } = payload;
    const chartData = await bitcoinDataService.getChartData(timeframe);

    // If requesting specific timeframe, return single object
    if (timeframe && chartData.length > 0) {
      return chartData[0];
    } else if (timeframe) {
      return null;
    } else {
      return chartData;
    }
  },

  async handleBitcoinHistory(payload, socket, socketServer) {
    const limit = Math.min(parseInt(payload.limit) || 100, 1000); // Cap at 1000
    
    return await bitcoinDataService.getDataHistory(limit);
  },

  async handleMarketData(payload, socket, socketServer) {
    const data = await bitcoinDataService.getCurrentData();
    const sentiment = await bitcoinDataService.getSentimentData();
    
    return {
      bitcoin: {
        price: data.price,
        market_cap: data.market_cap,
        volume_24h: data.volume_24h,
        price_change_24h: data.price_change_24h,
        price_change_percentage_24h: data.price_change_percentage_24h,
        circulating_supply: data.circulating_supply,
        dominance: data.market_cap_dominance
      },
      sentiment: {
        fear_greed_index: sentiment.fear_greed_index,
        fear_greed_classification: sentiment.fear_greed_classification
      },
      last_updated: new Date().toISOString()
    };
  },

  async handleFearGreedIndex(payload, socket, socketServer) {
    const sentiment = await bitcoinDataService.getSentimentData();
    
    return {
      value: sentiment.fear_greed_index,
      classification: sentiment.fear_greed_classification,
      last_updated: sentiment.last_updated,
      next_update: sentiment.next_update
    };
  },

  // Trading rates and fees handlers
  async handleTradingRates(payload, socket, socketServer) {
    const rates = await bitcoinDataService.getCalculatedRates();
    const settings = await settingsService.getSettings();
    
    return {
      btc_usd_price: rates.btcUsdPrice,
      buy_rate: rates.buyRate,
      sell_rate: rates.sellRate,
      buy_multiplier: settings.buy_multiplier,
      sell_multiplier: settings.sell_multiplier,
      spread: rates.buyRate - rates.sellRate,
      spread_percentage: ((rates.buyRate - rates.sellRate) / rates.sellRate) * 100,
      last_update: rates.lastUpdate
    };
  },

  async handleTradingFees(payload, socket, socketServer) {
    const settings = await settingsService.getSettings();
    
    return {
      buy_fee_percentage: ((settings.buy_multiplier - 1) * 100),
      sell_fee_percentage: ((1 - settings.sell_multiplier) * 100),
      buy_multiplier: settings.buy_multiplier,
      sell_multiplier: settings.sell_multiplier,
      minimum_trade_amount: 100, // ₹100 minimum
      maximum_trade_amount: 1000000, // ₹10,00,000 maximum
      currency: 'INR'
    };
  },

  // Platform statistics handlers
  async handlePlatformStats(payload, socket, socketServer) {
    const [
      totalUsers,
      totalTransactions,
      totalVolume,
      averageTransactionSize,
      last24hVolume,
      last24hTransactions
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED"'),
      query('SELECT COALESCE(SUM(inr_amount), 0) as total FROM operations WHERE status = "EXECUTED"'),
      query('SELECT COALESCE(AVG(inr_amount), 0) as average FROM operations WHERE status = "EXECUTED" AND inr_amount > 0'),
      query('SELECT COALESCE(SUM(inr_amount), 0) as total FROM operations WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
      query('SELECT COUNT(*) as count FROM operations WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)')
    ]);

    return {
      total_users: totalUsers[0].count,
      total_transactions: totalTransactions[0].count,
      total_volume: totalVolume[0].total,
      average_transaction_size: Math.round(averageTransactionSize[0].average),
      last_24h_volume: last24hVolume[0].total,
      last_24h_transactions: last24hTransactions[0].count,
      currency: 'INR',
      updated_at: new Date().toISOString()
    };
  },

  async handleVolumeStats(payload, socket, socketServer) {
    const { period = '24h' } = payload;
    
    let interval;
    switch (period) {
      case '1h':
        interval = 'INTERVAL 1 HOUR';
        break;
      case '24h':
        interval = 'INTERVAL 24 HOUR';
        break;
      case '7d':
        interval = 'INTERVAL 7 DAY';
        break;
      case '30d':
        interval = 'INTERVAL 30 DAY';
        break;
      default:
        interval = 'INTERVAL 24 HOUR';
    }

    const [
      buyVolume,
      sellVolume,
      totalTransactions,
      uniqueUsers
    ] = await Promise.all([
      query(`
        SELECT COALESCE(SUM(inr_amount), 0) as volume, COUNT(*) as count 
        FROM operations 
        WHERE status = "EXECUTED" AND type IN ("BUY", "LIMIT_BUY") 
        AND created_at >= DATE_SUB(NOW(), ${interval})
      `),
      query(`
        SELECT COALESCE(SUM(inr_amount), 0) as volume, COUNT(*) as count 
        FROM operations 
        WHERE status = "EXECUTED" AND type IN ("SELL", "LIMIT_SELL") 
        AND created_at >= DATE_SUB(NOW(), ${interval})
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM operations 
        WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), ${interval})
      `),
      query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM operations 
        WHERE status = "EXECUTED" AND created_at >= DATE_SUB(NOW(), ${interval})
      `)
    ]);

    return {
      period,
      buy_volume: buyVolume[0].volume,
      sell_volume: sellVolume[0].volume,
      total_volume: buyVolume[0].volume + sellVolume[0].volume,
      buy_transactions: buyVolume[0].count,
      sell_transactions: sellVolume[0].count,
      total_transactions: totalTransactions[0].count,
      unique_users: uniqueUsers[0].count,
      currency: 'INR',
      updated_at: new Date().toISOString()
    };
  },

  // System information handlers
  async handleSystemInfo(payload, socket, socketServer) {
    return {
      platform: 'BitTrade',
      version: '1.0.0',
      api_version: 'v1',
      supported_currencies: ['INR'],
      supported_cryptocurrencies: ['BTC'],
      trading_pairs: ['BTC/INR'],
      features: {
        spot_trading: true,
        limit_orders: true,
        dca_plans: true,
        lending: true,
        margin_trading: false,
        futures: false
      },
      limits: {
        min_trade_amount: 100,
        max_trade_amount: 1000000,
        min_withdrawal: 100,
        max_daily_withdrawal: 500000
      },
      trading_hours: '24/7',
      maintenance_mode: false,
      server_time: new Date().toISOString()
    };
  },

  async handleServerTime(payload, socket, socketServer) {
    return {
      server_time: new Date().toISOString(),
      timezone: 'UTC',
      unix_timestamp: Math.floor(Date.now() / 1000)
    };
  }
};

module.exports = publicHandlers;
