import React, { useState, useEffect, useRef } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PinConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<boolean>;
  title: string;
  message: string;
  isLoading?: boolean;
}

const PinConfirmationModal: React.FC<PinConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false
}) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [isShaking, setIsShaking] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError('');
      setIsShaking(false);
      // Focus first input after modal opens
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    // Auto-confirm when all 4 digits are entered
    if (pin.every(digit => digit !== '') && !isLoading) {
      handleConfirm();
    }
  }, [pin, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value !== '' && !/^\d$/.test(value)) {
      return;
    }

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Move to next input if digit entered
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const pinString = pin.join('');
    if (pinString.length !== 4) return;

    try {
      const isValid = await onConfirm(pinString);
      if (isValid) {
        onClose();
      } else {
        // Wrong PIN - shake and clear
        setIsShaking(true);
        setPin(['', '', '', '']);
        setError('Incorrect PIN. Please try again.');
        setTimeout(() => {
          setIsShaking(false);
          inputRefs.current[0]?.focus();
        }, 500);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* Modal */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-zinc-400">{message}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-4 text-center">
            Enter your 4-digit PIN
          </label>
          <div className={`flex gap-3 justify-center ${isShaking ? 'animate-pulse' : ''}`}>
            {pin.map((digit, index) => (
                <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={(e) => e.target.select()}
                className={`w-12 h-12 text-center text-xl font-bold bg-zinc-800 border-2 rounded-lg transition-all duration-200 ${
                  digit ? 'border-white' : 'border-zinc-600'
                } focus:border-white focus:outline-none ${
                  isShaking ? 'animate-shake' : ''
                }`}
                maxLength={1}
                disabled={isLoading}
              />
            ))}
          </div>
          
          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

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
            onClick={handleConfirm}
            disabled={pin.some(digit => digit === '') || isLoading}
            className="flex-1 btn-primary"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Confirming...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinConfirmationModal;
