import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Calculator, Zap } from 'lucide-react';
import { Prices } from '../types';
import { userAPI } from '../services/api';
import PinConfirmationModal from './PinConfirmationModal';

interface TradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  prices: Prices | null;
  userBalance: { inr: number; btc: number };
  onTrade: (amount: number) => Promise<void>;
  isLoading: boolean;
}

const TradingModal: React.FC<TradingModalProps> = ({
  isOpen,
  onClose,
  type,
  prices,
  userBalance,
  onTrade,
  isLoading
}) => {
  const [amount, setAmount] = useState('');
  const [estimation, setEstimation] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number>(0);

  const isBuy = type === 'buy';
  const rate = isBuy ? prices?.buy_rate : prices?.sell_rate;
  const availableBalance = isBuy ? userBalance.inr : userBalance.btc;

  useEffect(() => {
    if (amount && rate) {
      if (isBuy) {
        // Buying BTC with INR
        const btcAmount = parseFloat(amount) / rate;
        setEstimation(btcAmount);
      } else {
        // Selling BTC for INR
        const inrAmount = parseFloat(amount) * rate;
        setEstimation(inrAmount);
      }
    } else {
      setEstimation(0);
    }
  }, [amount, rate, isBuy]);

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    // Store the amount and open PIN confirmation
    setPendingAmount(parseFloat(amount));
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN
      const response = await userAPI.verifyPin(pin);
      if (response.data.data?.valid) {
        // PIN is correct, proceed with trade
        await onTrade(pendingAmount);
        setAmount('');
        setPendingAmount(0);
        setIsPinModalOpen(false);
        onClose();
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
    setPendingAmount(0);
  };

  const getMaxAmount = () => {
    if (isBuy) {
      return Math.floor(availableBalance).toString();
    } else {
      return availableBalance.toFixed(8);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-2xl border border-zinc-800 p-6 mx-4 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              {isBuy ? (
                <TrendingUp className="w-6 h-6 text-white" />
              ) : (
                <TrendingDown className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isBuy ? 'Buy Bitcoin' : 'Sell Bitcoin'}
              </h2>
              <p className="text-sm text-zinc-400">
                Rate: ₹{rate?.toLocaleString('en-IN')}/BTC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Display */}
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Available Balance:</span>
            <span className="font-medium">
              {isBuy ? (
                `₹${availableBalance.toLocaleString('en-IN')}`
              ) : (
                `${availableBalance.toFixed(8)} BTC`
              )}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {isBuy ? 'Amount to Spend (INR)' : 'Amount to Sell (BTC)'}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder={isBuy ? "1000" : "0.001"}
              step={isBuy ? "100" : "0.00000001"}
              min="0"
              max={getMaxAmount()}
            />
          </div>
          
          {/* Percentage Quick Select Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setAmount((availableBalance * 0.25).toFixed(isBuy ? 0 : 8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              25%
            </button>
            <button
              onClick={() => setAmount((availableBalance * 0.5).toFixed(isBuy ? 0 : 8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              50%
            </button>
            <button
              onClick={() => setAmount((availableBalance * 0.75).toFixed(isBuy ? 0 : 8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              75%
            </button>
            <button
              onClick={() => setAmount(getMaxAmount())}
              className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Estimation Display */}
        {amount && estimation > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">
                You'll receive approximately:
              </span>
            </div>
            <div className="text-2xl font-bold">
              {isBuy ? (
                `₿ ${estimation.toFixed(8)}`
              ) : (
                `₹${Math.floor(estimation).toLocaleString('en-IN')}`
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isLoading || parseFloat(amount) > availableBalance}
            className="flex-1 font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {isBuy ? 'Buy Bitcoin' : 'Sell Bitcoin'}
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title={`Confirm ${isBuy ? 'Buy' : 'Sell'} Order`}
        message={`Enter your PIN to confirm ${isBuy ? 'purchasing' : 'selling'} ${isBuy ? '₹' + pendingAmount.toLocaleString('en-IN') + ' worth of Bitcoin' : pendingAmount.toFixed(8) + ' BTC'}`}
        isLoading={isLoading}
      />
    </div>
  );
};

export default TradingModal;
