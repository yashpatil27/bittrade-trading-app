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
  Circle
} from 'lucide-react';
import { userAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { 
  getTransactionDisplayName, 
  getTransactionIcon, 
  getTransactionColor, 
  formatTimeAgo,
  formatCurrency
} from '../utils/formatters';

const History: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const response = await userAPI.getAllTransactions(page, 20);
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

    fetchTransactions();
  }, [page]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const formatAmount = (transaction: Transaction) => {
    if (transaction.type === 'BUY' || transaction.type === 'SELL') {
      return `₹${transaction.inr_amount.toLocaleString()} / ${formatCurrency(transaction.btc_amount, 'BTC')}`;
    } else if (transaction.type.includes('INR')) {
      return `₹${transaction.inr_amount.toLocaleString()}`;
    } else if (transaction.type.includes('BTC')) {
      return formatCurrency(transaction.btc_amount, 'BTC');
    }
    return '';
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
        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 text-center">
          <Activity className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Transactions</p>
          <p className="text-2xl font-bold">{transactions.length}</p>
        </div>
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4 text-center">
          <Activity className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">This Month</p>
          <p className="text-2xl font-bold">
            {transactions.filter(t => 
              new Date(t.created_at).getMonth() === new Date().getMonth()
            ).length}
          </p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">All Transactions</h2>
        </div>
        
        <div className="p-4">
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
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
                      <p className="font-bold text-sm text-white">
                        {formatAmount(transaction)}
                      </p>
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

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default History;
