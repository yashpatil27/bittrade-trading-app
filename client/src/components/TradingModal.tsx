import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
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
  const { sendMessage, on, off } = useWebSocket();
  const [realtimeBalances, setRealtimeBalances] = useState<Balances | null>(balances);
  const [realtimePrices, setRealtimePrices] = useState<Prices | null>(prices);
  const [isSingleInputModalOpen, setIsSingleInputModalOpen] = useState(false);
  const [isConfirmDetailsModalOpen, setIsConfirmDetailsModalOpen] = useState(false);
  const [isTargetPriceModalOpen, setIsTargetPriceModalOpen] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [isLimitOrder, setIsLimitOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSingleInputModalOpen(true);
      setIsConfirmDetailsModalOpen(false);
      setIsTargetPriceModalOpen(false);
      setInputAmount('');
      setTargetPrice('');
      setIsLimitOrder(false);
      setIsLoading(false);
      // Initialize real-time data with props
      setRealtimeBalances(balances);
      setRealtimePrices(prices);
    } else {
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setIsTargetPriceModalOpen(false);
      setInputAmount('');
      setTargetPrice('');
      setIsLimitOrder(false);
      setIsLoading(false);
    }
  }, [isOpen]); // Remove balances and prices from dependency array

  // Separate effect to update real-time data when props change (without resetting modal state)
  useEffect(() => {
    if (isOpen) {
      setRealtimeBalances(balances);
      setRealtimePrices(prices);
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
      if (data?.buy_rate !== undefined || data?.sell_rate !== undefined) {
        setRealtimePrices(prev => ({
          ...prev,
          buy_rate: data.buy_rate || prev?.buy_rate || 0,
          sell_rate: data.sell_rate || prev?.sell_rate || 0,
          btc_usd: data.btc_usd || prev?.btc_usd || 0,
          last_update: data.last_update || prev?.last_update || new Date().toISOString()
        }));
      }
    };

    // Subscribe to WebSocket events
    on('balance_update', handleBalanceUpdate);
    on('price_update', handlePriceUpdate);

    // Cleanup event listeners when modal closes or component unmounts
    return () => {
      off('balance_update', handleBalanceUpdate);
      off('price_update', handlePriceUpdate);
    };
  }, [isOpen, on, off]);

  const handleTrade = async (amount: number) => {
    setIsLoading(true);
    
    try {
      if (isLimitOrder) {
        // Limit order
        const targetPriceNum = parseFloat(targetPrice);
        if (type === 'buy') {
          await sendMessage('user.limit-buy', { amount: amount, targetPrice: targetPriceNum });
          onSuccess();
          onClose();
        } else {
          await sendMessage('user.limit-sell', { amount: amount, targetPrice: targetPriceNum });
          onSuccess();
          onClose();
        }
      } else {
        // Market order
        if (type === 'buy') {
          await sendMessage('user.buy', { amount });
          onSuccess();
          onClose();
        } else {
          await sendMessage('user.sell', { amount });
          onSuccess();
          onClose();
        }
      }
      
      // Refresh balance in the context
      refreshBalance();
    } catch (error: any) {
      onError(error.message || `Failed to ${isLimitOrder ? 'place limit order' : type + ' Bitcoin'}`);
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
    setIsTargetPriceModalOpen(false);
    onClose();
  };

  const handleSectionClick = () => {
    // Open target price modal when section is clicked
    setIsSingleInputModalOpen(false);
    setIsTargetPriceModalOpen(true);
  };

  const handleTargetPriceConfirm = (value: string) => {
    setTargetPrice(value);
    setIsLimitOrder(true);
    setIsTargetPriceModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  const handleTargetPriceClose = () => {
    setIsTargetPriceModalOpen(false);
    setIsSingleInputModalOpen(true);
  };

  return (
    <>
      {/* Single Input Modal */}
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleModalClose}
        title={type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin'}
        type={type === 'buy' ? 'inr' : 'btc'}
        maxValue={type === 'buy' ? (realtimeBalances?.inr || 0) : (realtimeBalances?.btc || 0)}
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
          
          const maxValue = type === 'buy' ? (realtimeBalances?.inr || 0) : (realtimeBalances?.btc || 0);
          if (numValue > maxValue) return 'Insufficient balance';
          
          return null;
        }}
        sectionTitle={isLimitOrder ? 'Target Price' : 'Market Rate'}
        sectionDetail={isLimitOrder ? 'Your limit order price' : 'Tap to set target price'}
        sectionAmount={isLimitOrder ? 
          formatCurrencyInr(parseFloat(targetPrice || '0')) : 
          (type === 'buy' ? 
            formatCurrencyInr(realtimePrices?.buy_rate || 0) : 
            formatCurrencyInr(realtimePrices?.sell_rate || 0))
        }
        onSectionClick={handleSectionClick}
      />

      {/* Target Price Modal */}
      <SingleInputModal
        isOpen={isTargetPriceModalOpen}
        onClose={handleTargetPriceClose}
        title="Set Target Price"
        type="inr"
        confirmText="Set Price"
        onConfirm={handleTargetPriceConfirm}
        validation={(value) => {
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          
          if (numValue < 0) return 'Price must be greater than or equal to 0';
          if (numValue < 1) return 'Minimum price is ₹1';
          
          return null;
        }}
        sectionTitle="Current Market Rate"
        sectionDetail="Current Bitcoin price"
        sectionAmount={type === 'buy' ? 
          formatCurrencyInr(realtimePrices?.buy_rate || 0) : 
          formatCurrencyInr(realtimePrices?.sell_rate || 0)
        }
      />

      {/* Confirm Details Modal */}
      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title={isLimitOrder ? 
          (type === 'buy' ? 'Limit Buy Order' : 'Limit Sell Order') : 
          (type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin')
        }
        amount={inputAmount}
        amountType={type === 'buy' ? 'inr' : 'btc'}
        subAmount={isLimitOrder ? 
          (type === 'buy' ? 
            (parseFloat(inputAmount || '0') / parseFloat(targetPrice || '1')).toFixed(8) : 
            (parseFloat(inputAmount || '0') * parseFloat(targetPrice || '0')).toFixed(2)) : 
          (type === 'buy' && realtimePrices ? 
            (parseFloat(inputAmount || '0') / (realtimePrices.buy_rate || 1)).toFixed(8) : 
            type === 'sell' && realtimePrices ? 
            (parseFloat(inputAmount || '0') * (realtimePrices.sell_rate || 1)).toFixed(2) : undefined)
        }
        subAmountType={type === 'buy' ? 'btc' : 'inr'}
        details={[
          {
            label: isLimitOrder ? 'Order Type' : 'Order Type',
            value: isLimitOrder ? 'Limit Order' : 'Market Order',
            highlight: true
          },
          {
            label: isLimitOrder ? 'Target Price' : 'Current Price',
            value: isLimitOrder ? 
              formatCurrencyInr(parseFloat(targetPrice || '0')) : 
              (type === 'buy' ? 
                formatCurrencyInr(realtimePrices?.buy_rate || 0) : 
                formatCurrencyInr(realtimePrices?.sell_rate || 0)),
            highlight: isLimitOrder
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
            value: isLimitOrder ? 
              (type === 'buy' ? 
                `₿${(parseFloat(inputAmount || '0') / parseFloat(targetPrice || '1')).toFixed(8)}` : 
                formatCurrencyInr(parseFloat(inputAmount || '0') * parseFloat(targetPrice || '0'))) : 
              (type === 'buy' ? 
                `₿${(parseFloat(inputAmount || '0') / (realtimePrices?.buy_rate || 1)).toFixed(8)}` : 
                formatCurrencyInr(parseFloat(inputAmount || '0') * (realtimePrices?.sell_rate || 1))),
            highlight: false
          }
        ]}
        confirmText={isLimitOrder ? 
          (type === 'buy' ? 'Place Limit Buy' : 'Place Limit Sell') : 
          (type === 'buy' ? 'Buy Bitcoin' : 'Sell Bitcoin')
        }
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={isLoading}
      />
    </>
  );
};

export default TradingModal;
