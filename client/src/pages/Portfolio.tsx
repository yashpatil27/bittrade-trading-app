import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  DollarSign,
  Bitcoin,
  PieChart,
  Sparkles,
  Eye,
  ArrowUp,
  ArrowDown,
  Trophy,
  Clock,
  Globe,
  Crown,
  Brain
} from 'lucide-react';
import { userAPI } from '../services/api';
import { formatCurrency, formatInr, formatBtc, formatPercentage, formatCurrencyInr } from '../utils/formatters';

interface PortfolioData {
  totalPortfolioValue: number;
  currentBalances: {
    inr: number;
    btc: number;
    collateralBtc: number;
    borrowedInr: number;
    interestAccrued: number;
  };
  totalInvestment: number;
  unrealizedProfit: number;
  totalReturn: number;
  averageBuyPrice: number;
  breakEvenPrice: number;
  realizedProfit: number;
  assetAllocation: {
    inrPercentage: number;
    btcPercentage: number;
    liabilitiesPercentage: number;
  };
  loanSummary: {
    totalLiabilities: number;
    borrowedAmount: number;
    interestAccrued: number;
    collateralBtc: number;
  };
  tradingStats: {
    tradingDays: number;
    totalTrades: number;
    tradesThisMonth: number;
    averageTradeSize: number;
    totalVolume: number;
    daysInProfit: number;
  };
  currentRates: {
    sellRate: number;
    buyRate: number;
    btcUsdPrice: number;
  };
}

interface BitcoinMarketData {
  market_cap_usd: number;
  volume_24h_usd: number;
  btc_dominance_pct: number;
  ath_usd: number;
  ath_date: string;
  ath_change_pct: number;
}

interface SentimentData {
  fear_greed_value: number;
  fear_greed_classification: string;
}

const Portfolio: React.FC = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [bitcoinData, setBitcoinData] = useState<BitcoinMarketData | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all data in parallel
      const [portfolioResponse, bitcoinResponse, sentimentResponse] = await Promise.all([
        userAPI.portfolio(),
        userAPI.getBitcoinData(),
        userAPI.getBitcoinSentiment()
      ]);
      
      setPortfolioData(portfolioResponse.data.data);
      setBitcoinData(bitcoinResponse.data.data);
      setSentimentData(sentimentResponse.data.data);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setError('Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPercentageWithNA = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 'N/A';
    }
    return formatPercentage(value);
  };

  const formatInrWithNA = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return '₹0';
    }
    return formatInr(value);
  };

  const formatLargeNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 'N/A';
    }
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else {
      return `$${value.toLocaleString()}`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getSentimentColor = (classification: string) => {
    const lower = classification.toLowerCase();
    if (lower.includes('fear')) return 'text-red-400';
    if (lower.includes('greed')) return 'text-green-400';
    return 'text-yellow-400';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PieChart className="w-6 h-6 text-white" />
          Portfolio
        </h1>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolioData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PieChart className="w-6 h-6 text-white" />
          Portfolio
        </h1>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 bg-red-400 rounded-full" />
          <span className="text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  const { 
    totalPortfolioValue, 
    currentBalances, 
    totalInvestment, 
    unrealizedProfit, 
    totalReturn,
    averageBuyPrice,
    breakEvenPrice,
    realizedProfit,
    assetAllocation,
    loanSummary,
    tradingStats,
    currentRates
  } = portfolioData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="w-6 h-6 text-white" />
            Portfolio
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Track your trading performance</p>
        </div>
        <button 
          onClick={fetchPortfolioData}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Activity className="w-5 h-5" />
        </button>
      </div>

      {/* Total Portfolio Value */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="w-6 h-6 text-white" />
          <h2 className="text-lg font-semibold">Total Portfolio Value</h2>
        </div>
        <p className="text-3xl font-bold text-white mb-2">
          {formatInrWithNA(totalPortfolioValue || 0)}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="text-zinc-400">
            Investment: {formatInrWithNA(totalInvestment || 0)}
          </span>
          <span className={`flex items-center gap-1 ${(unrealizedProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(unrealizedProfit || 0) >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {formatPercentageWithNA(totalReturn)}
          </span>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-zinc-400 text-sm">Unrealized P&L</span>
          </div>
          <p className={`text-lg font-bold ${(unrealizedProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatInrWithNA(unrealizedProfit || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-blue-400" />
            <span className="text-zinc-400 text-sm">Realized P&L</span>
          </div>
          <p className={`text-lg font-bold ${(realizedProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(realizedProfit || 0) === 0 ? 'Coming Soon' : formatInrWithNA(realizedProfit || 0)}
          </p>
        </div>
      </div>

      {/* Current Holdings */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-white" />
          Current Holdings
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">Cash Balance</p>
            <p className="text-lg font-bold">{formatInrWithNA(currentBalances?.inr || 0)}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <Bitcoin className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">Bitcoin</p>
            <p className="text-lg font-bold">{formatCurrency(currentBalances?.btc || 0, 'BTC')}</p>
            <p className="text-xs text-zinc-500">
              ≈ {formatInrWithNA((currentBalances?.btc || 0) * (currentRates?.sellRate || 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Loan Summary */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-white" />
          Loan Summary
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <span className="text-zinc-400 text-sm">Borrowed Amount</span>
            <p className="text-lg font-bold">{formatInrWithNA(loanSummary?.borrowedAmount || 0)}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <span className="text-zinc-400 text-sm">Interest Accrued</span>
            <p className="text-lg font-bold">{formatInrWithNA(loanSummary?.interestAccrued || 0)}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <Bitcoin className="w-6 h-6 text-white mx-auto mb-2" />
            <span className="text-zinc-400 text-sm">Collateral Bitcoin</span>
            <p className="text-lg font-bold">{formatCurrency(loanSummary?.collateralBtc || 0, 'BTC')}</p>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-white" />
          Asset Allocation
        </h3>
        <div className="space-y-4">
          {/* INR Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Cash (INR)</span>
              <span className="text-white font-medium">{(assetAllocation?.inrPercentage || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div 
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${assetAllocation?.inrPercentage || 0}%` }}
              />
            </div>
          </div>

          {/* BTC Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Bitcoin</span>
              <span className="text-white font-medium">{(assetAllocation?.btcPercentage || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${assetAllocation?.btcPercentage || 0}%` }}
              />
            </div>
          </div>

          {/* Liabilities Bar */}
          {(assetAllocation?.liabilitiesPercentage || 0) > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Liabilities</span>
                <span className="text-white font-medium">{(assetAllocation?.liabilitiesPercentage || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${assetAllocation?.liabilitiesPercentage || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trading Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Target className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Avg Buy Price</p>
          <p className="text-lg font-bold">
            {(averageBuyPrice || 0) > 0 ? formatInrWithNA(averageBuyPrice || 0) : 'N/A'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <TrendingDown className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Breakeven Price</p>
          <p className="text-lg font-bold">
            {(breakEvenPrice || 0) > 0 ? formatInrWithNA(breakEvenPrice || 0) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Bitcoin Market Overview */}
      {bitcoinData && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold">Bitcoin Market Overview</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Market Cap */}
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-400 text-sm">Market Cap</span>
              </div>
              <p className="text-lg font-bold">{formatLargeNumber(bitcoinData?.market_cap_usd)}</p>
            </div>

            {/* 24h Volume */}
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-400 text-sm">24h Volume</span>
              </div>
              <p className="text-lg font-bold">{formatLargeNumber(bitcoinData?.volume_24h_usd)}</p>
            </div>
          </div>

        </>
      )}

      {/* All-Time High Section */}
      {bitcoinData && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold">All-Time High</h3>
          </div>

          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Price</p>
                <p className="text-base font-bold">${(bitcoinData?.ath_usd || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Date</p>
                <p className="text-base font-bold">{bitcoinData?.ath_date ? formatDate(bitcoinData.ath_date) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">From ATH</p>
                <p className={`text-base font-bold ${(bitcoinData?.ath_change_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentage(bitcoinData?.ath_change_pct)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Market Sentiment with Visual Gauge */}
      {sentimentData && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold">Market Sentiment</h3>
          </div>

          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          
          <div className="grid grid-cols-2 gap-6">
            {/* Fear & Greed Gauge */}
            <div>
              <p className="text-zinc-500 text-xs mb-2">Fear & Greed Index</p>
              <div className="relative">
                <div className="text-lg font-bold mb-2">{sentimentData?.fear_greed_value || 0}/100</div>
                <div className="w-full bg-zinc-800 rounded-full h-2 mb-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      (sentimentData?.fear_greed_value || 0) <= 25 ? 'bg-red-500' :
                      (sentimentData?.fear_greed_value || 0) <= 45 ? 'bg-orange-500' :
                      (sentimentData?.fear_greed_value || 0) <= 55 ? 'bg-yellow-500' :
                      (sentimentData?.fear_greed_value || 0) <= 75 ? 'bg-green-500' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${sentimentData?.fear_greed_value || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>Fear</span>
                  <span>Greed</span>
                </div>
              </div>
            </div>
            
            {/* Classification */}
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-zinc-500 text-xs mb-2">Classification</p>
              <p className={`text-lg font-bold ${getSentimentColor(sentimentData?.fear_greed_classification || 'Neutral')}`}>
                {sentimentData?.fear_greed_classification || 'N/A'}
              </p>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Trading Statistics Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-white" />
        <h3 className="text-lg font-semibold">Trading Statistics</h3>
      </div>

      {/* Trading Statistics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Activity className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Trading Days</p>
          <p className="text-xl font-bold">{tradingStats?.tradingDays || 0}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <BarChart3 className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Trades</p>
          <p className="text-xl font-bold">{tradingStats?.totalTrades || 0}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">This Month</p>
          <p className="text-xl font-bold">{tradingStats?.tradesThisMonth || 0}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <DollarSign className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Avg Trade Size</p>
          <p className="text-lg font-bold">{formatInrWithNA(tradingStats?.averageTradeSize || 0)}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <TrendingUp className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Volume</p>
          <p className="text-lg font-bold">{formatInrWithNA(tradingStats?.totalVolume || 0)}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Trophy className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Days in Profit</p>
          <p className="text-lg font-bold">
            {(tradingStats?.daysInProfit || 0) === 0 ? 'Coming Soon' : (tradingStats?.daysInProfit || 0)}
          </p>
        </div>
      </div>

      {/* Current Market Info */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-zinc-400" />
          <span className="text-zinc-400 text-sm">Current Market Rates</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-zinc-500">BTC/USD</p>
            <p className="font-bold">${(currentRates?.btcUsdPrice || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-zinc-500">Buy Rate</p>
            <p className="font-bold">{formatInrWithNA(currentRates?.buyRate || 0)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Sell Rate</p>
            <p className="font-bold">{formatInrWithNA(currentRates?.sellRate || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
