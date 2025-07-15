import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { Balances, Prices } from '../types';
import SingleInputModal from './SingleInputModal';
import ConfirmDetailsModal from './ConfirmDetailsModal';
import { formatCurrencyInr } from '../utils/formatters';
import { useBalance } from '../contexts/BalanceContext';
import { Clock, Calendar, Zap, RotateCcw } from 'lucide-react';

interface DcaPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  balances: Balances | null;
  prices: Prices | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const DcaPlanModal: React.FC<DcaPlanModalProps> = ({
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
  const [selectedFrequency, setSelectedFrequency] = useState<'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Only reset if we're actually opening the modal for the first time
      if (!isSingleInputModalOpen && !isConfirmDetailsModalOpen) {
        setIsSingleInputModalOpen(true);
        setIsConfirmDetailsModalOpen(false);
        setInputAmount('');
        setSelectedFrequency('DAILY');
        setIsLoading(false);
      }
    } else {
      // Only reset when truly closing the modal
      setIsSingleInputModalOpen(false);
      setIsConfirmDetailsModalOpen(false);
      setInputAmount('');
      setSelectedFrequency('DAILY');
      setIsLoading(false);
    }
  }, [isOpen, isSingleInputModalOpen, isConfirmDetailsModalOpen]);

  const handleCreateDcaPlan = async (amount: number, frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    setIsLoading(true);
    
    try {
      const dcaData = {
        amountPerExecution: amount,
        frequency
      };

      if (type === 'buy') {
        await userAPI.createDcaBuyPlan(dcaData);
        onSuccess();
        onClose();
      } else {
        await userAPI.createDcaSellPlan(dcaData);
        onSuccess();
        onClose();
      }
      
      // Refresh balance in the context
      refreshBalance();
    } catch (error: any) {
      onError(error.response?.data?.message || `Failed to create DCA ${type} plan`);
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
    await handleCreateDcaPlan(parseFloat(inputAmount), selectedFrequency);
  };

  const handleModalClose = () => {
    setIsSingleInputModalOpen(false);
    setIsConfirmDetailsModalOpen(false);
    onClose();
  };

  const handleFrequencySelect = (frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    setSelectedFrequency(frequency);
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency) {
      case 'HOURLY':
        return <Clock className="w-4 h-4" />;
      case 'DAILY':
        return <Calendar className="w-4 h-4" />;
      case 'WEEKLY':
        return <RotateCcw className="w-4 h-4" />;
      case 'MONTHLY':
        return <Zap className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getFrequencyDescription = (frequency: string) => {
    switch (frequency) {
      case 'HOURLY':
        return 'Execute every hour';
      case 'DAILY':
        return 'Execute once per day';
      case 'WEEKLY':
        return 'Execute once per week';
      case 'MONTHLY':
        return 'Execute once per month';
      default:
        return 'Execute once per day';
    }
  };

  return (
    <>
      {/* Single Input Modal */}
      <SingleInputModal
        isOpen={isSingleInputModalOpen}
        onClose={handleModalClose}
        title={`Create DCA ${type === 'buy' ? 'Buy' : 'Sell'} Plan`}
        type={type === 'buy' ? 'inr' : 'btc'}
        maxValue={type === 'buy' ? (balances?.inr || 0) : (balances?.btc || 0)}
        confirmText="Next"
        onConfirm={handleSingleInputConfirm}
        validation={(value) => {
          // Allow empty string or strings ending with decimal point during typing
          if (value === '' || value === '.' || value.endsWith('.')) return null;
          
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return 'Please enter a valid number';
          
          if (numValue < 0) return 'Amount must be greater than or equal to 0';
          
          // For BTC, allow very small amounts (minimum 0.00000001 = 1 satoshi)
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
        tabSwitcher={
          <div className="bg-zinc-900 p-1 rounded-2xl flex gap-1">
            {(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((frequency) => {
              const displayName = frequency.charAt(0) + frequency.slice(1).toLowerCase();
              return (
                <button
                  key={frequency}
                  onClick={() => handleFrequencySelect(frequency)}
                  className={`flex-1 px-3 py-2 rounded-xl transition-all duration-200 text-xs font-medium ${
                    selectedFrequency === frequency
                      ? 'bg-white text-black shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Confirm Details Modal */}
      <ConfirmDetailsModal
        isOpen={isConfirmDetailsModalOpen}
        onClose={handleConfirmDetailsClose}
        title={`Create DCA ${type === 'buy' ? 'Buy' : 'Sell'} Plan`}
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
            label: 'Plan Type',
            value: `DCA ${type === 'buy' ? 'Buy' : 'Sell'} Plan`,
            highlight: true
          },
          {
            label: 'Frequency',
            value: selectedFrequency,
            highlight: true
          },
          {
            label: 'Amount per Execution',
            value: type === 'buy' ? 
              formatCurrencyInr(parseFloat(inputAmount || '0')) : 
              `₿${parseFloat(inputAmount || '0').toFixed(8)}`,
            highlight: false
          },
          {
            label: 'Estimated per Execution',
            value: type === 'buy' ? 
              `₿${(parseFloat(inputAmount || '0') / (prices?.buy_rate || 1)).toFixed(8)}` : 
              formatCurrencyInr(parseFloat(inputAmount || '0') * (prices?.sell_rate || 1)),
            highlight: false
          },
          {
            label: 'Current Price',
            value: type === 'buy' ? 
              formatCurrencyInr(prices?.buy_rate || 0) : 
              formatCurrencyInr(prices?.sell_rate || 0),
            highlight: false
          },
          {
            label: 'Description',
            value: getFrequencyDescription(selectedFrequency),
            highlight: false
          }
        ]}
        confirmText={`Create DCA ${type === 'buy' ? 'Buy' : 'Sell'} Plan`}
        onConfirm={handleConfirmDetailsConfirm}
        isLoading={isLoading}
      />

    </>
  );
};

export default DcaPlanModal;
