import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Calculator, Zap, Target, Clock } from 'lucide-react';
import { Prices } from '../types';
import { userAPI } from '../services/api';
import PinConfirmationModal from './PinConfirmationModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  prices: Prices | null;
  userBalance: { inr: number; btc: number };
  onTrade: (amount: number, targetPrice?: number) => Promise<void>;
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
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [estimation, setEstimation] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [pendingTargetPrice, setPendingTargetPrice] = useState<number | undefined>(undefined);

  const isBuy = type === 'buy';
  const rate = isBuy ? prices?.buy_rate : prices?.sell_rate;
  const availableBalance = isBuy ? userBalance.inr : userBalance.btc;

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (amount) {
      const effectiveRate = orderType === 'limit' && targetPrice ? parseFloat(targetPrice) : rate;
      
      if (effectiveRate) {
        if (isBuy) {
          // Buying BTC with INR
          const btcAmount = parseFloat(amount) / effectiveRate;
          setEstimation(btcAmount);
        } else {
          // Selling BTC for INR
          const inrAmount = parseFloat(amount) * effectiveRate;
          setEstimation(inrAmount);
        }
      } else {
        setEstimation(0);
      }
    } else {
      setEstimation(0);
    }
  }, [amount, rate, isBuy, orderType, targetPrice]);

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (orderType === 'limit' && (!targetPrice || parseFloat(targetPrice) <= 0)) return;
    
    // Store the amount and target price, then open PIN confirmation
    setPendingAmount(parseFloat(amount));
    setPendingTargetPrice(orderType === 'limit' ? parseFloat(targetPrice) : undefined);
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN
      const response = await userAPI.verifyPin(pin);
      if (response.data.data?.valid) {
        // PIN is correct, proceed with trade
        await onTrade(pendingAmount, pendingTargetPrice);
        setAmount('');
        setTargetPrice('');
        setPendingAmount(0);
        setPendingTargetPrice(undefined);
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
    setPendingTargetPrice(undefined);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* Modal */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              {orderType === 'market' ? (
                isBuy ? (
                  <TrendingUp className="w-6 h-6 text-white" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-white" />
                )
              ) : (
                <Target className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {orderType === 'market' ? 
                  (isBuy ? 'Buy Bitcoin' : 'Sell Bitcoin') : 
                  (isBuy ? 'Limit Buy Order' : 'Limit Sell Order')
                }
              </h2>
              <p className="text-sm text-zinc-400">
                {orderType === 'market' ? 
                  `Market Rate: ₹${rate?.toLocaleString('en-IN')}/BTC` :
                  `Current: ₹${rate?.toLocaleString('en-IN')}/BTC`
                }
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

        {/* Order Type Toggle */}
        <div className="mb-6">
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setOrderType('market')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                orderType === 'market' 
                  ? 'bg-white text-black' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              Market Order
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                orderType === 'limit' 
                  ? 'bg-white text-black' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
              Limit Order
            </button>
          </div>
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
              inputMode={isBuy ? "numeric" : "decimal"}
              pattern={isBuy ? "[0-9]*" : "[0-9]*[.]?[0-9]*"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder={isBuy ? "1000" : "0.001"}
              step={isBuy ? "1" : "0.00000001"}
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

        {/* Target Price Input (Limit Orders Only) */}
        {orderType === 'limit' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Target Price (₹ per BTC)
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="input-field w-full"
                placeholder={rate?.toLocaleString('en-IN') || "0"}
                step="1"
                min="1"
              />
            </div>
            
            {/* Quick Price Buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setTargetPrice((rate! * 0.95).toFixed(0))}
                className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
              >
                -5%
              </button>
              <button
                onClick={() => setTargetPrice((rate! * 0.98).toFixed(0))}
                className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
              >
                -2%
              </button>
              <button
                onClick={() => setTargetPrice(rate?.toFixed(0) || '0')}
                className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
              >
                Market
              </button>
              <button
                onClick={() => setTargetPrice((rate! * 1.02).toFixed(0))}
                className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
              >
                +2%
              </button>
              <button
                onClick={() => setTargetPrice((rate! * 1.05).toFixed(0))}
                className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
              >
                +5%
              </button>
            </div>
          </div>
        )}

        {/* Estimation Display */}
        {amount && estimation > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              {orderType === 'market' ? (
                <Calculator className="w-4 h-4 text-white" />
              ) : (
                <Clock className="w-4 h-4 text-white" />
              )}
              <span className="text-sm font-medium text-white">
                {orderType === 'market' ? 
                  'You\'ll receive approximately:' : 
                  'Estimated when filled:'
                }
              </span>
            </div>
            <div className="text-2xl font-bold">
              {isBuy ? (
                `₿ ${estimation.toFixed(8)}`
              ) : (
                `₹${Math.floor(estimation).toLocaleString('en-IN')}`
              )}
            </div>
            {orderType === 'limit' && (
              <div className="mt-2 text-xs text-zinc-400">
                {isBuy ? (
                  targetPrice && rate && parseFloat(targetPrice) < rate ? (
                    <span className="text-green-400">• Waiting for price to drop to ₹{parseFloat(targetPrice).toLocaleString('en-IN')}</span>
                  ) : (
                    <span className="text-orange-400">• Waiting for price to rise to ₹{parseFloat(targetPrice).toLocaleString('en-IN')}</span>
                  )
                ) : (
                  targetPrice && rate && parseFloat(targetPrice) > rate ? (
                    <span className="text-green-400">• Waiting for price to rise to ₹{parseFloat(targetPrice).toLocaleString('en-IN')}</span>
                  ) : (
                    <span className="text-orange-400">• Waiting for price to drop to ₹{parseFloat(targetPrice).toLocaleString('en-IN')}</span>
                  )
                )}
              </div>
            )}
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
            disabled={
              !amount || 
              parseFloat(amount) <= 0 || 
              isLoading || 
              parseFloat(amount) > availableBalance ||
              (orderType === 'limit' && (!targetPrice || parseFloat(targetPrice) <= 0))
            }
            className="flex-1 font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {orderType === 'market' ? <Zap className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                {orderType === 'market' ? 
                  (isBuy ? 'Buy Bitcoin' : 'Sell Bitcoin') :
                  (isBuy ? 'Place Buy Order' : 'Place Sell Order')
                }
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
        title={`Confirm ${orderType === 'market' ? (isBuy ? 'Buy' : 'Sell') : 'Limit'} Order`}
        message={(() => {
          const baseText = 'Enter your PIN to confirm ';
          if (orderType === 'market') {
            const action = isBuy ? 'purchasing' : 'selling';
            const amount = isBuy ? `₹${pendingAmount.toLocaleString('en-IN')} worth of Bitcoin` : `${pendingAmount.toFixed(8)} BTC`;
            return `${baseText}${action} ${amount}`;
          } else {
            const action = isBuy ? 'buy' : 'sell';
            const amount = isBuy ? `₹${pendingAmount.toLocaleString('en-IN')}` : `${pendingAmount.toFixed(8)} BTC`;
            const price = `₹${(pendingTargetPrice || 0).toLocaleString('en-IN')}/BTC`;
            return `${baseText}placing a limit ${action} order for ${amount} at ${price}`;
          }
        })()}
        isLoading={isLoading}
      />
    </div>
  );
};

export default TradingModal;
