import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Filter, 
  ChevronDown, 
  Wallet,
  User,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Circle,
  X,
  Calendar,
  DollarSign,
  RotateCcw,
  Target,
  Repeat,
  Lock,
  Clock,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { userAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useBalance } from '../contexts/BalanceContext';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  formatTimeAgo,
  formatCurrency
} from '../utils/formatters';

type TransactionType = 'ALL' | 'BUY' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL' | 'DEPOSIT_INR' | 'DEPOSIT_BTC' | 'WITHDRAW_INR' | 'WITHDRAW_BTC' | 'DCA_BUY' | 'DCA_SELL' | 'LOAN_CREATE' | 'LOAN_BORROW' | 'LOAN_REPAY' | 'INTEREST_ACCRUAL' | 'PARTIAL_LIQUIDATION' | 'FULL_LIQUIDATION';
type DateFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type SortOption = 'NEWEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST';

interface FilterState {
  types: TransactionType[];
  dateFilter: DateFilter;
  customDateFrom: string;
  customDateTo: string;
  minAmount: string;
  maxAmount: string;
  sortBy: SortOption;
}

const History: React.FC = () => {
  const { refreshBalance } = useBalance();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  
  const [filters, setFilters] = useState<FilterState>({
    types: ['ALL'],
    dateFilter: 'ALL',
    customDateFrom: '',
    customDateTo: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'NEWEST'
  });

  useBodyScrollLock(isFilterOpen);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getAllTransactions(page, 20);
      const { transactions: newTransactions, pagination } = response.data.data!;
      
      if (page === 1) {
        setAllTransactions(newTransactions);
      } else {
        setAllTransactions(prev => [...prev, ...newTransactions]);
      }
      
      setHasMore(pagination.has_more);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters whenever transactions or filters change
  useEffect(() => {
    applyFilters();
  }, [allTransactions, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    let filtered = [...allTransactions];
    let activeCount = 0;

    // Filter by transaction type
    if (!filters.types.includes('ALL')) {
      filtered = filtered.filter(t => filters.types.includes(t.type as TransactionType));
      activeCount++;
    }

    // Filter by date
    if (filters.dateFilter !== 'ALL') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (filters.dateFilter) {
        case 'TODAY':
          filtered = filtered.filter(t => new Date(t.created_at) >= today);
          activeCount++;
          break;
        case 'WEEK':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(t => new Date(t.created_at) >= weekAgo);
          activeCount++;
          break;
        case 'MONTH':
          const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
          filtered = filtered.filter(t => new Date(t.created_at) >= monthAgo);
          activeCount++;
          break;
        case 'CUSTOM':
          if (filters.customDateFrom && filters.customDateTo) {
            const fromDate = new Date(filters.customDateFrom);
            const toDate = new Date(filters.customDateTo + 'T23:59:59');
            filtered = filtered.filter(t => {
              const tDate = new Date(t.created_at);
              return tDate >= fromDate && tDate <= toDate;
            });
            activeCount++;
          }
          break;
      }
    }

    // Filter by amount range
    if (filters.minAmount || filters.maxAmount) {
      filtered = filtered.filter(t => {
        const amount = t.type.includes('INR') ? t.inr_amount : t.btc_amount;
        const min = filters.minAmount ? parseFloat(filters.minAmount) : 0;
        const max = filters.maxAmount ? parseFloat(filters.maxAmount) : Infinity;
        return amount >= min && amount <= max;
      });
      activeCount++;
    }

    // Sort transactions
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'NEWEST':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'OLDEST':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'HIGHEST':
          const aAmount = a.type.includes('INR') ? a.inr_amount : a.btc_amount;
          const bAmount = b.type.includes('INR') ? b.inr_amount : b.btc_amount;
          return bAmount - aAmount;
        case 'LOWEST':
          const aAmountLow = a.type.includes('INR') ? a.inr_amount : a.btc_amount;
          const bAmountLow = b.type.includes('INR') ? b.inr_amount : b.btc_amount;
          return aAmountLow - bAmountLow;
        default:
          return 0;
      }
    });

    setFilteredTransactions(filtered);
    setActiveFiltersCount(activeCount);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const formatAmount = (transaction: Transaction) => {
    if (transaction.type.includes('INR')) {
      return `₹${transaction.inr_amount.toLocaleString('en-IN')}`;
    } else if (transaction.type.includes('BTC')) {
      return formatCurrency(transaction.btc_amount, 'BTC');
    }
    return '';
  };


  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({
      types: ['ALL'],
      dateFilter: 'ALL',
      customDateFrom: '',
      customDateTo: '',
      minAmount: '',
      maxAmount: '',
      sortBy: 'NEWEST'
    });
  };

  const toggleTransactionType = (type: TransactionType) => {
    setFilters(prev => {
      if (type === 'ALL') {
        return { ...prev, types: ['ALL'] };
      }
      
      let newTypes = prev.types.filter(t => t !== 'ALL');
      
      if (newTypes.includes(type)) {
        newTypes = newTypes.filter(t => t !== type);
        if (newTypes.length === 0) {
          newTypes = ['ALL'];
        }
      } else {
        newTypes.push(type);
      }
      
      return { ...prev, types: newTypes };
    });
  };

  const refreshData = async () => {
    try {
      await fetchTransactions();
      refreshBalance();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-white" />
            Transaction History
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Track all your trading activity</p>
        </div>
        <button 
          onClick={() => setIsFilterOpen(true)}
          className="relative p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Filter className="w-5 h-5" />
          {activeFiltersCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black text-xs font-bold rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </div>
          )}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 text-center">
          <Activity className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Transactions</p>
          <p className="text-2xl font-bold">{allTransactions.length}</p>
        </div>
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 text-center">
          <Activity className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Filtered Results</p>
          <p className="text-2xl font-bold">
            {filteredTransactions.length}
          </p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">All Transactions</h2>
        </div>
        
        <div className="p-4">
          {filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  onClick={() => handleTransactionClick(transaction)}
                  className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-700 rounded-lg">
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
                          <p className="font-bold text-sm text-white">
                            ₹{transaction.inr_amount.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {formatCurrency(transaction.btc_amount, 'BTC')}
                          </p>
                          {transaction.status === 'PENDING' && transaction.btc_price && (
                            <p className="text-xs text-orange-300">
                              @ ₹{transaction.btc_price.toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                        ) : transaction.type === 'LOAN_CREATE' ? (
                          <div>
                            <p className="font-bold text-sm text-white">
                              {formatCurrency(transaction.btc_amount, 'BTC')}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Collateral Locked
                            </p>
                          </div>
                        ) : transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type.includes('LIQUIDATION') ? (
                          <div>
                            {transaction.inr_amount > 0 && (
                              <p className="font-bold text-sm text-white">
                                ₹{transaction.inr_amount.toLocaleString('en-IN')}
                              </p>
                            )}
                            {transaction.btc_amount > 0 && (
                              <p className="text-xs text-zinc-400">
                                {formatCurrency(transaction.btc_amount, 'BTC')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="font-bold text-sm text-white">
                            {formatAmount(transaction)}
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={isLoading}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Load More
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wallet className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">No transactions yet</p>
              <p className="text-zinc-500 text-sm">Your trading history will appear here once you start trading!</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsFilterOpen(false)}>
          {/* Modal */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  <Filter className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Filter Transactions</h2>
                  <p className="text-sm text-zinc-400">Customize your transaction view</p>
                </div>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(80vh-100px)]">
              {/* Reset Button */}
              <div className="flex justify-end">
                <button
                  onClick={resetFilters}
                  className="text-zinc-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              </div>
              
              {/* Transaction Types */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Transaction Types
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'ALL', label: 'All Types', icon: Circle },
                    { key: 'BUY', label: 'Buy', icon: TrendingUp },
                    { key: 'SELL', label: 'Sell', icon: TrendingDown },
                    { key: 'LIMIT_BUY', label: 'Limit Buy', icon: Target },
                    { key: 'LIMIT_SELL', label: 'Limit Sell', icon: Target },
                    { key: 'DCA_BUY', label: 'DCA Buy', icon: Repeat },
                    { key: 'DCA_SELL', label: 'DCA Sell', icon: Repeat },
                    { key: 'DEPOSIT_INR', label: 'Deposit INR', icon: Plus },
                    { key: 'DEPOSIT_BTC', label: 'Deposit BTC', icon: Plus },
                    { key: 'WITHDRAW_INR', label: 'Withdraw INR', icon: Minus },
                    { key: 'WITHDRAW_BTC', label: 'Withdraw BTC', icon: Minus }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => toggleTransactionType(key as TransactionType)}
                      className={`p-2 rounded-lg border transition-all text-xs flex items-center gap-1 ${
                        filters.types.includes(key as TransactionType)
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Range
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { key: 'ALL', label: 'All Time' },
                    { key: 'TODAY', label: 'Today' },
                    { key: 'WEEK', label: 'This Week' },
                    { key: 'MONTH', label: 'This Month' }
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleFilterChange({ dateFilter: key as DateFilter })}
                      className={`p-2 rounded-lg border transition-all text-xs ${
                        filters.dateFilter === key
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                {/* Custom Date Range */}
                <button
                  onClick={() => handleFilterChange({ dateFilter: 'CUSTOM' })}
                  className={`w-full p-2 rounded-lg border transition-all text-xs mb-3 ${
                    filters.dateFilter === 'CUSTOM'
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  Custom Range
                </button>
                
                {filters.dateFilter === 'CUSTOM' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">From</label>
                      <input
                        type="date"
                        value={filters.customDateFrom}
                        onChange={(e) => handleFilterChange({ customDateFrom: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">To</label>
                      <input
                        type="date"
                        value={filters.customDateTo}
                        onChange={(e) => handleFilterChange({ customDateTo: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Amount Range */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Amount Range
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Minimum</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      value={filters.minAmount}
                      onChange={(e) => handleFilterChange({ minAmount: e.target.value })}
                      placeholder="0"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Maximum</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      value={filters.maxAmount}
                      onChange={(e) => handleFilterChange({ maxAmount: e.target.value })}
                      placeholder="No limit"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <h3 className="text-sm font-medium mb-2">Sort By</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'NEWEST', label: 'Newest First' },
                    { key: 'OLDEST', label: 'Oldest First' },
                    { key: 'HIGHEST', label: 'Highest Amount' },
                    { key: 'LOWEST', label: 'Lowest Amount' }
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleFilterChange({ sortBy: key as SortOption })}
                      className={`p-2 rounded-lg border transition-all text-xs ${
                        filters.sortBy === key
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTransaction}
        onTransactionUpdate={refreshData}
      />
    </div>
  );
};

export default History;
