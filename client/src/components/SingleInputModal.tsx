import React, { useState, useEffect, useRef } from 'react';
import { formatCurrencyInr, formatBitcoin } from '../utils/formatters';

interface SingleInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  type: 'btc' | 'inr';
  maxValue?: number;
  maxLabel?: string;
  showMaxButton?: boolean;
  confirmText?: string;
  onConfirm: (value: string) => void | Promise<void>;
  isLoading?: boolean;
  validation?: (value: string) => string | null; // Returns error message or null if valid
}

const SingleInputModal: React.FC<SingleInputModalProps> = ({
  isOpen,
  onClose,
  title,
  placeholder = "Enter value",
  type,
  maxValue,
  maxLabel,
  showMaxButton = false,
  confirmText = "Next",
  onConfirm,
  isLoading = false,
  validation
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [screenHeight] = useState(window.innerHeight);
  const modalRef = useRef<HTMLDivElement>(null);

  // Layout calculations - much simpler than trading modal
  const layoutConfig = {
    header: 80, // Title area
    padding: 24, // px-6 = 24px on each side
    keypad: 232, // 4 rows × 64px (h-16) + gaps + mb-6 (24px)
    confirmButton: 88, // Button height + margins
    safeArea: 40, // Additional safe area for mobile browsers
  };

  const totalFixedHeight = layoutConfig.header + 
                          layoutConfig.keypad + 
                          layoutConfig.confirmButton + 
                          layoutConfig.safeArea;

  const availableContentHeight = screenHeight - totalFixedHeight;
  const contentHeight = Math.max(availableContentHeight, 200); // Minimum 200px for content

  // Animation control
  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsAnimating(false);
      setValue('');
      setError(null);
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

  // Validate input when value changes
  useEffect(() => {
    if (validation && value) {
      const errorMessage = validation(value);
      setError(errorMessage);
    } else {
      setError(null);
    }
  }, [value, validation]);

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

  // Keypad component
  const KeypadButton: React.FC<{ value: string; onPress: () => void; className?: string }> = ({ 
    value, 
    onPress, 
    className = '' 
  }) => {
    const handleTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation();
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
      e.stopPropagation();
      onPress();
    };
    
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
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

  const handleKeypadPress = (keyValue: string) => {
    if (keyValue === 'backspace') {
      setValue(prev => prev.slice(0, -1));
    } else if (keyValue === 'clear') {
      setValue('');
    } else if (keyValue === '.') {
      // Only allow decimal point for BTC inputs
      if (type === 'btc' && !value.includes('.')) {
        setValue(prev => prev === '' ? '0.' : prev + keyValue);
      }
    } else {
      setValue(prev => prev + keyValue);
    }
  };

  const handleMaxAmount = () => {
    if (maxValue !== undefined) {
      setValue(maxValue.toString());
    }
  };

  const handleConfirm = async () => {
    if (!value || (validation && validation(value))) return;
    
    try {
      await onConfirm(value);
    } catch (error) {
      // Handle error if onConfirm throws
      console.error('Confirmation error:', error);
    }
  };

  const isConfirmDisabled = !value || 
                           isLoading || 
                           (validation && !!validation(value));

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
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="w-10"></div> {/* Spacer for centering */}
            <h2 className="text-white text-xl font-semibold text-center flex-1">{title}</h2>
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
          {/* Input Display Area */}
          <div 
            className="flex flex-col justify-start items-center pt-4" 
            style={{ height: `${contentHeight}px` }}
          >
            <div className="text-center w-full">
              {/* Input Display */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-white text-5xl font-light">
                  {value ? (
                    type === 'btc' ? 
                      (value === '.' || value.endsWith('.')) ? `₿${value}` : `₿${formatBitcoin(parseFloat(value) || 0)}` : 
                      formatCurrencyInr(parseFloat(value) || 0)
                  ) : (
                    type === 'btc' ? '₿0' : '₹0'
                  )}
                </span>
              </div>
              
              {/* Placeholder/Helper Text */}
              {!value && (
                <div className="text-zinc-400 text-sm mb-4">
                  {placeholder}
                </div>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}
              
              {/* Max Button */}
              {showMaxButton && maxValue !== undefined && (
                <button
                  onClick={handleMaxAmount}
                  className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Max {maxLabel || maxValue}
                </button>
              )}
            </div>
          </div>

          {/* Keypad */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', type === 'btc' ? '.' : '', '0', 'backspace'].map((key, index) => (
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

          {/* Confirm Button */}
          <div className="mb-8 pb-8 flex justify-center">
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
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

export default SingleInputModal;
