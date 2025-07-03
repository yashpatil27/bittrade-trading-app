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
  Clock
} from 'lucide-react';
import { userAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface PortfolioData {
  totalPortfolioValue: number;
  currentBalances: {
    inr: number;
    btc: number;
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

const Portfolio: React.FC = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.portfolio();
      setPortfolioData(response.data.data);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setError('Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatCurrencyInr = (value: number) => {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
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
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="w-6 h-6 text-white" />
          <h2 className="text-lg font-semibold">Total Portfolio Value</h2>
        </div>
        <p className="text-3xl font-bold text-white mb-2">
          {formatCurrencyInr(totalPortfolioValue)}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="text-zinc-400">
            Investment: {formatCurrencyInr(totalInvestment)}
          </span>
          <span className={`flex items-center gap-1 ${unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {unrealizedProfit >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {formatPercentage(totalReturn)}
          </span>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-zinc-400 text-sm">Unrealized P&L</span>
          </div>
          <p className={`text-lg font-bold ${unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrencyInr(unrealizedProfit)}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-blue-400" />
            <span className="text-zinc-400 text-sm">Realized P&L</span>
          </div>
          <p className={`text-lg font-bold ${realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {realizedProfit === 0 ? 'Coming Soon' : formatCurrencyInr(realizedProfit)}
          </p>
        </div>
      </div>

      {/* Current Holdings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-white" />
          Current Holdings
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">Cash Balance</p>
            <p className="text-lg font-bold">{formatCurrencyInr(currentBalances.inr)}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <Bitcoin className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">Bitcoin</p>
            <p className="text-lg font-bold">{formatCurrency(currentBalances.btc, 'BTC')}</p>
            <p className="text-xs text-zinc-500">
              ≈ {formatCurrencyInr(currentBalances.btc * currentRates.sellRate)}
            </p>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-white" />
          Asset Allocation
        </h3>
        <div className="space-y-4">
          {/* INR Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Cash (INR)</span>
              <span className="text-white font-medium">{assetAllocation.inrPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div 
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${assetAllocation.inrPercentage}%` }}
              />
            </div>
          </div>

          {/* BTC Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Bitcoin</span>
              <span className="text-white font-medium">{assetAllocation.btcPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${assetAllocation.btcPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trading Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Target className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Avg Buy Price</p>
          <p className="text-lg font-bold">
            {averageBuyPrice > 0 ? formatCurrencyInr(averageBuyPrice) : 'N/A'}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <TrendingDown className="w-6 h-6 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Breakeven Price</p>
          <p className="text-lg font-bold">
            {breakEvenPrice > 0 ? formatCurrencyInr(breakEvenPrice) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Trading Statistics */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          Trading Statistics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Trading Days</span>
              <span className="text-white font-medium">{tradingStats.tradingDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Total Trades</span>
              <span className="text-white font-medium">{tradingStats.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">This Month</span>
              <span className="text-white font-medium">{tradingStats.tradesThisMonth}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Avg Trade Size</span>
              <span className="text-white font-medium">{formatCurrencyInr(tradingStats.averageTradeSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Total Volume</span>
              <span className="text-white font-medium">{formatCurrencyInr(tradingStats.totalVolume)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 text-sm">Days in Profit</span>
              <span className="text-white font-medium">
                {tradingStats.daysInProfit === 0 ? 'Coming Soon' : tradingStats.daysInProfit}
              </span>
            </div>
          </div>
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
            <p className="font-bold">${currentRates.btcUsdPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-zinc-500">Buy Rate</p>
            <p className="font-bold">{formatCurrencyInr(currentRates.buyRate)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Sell Rate</p>
            <p className="font-bold">{formatCurrencyInr(currentRates.sellRate)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
