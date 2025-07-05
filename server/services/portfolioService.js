const { query } = require('../config/database');
const bitcoinDataService = require('./bitcoinDataService');

class PortfolioService {
  async calculatePortfolioMetrics(userId) {
    try {
      // Get current balances (latest transaction)
      const currentBalances = await this.getCurrentBalances(userId);
      
      // Get current sell rate for portfolio valuation
      const rates = await bitcoinDataService.getCalculatedRates();
      
      // Calculate all portfolio metrics
      const totalPortfolioValue = await this.calculateTotalPortfolioValue(currentBalances, rates.sellRate);
      const totalInvestment = await this.calculateTotalInvestment(userId);
      const unrealizedProfit = totalPortfolioValue - totalInvestment;
      const totalReturn = totalInvestment > 0 ? (unrealizedProfit / totalInvestment) * 100 : 0;
      const averageBuyPrice = await this.calculateAverageBuyPrice(userId);
      const breakEvenPrice = await this.calculateBreakEvenPrice(userId, currentBalances, totalInvestment);
      const assetAllocation = this.calculateAssetAllocation(currentBalances, rates.sellRate, totalPortfolioValue);
      const tradingStats = await this.calculateTradingStats(userId);

      return {
        // Core metrics
        totalPortfolioValue,
        currentBalances: {
          inr: currentBalances.inr_balance,
          btc: currentBalances.btc_balance / 100000000 // Convert satoshis to BTC
        },
        totalInvestment,
        unrealizedProfit,
        totalReturn,
        averageBuyPrice,
        breakEvenPrice,
        
        // Asset allocation
        assetAllocation,
        
        // Trading statistics
        tradingStats,
        
        // Placeholder for future FIFO implementation
        realizedProfit: 0, // TODO: Implement FIFO logic
        
        // Current rates for context
        currentRates: {
          sellRate: rates.sellRate,
          buyRate: rates.buyRate,
          btcUsdPrice: rates.btcUsdPrice
        }
      };
    } catch (error) {
      console.error('Error calculating portfolio metrics:', error);
      throw error;
    }
  }

  async getCurrentBalances(userId) {
    const balanceRows = await query(
      'SELECT inr_balance, btc_balance FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (balanceRows.length === 0) {
      throw new Error('No transactions found for user');
    }

    return balanceRows[0];
  }

  async calculateTotalPortfolioValue(currentBalances, sellRate) {
    const btcInBtc = currentBalances.btc_balance / 100000000; // Convert satoshis to BTC
    const btcValueInInr = btcInBtc * sellRate;
    return currentBalances.inr_balance + btcValueInInr;
  }

  async calculateTotalInvestment(userId) {
    const investmentRows = await query(`
      SELECT 
        SUM(CASE WHEN type IN ('DEPOSIT_INR', 'DEPOSIT_BTC') THEN inr_amount ELSE 0 END) - 
        SUM(CASE WHEN type IN ('WITHDRAW_INR', 'WITHDRAW_BTC') THEN inr_amount ELSE 0 END) as total_investment
      FROM transactions 
      WHERE user_id = ? AND type IN ('DEPOSIT_INR', 'DEPOSIT_BTC', 'WITHDRAW_INR', 'WITHDRAW_BTC')
    `, [userId]);

    return investmentRows[0].total_investment || 0;
  }

  async calculateAverageBuyPrice(userId) {
    const buyRows = await query(`
      SELECT 
        SUM(inr_amount) as total_inr_spent,
        SUM(btc_amount) as total_btc_bought
      FROM transactions 
      WHERE user_id = ? AND type = 'BUY' AND btc_amount > 0
    `, [userId]);

    const result = buyRows[0];
    if (!result.total_btc_bought || result.total_btc_bought === 0) {
      return 0;
    }

    const totalBtcInBtc = result.total_btc_bought / 100000000; // Convert satoshis to BTC
    return result.total_inr_spent / totalBtcInBtc;
  }

  async calculateBreakEvenPrice(userId, currentBalances, totalInvestment) {
    const currentBtcInBtc = currentBalances.btc_balance / 100000000; // Convert satoshis to BTC
    
    if (currentBtcInBtc === 0) {
      return 0;
    }

    // Breakeven = (Total Investment - Current INR Balance) / Current BTC Balance
    const breakeven = (totalInvestment - currentBalances.inr_balance) / currentBtcInBtc;
    return Math.max(0, breakeven); // Don't return negative breakeven prices
  }

  calculateAssetAllocation(currentBalances, sellRate, totalPortfolioValue) {
    if (totalPortfolioValue === 0) {
      return { inrPercentage: 0, btcPercentage: 0 };
    }

    const btcInBtc = currentBalances.btc_balance / 100000000;
    const btcValueInInr = btcInBtc * sellRate;
    
    const inrPercentage = (currentBalances.inr_balance / totalPortfolioValue) * 100;
    const btcPercentage = (btcValueInInr / totalPortfolioValue) * 100;

    return {
      inrPercentage: Math.round(inrPercentage * 100) / 100, // Round to 2 decimal places
      btcPercentage: Math.round(btcPercentage * 100) / 100
    };
  }

  async calculateTradingStats(userId) {
    // Trading Days
    const tradingDaysRows = await query(`
      SELECT COUNT(DISTINCT DATE(created_at)) as trading_days
      FROM transactions 
      WHERE user_id = ? AND type IN ('BUY', 'SELL')
    `, [userId]);

    // Total Trades
    const totalTradesRows = await query(`
      SELECT COUNT(*) as total_trades
      FROM transactions 
      WHERE user_id = ? AND type IN ('BUY', 'SELL')
    `, [userId]);

    // Trades This Month
    const tradesThisMonthRows = await query(`
      SELECT COUNT(*) as trades_this_month
      FROM transactions 
      WHERE user_id = ? AND type IN ('BUY', 'SELL') 
      AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
      AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `, [userId]);

    // Average Trade Size and Total Volume
    const volumeRows = await query(`
      SELECT 
        AVG(inr_amount) as avg_trade_size,
        SUM(inr_amount) as total_volume
      FROM transactions 
      WHERE user_id = ? AND type IN ('BUY', 'SELL')
    `, [userId]);

    // Days in Profit (placeholder - requires more complex calculation)
    // TODO: Implement daily portfolio tracking for accurate days in profit calculation
    const daysInProfit = 0;

    return {
      tradingDays: tradingDaysRows[0].trading_days || 0,
      totalTrades: totalTradesRows[0].total_trades || 0,
      tradesThisMonth: tradesThisMonthRows[0].trades_this_month || 0,
      averageTradeSize: Math.round(volumeRows[0].avg_trade_size || 0),
      totalVolume: volumeRows[0].total_volume || 0,
      daysInProfit // TODO: Implement proper calculation
    };
  }
}

// Export singleton instance
const portfolioService = new PortfolioService();
module.exports = portfolioService;
