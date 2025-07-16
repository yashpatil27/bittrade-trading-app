import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useBalance } from '../contexts/BalanceContext';
import { formatBitcoin, formatCurrencyInr } from '../utils/formatters';
import { Balances, Prices } from '../types';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';

interface DepositCollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances?: Balances | null;
  prices?: Prices | null;
}

const DepositCollateralModal: React.FC<DepositCollateralModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  balances,
  prices
}) => {
  const [amount, setAmount] = useState('');
  const [realtimeBalances, setRealtimeBalances] = useState<Balances | null>(balances || null);
  const [realtimePrices, setRealtimePrices] = useState<Prices | null>(prices || null);
  const [interestRate, setInterestRate] = useState(15);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updateBalance } = useBalance();
  const { sendMessage, on, off } = useWebSocket();

  // Modal flow control
  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
      // Initialize real-time data with props
      setRealtimeBalances(balances || null);
      setRealtimePrices(prices || null);
      fetchSettings();
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setAmount('');
    }
  }, [isOpen]);

  // Separate effect to update real-time data when props change (without resetting modal state)
  useEffect(() => {
    if (isOpen) {
      setRealtimeBalances(balances || null);
      setRealtimePrices(prices || null);
    }
  }, [isOpen, balances, prices]);

  // Real-time event listeners for balance and price updates
  useEffect(() => {
    if (!isOpen) return;

    // Handle balance updates
    const handleBalanceUpdate = (data: any) => {
      if (data?.balances) {
        setRealtimeBalances(data.balances);
      }
    };

    // Handle price updates
    const handlePriceUpdate = (data: any) => {
      if (data?.sell_rate !== undefined || data?.buy_rate !== undefined) {
        setRealtimePrices(prev => ({
          btc_usd: prev?.btc_usd ?? 0,
          sell_rate: data.sell_rate ?? prev?.sell_rate ?? 0,
          buy_rate: data.buy_rate ?? prev?.buy_rate ?? 0,
          buy_multiplier: prev?.buy_multiplier,
          sell_multiplier: prev?.sell_multiplier,
          last_update: prev?.last_update
        }));
      }
    };

    // Handle settings updates (for interest rate)
    const handleSettingsUpdate = (data: any) => {
      if (data?.loan_interest_rate !== undefined) {
        setInterestRate(data.loan_interest_rate);
      }
    };

    // Subscribe to WebSocket events
    on('balance_update', handleBalanceUpdate);
    on('price_update', handlePriceUpdate);
    on('settings_update', handleSettingsUpdate);

    // Cleanup event listeners when modal closes or component unmounts
    return () => {
      off('balance_update', handleBalanceUpdate);
      off('price_update', handlePriceUpdate);
      off('settings_update', handleSettingsUpdate);
    };
  }, [isOpen, on, off]);

  const fetchSettings = async () => {
    try {
      const settingsResponse = await sendMessage('admin.get-settings');
      setInterestRate(settingsResponse?.loan_interest_rate || 15);
    } catch (error) {
      // Fallback to default interest rate if settings fetch fails
      setInterestRate(15);
    }
  };

  const calculateMaxBorrowable = () => {
    if (!amount || !realtimePrices?.sell_rate) return 0;
    const btcAmount = parseFloat(amount);
    const collateralValue = btcAmount * realtimePrices.sell_rate;
    return Math.floor(collateralValue * 0.6); // 60% LTV
  };

  const calculateLiquidationPrice = () => {
    if (!realtimePrices?.sell_rate) return 0;
    return Math.floor(realtimePrices.sell_rate * (60 / 90)); // 90% LTV triggers liquidation
  };

  const getCollateralValue = () => {
    if (!amount || !realtimePrices?.sell_rate) return 0;
    return parseFloat(amount) * realtimePrices.sell_rate;
  };


  const handleDepositCollateral = async () => {
    try {
      setLoading(true);
      
      // Convert BTC to satoshis
      const satoshiAmount = Math.floor(parseFloat(amount) * 100000000);
      
      // Deposit collateral
      await sendMessage('user.deposit-collateral', { satoshiAmount });
      
      // Update balance
      await updateBalance();
      
      onSuccess();
    } catch (error: any) {
      // Error handling is done through validation in the modal
    } finally {
      setLoading(false);
    }
  };

  const getMaxAmount = () => {
    return realtimeBalances?.btc || 0;
  };

  const getAvailableBalance = () => {
    return realtimeBalances?.btc || 0;
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
    await handleDepositCollateral();
  };

  const handleModalClose = () => {
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Single Input Modal */}
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleModalClose}
        title="Deposit Collateral"
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

      {/* Confirm Details Modal */}
      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title="Confirm Collateral Deposit"
        amount={amount}
        amountType="btc"
        details={[
          {
            label: 'Bitcoin Amount',
            value: `₿${formatBitcoin(parseFloat(amount || '0'))}`,
            highlight: true
          },
          {
            label: 'Collateral Value',
            value: formatCurrencyInr(getCollateralValue()),
            highlight: false
          },
          {
            label: 'Max Borrowable (60% LTV)',
            value: formatCurrencyInr(calculateMaxBorrowable()),
            highlight: false
          },
          {
            label: 'Interest Rate',
            value: `${interestRate}% APR`,
            highlight: false
          },
          {
            label: 'Liquidation Price',
            value: `${formatCurrencyInr(calculateLiquidationPrice())} per BTC`,
            highlight: true
          },
          {
            label: 'Remaining Balance',
            value: `₿${formatBitcoin(getAvailableBalance() - parseFloat(amount || '0'))}`,
            highlight: false
          }
        ]}
        confirmText="Confirm Deposit"
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={loading}
      />
    </>,
    document.body
  );
};

export default DepositCollateralModal;
