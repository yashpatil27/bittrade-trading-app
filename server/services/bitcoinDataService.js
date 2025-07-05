const axios = require('axios');
const cron = require('node-cron');
const { query } = require('../config/database');
const { setCache, getCache } = require('../config/redis');

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
      // Fetch both Bitcoin data and global market data for dominance
      const [bitcoinResponse, globalResponse] = await Promise.all([
        axios.get(
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
        ),
        axios.get(
          `${process.env.COINGECKO_API_URL}/global`,
          {
            timeout: 15000,
            headers: {
              'User-Agent': 'BitTrade-App/1.0'
            }
          }
        )
      ]);

      const data = bitcoinResponse.data;
      const marketData = data.market_data;
      const globalData = globalResponse.data.data;

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
        btc_dominance_pct: globalData && globalData.market_cap_percentage && globalData.market_cap_percentage.btc ? globalData.market_cap_percentage.btc : null,

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
      console.error('Error fetching Bitcoin data from CoinGecko:', error.message);
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
      console.error('Error fetching Fear & Greed Index:', error.message);
      throw error;
    }
  }

  // Fetch chart data for specific timeframe
  async fetchChartData(timeframe) {
    try {
      // Map our timeframes to CoinGecko days parameter
      const daysMap = {
        '1h': 1,
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
      console.error(`Error fetching chart data for ${timeframe}:`, error.message);
      throw error;
    }
  }

  // Update Bitcoin data in database
  async updateBitcoinData() {
    try {
      console.log('Fetching comprehensive Bitcoin data...');
      const bitcoinData = await this.fetchBitcoinData();
      
      // Store in database
      await query(
        `INSERT INTO bitcoin_data (
          btc_usd_price, price_change_24h, price_change_24h_pct,
          market_cap_usd, volume_24h_usd, high_24h_usd, low_24h_usd, btc_dominance_pct,
          price_change_1h_pct, price_change_7d_pct, price_change_30d_pct, 
          price_change_60d_pct, price_change_200d_pct, price_change_1y_pct,
          ath_usd, ath_date, ath_change_pct, atl_usd, atl_date, atl_change_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bitcoinData.btc_usd_price, bitcoinData.price_change_24h, bitcoinData.price_change_24h_pct,
          bitcoinData.market_cap_usd, bitcoinData.volume_24h_usd, bitcoinData.high_24h_usd, 
          bitcoinData.low_24h_usd, bitcoinData.btc_dominance_pct,
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
      await setCache('current_bitcoin_data', bitcoinData, 60); // Cache for 1 minute
      
      this.currentData = bitcoinData;
      this.lastUpdate = new Date();
      
      console.log(`Bitcoin data updated: $${bitcoinData.btc_usd_price.toLocaleString()}`);
      
      return bitcoinData;
    } catch (error) {
      console.error('Error updating Bitcoin data:', error.message);
      
      // If update fails, try to get last known data from cache or database
      const cachedData = await this.getCurrentData();
      if (cachedData) {
        console.log(`Using cached/last known data: $${cachedData.btc_usd_price.toLocaleString()}`);
        return cachedData;
      }
      
      throw error;
    }
  }

  // Update Fear & Greed sentiment data
  async updateSentimentData() {
    try {
      console.log('Fetching Fear & Greed Index...');
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

      console.log(`Fear & Greed Index updated: ${sentimentData.fear_greed_value} (${sentimentData.fear_greed_classification})`);
      
      return sentimentData;
    } catch (error) {
      console.error('Error updating sentiment data:', error.message);
      throw error;
    }
  }

  // Update chart data for specific timeframe
  async updateChartData(timeframe) {
    try {
      console.log(`Fetching chart data for ${timeframe}...`);
      const chartData = await this.fetchChartData(timeframe);
      
      // Upsert chart data
      await query(
        `INSERT INTO bitcoin_chart_data (timeframe, price_data, data_points_count, date_from, date_to)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         price_data = VALUES(price_data),
         data_points_count = VALUES(data_points_count),
         date_from = VALUES(date_from),
         date_to = VALUES(date_to),
         last_updated = CURRENT_TIMESTAMP`,
        [chartData.timeframe, chartData.price_data, chartData.data_points_count, chartData.date_from, chartData.date_to]
      );

      console.log(`Chart data updated for ${timeframe}: ${chartData.data_points_count} data points`);
      
      return chartData;
    } catch (error) {
      console.error(`Error updating chart data for ${timeframe}:`, error.message);
      throw error;
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
        
        // Cache it for future requests
        await setCache('current_bitcoin_data', data, 60);
        
        return data;
      }

      // If no data in database, fetch fresh data
      return await this.updateBitcoinData();
    } catch (error) {
      console.error('Error getting current Bitcoin data:', error.message);
      
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
      console.error('Error getting current BTC price:', error.message);
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
      console.error('Error calculating rates:', error.message);
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
      console.error('Error getting sentiment data:', error.message);
      throw error;
    }
  }

  // Get chart data
  async getChartData(timeframe = null) {
    try {
      let queryStr = 'SELECT * FROM bitcoin_chart_data';
      let params = [];

      if (timeframe) {
        queryStr += ' WHERE timeframe = ?';
        params.push(timeframe);
      }

      queryStr += ' ORDER BY timeframe';

      const chartRows = await query(queryStr, params);
      
      // Parse JSON price data with error handling
      return chartRows.map(row => {
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
          console.error(`Error parsing price_data for timeframe ${row.timeframe}:`, parseError.message);
          console.error('Raw price_data type:', typeof row.price_data);
          console.error('Raw price_data (first 200 chars):', JSON.stringify(row.price_data).substring(0, 200));
          // Return row with empty array if JSON parsing fails
          return {
            ...row,
            price_data: []
          };
        }
      }).filter(row => row.price_data && Array.isArray(row.price_data) && row.price_data.length > 0); // Filter out rows with no valid data
    } catch (error) {
      console.error('Error getting chart data:', error.message);
      throw error;
    }
  }

  // Start all data update services
  startDataUpdates() {
    if (this.isRunning) {
      console.log('Bitcoin data updates already running');
      return;
    }

    console.log('Starting Bitcoin data update services...');
    this.isRunning = true;

    // Initial data fetch
    this.updateBitcoinData().catch(error => {
      console.error('Initial Bitcoin data fetch failed:', error.message);
    });

    // Initial sentiment data fetch
    this.updateSentimentData().catch(error => {
      console.error('Initial sentiment data fetch failed:', error.message);
    });

    // Schedule Bitcoin data updates every 2 minutes to avoid rate limits
    cron.schedule('*/2 * * * *', async () => {
      if (this.isRunning) {
        try {
          await this.updateBitcoinData();
        } catch (error) {
          console.error('Scheduled Bitcoin data update failed:', error.message);
        }
      }
    });

    // Schedule sentiment data updates daily at 00:05
    cron.schedule('5 0 * * *', async () => {
      if (this.isRunning) {
        try {
          await this.updateSentimentData();
        } catch (error) {
          console.error('Scheduled sentiment data update failed:', error.message);
        }
      }
    });

    // Schedule chart data updates
    const chartTimeframes = ['1h', '1d', '7d', '30d', '90d', '365d'];
    
    chartTimeframes.forEach(timeframe => {
      // Short-term charts: update hourly
      if (['1h', '1d'].includes(timeframe)) {
        const job = cron.schedule('0 * * * *', async () => {
          if (this.isRunning) {
            try {
              await this.updateChartData(timeframe);
            } catch (error) {
              console.error(`Scheduled chart data update failed for ${timeframe}:`, error.message);
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
              console.error(`Scheduled chart data update failed for ${timeframe}:`, error.message);
            }
          }
        });
        this.chartUpdateJobs.push(job);
      }
    });

    // Initial chart data fetch for all timeframes (staggered to avoid rate limits)
    chartTimeframes.forEach((timeframe, index) => {
      setTimeout(() => {
        this.updateChartData(timeframe).catch(error => {
          console.error(`Initial chart data fetch failed for ${timeframe}:`, error.message);
        });
      }, index * 15000); // 15 second intervals
    });

    console.log('Bitcoin data updates scheduled:');
    console.log('- Bitcoin data: every 2 minutes');
    console.log('- Sentiment data: daily at 00:05');
    console.log('- Chart data: hourly (1h, 1d) and daily (7d, 30d, 90d, 365d)');
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
    console.log('Bitcoin data updates stopped');
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
      console.error('Error fetching Bitcoin data history:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
const bitcoinDataService = new BitcoinDataService();
module.exports = bitcoinDataService;
