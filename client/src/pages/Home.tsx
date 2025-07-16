import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Eye,
  Bitcoin,
  DollarSign,
  Sparkles,
  User,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Circle,
  Target,
  X,
  Repeat,
  Lock,
  Clock,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Balances, Prices, Transaction, DashboardData } from '../types';
import TradingModal from '../components/TradingModal';
import DcaPlanModal from '../components/DcaPlanModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import BitcoinChart, { BitcoinChartRef } from '../components/BitcoinChart';
import DcaPlansSection, { DcaPlansSectionRef } from '../components/DcaPlansSection';
import { useBalance } from '../contexts/BalanceContext';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  formatTimeAgo,
  formatCurrency,
  formatCurrencyInr
} from '../utils/formatters';

const Home: React.FC = () => {
  const { refreshBalance } = useBalance();
  const { getDashboard, createDcaBuyPlan, createDcaSellPlan, buyBitcoin, sellBitcoin, placeLimitBuyOrder, placeLimitSellOrder, on, off, isConnected } = useWebSocket();
  const dcaPlansSectionRef = useRef<DcaPlansSectionRef>(null);
  const bitcoinChartRef = useRef<BitcoinChartRef>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTradingModalOpen, setIsTradingModalOpen] = useState(false);
  const [tradingType, setTradingType] = useState<'buy' | 'sell'>('buy');
  const [isDcaPlanModalOpen, setIsDcaPlanModalOpen] = useState(false);
  const [dcaPlanType, setDcaPlanType] = useState<'buy' | 'sell'>('buy');

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardData = await getDashboard();
        const { balances, prices, recent_transactions } = dashboardData;
        setBalances(balances);
        setPrices(prices);
        setRecentTransactions(recent_transactions);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, [getDashboard]);

  // Real-time WebSocket event listeners
  useEffect(() => {
    const handleBalanceUpdate = (newBalances: Balances) => {
      setBalances(newBalances);
      refreshBalance(); // Update global balance indicator
    };

    const handlePriceUpdate = (newPrices: Prices) => {
      setPrices(newPrices);
      // Update chart if needed
      bitcoinChartRef.current?.refreshPrice();
    };

    const handleTransactionUpdate = (transaction: Transaction) => {
      // Add new transaction to the top of the list
      setRecentTransactions(prev => [transaction, ...prev.slice(0, 4)]);
    };

    // Listen for real-time updates
    on('balance_update', handleBalanceUpdate);
    on('price_update', handlePriceUpdate);
    on('transaction_update', handleTransactionUpdate);

    // Cleanup listeners on unmount
    return () => {
      off('balance_update', handleBalanceUpdate);
      off('price_update', handlePriceUpdate);
      off('transaction_update', handleTransactionUpdate);
    };
  }, [on, off, refreshBalance]);

  const handleOpenTradingModal = (type: 'buy' | 'sell') => {
    setTradingType(type);
    setIsTradingModalOpen(true);
  };

  const handleTrade = async (amount: number, targetPrice?: number, dcaConfig?: {
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    totalExecutions?: number;
    maxPrice?: number;
    minPrice?: number;
  }) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (dcaConfig) {
        // DCA plan
        if (dcaPlanType === 'buy') {
          await createDcaBuyPlan({ 
            amountPerExecution: amount, 
            frequency: dcaConfig.frequency,
            totalExecutions: dcaConfig.totalExecutions,
            maxPrice: dcaConfig.maxPrice,
            minPrice: dcaConfig.minPrice
          });
          setSuccess(`🔄 DCA ${dcaConfig.frequency.toLowerCase()} buy plan created successfully!`);
        } else {
          await createDcaSellPlan({ 
            amountPerExecution: amount, 
            frequency: dcaConfig.frequency,
            totalExecutions: dcaConfig.totalExecutions,
            maxPrice: dcaConfig.maxPrice,
            minPrice: dcaConfig.minPrice
          });
          setSuccess(`🔄 DCA ${dcaConfig.frequency.toLowerCase()} sell plan created successfully!`);
        }
        // Refresh DCA plans section
        await dcaPlansSectionRef.current?.refresh();
      } else if (targetPrice) {
        // Limit order
        if (tradingType === 'buy') {
          await placeLimitBuyOrder(amount, targetPrice);
          setSuccess('📊 Limit buy order placed successfully!');
        } else {
          await placeLimitSellOrder(amount, targetPrice);
          setSuccess('📊 Limit sell order placed successfully!');
        }
      } else {
        // Market order
        if (tradingType === 'buy') {
          await buyBitcoin(amount);
          setSuccess('🎉 Bitcoin purchased successfully!');
        } else {
          await sellBitcoin(amount);
          setSuccess('✅ Bitcoin sold successfully!');
        }
      }
      
      // Real-time WebSocket events will handle balance/price/transaction updates automatically
      // No manual refresh needed!
      
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to ${dcaConfig ? 'create DCA plan' : targetPrice ? 'place limit order' : tradingType + ' Bitcoin'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const dashboardData = await getDashboard();
      const { balances, prices, recent_transactions } = dashboardData;
      setBalances(balances);
      setPrices(prices);
      setRecentTransactions(recent_transactions);
      
      // Refresh DCA plans section
      await dcaPlansSectionRef.current?.refresh();
      
      // Refresh Bitcoin chart price display
      await bitcoinChartRef.current?.refreshPrice();
      
      // Trigger balance refresh for persistent top bar
      refreshBalance();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleOpenDcaPlanModal = (type: 'buy' | 'sell') => {
    setDcaPlanType(type);
    setIsDcaPlanModalOpen(true);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="bg-black border border-red-700 rounded-lg p-3">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-black border border-green-700 rounded-lg p-3">
            <span className="text-green-400 text-sm">{success}</span>
          </div>
        )}

        {/* Wallet Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* INR Balance */}
          <div className="bg-black border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div className="space-y-0.5">
              <p className="text-zinc-400 text-xs">Cash</p>
              <p className="text-lg font-semibold text-white">{formatCurrencyInr(balances?.inr || 0)}</p>
            </div>
          </div>

          {/* BTC Balance */}
          <div className="bg-black border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <Bitcoin className="w-4 h-4 text-white" />
            </div>
            <div className="space-y-0.5">
              <p className="text-zinc-400 text-xs">Bitcoin</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(balances?.btc || 0, 'BTC')}</p>
              {balances && prices && (
                <p className="text-xs text-zinc-500">
                  ≈ {formatCurrencyInr(Math.floor((balances.btc || 0) * (prices.sell_rate || 0)))}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bitcoin Price Card with Trading Actions */}
        <div className="bg-black border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-white" />
              Bitcoin Price
            </h2>
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-zinc-400 text-xs">Buy Rate</p>
              <p className="font-semibold text-white text-sm">{formatCurrencyInr(prices?.buy_rate ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-xs">USD Price</p>
              <p className="font-semibold text-white text-sm">${(prices?.btc_usd ?? 0).toLocaleString('en-US')}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-xs">Sell Rate</p>
              <p className="font-semibold text-white text-sm">{formatCurrencyInr(prices?.sell_rate ?? 0)}</p>
            </div>
          </div>
          
          {/* Trading Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleOpenTradingModal('buy')}
              className="bg-white text-black hover:bg-zinc-200 font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Buy</span>
            </button>
            
            <button
              onClick={() => handleOpenTradingModal('sell')}
              className="bg-zinc-700 text-white hover:bg-zinc-600 font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Sell</span>
            </button>
          </div>
        </div>

        {/* Bitcoin Price Chart */}
        <BitcoinChart ref={bitcoinChartRef} />

        {/* DCA Plan Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleOpenDcaPlanModal('buy')}
            className="bg-white text-black hover:bg-zinc-200 font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Add DCA Buy Plan</span>
          </button>
          
          <button
            onClick={() => handleOpenDcaPlanModal('sell')}
            className="bg-zinc-700 text-white hover:bg-zinc-600 font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
          >
            <TrendingDown className="w-4 h-4" />
            <span>Add DCA Sell Plan</span>
          </button>
        </div>

        {/* Active DCA Plans */}
        <DcaPlansSection ref={dcaPlansSectionRef} onUpdate={refreshData} balances={balances} prices={prices} />

        {/* Recent Activity */}
        <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-zinc-800">
            <h2 className="text-white text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-white" />
              Recent Activity
            </h2>
          </div>
          
          <div className="p-3">
            {recentTransactions.length > 0 ? (
              <div className="space-y-2">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    onClick={() => handleTransactionClick(transaction)}
                    className="bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-zinc-700 rounded">
                        {getTransactionIcon(transaction.type, transaction.status) === 'User' && <User className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'ArrowUp' && <ArrowUp className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'TrendingUp' && <TrendingUp className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'TrendingDown' && <TrendingDown className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'ArrowDown' && <ArrowDown className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Plus' && <Plus className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Minus' && <Minus className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Target' && <Target className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'X' && <X className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Repeat' && <Repeat className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Lock' && <Lock className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Clock' && <Clock className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'AlertTriangle' && <AlertTriangle className="w-3 h-3 text-white" />}
                        {getTransactionIcon(transaction.type, transaction.status) === 'Zap' && <Zap className="w-3 h-3 text-white" />}
                        {!['User', 'ArrowUp', 'TrendingUp', 'TrendingDown', 'ArrowDown', 'Plus', 'Minus', 'Target', 'X', 'Repeat', 'Lock', 'Clock', 'AlertTriangle', 'Zap'].includes(getTransactionIcon(transaction.type, transaction.status)) && <Circle className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white text-sm">
                              {getTransactionDisplayName(transaction.type, transaction.status)}
                            </p>
                            {transaction.status === 'PENDING' && (
                              <span className="px-1.5 py-0.5 text-xs bg-orange-900/20 border border-orange-800 text-orange-300 rounded">
                                PENDING
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-400 text-xs">
                            {formatTimeAgo(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {(transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'MARKET_BUY' || transaction.type === 'MARKET_SELL' || transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL' || transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') ? (
                          <div>
                            <p className="font-semibold text-sm text-white">
                              {formatCurrencyInr(transaction.inr_amount)}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {formatCurrency(transaction.btc_amount, 'BTC')}
                            </p>
                            {transaction.status === 'PENDING' && transaction.btc_price && (
                              <p className="text-xs text-orange-300">
                                @ {formatCurrencyInr(transaction.btc_price)}
                              </p>
                            )}
                          </div>
                        ) : transaction.type === 'LOAN_CREATE' ? (
                          <div>
                            <p className="font-semibold text-sm text-white">
                              {formatCurrency(transaction.btc_amount, 'BTC')}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Collateral Locked
                            </p>
                          </div>
                        ) : transaction.type === 'LOAN_ADD_COLLATERAL' ? (
                          <div>
                            <p className="font-semibold text-sm text-white">
                              {formatCurrency(transaction.btc_amount, 'BTC')}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Collateral Added
                            </p>
                          </div>
                        ) : transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type.includes('LIQUIDATION') ? (
                          <div>
                            {transaction.inr_amount > 0 && (
                              <p className="font-semibold text-sm text-white">
                                {formatCurrencyInr(transaction.inr_amount)}
                              </p>
                            )}
                            {transaction.btc_amount > 0 && (
                              <p className="text-xs text-zinc-400">
                                {formatCurrency(transaction.btc_amount, 'BTC')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="font-semibold text-sm text-white">
                            {transaction.type.includes('INR') ? (
                              formatCurrencyInr(transaction.inr_amount)
                            ) : (
                              formatCurrency(transaction.btc_amount, 'BTC')
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Wallet className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">No recent activity</p>
                <p className="text-zinc-500 text-xs">Start trading to see your activity here!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <TradingModal
        isOpen={isTradingModalOpen}
        onClose={() => setIsTradingModalOpen(false)}
        type={tradingType}
        balances={balances}
        prices={prices}
        onSuccess={() => {
          setSuccess(tradingType === 'buy' ? '🎉 Bitcoin purchased successfully!' : '✅ Bitcoin sold successfully!');
          refreshData();
        }}
        onError={(message) => setError(message)}
      />

      <TransactionDetailModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        transaction={selectedTransaction}
        onTransactionUpdate={refreshData}
      />

      {/* DCA Plan Creation Modal */}
      <DcaPlanModal
        isOpen={isDcaPlanModalOpen}
        onClose={() => setIsDcaPlanModalOpen(false)}
        type={dcaPlanType}
        balances={balances}
        prices={prices}
        onSuccess={() => {
          setSuccess(dcaPlanType === 'buy' ? '🔄 DCA buy plan created successfully!' : '🔄 DCA sell plan created successfully!');
          refreshData();
        }}
        onError={(message) => setError(message)}
      />
      
    </>
  );
};

export default Home;

