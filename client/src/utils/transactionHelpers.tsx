import React from 'react';
import { 
  User,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Circle,
  X,
  Target,
  Repeat,
  Lock,
  Clock,
  AlertTriangle,
  Zap,
  Trash2
} from 'lucide-react';
import { Transaction } from '../types';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatInr, satoshisToBitcoin } from './formatters';

// Helper function to get icon component from icon name
export const getIconComponent = (iconName: string) => {
  const iconProps = { className: "w-6 h-6 text-white" };
  switch (iconName) {
    case 'User': return <User {...iconProps} />;
    case 'ArrowUp': return <ArrowUp {...iconProps} />;
    case 'TrendingUp': return <TrendingUp {...iconProps} />;
    case 'TrendingDown': return <TrendingDown {...iconProps} />;
    case 'ArrowDown': return <ArrowDown {...iconProps} />;
    case 'Plus': return <Plus {...iconProps} />;
    case 'Minus': return <Minus {...iconProps} />;
    case 'Target': return <Target {...iconProps} />;
    case 'X': return <X {...iconProps} />;
    case 'Repeat': return <Repeat {...iconProps} />;
    case 'Lock': return <Lock {...iconProps} />;
    case 'Clock': return <Clock {...iconProps} />;
    case 'AlertTriangle': return <AlertTriangle {...iconProps} />;
    case 'Zap': return <Zap {...iconProps} />;
    default: return <Circle {...iconProps} />;
  }
};

// Helper function to get main amount for display
export const getMainAmount = (transaction: Transaction) => {
  // For trading transactions, show INR amount as main
  if (transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'MARKET_BUY' || transaction.type === 'MARKET_SELL' || transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL' || transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') {
    return {
      amount: transaction.inr_amount.toString(),
      type: 'inr' as const,
      subAmount: satoshisToBitcoin(transaction.btc_amount).toString(),
      subType: 'btc' as const
    };
  }
  // For loan transactions with both amounts, show INR as main
  else if (transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type.includes('LIQUIDATION')) {
    if (transaction.inr_amount > 0 && transaction.btc_amount > 0) {
      return {
        amount: transaction.inr_amount.toString(),
        type: 'inr' as const,
        subAmount: satoshisToBitcoin(transaction.btc_amount).toString(),
        subType: 'btc' as const
      };
    } else if (transaction.inr_amount > 0) {
      return {
        amount: transaction.inr_amount.toString(),
        type: 'inr' as const
      };
    } else if (transaction.btc_amount > 0) {
      return {
        amount: satoshisToBitcoin(transaction.btc_amount).toString(),
        type: 'btc' as const
      };
    }
  }
  // For INR-only transactions
  else if (transaction.type.includes('INR')) {
    return {
      amount: transaction.inr_amount.toString(),
      type: 'inr' as const
    };
  }
  // For BTC-only transactions
  else if (transaction.type.includes('BTC')) {
    return {
      amount: satoshisToBitcoin(transaction.btc_amount).toString(),
      type: 'btc' as const
    };
  }
  return null;
};

// Helper function to get status text
export const getStatusText = (transaction: Transaction) => {
  if (transaction.status === 'PENDING') {
    return 'Pending';
  } else if (transaction.status === 'CANCELLED') {
    return 'Cancelled';
  } else {
    return 'Completed';
  }
};

// Helper function to get transaction details for modal
export const getTransactionDetails = (transaction: Transaction) => {
  const details = [];

  // Add status as first detail
  details.push({
    label: 'Status',
    value: getStatusText(transaction),
    highlight: transaction.status === 'PENDING'
  });

  // Add price information for trading transactions
  if (transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'MARKET_BUY' || transaction.type === 'MARKET_SELL' || transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL' || transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') {
    details.push({
      label: transaction.status === 'PENDING' ? 'Target Price' : 'BTC Price',
      value: transaction.btc_price ? formatInr(transaction.btc_price) : 'N/A'
    });
  }

  // Add loan information
  if (transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type === 'PARTIAL_LIQUIDATION' || transaction.type === 'FULL_LIQUIDATION') {
    if (transaction.loan_id) {
      details.push({
        label: 'Loan ID',
        value: transaction.loan_id.toString()
      });
    }
    if (transaction.execution_price) {
      details.push({
        label: 'Execution Price',
        value: formatInr(transaction.execution_price)
      });
    }
    if (transaction.executed_at) {
      details.push({
        label: 'Executed At',
        value: transaction.executed_at
      });
    }
  }

  // Add transaction date
  details.push({
    label: 'Date',
    value: new Date(transaction.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' at ' + new Date(transaction.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  });

  // Add transaction ID
  details.push({
    label: 'Transaction ID',
    value: `#${transaction.id.toString().padStart(8, '0')}`
  });

  return details;
};

// Helper function to check if transaction can be cancelled
export const canCancelTransaction = (transaction: Transaction) => {
  return transaction.status === 'PENDING' && 
         (transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL');
};

// Helper function to handle order cancellation
export const handleCancelOrder = async (
  transaction: Transaction,
  isCancelling: boolean,
  setIsCancelling: (value: boolean) => void,
  refreshData: () => Promise<void>,
  setIsModalOpen: (value: boolean) => void
) => {
  const { sendMessage } = useWebSocket();

  if (!transaction || isCancelling) return;
  
  try {
    setIsCancelling(true);
    await sendMessage('order.cancel-limit-order', { id: transaction.id });
    
    // Refresh data and close modal
    await refreshData();
    setIsModalOpen(false);
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    alert(error.message || 'Failed to cancel order. Please try again.');
  } finally {
    setIsCancelling(false);
  }
};

// Helper function to create cancel button component
export const createCancelButton = (
  transaction: Transaction,
  isCancelling: boolean,
  onCancel: () => void
) => {
  if (!canCancelTransaction(transaction)) return undefined;

  return (
    <button
      onClick={onCancel}
      disabled={isCancelling}
      className="w-full bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <Trash2 className="w-4 h-4" />
      {isCancelling ? 'Cancelling...' : 'Cancel Order'}
    </button>
  );
};
