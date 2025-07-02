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
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-800 rounded-lg">
              {getIconComponent(getTransactionIcon(transaction.type))}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Transaction Details</h2>
              <p className={`text-sm font-medium ${getTransactionTypeColor()}`}>
                {getTransactionDisplayName(transaction.type)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Transaction ID */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-zinc-400" />
              <p className="text-zinc-400 text-sm">Transaction ID</p>
            </div>
            <p className="text-white font-mono text-sm">#{transaction.id.toString().padStart(8, '0')}</p>
          </div>

          {/* Amount */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-zinc-400" />
              <p className="text-zinc-400 text-sm">Amount</p>
            </div>
            <p className="text-white font-bold text-lg">{formatAmount()}</p>
          </div>

          {/* Price Information (for BUY/SELL) */}
          {(transaction.type === 'BUY' || transaction.type === 'SELL') && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bitcoin className="w-4 h-4 text-zinc-400" />
                <p className="text-zinc-400 text-sm">Price Information</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-sm">Bitcoin Price:</span>
                  <span className="text-white">₹{transaction.btc_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-sm">INR Amount:</span>
                  <span className="text-white">₹{transaction.inr_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-sm">Bitcoin Amount:</span>
                  <span className="text-white">₿{formatBitcoin(transaction.btc_amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Balances After Transaction */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-zinc-400" />
              <p className="text-zinc-400 text-sm">Balances After Transaction</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-zinc-400 text-xs">INR Balance</p>
                <p className="text-white font-bold">₹{transaction.inr_balance.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-xs">₿ Balance</p>
                <p className="text-white font-bold">₿{formatBitcoin(transaction.btc_balance)}</p>
              </div>
            </div>
          </div>

          {/* Date and Time */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <p className="text-zinc-400 text-sm">Date & Time</p>
            </div>
            <div className="space-y-1">
              <p className="text-white">
                {new Date(transaction.created_at).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-zinc-400 text-sm">
                {new Date(transaction.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <p className="text-green-300 font-medium">Completed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
