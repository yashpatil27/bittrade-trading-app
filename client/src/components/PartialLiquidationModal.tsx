import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { LoanStatus } from '../types';
import { formatBitcoin, formatCurrencyInr } from '../utils/formatters';

interface PartialLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  onSuccess: () => void;
}

const PartialLiquidationModal: React.FC<PartialLiquidationModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  onSuccess
}) => {
  const [btcAmount, setBtcAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const { sendMessage, on, off } = useWebSocket();
  const [currentBtcPrice, setCurrentBtcPrice] = useState(loanStatus?.currentBtcPrice || 0);

  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setBtcAmount('');
      setCurrentBtcPrice(loanStatus?.currentBtcPrice || 0);
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setBtcAmount('');
    }
  }, [isOpen, loanStatus]);

  // Real-time event listeners for price updates
  useEffect(() => {
    if (!isOpen) return;

    // Handle price updates
    const handlePriceUpdate = (data: any) => {
      if (data?.sell_rate !== undefined) {
        setCurrentBtcPrice(data.sell_rate);
      }
    };

    // Subscribe to WebSocket events
    on('price_update', handlePriceUpdate);

    // Cleanup event listeners when modal closes or component unmounts
    return () => {
      off('price_update', handlePriceUpdate);
    };
  }, [isOpen, on, off]);

  const getTotalDue = () => {
    if (!loanStatus) return 0;
    return loanStatus.borrowedAmount + (loanStatus.minimumInterestDue || 0);
  };

  const handleSingleInputConfirm = async (value: string) => {
    setBtcAmount(value);
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(true);
  };

  const handleConfirmDetailsClose = () => {
    setIsConfirmDetailsModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  const handleConfirmDetailsConfirm = async () => {
    await handleLiquidation();
    setIsConfirmDetailsModalOpen(false);
  };

  const handleLiquidation = async () => {
    try {
      setLoading(true);

      // Execute partial liquidation
      await sendMessage('user.partial-liquidation', { amount: parseFloat(btcAmount) });

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
    if (!loanStatus) return 0;
    
    // Use current BTC price, fallback to loanStatus price if currentBtcPrice is 0
    const btcPrice = currentBtcPrice || loanStatus.currentBtcPrice;
    
    if (!btcPrice) return 0;
    
    // Calculate the Bitcoin amount needed to repay the total debt
    const totalDue = getTotalDue();
    const btcNeededToRepayDebt = totalDue / btcPrice;
    const availableCollateral = loanStatus.collateralAmount / 100000000;
    
    // Return the minimum of debt-based requirement and available collateral, rounded to 8 decimal places
    const maxAmount = Math.min(btcNeededToRepayDebt, availableCollateral);
    return parseFloat(maxAmount.toFixed(8));
  };

  if (!isOpen || !loanStatus) return null;

  return createPortal(
    <>
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleClose}
        title="Partial Liquidation"
        type="btc"
        maxValue={getMaxAmount()}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          if (value === '' || value === '.' || value.endsWith('.')) return null;

          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          if (numValue <= 0) return 'Amount must be greater than 0';
          if (numValue > getMaxAmount()) return 'Amount exceeds available collateral';

          return null;
        }}
      />

      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title="Confirm Partial Liquidation"
        amount={btcAmount}
        amountType="btc"
        details={[
          {
            label: 'Bitcoin Amount',
            value: `₿${formatBitcoin(parseFloat(btcAmount || '0'))}`,
            highlight: true
          },
          {
            label: 'Est. ₹ Proceeds',
            value: formatCurrencyInr(Math.round(parseFloat(btcAmount || '0') * (currentBtcPrice || loanStatus.currentBtcPrice))),
            highlight: false
          },
          {
            label: 'Remaining Collateral',
            value: `₿${formatBitcoin((loanStatus.collateralAmount / 100000000) - parseFloat(btcAmount || '0'))}`,
            highlight: false
          },
          {
            label: 'Remaining Debt',
            value: formatCurrencyInr(Math.round(Math.max(0, getTotalDue() - (parseFloat(btcAmount || '0') * (currentBtcPrice || loanStatus.currentBtcPrice))))),
            highlight: true
          },
          {
            label: 'Total Due',
            value: formatCurrencyInr(getTotalDue()),
            highlight: false
          },
          {
            label: 'Current BTC Price',
            value: formatCurrencyInr(currentBtcPrice || loanStatus.currentBtcPrice),
            highlight: false
          },
          {
            label: 'Important Note',
            value: parseFloat(btcAmount || '0') === 0 ? 
              'Liquidate part of your collateral to reduce debt and improve your position. Total debt includes principal + 30-day minimum interest.' :
              'Bitcoin will be sold at current market price to reduce your loan debt. The proceeds will be applied to your total outstanding balance (principal + interest).',
            highlight: false
          }
        ]}
        confirmText="Confirm Liquidation"
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={loading}
      />
    </>,
    document.body
  );
};

export default PartialLiquidationModal;
