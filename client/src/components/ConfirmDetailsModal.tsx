import React, { useState, useEffect, useRef } from 'react';
import { formatCurrencyInr, formatBitcoin } from '../utils/formatters';

interface DetailItem {
  label: string;
  value: string;
  highlight?: boolean; // Optional highlighting for important details
}

interface ConfirmDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  amount: string;
  amountType: 'btc' | 'inr';
  subAmount?: string; // Smaller amount below main amount
  subAmountType?: 'btc' | 'inr';
  details: DetailItem[]; // Array of 2-5 details to show
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

const ConfirmDetailsModal: React.FC<ConfirmDetailsModalProps> = ({
  isOpen,
  onClose,
  title,
  amount,
  amountType,
  subAmount,
  subAmountType,
  details,
  confirmText = "Confirm",
  onConfirm,
  isLoading = false,
}) => {
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [screenHeight] = useState(window.innerHeight);
  const modalRef = useRef<HTMLDivElement>(null);

  // Layout calculations to match SingleInputModal button position
  const layoutConfig = {
    header: 80, // Title area
    padding: 24, // px-6 = 24px on each side
    keypadSpace: 200, // Same keypad space as SingleInputModal to maintain button position
    confirmButton: 60, // Button height + margins
    safeArea: 20, // Safe area for mobile browsers
  };

  const totalFixedHeight = layoutConfig.header + 
                          layoutConfig.keypadSpace + 
                          layoutConfig.confirmButton + 
                          layoutConfig.safeArea;

  const availableContentHeight = screenHeight - totalFixedHeight;
  const contentHeight = Math.max(availableContentHeight, 200); // Minimum 200px for content

  // Animation control
  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsAnimating(false);
      setTimeout(() => {
        setIsAnimating(true);
      }, 50);
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

  // Close animation function
  const animateClose = () => {
    setIsClosing(true);
    setIsAnimating(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  // Touch handlers for drag-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
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
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const closeThreshold = screenHeight * 0.3; // 30% of screen height
    
    if (dragOffset > closeThreshold) {
      animateClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation error:', error);
    }
  };

  const formatAmount = (value: string, type: 'btc' | 'inr') => {
    const numValue = parseFloat(value) || 0;
    return type === 'btc' ? `₿${formatBitcoin(numValue)}` : formatCurrencyInr(numValue);
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
        className="absolute inset-x-0 bottom-0 top-0 bg-black max-w-md mx-auto"
        style={{
          transform: `translateY(${isClosing ? '100%' : isAnimating ? `${dragOffset}px` : '100%'})`,
          transition: isDragging ? 'none' : (isAnimating || isClosing) ? 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="px-6 modal-safe-top pb-4">
          <div className="flex items-center justify-between">
            <div className="w-10"></div> {/* Spacer for centering */}
            <h2 className="text-white text-sm font-semibold text-center flex-1">{title}</h2>
            <button
              onClick={animateClose}
              className="text-zinc-400 hover:text-white p-2 w-10 h-10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full px-6">
          {/* Amount Display Area */}
          <div 
            className="flex flex-col justify-start items-center pt-4" 
            style={{ height: `${contentHeight}px` }}
          >
            <div className="text-center w-full">
              {/* Main Amount Display */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-white text-5xl font-light">
                  {formatAmount(amount, amountType)}
                </span>
              </div>
              
              {/* Sub Amount Display */}
              {subAmount && subAmountType && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-zinc-400 text-lg font-light">
                    {formatAmount(subAmount, subAmountType)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Details Section - positioned exactly like SingleInputModal section */}
          <div className="mb-2 bg-black border border-zinc-700 rounded-lg p-4">
            <div className="space-y-4">
              {details.map((detail, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">{detail.label}</span>
                  <span className={`text-sm font-medium ${
                    detail.highlight ? 'text-white' : 'text-zinc-300'
                  }`}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Keypad Space - matches SingleInputModal keypad */}
          <div className="mb-3">
            <div className="h-32"></div> {/* 128px height to match keypad area */}
          </div>

          {/* Confirm Button */}
          <div className="mb-4 pb-20 flex justify-center">
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-8 h-12 bg-white text-black text-base font-medium rounded-lg transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDetailsModal;
