import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { LoanStatus, Balances } from '../types';
import { formatBitcoin, formatCurrencyInr } from '../utils/formatters';
import { useBalance } from '../contexts/BalanceContext';

interface AddCollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  balances?: Balances | null;
  onSuccess: () => void;
}

const AddCollateralModal: React.FC<AddCollateralModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  balances,
  onSuccess
}) => {
  const [collateralAmount, setCollateralAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const [realtimeBalances, setRealtimeBalances] = useState<Balances | null>(balances || null);
  const { updateBalance } = useBalance();
  const { sendMessage, on, off } = useWebSocket();

  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setCollateralAmount('');
      // Initialize real-time data with props
      setRealtimeBalances(balances || null);
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setCollateralAmount('');
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



  const handleSingleInputConfirm = async (value: string) => {
    setCollateralAmount(value);
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(true);
  };

  const handleConfirmDetailsClose = () => {
    setIsConfirmDetailsModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  const handleConfirmDetailsConfirm = async () => {
    await handleAddCollateral();
    setIsConfirmDetailsModalOpen(false);
  };

  const handleAddCollateral = async () => {
    try {
      setLoading(true);
      
      // Add collateral
      await sendMessage('user.add-collateral', { btcAmount: parseFloat(collateralAmount) });
      
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
      setCollateralAmount('');
      onClose();
    }
  };

  const getMaxAmount = () => {
    return realtimeBalances?.btc || 0;
  };

  const calculateNewMetrics = () => {
    if (!loanStatus || !collateralAmount) return null;

    const additionalBtc = parseFloat(collateralAmount);
    const currentBtc = loanStatus.collateralAmount / 100000000;
    const newTotalBtc = currentBtc + additionalBtc;
    
    // Calculate new max borrowable (60% LTV)
    const newMaxBorrowable = Math.floor((newTotalBtc * loanStatus.currentBtcPrice * 60) / 100);
    const newAvailableCapacity = newMaxBorrowable - loanStatus.borrowedAmount;
    
    // Calculate new LTV
    const newCurrentLtv = (loanStatus.borrowedAmount / (newTotalBtc * loanStatus.currentBtcPrice)) * 100;
    
    return {
      newTotalBtc,
      newMaxBorrowable,
      newAvailableCapacity,
      newCurrentLtv
    };
  };

  if (!isOpen) return null;

  const newMetrics = calculateNewMetrics();

  return createPortal(
    <>
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleClose}
        title="Add Collateral"
        type="btc"
        maxValue={getMaxAmount()}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          if (numValue <= 0) return 'Amount must be greater than 0';
          if (numValue > getMaxAmount()) return 'Insufficient Bitcoin balance';
          
          return null;
        }}
      />

      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title="Confirm Collateral Addition"
        amount={collateralAmount}
        amountType="btc"
        details={[
          {
            label: 'Bitcoin Amount',
            value: `₿${formatBitcoin(parseFloat(collateralAmount || '0'))}`,
            highlight: true
          },
          {
            label: 'Current Collateral',
            value: `₿${formatBitcoin((loanStatus?.collateralAmount || 0) / 100000000)}`,
            highlight: false
          },
          {
            label: 'New Total Collateral',
            value: `₿${formatBitcoin(newMetrics?.newTotalBtc || 0)}`,
            highlight: true
          },
          {
            label: 'Current LTV',
            value: `${loanStatus?.currentLtv.toFixed(1) || 0}%`,
            highlight: false
          },
          {
            label: 'New LTV',
            value: `${newMetrics?.newCurrentLtv.toFixed(1) || 0}%`,
            highlight: true
          },
          {
            label: 'Borrowed Amount',
            value: formatCurrencyInr(loanStatus?.borrowedAmount || 0),
            highlight: false
          },
          {
            label: 'New Max Borrowable',
            value: formatCurrencyInr(newMetrics?.newMaxBorrowable || 0),
            highlight: false
          },
          {
            label: 'New Available to Borrow',
            value: formatCurrencyInr(newMetrics?.newAvailableCapacity || 0),
            highlight: true
          }
        ]}
        confirmText="Confirm Addition"
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={loading}
      />
    </>,
    document.body
  );
};

export default AddCollateralModal;
