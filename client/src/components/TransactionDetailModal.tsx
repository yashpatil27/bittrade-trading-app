import React, { useState } from 'react';
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
  Target,
  Trash2,
  Repeat,
  Lock,
  Clock,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { Transaction } from '../types';
import { getTransactionDisplayName, getTransactionIcon, formatBitcoin, formatCurrencyInr } from '../utils/formatters';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { userAPI } from '../services/api';
import PinConfirmationModal from './PinConfirmationModal';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onTransactionUpdate?: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onTransactionUpdate
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  useBodyScrollLock(isOpen);
  
  if (!isOpen || !transaction) return null;

  // Check if transaction can be cancelled
  const canCancel = transaction.status === 'PENDING' && 
    (transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL');

  const handleCancelOrder = async () => {
    if (!transaction || isCancelling) return;
    
    try {
      setIsCancelling(true);
      await userAPI.cancelLimitOrder(transaction.id);
      
      // Call the update callback to refresh the transaction list
      if (onTransactionUpdate) {
        onTransactionUpdate();
      }
      
      // Close the modal
      onClose();
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      alert(error.response?.data?.message || 'Failed to cancel order. Please try again.');
    } finally {
      setIsCancelling(false);
      setIsPinModalOpen(false);
    }
  };

  const handleCancelClick = () => {
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN
      const response = await userAPI.verifyPin(pin);
      if (response.data.data?.valid) {
        // PIN is correct, proceed with canceling the order
        await handleCancelOrder();
        return true;
      } else {
        // PIN is incorrect
        return false;
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
  };

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

  const formatAmount = () => {
    if (transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'MARKET_BUY' || transaction.type === 'MARKET_SELL' || transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL' || transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') {
      return `${formatCurrencyInr(transaction.inr_amount)} / ₿${formatBitcoin(transaction.btc_amount)}`;
    } else if (transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type.includes('LIQUIDATION')) {
      // For loan transactions, show both amounts if they exist
      if (transaction.inr_amount > 0 && transaction.btc_amount > 0) {
        return `${formatCurrencyInr(transaction.inr_amount)} / ₿${formatBitcoin(transaction.btc_amount)}`;
      } else if (transaction.inr_amount > 0) {
        return formatCurrencyInr(transaction.inr_amount);
      } else if (transaction.btc_amount > 0) {
        return `₿${formatBitcoin(transaction.btc_amount)}`;
      }
      return 'N/A';
    } else if (transaction.type.includes('INR')) {
      return formatCurrencyInr(transaction.inr_amount);
    } else if (transaction.type.includes('BTC')) {
      return `₿${formatBitcoin(transaction.btc_amount)}`;
    }
    return '';
  };

  const getTransactionTypeColor = () => {
    if (transaction.status === 'PENDING') {
      return 'text-orange-400';
    }
    if (transaction.status === 'CANCELLED') {
      return 'text-gray-400';
    }
    switch (transaction.type) {
      case 'BUY':
      case 'MARKET_BUY':
      case 'LIMIT_BUY': return 'text-green-400';
      case 'SELL':
      case 'MARKET_SELL':
      case 'LIMIT_SELL': return 'text-red-400';
      case 'DEPOSIT_INR': 
      case 'DEPOSIT_BTC': return 'text-blue-400';
      case 'WITHDRAW_INR': 
      case 'WITHDRAW_BTC': return 'text-orange-400';
      case 'LOAN_CREATE':
      case 'LOAN_ADD_COLLATERAL': return 'text-blue-400';
      case 'LOAN_BORROW': return 'text-green-400';
      case 'LOAN_REPAY': return 'text-red-400';
      case 'INTEREST_ACCRUAL': return 'text-yellow-400';
      case 'PARTIAL_LIQUIDATION':
      case 'FULL_LIQUIDATION': return 'text-red-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-zinc-800 rounded-lg">
              {getIconComponent(getTransactionIcon(transaction.type, transaction.status))}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{getTransactionDisplayName(transaction.type, transaction.status)}</h2>
              <p className="text-xs text-zinc-400">
                #{transaction.id.toString().padStart(8, '0')}
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
          {/* Transaction Amount */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-white font-bold text-lg">{formatAmount()}</p>
            </div>
          </div>

          {/* Loan Information (for LOAN operations) */}
{(transaction.type.includes('LOAN') || transaction.type.includes('INTEREST') || transaction.type === 'PARTIAL_LIQUIDATION' || transaction.type === 'FULL_LIQUIDATION') 
            
            && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="space-y-1">
                {transaction.loan_id ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-xs">Loan ID:</span>
                    <span className="text-white text-xs">{transaction.loan_id}</span>
                  </div>
                ) : null}
{transaction.execution_price ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-xs">Execution Price:</span>
                    <span className="text-white text-xs">{formatCurrencyInr(transaction.execution_price)}</span>
                  </div>
                ) : null}
                {transaction.notes && transaction.type !== 'PARTIAL_LIQUIDATION' && transaction.type !== 'FULL_LIQUIDATION' ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-xs">Notes:</span>
                    <span className="text-white text-xs">{transaction.notes}</span>
                  </div>
                ) : null}
                {transaction.executed_at ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-xs">Executed At:</span>
                    <span className="text-white text-xs">{transaction.executed_at}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          
          {/* Liquidation Details */}
          {(transaction.type === 'FULL_LIQUIDATION' || transaction.type === 'PARTIAL_LIQUIDATION') && (
            <div className="bg-red-900/10 border border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 text-xs font-medium">
                  {transaction.type === 'FULL_LIQUIDATION' ? 'Full Liquidation Details' : 'Partial Liquidation Details'}
                </span>
              </div>
              <div className="space-y-1">
                {(() => {
                  // Try to parse structured liquidation data from notes
                  let liquidationData = null;
                  try {
                    if (transaction.notes) {
                      liquidationData = JSON.parse(transaction.notes);
                    }
                  } catch (e) {
                    // If parsing fails, fall back to basic display
                  }
                  
                  // For full liquidations, try to calculate BTC returned if not in structured data
                  let btcReturned = liquidationData?.btcReturned;
                  let originalCollateral = liquidationData?.originalCollateral;
                  
                  // Fallback calculation for older transactions
                  if (transaction.type === 'FULL_LIQUIDATION' && !btcReturned && transaction.execution_price && transaction.inr_amount && transaction.btc_amount) {
                    // For full liquidations, the total sale proceeds should equal debt cleared
                    // So we can estimate original collateral = btc_sold + btc_returned
                    // Since we know debt was fully cleared, any excess BTC from sale would be returned
                    const saleProceeds = (transaction.btc_amount * (transaction.execution_price || transaction.btc_price || 0)) / 100000000;
                    const excessInr = saleProceeds - transaction.inr_amount;
                    
                    // If there was excess INR, it means some BTC was sold and converted back to user's balance
                    // But for full liquidation, typically the BTC returned calculation is:
                    // Original collateral = BTC sold to cover debt + BTC returned directly
                    // We'll show a note that this is estimated for older transactions
                  }
                  
                  return (
                    <>
                      {transaction.btc_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400 text-xs">BTC Sold:</span>
                          <span className="text-white text-xs">₿{formatBitcoin(transaction.btc_amount)}</span>
                        </div>
                      )}
                      {(transaction.execution_price || transaction.btc_price) && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400 text-xs">Sale Price:</span>
                          <span className="text-white text-xs">{formatCurrencyInr(transaction.execution_price || transaction.btc_price)}</span>
                        </div>
                      )}
                      {transaction.inr_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400 text-xs">{transaction.type === 'FULL_LIQUIDATION' ? 'Debt Cleared:' : 'Amount Applied:'}</span>
                          <span className="text-white text-xs">{formatCurrencyInr(transaction.inr_amount)}</span>
                        </div>
                      )}
                      {/* Show BTC returned for full liquidations */}
                      {transaction.type === 'FULL_LIQUIDATION' && btcReturned && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400 text-xs">BTC Returned:</span>
                          <span className="text-green-300 text-xs">₿{formatBitcoin(btcReturned)}</span>
                        </div>
                      )}
                      {/* Show original collateral if available */}
                      {originalCollateral && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400 text-xs">Original Collateral:</span>
                          <span className="text-white text-xs">₿{formatBitcoin(originalCollateral)}</span>
                        </div>
                      )}
                      {transaction.type === 'FULL_LIQUIDATION' && (
                        <div className="text-center mt-2">
                          <span className="px-2 py-1 text-xs bg-red-900/20 border border-red-800 text-red-300 rounded">
                            Loan Fully Repaid
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          
          {(transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'MARKET_BUY' || transaction.type === 'MARKET_SELL' || transaction.type === 'LIMIT_BUY' || transaction.type === 'LIMIT_SELL' || transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs">{transaction.status === 'PENDING' ? 'Target Price:' : 'BTC Price:'}</span>
                  <span className="text-white text-xs">{transaction.btc_price ? formatCurrencyInr(transaction.btc_price) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-xs">{transaction.status === 'PENDING' ? 'Estimated BTC:' : 'BTC Amount:'}</span>
                  <span className="text-white text-xs">₿{formatBitcoin(transaction.btc_amount)}</span>
                </div>
                {(transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') && (
                  <div className="text-center mt-2">
                    <span className="px-2 py-1 text-xs bg-blue-900/20 border border-blue-800 text-blue-300 rounded">
                      Automated DCA Transaction
                    </span>
                  </div>
                )}
                {transaction.status === 'PENDING' && (
                  <div className="text-center mt-2">
                    <span className="px-2 py-1 text-xs bg-orange-900/20 border border-orange-800 text-orange-300 rounded">
                      Waiting for price to reach target
                    </span>
                  </div>
                )}
                {transaction.status === 'CANCELLED' && (
                  <div className="text-center mt-2">
                    <span className="px-2 py-1 text-xs bg-gray-900/20 border border-gray-800 text-gray-400 rounded">
                      Order was cancelled
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Balances After Transaction - Hidden for now as we're not storing balance snapshots */}
          {/* TODO: Implement balance snapshots in operations table to show historical balances */}

          {/* Date and Status */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-xs">Date</span>
              <div className="flex items-center gap-1">
                {transaction.status === 'PENDING' ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                    <span className="text-orange-300 text-xs">Pending</span>
                  </>
                ) : transaction.status === 'CANCELLED' ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    <span className="text-gray-400 text-xs">Cancelled</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    <span className="text-green-300 text-xs">Completed</span>
                  </>
                )}
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

          {/* Cancel Order Button */}
          {canCancel && (
            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              className="w-full bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isCancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
        </div>
      </div>
      
      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title="Confirm Cancel Order"
        message="Enter your PIN to confirm canceling this limit order"
        isLoading={isCancelling}
      />
    </div>
  );
};

export default TransactionDetailModal;
