import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { Balances, Prices } from '../types';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { formatCurrencyInr } from '../utils/formatters';
import { useBalance } from '../contexts/BalanceContext';

interface TradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  balances: Balances | null;
  prices: Prices | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const TradingModal: React.FC<TradingModalProps> = ({
  isOpen,
  onClose,
  type,
  balances,
  prices,
  onSuccess,
  onError
}) => {
  const { refreshBalance } = useBalance();
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setInputAmount('');
      setIsLoading(false);
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setInputAmount('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleTrade = async (amount: number) => {
    setIsLoading(true);
    
    try {
      if (type === 'buy') {
        await userAPI.buyBitcoin({ amount });
        onSuccess();
        onClose();
      } else {
        await userAPI.sellBitcoin({ amount });
        onSuccess();
        onClose();
      }
      
      // Refresh balance in the context
      refreshBalance();
    } catch (error: any) {
      onError(error.response?.data?.message || `Failed to ${type} Bitcoin`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleInputConfirm = async (value: string) => {
    setInputAmount(value);
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(true);
  };

  const handleConfirmDetailsClose = () => {
    setIsConfirmDetailsModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  const handleConfirmDetailsConfirm = async () => {
    setIsConfirmDetailsModalOpen(false);
    await handleTrade(parseFloat(inputAmount));
  };

  const handleModalClose = () => {
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(false);
    onClose();
  };

  return (
    <>
      {/* Single Input Modal */}
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleModalClose}
        title={type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin'}
        type={type === 'buy' ? 'inr' : 'btc'}
        maxValue={type === 'buy' ? (balances?.inr || 0) : (balances?.btc || 0)}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          // Allow empty string or strings ending with decimal point during typing
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          
          // Allow very small positive numbers (like 0.000056) for BTC
          if (numValue < 0) return 'Amount must be greater than or equal to 0';
          
          // For BTC, allow very small amounts (minimum 0.00000001 = 1 satoshi)
          // Only apply minimum validation if the value is greater than 0 (allow 0 during typing)
          if (type === 'sell' && numValue > 0 && numValue < 0.00000001) {
            return 'Minimum amount is 0.00000001 BTC';
          }
          
          // For INR, minimum 1 rupee
          if (type === 'buy' && numValue < 1) {
            return 'Minimum amount is ₹1';
          }
          
          const maxValue = type === 'buy' ? (balances?.inr || 0) : (balances?.btc || 0);
          if (numValue > maxValue) return 'Insufficient balance';
          
          return null;
        }}
        sectionTitle="Market Rate"
        sectionDetail="Price per Bitcoin"
        sectionAmount={type === 'buy' ? 
          formatCurrencyInr(prices?.buy_rate || 0) : 
          formatCurrencyInr(prices?.sell_rate || 0)
        }
      />

      {/* Confirm Details Modal */}
      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title={type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin'}
        amount={inputAmount}
        amountType={type === 'buy' ? 'inr' : 'btc'}
        subAmount={type === 'buy' && prices ? 
          (parseFloat(inputAmount || '0') / (prices.buy_rate || 1)).toFixed(8) : 
          type === 'sell' && prices ? 
          (parseFloat(inputAmount || '0') * (prices.sell_rate || 1)).toFixed(2) : undefined
        }
        subAmountType={type === 'buy' ? 'btc' : 'inr'}
        details={[
          {
            label: 'Bitcoin Price',
            value: type === 'buy' ? 
              formatCurrencyInr(prices?.buy_rate || 0) : 
              formatCurrencyInr(prices?.sell_rate || 0),
            highlight: false
          },
          {
            label: type === 'buy' ? '₹ Amount' : '₿ Amount',
            value: type === 'buy' ? 
              formatCurrencyInr(parseFloat(inputAmount || '0')) : 
              `₿${parseFloat(inputAmount || '0').toFixed(8)}`,
            highlight: false
          },
          {
            label: type === 'buy' ? '₿ Amount' : '₹ Amount',
            value: type === 'buy' ? 
              `₿${(parseFloat(inputAmount || '0') / (prices?.buy_rate || 1)).toFixed(8)}` : 
              formatCurrencyInr(parseFloat(inputAmount || '0') * (prices?.sell_rate || 1)),
            highlight: false
          }
        ]}
        confirmText={type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin'}
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={isLoading}
      />
    </>
  );
};

export default TradingModal;
