import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Filter, 
  ChevronDown, 
  Search,
  Eye,
  User,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Circle
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  formatTimeAgo,
  formatBitcoin
} from '../utils/formatters';

const AdminTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    fetchTransactions();
  }, [page]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getAllTransactions(page, 50);
      const { transactions: newTransactions, pagination } = response.data.data!;
      
      if (page === 1) {
        setTransactions(newTransactions);
      } else {
        setTransactions(prev => [...prev, ...newTransactions]);
      }
      
      setHasMore(pagination.has_more);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const formatAmount = (transaction: Transaction) => {
    if (transaction.type.includes('INR')) {
      return `₹${transaction.inr_amount.toLocaleString('en-IN')}`;
    } else if (transaction.type.includes('BTC')) {
      return `₿${formatBitcoin(transaction.btc_amount)}`;
    }
    return '';
  };

  const getIconComponent = (iconName: string) => {
    const iconProps = { className: "w-4 h-4 text-white" };
    switch (iconName) {
      case 'User': return <User {...iconProps} />;
      case 'ArrowUp': return <ArrowUp {...iconProps} />;
      case 'TrendingUp': return <TrendingUp {...iconProps} />;
      case 'TrendingDown': return <TrendingDown {...iconProps} />;
      case 'ArrowDown': return <ArrowDown {...iconProps} />;
      case 'Plus': return <Plus {...iconProps} />;
      case 'Minus': return <Minus {...iconProps} />;
      default: return <Circle {...iconProps} />;
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.id.toString().includes(searchTerm) || 
                         getTransactionDisplayName(transaction.type).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || transaction.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const transactionTypes = ['ALL', 'SETUP', 'DEPOSIT_INR', 'BUY', 'SELL', 'WITHDRAW_INR', 'DEPOSIT_BTC', 'WITHDRAW_BTC'];

  // Calculate stats
  const totalTransactions = transactions.length;
  const buyTransactions = transactions.filter(t => t.type === 'BUY').length;
  const sellTransactions = transactions.filter(t => t.type === 'SELL').length;
  const todayTransactions = transactions.filter(t => 
    new Date(t.created_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-white" />
            All Transactions
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Monitor all platform transaction activity</p>
        </div>
        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Activity className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Transactions</p>
          <p className="text-2xl font-bold">{totalTransactions}</p>
          <p className="text-xs text-zinc-500">{todayTransactions} Today</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <TrendingUp className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Trading Activity</p>
          <p className="text-xl font-bold">{buyTransactions + sellTransactions}</p>
          <p className="text-xs text-zinc-500">{buyTransactions} Buy • {sellTransactions} Sell</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by transaction ID or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {transactionTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === type
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All Types' : getTransactionDisplayName(type as Transaction['type'])}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-white" />
            Transactions ({filteredTransactions.length})
          </h2>
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
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-zinc-400">
                            {formatTimeAgo(transaction.created_at)}
                          </span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400">
                            User #{transaction.user_id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {transaction.type === 'BUY' || transaction.type === 'SELL' ? (
                        <div>
                          <p className="font-bold text-sm text-white">
                          ₹{transaction.inr_amount.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            ₿{formatBitcoin(transaction.btc_amount)}
                          </p>
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
              <Activity className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">
                {searchTerm || filterType !== 'ALL' ? 'No transactions found' : 'No transactions yet'}
              </p>
              <p className="text-zinc-500 text-sm">
                {searchTerm || filterType !== 'ALL' 
                  ? 'Try adjusting your search or filter' 
                  : 'Transaction activity will appear here once users start trading!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default AdminTransactions;
