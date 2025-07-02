import React from 'react';
import { 
  X, 
  User,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Circle,
  Calendar,
  Hash,
  Wallet,
  DollarSign,
  Bitcoin
} from 'lucide-react';
import { Transaction } from '../types';
import { getTransactionDisplayName, getTransactionIcon, formatBitcoin } from '../utils/formatters';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction
}) => {
  if (!isOpen || !transaction) return null;

  const getIconComponent = (iconName: string) => {
    const iconProps = { className: "w-6 h-6 text-white" };
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

  const formatAmount = () => {
    if (transaction.type === 'BUY' || transaction.type === 'SELL') {
      return `₹${transaction.inr_amount.toLocaleString()} / ₿${formatBitcoin(transaction.btc_amount)}`;
    } else if (transaction.type.includes('INR')) {
      return `₹${transaction.inr_amount.toLocaleString()}`;
    } else if (transaction.type.includes('BTC')) {
      return `₿${formatBitcoin(transaction.btc_amount)}`;
    }
    return '';
  };

  const getTransactionTypeColor = () => {
    switch (transaction.type) {
      case 'BUY': return 'text-green-400';
      case 'SELL': return 'text-red-400';
      case 'DEPOSIT_INR': 
      case 'DEPOSIT_BTC': return 'text-blue-400';
      case 'WITHDRAW_INR': 
      case 'WITHDRAW_BTC': return 'text-orange-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-zinc-800 rounded-lg">
              {getIconComponent(getTransactionIcon(transaction.type))}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Transaction</h2>
              <p className={`text-xs font-medium ${getTransactionTypeColor()}`}>
                {getTransactionDisplayName(transaction.type)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Transaction ID & Amount */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-xs">ID</span>
              <span className="text-white font-mono text-xs">#{transaction.id.toString().padStart(8, '0')}</span>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{formatAmount()}</p>
            </div>
          </div>

          {/* Price Information (for BUY/SELL) */}
          {(transaction.type === 'BUY' || transaction.type === 'SELL') && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs">BTC Price:</span>
                  <span className="text-white text-xs">₹{transaction.btc_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs">BTC Amount:</span>
                  <span className="text-white text-xs">₿{formatBitcoin(transaction.btc_amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Balances After Transaction */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-zinc-400 text-xs mb-2">Balances After</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-zinc-400 text-xs">INR</p>
                <p className="text-white font-medium text-sm">₹{transaction.inr_balance.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-xs">₿</p>
                <p className="text-white font-medium text-sm">₿{formatBitcoin(transaction.btc_balance)}</p>
              </div>
            </div>
          </div>

          {/* Date and Status */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-xs">Date</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-green-300 text-xs">Completed</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-white text-sm">
                {new Date(transaction.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
              <p className="text-zinc-400 text-xs">
                {new Date(transaction.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
