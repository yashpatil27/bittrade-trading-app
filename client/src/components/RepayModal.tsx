import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { LoanStatus, Balances, Prices } from '../types';
import { useBalance } from '../contexts/BalanceContext';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { formatCurrencyInr } from '../utils/formatters';

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  balances?: Balances | null;
  onSuccess: () => void;
}

const RepayModal: React.FC<RepayModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  balances,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [realtimeBalances, setRealtimeBalances] = useState<Balances | null>(balances || null);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { updateBalance } = useBalance();
  const { sendMessage, on, off } = useWebSocket();

  // Modal flow control
  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
      setError('');
      // Initialize real-time data with props
      setRealtimeBalances(balances || null);
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
      setError('');
    }
  }, [isOpen]);

  // Separate effect to update real-time data when props change (without resetting modal state)
  useEffect(() => {
    if (isOpen) {
      setRealtimeBalances(balances || null);
    }
  }, [isOpen, balances]);

  // Real-time event listeners for balance updates
  useEffect(() => {
    if (!isOpen) return;

    // Handle balance updates
    const handleBalanceUpdate = (data: any) => {
      console.log('Balance update received:', data);
      if (data?.balances) {
        setRealtimeBalances(data.balances);
      }
    };

    // Subscribe to WebSocket events
    on('balance_update', handleBalanceUpdate);

    // Cleanup event listeners when modal closes or component unmounts
    return () => {
      off('balance_update', handleBalanceUpdate);
    };
  }, [isOpen, on, off]);

  const getTotalDue = () => {
    if (!loanStatus) return 0;
    return loanStatus.borrowedAmount + (loanStatus.minimumInterestDue || 0);
  };

  const calculateNewLtv = () => {
    if (!amount || !loanStatus) return loanStatus?.currentLtv || 0;
    const repayAmount = parseFloat(amount);
    const newBorrowedTotal = Math.max(0, loanStatus.borrowedAmount - repayAmount);
    const collateralValue = (loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000;
    return newBorrowedTotal > 0 ? (newBorrowedTotal / collateralValue) * 100 : 0;
  };

  const getRiskColor = (ltv: number) => {
    if (ltv >= 90) return 'text-red-400';
    if (ltv >= 85) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskText = (ltv: number) => {
    if (ltv >= 90) return 'HIGH RISK';
    if (ltv >= 85) return 'MEDIUM RISK';
    return 'LOW RISK';
  };

  const handleRepay = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!loanStatus) {
      setError('No active loan found');
      return;
    }

    const repayAmount = parseFloat(amount);
    if (repayAmount > getAvailableBalance()) {
      setError('Insufficient ₹ balance');
      return;
    }

    if (repayAmount > getTotalDue()) {
      setError('Amount exceeds total due amount');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      // Repay loan
      await sendMessage('user.repay-loan', { amount: parseFloat(amount) });
      
      // Update balance
      await updateBalance();
      
      onSuccess();
    } catch (error: any) {
      console.error('Repay error:', error);
      setError(error.message || 'Error repaying loan');
    } finally {
      setLoading(false);
    }
  };


  const getMaxAmount = () => {
    const availableBalance = realtimeBalances?.inr || 0;
    return Math.min(availableBalance, getTotalDue());
  };

  const getAvailableBalance = () => {
    return realtimeBalances?.inr || 0;
  };

  const handleSingleInputConfirm = async (value: string) => {
    setAmount(value);
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(true);
  };

  const handleConfirmDetailsClose = () => {
    setIsConfirmDetailsModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  const handleConfirmDetailsConfirm = async () => {
    setIsConfirmDetailsModalOpen(false);
    await handleRepay();
  };

  const handleModalClose = () => {
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(false);
    onClose();
  };

  if (!isOpen || !loanStatus) return null;

  return createPortal(
    <>
      {/* Single Input Modal */}
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleModalClose}
        title="Repay Loan"
        type="inr"
        maxValue={getMaxAmount()}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          if (numValue <= 0) return 'Amount must be greater than 0';
          if (numValue > getMaxAmount()) return 'Insufficient balance';
          if (numValue > getTotalDue()) return 'Amount exceeds total due';
          
          return null;
        }}
        sectionTitle="Loan Details"
        sectionDetail={
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Total Due:</span>
              <span className="text-white">{formatCurrencyInr(getTotalDue())}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Available Balance:</span>
              <span className="text-white">{formatCurrencyInr(getAvailableBalance())}</span>
            </div>
          </div>
        }
        sectionAmount={formatCurrencyInr(getMaxAmount())}
      />

      {/* Confirm Details Modal */}
      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title="Confirm Repayment"
        amount={amount}
        amountType="inr"
        details={[
          {
            label: 'Total Due',
            value: formatCurrencyInr(getTotalDue()),
            highlight: false
          },
          {
            label: 'Amount to Repay',
            value: formatCurrencyInr(parseFloat(amount || '0')),
            highlight: true
          },
          {
            label: 'Remaining Debt',
            value: formatCurrencyInr(Math.max(0, getTotalDue() - parseFloat(amount || '0'))),
            highlight: false
          },
          {
            label: 'New LTV',
            value: `${calculateNewLtv().toFixed(1)}% (${getRiskText(calculateNewLtv())})`,
            highlight: calculateNewLtv() >= 85
          },
          {
            label: 'Remaining Balance',
            value: formatCurrencyInr(getAvailableBalance() - parseFloat(amount || '0')),
            highlight: false
          }
        ]}
        confirmText="Confirm Repayment"
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={loading}
      />

    </>,
    document.body
  );
};

export default RepayModal;
