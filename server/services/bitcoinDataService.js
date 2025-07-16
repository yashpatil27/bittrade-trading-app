const axios = require('axios');
const cron = require('node-cron');
const { query } = require('../config/database');
const { setCache, getCache } = require('../config/redis');
const { bitcoinDataLogger } = require('../utils/logger');
const socketServer = require('../websocket/socketServer');

class BitcoinDataService {
  constructor() {
    this.isRunning = false;
    this.currentData = null;
    this.lastUpdate = null;
    this.chartUpdateJobs = [];
  }

  // Fetch comprehensive Bitcoin data from CoinGecko
  async fetchBitcoinData() {
    try {
      // Fetch Bitcoin data only
      const bitcoinResponse = await axios.get(
        `${process.env.COINGECKO_API_URL}/coins/bitcoin`,
        {
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
            sparkline: false
          },
          timeout: 15000,
          headers: {
            'User-Agent': 'BitTrade-App/1.0'
          }
        }
      );

      const data = bitcoinResponse.data;
      const marketData = data.market_data;

      if (!marketData || !marketData.current_price || !marketData.current_price.usd) {
        throw new Error('Invalid response format from CoinGecko API');
      }

      return {
        // Price data (rounded to integers for cleaner display)
        btc_usd_price: Math.round(marketData.current_price.usd),
        price_change_24h: marketData.price_change_24h ? Math.round(marketData.price_change_24h) : null,
        price_change_24h_pct: marketData.price_change_percentage_24h || null,

        // Market data
        market_cap_usd: marketData.market_cap ? marketData.market_cap.usd : null,
        volume_24h_usd: marketData.total_volume ? marketData.total_volume.usd : null,
        high_24h_usd: marketData.high_24h ? Math.round(marketData.high_24h.usd) : null,
        low_24h_usd: marketData.low_24h ? Math.round(marketData.low_24h.usd) : null,

        // Price changes (all timeframes)
        price_change_1h_pct: marketData.price_change_percentage_1h_in_currency ? marketData.price_change_percentage_1h_in_currency.usd : null,
        price_change_7d_pct: marketData.price_change_percentage_7d || null,
        price_change_30d_pct: marketData.price_change_percentage_30d || null,
        price_change_60d_pct: marketData.price_change_percentage_60d || null,
        price_change_200d_pct: marketData.price_change_percentage_200d || null,
        price_change_1y_pct: marketData.price_change_percentage_1y || null,

        // All-time records (rounded to integers)
        ath_usd: marketData.ath ? Math.round(marketData.ath.usd) : null,
        ath_date: marketData.ath_date ? marketData.ath_date.usd.split('T')[0] : null,
        ath_change_pct: marketData.ath_change_percentage ? marketData.ath_change_percentage.usd : null,
        atl_usd: marketData.atl ? Math.round(marketData.atl.usd) : null,
        atl_date: marketData.atl_date ? marketData.atl_date.usd.split('T')[0] : null,
        atl_change_pct: marketData.atl_change_percentage ? marketData.atl_change_percentage.usd : null
      };
    } catch (error) {
      bitcoinDataLogger.error('Error fetching Bitcoin data from CoinGecko', error);
      throw error;
    }
  }

  // Fetch Fear & Greed Index from Alternative.me
  async fetchFearGreedIndex() {
    try {
      const response = await axios.get(
        'https://api.alternative.me/fng/?limit=1',
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'BitTrade-App/1.0'
          }
        }
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const fngData = response.data.data[0];
        return {
          fear_greed_value: parseInt(fngData.value),
          fear_greed_classification: fngData.value_classification,
          data_date: new Date(parseInt(fngData.timestamp) * 1000).toISOString().split('T')[0]
        };
      } else {
        throw new Error('Invalid response format from Alternative.me API');
      }
    } catch (error) {
      bitcoinDataLogger.error('Error fetching Fear & Greed Index', error);
      throw error;
    }
  }

  // Fetch chart data for specific timeframe
  async fetchChartData(timeframe) {
    try {
      // Map our timeframes to CoinGecko days parameter
      const daysMap = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '365d': 365
      };

      const days = daysMap[timeframe] || 7;
      
      const response = await axios.get(
        `${process.env.COINGECKO_API_URL}/coins/bitcoin/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: days
            // Note: CoinGecko automatically determines intervals:
            // - 1 day: 5-minute intervals
            // - 2-90 days: hourly intervals
            // - 90+ days: daily intervals
            // Explicit interval param requires Enterprise plan
          },
          timeout: 15000,
          headers: {
            'User-Agent': 'BitTrade-App/1.0'
          }
        }
      );

      if (response.data && response.data.prices) {
        const prices = response.data.prices;
        const dataPointsCount = prices.length;
        const dateFrom = new Date(prices[0][0]);
        const dateTo = new Date(prices[prices.length - 1][0]);

        return {
          timeframe,
          price_data: JSON.stringify(prices),
          data_points_count: dataPointsCount,
          date_from: dateFrom,
          date_to: dateTo
        };
      } else {
        throw new Error('Invalid chart data response from CoinGecko API');
      }
    } catch (error) {
      bitcoinDataLogger.error('Error fetching chart data for 1d', error);
      throw error;
    }
  }

  // Update Bitcoin data in database
  async updateBitcoinData() {
    try {
      bitcoinDataLogger.info('Fetching comprehensive Bitcoin data...');
      const bitcoinData = await this.fetchBitcoinData();
      
      // Store in database
      await query(
        `INSERT INTO bitcoin_data (
          btc_usd_price, price_change_24h, price_change_24h_pct,
          market_cap_usd, volume_24h_usd, high_24h_usd, low_24h_usd,
          price_change_1h_pct, price_change_7d_pct, price_change_30d_pct, 
          price_change_60d_pct, price_change_200d_pct, price_change_1y_pct,
          ath_usd, ath_date, ath_change_pct, atl_usd, atl_date, atl_change_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bitcoinData.btc_usd_price, bitcoinData.price_change_24h, bitcoinData.price_change_24h_pct,
          bitcoinData.market_cap_usd, bitcoinData.volume_24h_usd, bitcoinData.high_24h_usd, 
          bitcoinData.low_24h_usd,
          bitcoinData.price_change_1h_pct, bitcoinData.price_change_7d_pct, bitcoinData.price_change_30d_pct,
          bitcoinData.price_change_60d_pct, bitcoinData.price_change_200d_pct, bitcoinData.price_change_1y_pct,
          bitcoinData.ath_usd, bitcoinData.ath_date, bitcoinData.ath_change_pct,
          bitcoinData.atl_usd, bitcoinData.atl_date, bitcoinData.atl_change_pct
        ]
      );

      // Clean up old records (keep only last 10)
      await query(
        'DELETE FROM bitcoin_data WHERE id NOT IN (SELECT id FROM (SELECT id FROM bitcoin_data ORDER BY created_at DESC LIMIT 10) as t)'
      );

      // Cache for quick access
      await setCache('current_bitcoin_data', bitcoinData, 35); // Cache for 35 seconds (just longer than update interval)
      
      this.currentData = bitcoinData;
      this.lastUpdate = new Date();
      
      bitcoinDataLogger.info(`Bitcoin data updated: $${bitcoinData.btc_usd_price.toLocaleString()}`);
      
      // Broadcast price update to all connected clients
      try {
        const rates = await this.getCalculatedRates();
        const priceUpdate = {
          btc_usd: rates.btcUsdPrice,
          buy_rate: rates.buyRate,
          sell_rate: rates.sellRate,
          last_update: this.lastUpdate
        };
        
        // Broadcast to all connected users
        socketServer.broadcastToAll('price_update', priceUpdate);
        bitcoinDataLogger.debug('Price update broadcasted to all clients');
      } catch (broadcastError) {
        bitcoinDataLogger.error('Error broadcasting price update', broadcastError);
      }
      
      return bitcoinData;
    } catch (error) {
      bitcoinDataLogger.error('Error updating Bitcoin data', error);
      
      // If update fails, try to get last known data from cache or database
      const cachedData = await this.getCurrentData();
      if (cachedData) {
        bitcoinDataLogger.debug(`Using cached/last known data: $${cachedData.btc_usd_price.toLocaleString()}`);
        return cachedData;
      }
      
      throw error;
    }
  }

  // Update Fear & Greed sentiment data
  async updateSentimentData() {
    try {
      bitcoinDataLogger.info('Fetching Fear & Greed Index...');
      const sentimentData = await this.fetchFearGreedIndex();
      
      // Upsert sentiment data (update if exists for the date, insert if not)
      await query(
        `INSERT INTO bitcoin_sentiment (fear_greed_value, fear_greed_classification, data_date)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         fear_greed_value = VALUES(fear_greed_value),
         fear_greed_classification = VALUES(fear_greed_classification),
         last_updated = CURRENT_TIMESTAMP`,
        [sentimentData.fear_greed_value, sentimentData.fear_greed_classification, sentimentData.data_date]
      );

      // Clean up old records (keep only last 10)
      await query(
        'DELETE FROM bitcoin_sentiment WHERE id NOT IN (SELECT id FROM (SELECT id FROM bitcoin_sentiment ORDER BY data_date DESC LIMIT 10) as t)'
      );

      bitcoinDataLogger.info(`Fear & Greed Index updated: ${sentimentData.fear_greed_value} (${sentimentData.fear_greed_classification})`);
      
      // Broadcast sentiment update to all connected clients
      try {
        socketServer.broadcastToAll('sentiment_update', {
          fear_greed_value: sentimentData.fear_greed_value,
          fear_greed_classification: sentimentData.fear_greed_classification,
          data_date: sentimentData.data_date,
          last_updated: new Date().toISOString()
        });
        bitcoinDataLogger.debug('Sentiment update broadcasted to all clients');
      } catch (broadcastError) {
        bitcoinDataLogger.error('Error broadcasting sentiment update', broadcastError);
      }
      
      return sentimentData;
    } catch (error) {
      bitcoinDataLogger.error('Error updating sentiment data', error);
      throw error;
    }
  }

  // Update chart data for specific timeframe
  async updateChartData(timeframe) {
    try {
      bitcoinDataLogger.info(`Fetching chart data for ${timeframe}...`);
      const chartData = await this.fetchChartData(timeframe);
      
      // Insert new chart data (always create new record)
      await query(
        `INSERT INTO bitcoin_chart_data (timeframe, price_data, data_points_count, date_from, date_to)
         VALUES (?, ?, ?, ?, ?)`,
        [chartData.timeframe, chartData.price_data, chartData.data_points_count, chartData.date_from, chartData.date_to]
      );

      // Keep only the latest 2 records per timeframe for fallback
      await query(
        `DELETE FROM bitcoin_chart_data 
         WHERE timeframe = ? 
         AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM bitcoin_chart_data 
             WHERE timeframe = ? 
             ORDER BY last_updated DESC 
             LIMIT 2
           ) as t
         )`,
        [timeframe, timeframe]
      );

      bitcoinDataLogger.info(`Chart data updated for ${timeframe}: ${chartData.data_points_count} data points (keeping 2 records for fallback)`);
      
      return chartData;
    } catch (error) {
      bitcoinDataLogger.error(`Error updating chart data for ${timeframe}`, error);
      // Don't throw error to prevent stopping other timeframe updates
      bitcoinDataLogger.warn(`Retaining existing chart data for ${timeframe} as fallback`);
      return null;
    }
  }

  // Get current Bitcoin data
  async getCurrentData() {
    try {
      // Try cache first
      const cachedData = await getCache('current_bitcoin_data');
      if (cachedData) {
        this.currentData = cachedData;
        return cachedData;
      }

      // If not in cache, get latest from database
      const dataRows = await query(
        'SELECT * FROM bitcoin_data ORDER BY created_at DESC LIMIT 1'
      );

      if (dataRows.length > 0) {
        const data = dataRows[0];
        this.currentData = data;
        
        // Cache it for future requests with stale-while-revalidate pattern
        await setCache('current_bitcoin_data', data, 35);
        
        return data;
      }

      // If no data in database, fetch fresh data
      return await this.updateBitcoinData();
    } catch (error) {
      bitcoinDataLogger.error('Error getting current Bitcoin data', error);
      
      // Return last known data if available
      if (this.currentData) {
        return this.currentData;
      }
      
      throw error;
    }
  }

  // Get current price (for backward compatibility)
  async getCurrentPrice() {
    try {
      const data = await this.getCurrentData();
      return data.btc_usd_price;
    } catch (error) {
      bitcoinDataLogger.error('Error getting current BTC price', error);
      throw error;
    }
  }

  // Get calculated rates (for backward compatibility)
  async getCalculatedRates() {
    try {
      const data = await this.getCurrentData();
      
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

      const buyRate = Math.round(data.btc_usd_price * buyMultiplier);
      const sellRate = Math.round(data.btc_usd_price * sellMultiplier);

      return {
        btcUsdPrice: data.btc_usd_price,
        buyRate,
        sellRate,
        buyMultiplier,
        sellMultiplier,
        lastUpdate: this.lastUpdate,
        marketData: {
          market_cap_usd: data.market_cap_usd,
          volume_24h_usd: data.volume_24h_usd,
          price_change_24h_pct: data.price_change_24h_pct,
          high_24h_usd: data.high_24h_usd,
          low_24h_usd: data.low_24h_usd
        }
      };
    } catch (error) {
      bitcoinDataLogger.error('Error calculating rates', error);
      throw error;
    }
  }

  // Get sentiment data
  async getSentimentData() {
    try {
      const sentimentRows = await query(
        'SELECT * FROM bitcoin_sentiment ORDER BY data_date DESC LIMIT 1'
      );

      return sentimentRows.length > 0 ? sentimentRows[0] : null;
    } catch (error) {
      bitcoinDataLogger.error('Error getting sentiment data', error);
      throw error;
    }
  }

  // Get chart data
  async getChartData(timeframe = null) {
    try {
      let queryStr, params = [];

      if (timeframe) {
        // For specific timeframe, get the latest valid record (with fallback to older records)
        queryStr = `SELECT * FROM bitcoin_chart_data 
                    WHERE timeframe = ? 
                    ORDER BY last_updated DESC 
                    LIMIT 2`;
        params.push(timeframe);
      } else {
        // For all timeframes, get the latest record for each timeframe
        queryStr = `SELECT t1.* FROM bitcoin_chart_data t1
                    INNER JOIN (
                      SELECT timeframe, MAX(last_updated) as max_updated
                      FROM bitcoin_chart_data
                      GROUP BY timeframe
                    ) t2 ON t1.timeframe = t2.timeframe AND t1.last_updated = t2.max_updated
                    ORDER BY t1.timeframe`;
      }

      const chartRows = await query(queryStr, params);
      
      // Parse JSON price data with error handling
      const processedRows = chartRows.map(row => {
        try {
          // Check if price_data is already an object/array
          if (typeof row.price_data === 'object') {
            return {
              ...row,
              price_data: row.price_data
            };
          }
          // If it's a string, try to parse it
          return {
            ...row,
            price_data: JSON.parse(row.price_data)
          };
        } catch (parseError) {
          bitcoinDataLogger.error(`Error parsing price_data for timeframe ${row.timeframe}`, parseError);
          bitcoinDataLogger.debug('Raw price_data type:', typeof row.price_data);
          bitcoinDataLogger.debug('Raw price_data (first 200 chars):', JSON.stringify(row.price_data).substring(0, 200));
          // Return row with empty array if JSON parsing fails
          return {
            ...row,
            price_data: []
          };
        }
      }).filter(row => row.price_data && Array.isArray(row.price_data) && row.price_data.length > 0);

      // If requesting specific timeframe, return the first valid record (latest)
      if (timeframe) {
        return processedRows.length > 0 ? [processedRows[0]] : [];
      }
      
      return processedRows;
    } catch (error) {
      bitcoinDataLogger.error('Error getting chart data', error);
      throw error;
    }
  }

  // Start all data update services
  startDataUpdates() {
    if (this.isRunning) {
      bitcoinDataLogger.warn('Bitcoin data updates already running');
      return;
    }

    bitcoinDataLogger.info('Starting Bitcoin data update services...');
    this.isRunning = true;

    // Initial data fetch
    this.updateBitcoinData().catch(error => {
      bitcoinDataLogger.error('Initial Bitcoin data fetch failed', error);
    });

    // Initial sentiment data fetch
    this.updateSentimentData().catch(error => {
      bitcoinDataLogger.error('Initial sentiment data fetch failed', error);
    });

    // Schedule Bitcoin data updates every 30 seconds for real-time trading
    cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        try {
          await this.updateBitcoinData();
        } catch (error) {
          bitcoinDataLogger.error('Scheduled Bitcoin data update failed', error);
        }
      }
    });

    // Schedule sentiment data updates daily at 00:05
    cron.schedule('5 0 * * *', async () => {
      if (this.isRunning) {
        try {
          await this.updateSentimentData();
        } catch (error) {
          bitcoinDataLogger.error('Scheduled sentiment data update failed', error);
        }
      }
    });

    // Schedule chart data updates
    const chartTimeframes = ['1d', '7d', '30d', '90d', '365d'];
    
    chartTimeframes.forEach(timeframe => {
      // Short-term charts: update hourly
      if (['1d'].includes(timeframe)) {
        const job = cron.schedule('0 * * * *', async () => {
          if (this.isRunning) {
            try {
              await this.updateChartData(timeframe);
            } catch (error) {
              bitcoinDataLogger.error(`Scheduled chart data update failed for ${timeframe}`, error);
            }
          }
        });
        this.chartUpdateJobs.push(job);
      } 
      // Long-term charts: update daily at 01:00
      else {
        const job = cron.schedule('0 1 * * *', async () => {
          if (this.isRunning) {
            try {
              await this.updateChartData(timeframe);
            } catch (error) {
              bitcoinDataLogger.error(`Scheduled chart data update failed for ${timeframe}`, error);
            }
          }
        });
        this.chartUpdateJobs.push(job);
      }
    });

    // Initial chart data fetch for all timeframes (staggered to avoid rate limits)
    const chartFetchSchedule = {
      '1d': 2 * 60 * 1000,   // 2 minutes
      '7d': 7 * 60 * 1000,   // 7 minutes
      '30d': 12 * 60 * 1000, // 12 minutes
      '90d': 17 * 60 * 1000, // 17 minutes
      '365d': 22 * 60 * 1000 // 22 minutes
    };
    
    chartTimeframes.forEach((timeframe) => {
      setTimeout(() => {
        this.updateChartData(timeframe).catch(error => {
          bitcoinDataLogger.error(`Initial chart data fetch failed for ${timeframe}`, error);
        });
      }, chartFetchSchedule[timeframe]);
    });

    bitcoinDataLogger.serviceStarted('Bitcoin Data Service', {
      priceUpdates: 'Every 30 seconds',
      sentimentUpdates: 'Daily at 00:05',
      chartUpdates: 'Hourly (1d) and daily (7d, 30d, 90d, 365d)',
      initialFetch: 'Staggered: 1d(2min), 7d(7min), 30d(12min), 90d(17min), 365d(22min)'
    });
  }

  // Stop all data update services
  stopDataUpdates() {
    this.isRunning = false;
    this.chartUpdateJobs.forEach(job => {
      if (job && typeof job.destroy === 'function') {
        job.destroy();
      }
    });
    this.chartUpdateJobs = [];
    bitcoinDataLogger.info('Bitcoin data updates stopped');
  }

  // Get comprehensive data history
  async getDataHistory(limit = 100) {
    try {
      const dataHistory = await query(
        'SELECT * FROM bitcoin_data ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
      return dataHistory;
    } catch (error) {
      bitcoinDataLogger.error('Error fetching Bitcoin data history', error);
      throw error;
    }
  }
}

// Export singleton instance
const bitcoinDataService = new BitcoinDataService();
module.exports = bitcoinDataService;
