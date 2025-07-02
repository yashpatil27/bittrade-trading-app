const axios = require('axios');
const cron = require('node-cron');
const { query } = require('../config/database');
const { setCache, getCache } = require('../config/redis');

class PriceService {
  constructor() {
    this.isRunning = false;
    this.currentPrice = null;
    this.lastUpdate = null;
  }

  async fetchBTCPrice() {
    try {
      const response = await axios.get(
        `${process.env.COINGECKO_API_URL}/simple/price?ids=bitcoin&vs_currencies=usd`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'BitTrade-App/1.0'
          }
        }
      );

      if (response.data && response.data.bitcoin && response.data.bitcoin.usd) {
        const btcUsdPrice = Math.round(response.data.bitcoin.usd);
        return btcUsdPrice;
      } else {
        throw new Error('Invalid response format from CoinGecko API');
      }
    } catch (error) {
      console.error('Error fetching BTC price from CoinGecko:', error.message);
      throw error;
    }
  }

  async updatePrice() {
    try {
      console.log('Fetching BTC price...');
      const btcUsdPrice = await this.fetchBTCPrice();
      
      // Store in database
      await query(
        'INSERT INTO prices (btc_usd_price) VALUES (?)',
        [btcUsdPrice]
      );

      // Cache for quick access
      await setCache('current_btc_price', btcUsdPrice, 60); // Cache for 1 minute
      
      this.currentPrice = btcUsdPrice;
      this.lastUpdate = new Date();
      
      console.log(`BTC price updated: $${btcUsdPrice.toLocaleString()}`);
      
      return btcUsdPrice;
    } catch (error) {
      console.error('Error updating BTC price:', error.message);
      
      // If update fails, try to get last known price from cache or database
      const cachedPrice = await this.getCurrentPrice();
      if (cachedPrice) {
        console.log(`Using cached/last known price: $${cachedPrice.toLocaleString()}`);
        return cachedPrice;
      }
      
      throw error;
    }
  }

  async getCurrentPrice() {
    try {
      // Try cache first
      const cachedPrice = await getCache('current_btc_price');
      if (cachedPrice) {
        this.currentPrice = cachedPrice;
        return cachedPrice;
      }

      // If not in cache, get latest from database
      const priceRows = await query(
        'SELECT btc_usd_price FROM prices ORDER BY created_at DESC LIMIT 1'
      );

      if (priceRows.length > 0) {
        const price = priceRows[0].btc_usd_price;
        this.currentPrice = price;
        
        // Cache it for future requests
        await setCache('current_btc_price', price, 60);
        
        return price;
      }

      // If no price in database, fetch fresh price
      return await this.updatePrice();
    } catch (error) {
      console.error('Error getting current BTC price:', error.message);
      
      // Return last known price if available
      if (this.currentPrice) {
        return this.currentPrice;
      }
      
      throw error;
    }
  }

  async getCalculatedRates() {
    try {
      const btcUsdPrice = await this.getCurrentPrice();
      
      // Get multipliers from settings
      const settings = await query(
        'SELECT `key`, value FROM settings WHERE `key` IN (?, ?)',
        ['buy_multiplier', 'sell_multiplier']
      );

      let buyMultiplier = 91; // default
      let sellMultiplier = 88; // default

      settings.forEach(setting => {
        if (setting.key === 'buy_multiplier') {
          buyMultiplier = setting.value;
        } else if (setting.key === 'sell_multiplier') {
          sellMultiplier = setting.value;
        }
      });

      const buyRate = btcUsdPrice * buyMultiplier;
      const sellRate = btcUsdPrice * sellMultiplier;

      return {
        btcUsdPrice,
        buyRate,
        sellRate,
        buyMultiplier,
        sellMultiplier,
        lastUpdate: this.lastUpdate
      };
    } catch (error) {
      console.error('Error calculating rates:', error.message);
      throw error;
    }
  }

  startPriceUpdates() {
    if (this.isRunning) {
      console.log('Price updates already running');
      return;
    }

    console.log('Starting price update service...');
    this.isRunning = true;

    // Initial price fetch
    this.updatePrice().catch(error => {
      console.error('Initial price fetch failed:', error.message);
    });

    // Schedule updates every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        try {
          await this.updatePrice();
        } catch (error) {
          console.error('Scheduled price update failed:', error.message);
        }
      }
    });

    console.log('Price updates scheduled every 30 seconds');
  }

  stopPriceUpdates() {
    this.isRunning = false;
    console.log('Price updates stopped');
  }

  async getPriceHistory(limit = 100) {
    try {
      const priceHistory = await query(
        'SELECT btc_usd_price, created_at FROM prices ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
      return priceHistory;
    } catch (error) {
      console.error('Error fetching price history:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
const priceService = new PriceService();
module.exports = priceService;
