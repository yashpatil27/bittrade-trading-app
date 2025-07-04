import React, { useState, useEffect } from 'react';
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
  Circle
} from 'lucide-react';
import { userAPI } from '../services/api';
import { Balances, Prices, Transaction, DashboardData } from '../types';
import TradingModal from '../components/TradingModal';
import PriceUpdateTimer from '../components/PriceUpdateTimer';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { useBalance } from '../contexts/BalanceContext';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  formatTimeAgo,
  formatCurrency
} from '../utils/formatters';

const Home: React.FC = () => {
  const { refreshBalance } = useBalance();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'buy' | 'sell'>('buy');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardResponse = await userAPI.getDashboard();
        const dashboardData = dashboardResponse.data.data as DashboardData;
        const { balances, prices, recent_transactions } = dashboardData;
        setBalances(balances);
        setPrices(prices);
        setRecentTransactions(recent_transactions);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, []);

  const openTradingModal = (type: 'buy' | 'sell') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleTrade = async (amount: number) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (modalType === 'buy') {
        await userAPI.buyBitcoin({ amount });
        setSuccess('🎉 Bitcoin purchased successfully!');
      } else {
        await userAPI.sellBitcoin({ amount });
        setSuccess('✅ Bitcoin sold successfully!');
      }
      
      // Refresh data
      const dashboardResponse = await userAPI.getDashboard();
      const dashboardData = dashboardResponse.data.data as DashboardData;
      const { balances, prices, recent_transactions } = dashboardData;
      setBalances(balances);
      setPrices(prices);
      setRecentTransactions(recent_transactions);
      
      // Trigger balance refresh for persistent top bar
      refreshBalance();
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to ${modalType} Bitcoin`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const dashboardResponse = await userAPI.getDashboard();
      const dashboardData = dashboardResponse.data.data as DashboardData;
      const { balances, prices, recent_transactions } = dashboardData;
      setBalances(balances);
      setPrices(prices);
      setRecentTransactions(recent_transactions);
      
      // Trigger balance refresh for persistent top bar
      refreshBalance();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header with greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-white" />
              Trading Dashboard
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Ready to make some moves?</p>
          </div>
          <button 
            onClick={refreshData}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full" />
            <span className="text-red-300">{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-300">{success}</span>
          </div>
        )}

        {/* Wallet Balance Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* INR Balance */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-zinc-700 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <Eye className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="space-y-1">
              <p className="text-zinc-400 text-sm">Cash Balance</p>
              <p className="text-xl font-bold">₹{balances?.inr.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* BTC Balance */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-zinc-700 rounded-lg">
                <Bitcoin className="w-5 h-5 text-white" />
              </div>
              <Eye className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="space-y-1">
              <p className="text-zinc-400 text-sm">Bitcoin Balance</p>
              <p className="text-xl font-bold">{formatCurrency(balances?.btc || 0, 'BTC')}</p>
              {balances && prices && (
                <p className="text-xs text-zinc-500">
                  ≈ ₹{Math.floor((balances.btc || 0) * (prices.sell_rate || 0)).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bitcoin Price Card */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-white" />
              Bitcoin Price
            </h2>
            <PriceUpdateTimer className="text-zinc-400" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-zinc-400 text-xs">USD Price</p>
              <p className="font-bold">${(prices?.btc_usd ?? 0).toLocaleString('en-US')}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-xs">Buy Rate</p>
              <p className="font-bold text-white">₹{(prices?.buy_rate ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-xs">Sell Rate</p>
              <p className="font-bold text-white">₹{(prices?.sell_rate ?? 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Trading Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => openTradingModal('buy')}
            className="bg-white text-black hover:bg-zinc-200 font-medium py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
          >
            <TrendingUp className="w-5 h-5" />
            <span>Buy Bitcoin</span>
          </button>
          
          <button
            onClick={() => openTradingModal('sell')}
            className="bg-zinc-700 text-white hover:bg-zinc-600 font-medium py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
          >
            <TrendingDown className="w-5 h-5" />
            <span>Sell Bitcoin</span>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-white" />
              Recent Activity
            </h2>
          </div>
          
          <div className="p-4">
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    onClick={() => handleTransactionClick(transaction)}
                    className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-700 rounded-lg">
                          {getTransactionIcon(transaction.type) === 'User' && <User className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'ArrowUp' && <ArrowUp className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'TrendingUp' && <TrendingUp className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'TrendingDown' && <TrendingDown className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'ArrowDown' && <ArrowDown className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'Plus' && <Plus className="w-3 h-3 text-white" />}
                          {getTransactionIcon(transaction.type) === 'Minus' && <Minus className="w-3 h-3 text-white" />}
                          {!['User', 'ArrowUp', 'TrendingUp', 'TrendingDown', 'ArrowDown', 'Plus', 'Minus'].includes(getTransactionIcon(transaction.type)) && <Circle className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">
                            {getTransactionDisplayName(transaction.type)}
                          </p>
                          <p className="text-zinc-400 text-xs">
                            {formatTimeAgo(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {transaction.type === 'BUY' || transaction.type === 'SELL' ? (
                          <div>
                            <p className="font-bold text-sm text-white">
                              ₹{transaction.inr_amount.toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {formatCurrency(transaction.btc_amount, 'BTC')}
                            </p>
                          </div>
                        ) : (
                          <p className="font-bold text-sm text-white">
                            {transaction.type.includes('INR') ? (
                              `₹${transaction.inr_amount.toLocaleString('en-IN')}`
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
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No recent activity</p>
                <p className="text-zinc-500 text-sm">Start trading to see your activity here!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trading Modal */}
      <TradingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        prices={prices}
        userBalance={balances || { inr: 0, btc: 0 }}
        onTrade={handleTrade}
        isLoading={isLoading}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        transaction={selectedTransaction}
      />
    </>
  );
};

export default Home;

