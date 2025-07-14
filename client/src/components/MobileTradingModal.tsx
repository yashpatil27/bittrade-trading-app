import React, { useState, useEffect, useRef } from 'react';
import { Prices } from '../types';
import { userAPI } from '../services/api';
import { formatCurrencyInr, formatBitcoin } from '../utils/formatters';

interface MobileTradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  prices: Prices | null;
  userBalance: { inr: number; btc: number };
  onTrade: (amount: number, targetPrice?: number, dcaConfig?: {
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    totalExecutions?: number;
    maxPrice?: number;
    minPrice?: number;
  }) => Promise<void>;
  isLoading: boolean;
}

const MobileTradingModal: React.FC<MobileTradingModalProps> = ({
  isOpen,
  onClose,
  type,
  prices,
  userBalance,
  onTrade,
  isLoading
}) => {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'dca'>('market');
  const [amount, setAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [estimation, setEstimation] = useState<number>(0);
  const [showPinPad, setShowPinPad] = useState(false);
  const [currentStep, setCurrentStep] = useState<'targetPrice' | 'amount'>('amount');
  const [pin, setPin] = useState('');
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const isBuy = type === 'buy';
  const rate = isBuy ? prices?.buy_rate : prices?.sell_rate;
  const availableBalance = isBuy ? userBalance.inr : userBalance.btc;

  // Animation control
  useEffect(() => {
    if (isOpen) {
      // Reset drag offset and start from bottom
      setDragOffset(0);
      setIsAnimating(false);
      setTimeout(() => {
        setIsAnimating(true);
      }, 50); // Small delay to ensure proper initial position
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Calculate estimation
  useEffect(() => {
    if (amount && rate) {
      const amountNum = parseFloat(amount);
      const effectiveRate = orderType === 'limit' && targetPrice ? parseFloat(targetPrice) : rate;
      
      if (isBuy) {
        setEstimation(amountNum / effectiveRate);
      } else {
        setEstimation(amountNum * effectiveRate);
      }
    } else {
      setEstimation(0);
    }
  }, [amount, rate, isBuy, orderType, targetPrice]);

  // Close animation function
  const animateClose = () => {
    setIsClosing(true);
    setIsAnimating(false);
    // Wait for the animation to complete before actually closing
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // 300ms animation duration
  };

  // Touch handlers for drag-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't interfere with button clicks
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    // Prevent default to avoid scrolling
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    
    // Only allow downward drag
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Get screen height to calculate 45% threshold
    const screenHeight = window.innerHeight;
    const closeThreshold = screenHeight * 0.45; // 45% of screen height
    
    // Close if dragged down more than 45% of screen height
    if (dragOffset > closeThreshold) {
      animateClose();
    } else {
      // Snap back to original position if not dragged far enough
      setDragOffset(0);
    }
  };

  // Keypad component
  const KeypadButton: React.FC<{ value: string; onPress: () => void; className?: string }> = ({ 
    value, 
    onPress, 
    className = '' 
  }) => {
    const handleTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation(); // Prevent modal drag
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
      e.stopPropagation(); // Prevent modal drag
      onPress();
    };
    
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent modal drag
      onPress();
    };
    
    return (
      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`h-16 bg-black text-white text-xl font-medium select-none ${className}`}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation'
        }}
      >
        {value}
      </button>
    );
  };

  const handleKeypadPress = (value: string) => {
    if (showPinPad) {
      if (value === 'backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (value === 'clear') {
        setPin('');
      } else if (pin.length < 4) {
        setPin(prev => prev + value);
      }
    } else {
      // Determine which field we're editing based on currentStep
      const isEditingTargetPrice = orderType === 'limit' && currentStep === 'targetPrice';
      const currentValue = isEditingTargetPrice ? targetPrice : amount;
      const setValue = isEditingTargetPrice ? setTargetPrice : setAmount;
      
      if (value === 'backspace') {
        setValue(prev => prev.slice(0, -1));
      } else if (value === 'clear') {
        setValue('');
      } else if (value === '.') {
        if (!currentValue.includes('.')) {
          setValue(prev => prev + value);
        }
      } else {
        setValue(prev => prev + value);
      }
    }
  };

  const handleMaxAmount = () => {
    if (isBuy) {
      setAmount(Math.floor(availableBalance).toString());
    } else {
      setAmount(availableBalance.toFixed(8));
    }
  };

  const handleConfirm = async () => {
    // Handle limit order step progression
    if (orderType === 'limit' && currentStep === 'targetPrice') {
      if (!targetPrice || parseFloat(targetPrice) <= 0) return;
      setCurrentStep('amount');
      return;
    }
    
    // Handle final confirmation
    if (!amount || parseFloat(amount) <= 0) return;
    if (orderType === 'limit' && (!targetPrice || parseFloat(targetPrice) <= 0)) return;
    
    setShowPinPad(true);
  };

  const handlePinConfirm = async () => {
    if (pin.length !== 4) return;
    
    try {
      const response = await userAPI.verifyPin(pin);
      if (response.data.data?.valid) {
        await onTrade(
          parseFloat(amount),
          orderType === 'limit' ? parseFloat(targetPrice) : undefined
        );
        // Reset form
        setAmount('');
        setTargetPrice('');
        setPin('');
        setShowPinPad(false);
        onClose();
      } else {
        // Shake animation for wrong PIN
        setPin('');
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setPin('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={animateClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute inset-0 bg-black"
        style={{
          transform: `translateY(${isClosing ? '100%' : isAnimating ? `${dragOffset}px` : '100%'})`,
          transition: isDragging ? 'none' : (isAnimating || isClosing) ? 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* Order Type Toggle */}
        {!showPinPad && (
          <div className="px-6 pt-6 mb-8">
            <div className="flex bg-zinc-900 rounded-full p-0.5">
              <button
                onClick={() => {
                  setOrderType('market');
                  setTargetPrice('');
                }}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  orderType === 'market'
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Market Order
              </button>
              <button
                onClick={() => {
                  setOrderType('limit');
                  setAmount('');
                  setCurrentStep('targetPrice');
                }}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  orderType === 'limit'
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Limit Order
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col h-full px-6">
          {/* Amount Display - Centered */}
          <div className="flex-1 flex flex-col justify-center items-center mb-12">
            {showPinPad ? (
              <div className="text-center">
                <div className="text-white text-lg mb-6">Enter PIN</div>
                <div className="flex justify-center gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full ${
                        i < pin.length ? 'bg-white' : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center">
                {/* Step indicator for limit orders */}
                {orderType === 'limit' && (
                  <div className="mb-4">
                    <div className="text-zinc-400 text-sm mb-2">
                      {currentStep === 'targetPrice' ? 'Step 1: Set Target Price' : 'Step 2: Enter Amount'}
                    </div>
                    <div className="flex justify-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        currentStep === 'targetPrice' ? 'bg-white' : 'bg-zinc-600'
                      }`} />
                      <div className={`w-2 h-2 rounded-full ${
                        currentStep === 'amount' ? 'bg-white' : 'bg-zinc-600'
                      }`} />
                    </div>
                  </div>
                )}
                
                {/* Input Display */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {/* Show currency symbol based on current input */}
                  {orderType === 'limit' && currentStep === 'targetPrice' ? (
                    // Target price input - always INR
                    <span className="text-white text-4xl font-light">₹</span>
                  ) : (
                    // Amount input - depends on buy/sell
                    <>
                      {isBuy && <span className="text-white text-4xl font-light">₹</span>}
                      {!isBuy && <span className="text-white text-4xl font-light">₿</span>}
                    </>
                  )}
                  <span className="text-white text-5xl font-light">
                    {orderType === 'limit' && currentStep === 'targetPrice'
                      ? (targetPrice || '0')
                      : (amount || '0')
                    }
                  </span>
                </div>
                
                {/* Label */}
                <div className="text-zinc-400 text-sm mb-4">
                </div>
                
                {/* Max button - only for amount input */}
                {(orderType === 'market' || (orderType === 'limit' && currentStep === 'amount')) && (
                  <button
                    onClick={handleMaxAmount}
                    className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Max {isBuy ? formatCurrencyInr(availableBalance) : formatBitcoin(availableBalance)}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Rate and Estimation Preview - Reserved Space */}
          <div className="mb-4 h-20">
            {amount && rate && !showPinPad ? (
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Rate</span>
                    <span className="text-white font-medium">
                      ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">
                      {isBuy ? 'You will get' : 'You will receive'}
                    </span>
                    <span className="text-white font-medium">
                      {isBuy 
                        ? `₿ ${estimation.toFixed(8)}` 
                        : `₹ ${estimation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div></div>
            )}
          </div>

          {/* Keypad */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'].map((key, index) => (
                key === '' ? (
                  <div key={`empty-${index}`} className="h-16" />
                ) : (
                  <KeypadButton
                    key={`key-${index}-${key}`}
                    value={key === 'backspace' ? '⌫' : key}
                    onPress={() => handleKeypadPress(key)}
                  />
                )
              ))}
            </div>
          </div>

          {/* Next Button - Extra padding for mobile browser UI */}
          <div className="mb-16 pb-12 flex justify-center">
            <button
              onClick={showPinPad ? handlePinConfirm : handleConfirm}
              disabled={
                isLoading || 
                (showPinPad && pin.length !== 4) ||
                (orderType === 'limit' && currentStep === 'targetPrice' && (!targetPrice || parseFloat(targetPrice) <= 0)) ||
                (orderType !== 'limit' && (!amount || parseFloat(amount) <= 0)) ||
                (orderType === 'limit' && currentStep === 'amount' && (!amount || parseFloat(amount) <= 0))
              }
              className="px-8 h-12 bg-white text-black text-base font-medium rounded-lg transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isLoading ? 'Processing...' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileTradingModal;
