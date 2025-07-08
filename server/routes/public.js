const express = require('express');
const bitcoinDataService = require('../services/bitcoinDataService');

const router = express.Router();

// Get Bitcoin chart data (public endpoint)
router.get('/bitcoin/charts', async (req, res) => {
  try {
    const { timeframe } = req.query;
    const chartData = await bitcoinDataService.getChartData(timeframe);

    // If requesting specific timeframe, return single object
    if (timeframe && chartData.length > 0) {
      res.json({
        success: true,
        data: chartData[0]
      });
    } else if (timeframe) {
      // If no data found for specific timeframe, return null
      res.json({
        success: true,
        data: null
      });
    } else {
      // If no timeframe specified, return all chart data
      res.json({
        success: true,
        data: chartData
      });
    }

  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chart data'
    });
  }
});

// Get current Bitcoin price data (public endpoint)
router.get('/bitcoin/price', async (req, res) => {
  try {
    const rates = await bitcoinDataService.getCalculatedRates();

    res.json({
      success: true,
      data: {
        btc_usd: rates.btcUsdPrice,
        buy_rate: rates.buyRate,
        sell_rate: rates.sellRate,
        last_update: rates.lastUpdate,
        market_data: rates.marketData
      }
    });

  } catch (error) {
    console.error('Public price data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching price data'
    });
  }
});

// Get Bitcoin sentiment data (public endpoint)
router.get('/bitcoin/sentiment', async (req, res) => {
  try {
    const sentimentData = await bitcoinDataService.getSentimentData();

    res.json({
      success: true,
      data: sentimentData
    });

  } catch (error) {
    console.error('Public sentiment data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sentiment data'
    });
  }
});

module.exports = router;
