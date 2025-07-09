import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Filter,
  ChevronDown,
  Wallet,
  Search,
  Eye,
  User,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Circle,
  Target,
  X,
  Clock,
  Pause,
  Play,
  Repeat,
  AlertTriangle,
  CheckCircle,
  Settings,
  Calendar,
  DollarSign,
  RotateCcw,
  Lock,
  Zap
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { Transaction, DcaPlan } from '../types';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  formatTimeAgo,
  formatBitcoin,
  formatCurrency
} from '../utils/formatters';

type TransactionType = 'ALL' | 'BUY' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL' | 'DEPOSIT_INR' | 'DEPOSIT_BTC' | 'WITHDRAW_INR' | 'WITHDRAW_BTC' | 'LOAN_CREATE' | 'LOAN_BORROW' | 'LOAN_REPAY' | 'LOAN_ADD_COLLATERAL';
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

const AdminTransactions: React.FC = () => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [dcaPlans, setDcaPlans] = useState<DcaPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedDcaPlan, setSelectedDcaPlan] = useState<DcaPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDcaModalOpen, setIsDcaModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'operations' | 'dca'>('operations');
  const [dcaPage, setDcaPage] = useState(1);
  const [dcaHasMore, setDcaHasMore] = useState(false);
  const [dcaSearchTerm, setDcaSearchTerm] = useState('');
  const [dcaSelectedStatus, setDcaSelectedStatus] = useState<string>('');
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());
  
  const [filters, setFilters] = useState<FilterState>({
    types: ['ALL'],
    dateFilter: 'ALL',
    customDateFrom: '',
    customDateTo: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'NEWEST'
  });

  const fetchTransactions = useCallback(async (currentPage: number = 1) => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getTransactions(currentPage);
      if (response.data && response.data.data) {
        const { transactions, pagination } = response.data.data;
        
        if (currentPage === 1) {
          setAllTransactions(transactions);
        } else {
          setAllTransactions(prev => [...prev, ...transactions]);
        }
        
        setHasMore(pagination.has_more);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const fetchDcaPlans = useCallback(async (currentPage: number = 1) => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getDcaPlans(currentPage);
      if (response.data && response.data.data) {
        const { dcaPlans, pagination } = response.data.data;
        
        if (currentPage === 1) {
          setDcaPlans(dcaPlans);
        } else {
          setDcaPlans(prev => [...prev, ...dcaPlans]);
        }
        
        setDcaHasMore(pagination.has_more);
      }
    } catch (error) {
      console.error('Error fetching DCA plans:', error);
      setError('Failed to fetch DCA plans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'operations') {
      fetchTransactions(page);
    } else {
      fetchDcaPlans(dcaPage);
    }
  }, [activeTab, page, dcaPage, fetchTransactions, fetchDcaPlans]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleDcaPlanClick = (plan: DcaPlan) => {
    setSelectedDcaPlan(plan);
    setIsDcaModalOpen(true);
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

  const formatAmount = (transaction: Transaction) => {
    if (transaction.type.includes('INR')) {
      return `₹${transaction.inr_amount.toLocaleString('en-IN')}`;
    } else if (transaction.type.includes('BTC')) {
      return `₿${formatBitcoin(transaction.btc_amount)}`;
    } else if (transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type.includes('LIQUIDATION')) {
      // For loan transactions, show both amounts if they exist
      if (transaction.inr_amount > 0 && transaction.btc_amount > 0) {
        return `₹${transaction.inr_amount.toLocaleString('en-IN')} / ₿${formatBitcoin(transaction.btc_amount)}`;
      } else if (transaction.inr_amount > 0) {
        return `₹${transaction.inr_amount.toLocaleString('en-IN')}`;
      } else if (transaction.btc_amount > 0) {
        return `₿${formatBitcoin(transaction.btc_amount)}`;
      }
      return 'N/A';
    }
    return '';
  };

  const handleCancelLimitOrder = async (orderId: string) => {
    try {
      setProcessingActions(prev => new Set(prev).add(orderId));
      await adminAPI.cancelLimitOrder(parseInt(orderId));
      // Refresh the transactions
      fetchTransactions(1);
    } catch (error) {
      console.error('Error cancelling limit order:', error);
      setError('Failed to cancel limit order');
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handlePauseDcaPlan = async (planId: string) => {
    try {
      setProcessingActions(prev => new Set(prev).add(planId));
      await adminAPI.pauseDcaPlan(parseInt(planId));
      // Refresh the DCA plans
      fetchDcaPlans(1);
    } catch (error) {
      console.error('Error pausing DCA plan:', error);
      setError('Failed to pause DCA plan');
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(planId);
        return newSet;
      });
    }
  };

  const handleResumeDcaPlan = async (planId: string) => {
    try {
      setProcessingActions(prev => new Set(prev).add(planId));
      await adminAPI.resumeDcaPlan(parseInt(planId));
      // Refresh the DCA plans
      fetchDcaPlans(1);
    } catch (error) {
      console.error('Error resuming DCA plan:', error);
      setError('Failed to resume DCA plan');
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(planId);
        return newSet;
      });
    }
  };

  const handleDeleteDcaPlan = async (planId: string) => {
    try {
      setProcessingActions(prev => new Set(prev).add(planId));
      await adminAPI.deleteDcaPlan(parseInt(planId));
      // Refresh the DCA plans
      fetchDcaPlans(1);
    } catch (error) {
      console.error('Error deleting DCA plan:', error);
      setError('Failed to delete DCA plan');
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(planId);
        return newSet;
      });
    }
  };



  const getDcaStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-400 bg-green-900/20 border-green-800';
      case 'PAUSED':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      case 'COMPLETED':
        return 'text-blue-400 bg-blue-900/20 border-blue-800';
      case 'CANCELLED':
        return 'text-red-400 bg-red-900/20 border-red-800';
      default:
        return 'text-zinc-400 bg-zinc-800/20 border-zinc-800';
    }
  };

  const getDcaStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="w-3 h-3" />;
      case 'PAUSED':
        return <Pause className="w-3 h-3" />;
      case 'COMPLETED':
        return <CheckCircle className="w-3 h-3" />;
      case 'CANCELLED':
        return <X className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const formatNextExecution = (nextExecutionAt: string) => {
    const nextDate = new Date(nextExecutionAt);
    const now = new Date();
    const diffMs = nextDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Due now';
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  };

  const filteredDcaPlans = dcaPlans.filter(plan => {
    const matchesSearch = plan.id.toString().includes(dcaSearchTerm) || 
                         (plan.user_id ? plan.user_id.toString().includes(dcaSearchTerm) : false);
    const matchesStatus = !dcaSelectedStatus || plan.status === dcaSelectedStatus;
    return matchesSearch && matchesStatus;
  });

  const dcaStatuses = ['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

  // Calculate stats
  const totalTransactions = allTransactions.length;
  const buyTransactions = allTransactions.filter(t => t.type === 'BUY').length;
  const sellTransactions = allTransactions.filter(t => t.type === 'SELL').length;
  const todayTransactions = allTransactions.filter(t => 
    new Date(t.created_at).toDateString() === new Date().toDateString()
  ).length;

  const totalDcaPlans = dcaPlans.length;
  const activeDcaPlans = dcaPlans.filter(p => p.status === 'ACTIVE').length;
  const pausedDcaPlans = dcaPlans.filter(p => p.status === 'PAUSED').length;

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-white" />
            Operations & DCA Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Monitor and manage platform operations and DCA plans</p>
        </div>
        {activeTab === 'operations' && (
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
        )}
        {activeTab === 'dca' && (
          <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'operations'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Operations ({totalTransactions})
        </button>
        <button
          onClick={() => setActiveTab('dca')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'dca'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          DCA Plans ({totalDcaPlans})
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        {activeTab === 'operations' ? (
          <>
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Activity className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Total Operations</p>
              <p className="text-2xl font-bold">{totalTransactions}</p>
              <p className="text-xs text-zinc-500">{todayTransactions} Today</p>
            </div>
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Activity className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Filtered Results</p>
              <p className="text-2xl font-bold">{filteredTransactions.length}</p>
              <p className="text-xs text-zinc-500">{buyTransactions} Buy • {sellTransactions} Sell</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Repeat className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Total DCA Plans</p>
              <p className="text-2xl font-bold">{totalDcaPlans}</p>
              <p className="text-xs text-zinc-500">{activeDcaPlans} Active</p>
            </div>
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <Play className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Plan Status</p>
              <p className="text-xl font-bold">{activeDcaPlans}</p>
              <p className="text-xs text-zinc-500">{pausedDcaPlans} Paused</p>
            </div>
          </>
        )}
      </div>

      {/* DCA Search */}
      {activeTab === 'dca' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by plan ID or user..."
              value={dcaSearchTerm}
              onChange={(e) => setDcaSearchTerm(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {dcaStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setDcaSelectedStatus(status === 'ALL' ? '' : status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  dcaSelectedStatus === status || (status === 'ALL' && !dcaSelectedStatus)
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-white" />
            {activeTab === 'operations' ? `Operations (${filteredTransactions.length})` : `DCA Plans (${filteredDcaPlans.length})`}
          </h2>
        </div>
        
        <div className="p-4">
          {activeTab === 'operations' ? (
            filteredTransactions.length > 0 ? (
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
                            {formatTimeAgo(transaction.created_at)} • User: {transaction.user_id}
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
                            {(transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') && (
                              <p className="text-xs text-zinc-500">
                                Auto-DCA
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
                    {(transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL') && transaction.status === 'PENDING' && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelLimitOrder(transaction.id.toString());
                          }}
                          disabled={processingActions.has(transaction.id.toString())}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                        >
                          {processingActions.has(transaction.id.toString()) ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      </div>
                    )}
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
                <p className="text-zinc-400 text-lg mb-2">No operations found</p>
                <p className="text-zinc-500 text-sm">Operations matching your filters will appear here!</p>
              </div>
            )
          ) : (
            filteredDcaPlans.length > 0 ? (
              <div className="space-y-3">
                {filteredDcaPlans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
                    onClick={() => handleDcaPlanClick(plan)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-700 rounded-lg">
                          {plan.plan_type === 'DCA_BUY' ? (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white text-sm">
                              {plan.plan_type === 'DCA_BUY' ? 'DCA Buy' : 'DCA Sell'} - {plan.frequency}
                            </p>
                            <span className={`px-1.5 py-0.5 text-xs border rounded flex items-center gap-1 ${getDcaStatusColor(plan.status)}`}>
                              {getDcaStatusIcon(plan.status)}
                              {plan.status}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-xs">
                            Created {formatTimeAgo(plan.created_at)} • User: {plan.user_id}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-400">Amount per execution</p>
                        <p className="font-bold text-white">
                          {plan.plan_type === 'DCA_BUY' 
                            ? `₹${plan.amount_per_execution.toLocaleString('en-IN')}`
                            : formatCurrency(plan.amount_per_execution, 'BTC')
                          }
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-zinc-400">Next execution</p>
                        <p className="font-bold text-white flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {plan.next_execution_at ? formatNextExecution(plan.next_execution_at) : 'N/A'}
                        </p>
                      </div>

                      {plan.remaining_executions !== null && (
                        <div>
                          <p className="text-zinc-400">Remaining</p>
                          <p className="font-bold text-white">
                            {plan.remaining_executions} of {plan.total_executions}
                          </p>
                        </div>
                      )}

                      {(plan.max_price || plan.min_price) && (
                        <div>
                          <p className="text-zinc-400">Price limits</p>
                          <div className="font-bold text-white text-xs">
                            {plan.max_price && (
                              <p>Max: ₹{plan.max_price.toLocaleString('en-IN')}</p>
                            )}
                            {plan.min_price && (
                              <p>Min: ₹{plan.min_price.toLocaleString('en-IN')}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No active DCA plans</p>
                <p className="text-zinc-500 text-sm">DCA plans matching your filters will appear here!</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* DCA Load More Button */}
      {activeTab === 'dca' && dcaHasMore && (
        <div className="text-center">
          <button
            onClick={() => setDcaPage(prev => prev + 1)}
            disabled={isLoading}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsFilterOpen(false)}>
          {/* Modal */}
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  <Filter className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Filter Operations</h2>
                  <p className="text-sm text-zinc-400">Customize your operations view</p>
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
                    { key: 'WITHDRAW_BTC', label: 'Withdraw BTC', icon: Minus },
                    { key: 'LOAN_CREATE', label: 'Loan Create', icon: Lock },
                    { key: 'LOAN_BORROW', label: 'Loan Borrow', icon: ArrowDown },
                    { key: 'LOAN_REPAY', label: 'Loan Repay', icon: ArrowUp },
                    { key: 'LOAN_ADD_COLLATERAL', label: 'Add Collateral', icon: Plus }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => toggleTransactionType(key as TransactionType)}
                      className={`p-2 rounded-lg border transition-all text-xs flex items-center gap-1 ${
                        filters.types.includes(key as TransactionType)
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
                          : 'bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
                      : 'bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
                        className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">To</label>
                      <input
                        type="date"
                        value={filters.customDateTo}
                        onChange={(e) => handleFilterChange({ customDateTo: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
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
                      className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
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
                      className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white"
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
                          : 'bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransaction(null);
          }}
        />
      )}

      {/* DCA Plan Detail Modal */}
      {isDcaModalOpen && selectedDcaPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  {selectedDcaPlan.plan_type === 'DCA_BUY' ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">DCA Plan Details</h2>
                  <p className="text-zinc-400 text-sm">{selectedDcaPlan.plan_type === 'DCA_BUY' ? 'DCA Buy' : 'DCA Sell'} Plan</p>
                </div>
              </div>
              <button
                onClick={() => setIsDcaModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              {/* Plan Details - 4 Separate Sections */}
              <div className="grid grid-cols-2 gap-3">
                {/* Frequency */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Frequency</p>
                  <p className="text-white font-medium text-sm">{selectedDcaPlan.frequency}</p>
                </div>
                
                {/* Amount per Execution */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Amount per Execution</p>
                  <p className="text-white font-medium text-sm">
                    {selectedDcaPlan.plan_type === 'DCA_BUY' 
                      ? `₹${selectedDcaPlan.amount_per_execution.toLocaleString('en-IN')}`
                      : formatCurrency(selectedDcaPlan.amount_per_execution, 'BTC')
                    }
                  </p>
                </div>
                
                {/* Next Execution */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Next Execution</p>
                  <p className="text-white font-medium text-sm flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedDcaPlan.next_execution_at ? formatNextExecution(selectedDcaPlan.next_execution_at) : 'N/A'}
                  </p>
                </div>
                
                {/* Status */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Status</p>
                  <span className={`px-2 py-1 text-xs border rounded flex items-center gap-1 w-fit ${getDcaStatusColor(selectedDcaPlan.status)}`}>
                    {getDcaStatusIcon(selectedDcaPlan.status)}
                    {selectedDcaPlan.status}
                  </span>
                </div>
              </div>

              {/* Optional Details */}
              {(selectedDcaPlan.remaining_executions !== null || selectedDcaPlan.max_price || selectedDcaPlan.min_price) && (
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    {selectedDcaPlan.remaining_executions !== null && (
                      <div>
                        <span className="text-zinc-400">Progress: </span>
                        <span className="text-white">{selectedDcaPlan.remaining_executions} of {selectedDcaPlan.total_executions} remaining</span>
                      </div>
                    )}
                    {(selectedDcaPlan.max_price || selectedDcaPlan.min_price) && (
                      <div>
                        <span className="text-zinc-400">Price Limits: </span>
                        <span className="text-white">
                          {selectedDcaPlan.max_price && `Max ₹${selectedDcaPlan.max_price.toLocaleString('en-IN')}`}
                          {selectedDcaPlan.max_price && selectedDcaPlan.min_price && ', '}
                          {selectedDcaPlan.min_price && `Min ₹${selectedDcaPlan.min_price.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedDcaPlan.status === 'ACTIVE' && (
                  <button 
                    onClick={() => handlePauseDcaPlan(selectedDcaPlan.id.toString())} 
                    disabled={processingActions.has(selectedDcaPlan.id.toString())} 
                    className="flex-1 bg-yellow-900/20 border border-yellow-800 text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    {processingActions.has(selectedDcaPlan.id.toString()) ? 'Pausing...' : 'Pause'}
                  </button>
                )}
                {selectedDcaPlan.status === 'PAUSED' && (
                  <button 
                    onClick={() => handleResumeDcaPlan(selectedDcaPlan.id.toString())} 
                    disabled={processingActions.has(selectedDcaPlan.id.toString())} 
                    className="flex-1 bg-green-900/20 border border-green-800 text-green-300 hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {processingActions.has(selectedDcaPlan.id.toString()) ? 'Resuming...' : 'Resume'}
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteDcaPlan(selectedDcaPlan.id.toString())} 
                  disabled={processingActions.has(selectedDcaPlan.id.toString())} 
                  className="flex-1 bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {processingActions.has(selectedDcaPlan.id.toString()) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;
