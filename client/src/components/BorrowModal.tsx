import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { LoanStatus } from '../types';
import { useBalance } from '../contexts/BalanceContext';
import { formatCurrencyInr } from '../utils/formatters';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  onSuccess: () => void;
}

const BorrowModal: React.FC<BorrowModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const { updateBalance } = useBalance();
  const { sendMessage } = useWebSocket();

  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
    }
  }, [isOpen]);

  const calculateNewLtv = () => {
    if (!amount || !loanStatus) return 0;
    const borrowAmount = parseFloat(amount);
    const newBorrowedTotal = loanStatus.borrowedAmount + borrowAmount;
    const collateralValue = (loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000;
    return (newBorrowedTotal / collateralValue) * 100;
  };


  const getRiskText = (ltv: number) => {
    if (ltv >= 90) return 'HIGH RISK';
    if (ltv >= 85) return 'MEDIUM RISK';
    return 'LOW RISK';
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
    await handleBorrowFunds();
    setIsConfirmDetailsModalOpen(false);
  };

  const handleBorrowFunds = async () => {
    try {
      setLoading(true);
      
      // Borrow funds
      await sendMessage('user.borrow-funds', { amount: parseFloat(amount) });
      
      // Update balance
      await updateBalance();
      
      onSuccess();
    } catch (error: any) {
      // Error handling is done through validation in the modal
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      onClose();
    }
  };

  const getMaxAmount = () => {
    return loanStatus?.availableCapacity || 0;
  };

  if (!isOpen || !loanStatus) return null;

  return createPortal(
    <>
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleClose}
        title="Borrow Funds"
        type="inr"
        maxValue={getMaxAmount()}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          if (numValue <= 0) return 'Amount must be greater than 0';
          if (numValue > getMaxAmount()) return 'Amount exceeds available borrowing capacity';
          
          return null;
        }}
      />

      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title="Confirm Borrow"
        amount={amount}
        amountType="inr"
        details={[
          {
            label: 'Amount to Borrow',
            value: formatCurrencyInr(parseFloat(amount || '0')),
            highlight: true
          },
          {
            label: 'Current Borrowed',
            value: formatCurrencyInr(loanStatus.borrowedAmount),
            highlight: false
          },
          {
            label: 'New Total Debt',
            value: formatCurrencyInr(loanStatus.borrowedAmount + parseFloat(amount || '0')),
            highlight: true
          },
          {
            label: 'Current LTV',
            value: `${loanStatus.currentLtv.toFixed(1)}%`,
            highlight: false
          },
          {
            label: 'New LTV',
            value: `${calculateNewLtv().toFixed(1)}% (${getRiskText(calculateNewLtv())})`,
            highlight: true
          },
          {
            label: 'Available Capacity',
            value: formatCurrencyInr(loanStatus.availableCapacity),
            highlight: false
          },
          {
            label: 'Remaining Capacity',
            value: formatCurrencyInr(loanStatus.availableCapacity - parseFloat(amount || '0')),
            highlight: true
          },
          {
            label: 'Interest Rate',
            value: `${loanStatus.interestRate}% APR`,
            highlight: false
          },
          {
            label: 'Risk Level',
            value: getRiskText(calculateNewLtv()),
            highlight: calculateNewLtv() >= 85
          }
        ]}
        confirmText="Confirm Borrow"
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={loading}
      />
    </>,
    document.body
  );
};

export default BorrowModal;
