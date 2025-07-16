import React, { useState, useEffect, useRef } from 'react';
import { formatCurrencyInr, formatBitcoin, formatBitcoinInput, formatInrInput } from '../utils/formatters';

interface SingleInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'btc' | 'inr';
  maxValue?: number;
  confirmText?: string;
  onConfirm: (value: string) => void | Promise<void>;
  isLoading?: boolean;
  validation?: (value: string) => string | null; // Returns error message or null if valid
  // Optional section above keypad
  sectionTitle?: string;
  sectionDetail?: string | React.ReactNode;
  sectionAmount?: string;
  onSectionClick?: () => void;
  // Optional tab switcher
  tabSwitcher?: React.ReactNode;
}

const SingleInputModal: React.FC<SingleInputModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  maxValue,
  confirmText = "Next",
  onConfirm,
  isLoading = false,
  validation,
  sectionTitle,
  sectionDetail,
  sectionAmount,
  onSectionClick,
  tabSwitcher
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
    keypad: 200, // Reduced from 232 to shift keypad up
    confirmButton: 60, // Reduced from 88 to shift button up
    safeArea: 20, // Reduced from 40 to shift everything up
    maxButton: maxValue !== undefined ? 44 : 0, // Max button height (py-2 = 8px + 8px, text height ~20px, mb-2 = 8px)
    section: sectionTitle ? 64 : 0, // Section height when present
  };

  const totalFixedHeight = layoutConfig.header + 
                          layoutConfig.keypad + 
                          layoutConfig.confirmButton + 
                          layoutConfig.safeArea + 
                          layoutConfig.maxButton + 
                          layoutConfig.section;

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

  // Keyboard event handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for handled keys
      if (/^[0-9]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter' || (e.key === '.' && type === 'btc')) {
        e.preventDefault();
      }

      // Handle number keys
      if (/^[0-9]$/.test(e.key)) {
        handleKeypadPress(e.key);
      }
      // Handle backspace/delete
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleKeypadPress('backspace');
      }
      // Handle decimal point for BTC
      else if (e.key === '.' && type === 'btc') {
        handleKeypadPress('.');
      }
      // Handle enter key to confirm
      else if (e.key === 'Enter') {
        if (!isConfirmDisabled) {
          handleConfirm();
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, type, value, validation, isLoading]); // Using validation and isLoading instead of isConfirmDisabled

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
    
    // Don't start drag if touching a button or clickable section
    if (target.tagName === 'BUTTON' || 
        target.closest('button') || 
        target.closest('[data-clickable-section]')) {
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
          {/* Input Display Area */}
          <div 
            className="flex flex-col justify-start items-center pt-4" 
            style={{ height: `${contentHeight}px` }}
          >
            <div className="text-center w-full">
              {/* Input Display */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-white text-5xl font-light">
                  {type === 'btc' ? formatBitcoinInput(value) : formatInrInput(value)}
                </span>
              </div>
              
              {/* Max Button */}
              {!value && maxValue !== undefined && (
                <button
                  onClick={handleMaxAmount}
                  className="bg-zinc-800 text-zinc-300 px-6 py-2 rounded-full text-sm font-medium hover:bg-zinc-700 transition-colors mb-2 inline-flex items-center justify-center min-w-fit"
                >
                  Max {type === 'btc' ? `₿${formatBitcoin(maxValue)}` : formatCurrencyInr(maxValue)}
                </button>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Optional Section */}
          {sectionTitle && (onSectionClick || sectionAmount || sectionDetail) && (
            <div 
              data-clickable-section
              onClick={onSectionClick} 
              className="mb-2 bg-black border border-zinc-700 rounded-lg p-4 cursor-pointer hover:bg-zinc-900 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-zinc-400 text-sm">{sectionTitle}</span>
                  {sectionDetail && (
                    <div className="text-xs text-zinc-500 mt-1">
                      {typeof sectionDetail === 'string' ? <p>{sectionDetail}</p> : sectionDetail}
                    </div>
                  )}
                </div>
                {sectionAmount && <span className="text-sm font-medium text-zinc-300">{sectionAmount}</span>}
              </div>
            </div>
          )}

          {/* Optional Tab Switcher */}
          {tabSwitcher && (
            <div className="mb-3">
              {tabSwitcher}
            </div>
          )}

          {/* Keypad */}
          <div className="mb-3">
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
          <div className="mb-4 pb-20 flex justify-center">
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
