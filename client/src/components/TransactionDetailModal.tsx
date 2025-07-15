import React from 'react';
import { Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { getTransactionDisplayName } from '../utils/formatters';
import {
  getMainAmount,
  getTransactionDetails,
  canCancelTransaction,
  handleCancelOrder as handleCancelOrderHelper
} from '../utils/transactionHelpers';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  // New API props (used by History page)
  isCancelling?: boolean;
  setIsCancelling?: (value: boolean) => void;
  refreshData?: () => Promise<void>;
  // Legacy API prop (used by other pages)
  onTransactionUpdate?: () => Promise<void>;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  isCancelling,
  setIsCancelling,
  refreshData,
  onTransactionUpdate
}) => {
  if (!transaction) return null;

  // Use the new API if available, otherwise fall back to legacy API
  const effectiveRefreshData = refreshData || onTransactionUpdate;
  const effectiveIsCancelling = isCancelling || false;
  const effectiveSetIsCancelling = setIsCancelling || (() => {});

  const handleCancelOrder = async () => {
    if (effectiveRefreshData) {
      await handleCancelOrderHelper(transaction, effectiveIsCancelling, effectiveSetIsCancelling, effectiveRefreshData, onClose);
    }
  };

  const amountData = getMainAmount(transaction);

  const actionButtons = canCancelTransaction(transaction) && effectiveRefreshData ? (
    <button
      onClick={handleCancelOrder}
      disabled={effectiveIsCancelling}
      className="w-full bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <Trash2 className="w-4 h-4" />
      {effectiveIsCancelling ? 'Cancelling...' : 'Cancel Order'}
    </button>
  ) : undefined;

  return (
    <ConfirmDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      mode="display"
      title={getTransactionDisplayName(transaction.type, transaction.status)}
      amount={amountData?.amount}
      amountType={amountData?.type}
      subAmount={amountData?.subAmount}
      subAmountType={amountData?.subType}
      details={getTransactionDetails(transaction)}
      actionButtons={actionButtons}
    />
  );
};

export default TransactionDetailModal;
