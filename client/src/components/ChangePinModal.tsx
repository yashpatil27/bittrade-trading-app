import React, { useState, useRef, useEffect } from 'react';
import { X, Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { userAPI } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePinModal: React.FC<ChangePinModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState<'new' | 'confirm' | 'password'>('new');
  
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setNewPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setCurrentPassword('');
      setError('');
      setShowPassword(false);
      setActiveStep('new');
      // Focus first new PIN input
      setTimeout(() => {
        newPinRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto-advance to confirm step when new PIN is complete
  useEffect(() => {
    if (newPin.every(digit => digit !== '') && activeStep === 'new') {
      setActiveStep('confirm');
      setTimeout(() => {
        confirmPinRefs.current[0]?.focus();
      }, 100);
    }
  }, [newPin, activeStep]);

  // Auto-advance to password step when confirm PIN is complete
  useEffect(() => {
    if (confirmPin.every(digit => digit !== '') && activeStep === 'confirm') {
      const newPinString = newPin.join('');
      const confirmPinString = confirmPin.join('');
      
      if (newPinString === confirmPinString) {
        setActiveStep('password');
        setError('');
      } else {
        setError('PINs do not match');
        setConfirmPin(['', '', '', '']);
        setTimeout(() => {
          confirmPinRefs.current[0]?.focus();
        }, 100);
      }
    }
  }, [confirmPin, newPin, activeStep]);

  const handlePinInputChange = (index: number, value: string, isConfirm = false) => {
    // Only allow digits
    if (value !== '' && !/^\d$/.test(value)) {
      return;
    }

    const pinArray = isConfirm ? [...confirmPin] : [...newPin];
    pinArray[index] = value;
    
    if (isConfirm) {
      setConfirmPin(pinArray);
    } else {
      setNewPin(pinArray);
    }

    // Move to next input if digit entered
    if (value && index < 3) {
      const refs = isConfirm ? confirmPinRefs : newPinRefs;
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isConfirm = false) => {
    const pinArray = isConfirm ? confirmPin : newPin;
    const refs = isConfirm ? confirmPinRefs : newPinRefs;
    
    if (e.key === 'Backspace' && !pinArray[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      refs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newPinString = newPin.join('');
    const confirmPinString = confirmPin.join('');

    // Validation
    if (!newPinString || !confirmPinString || !currentPassword) {
      setError('All fields are required');
      return;
    }

    if (newPinString.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPinString !== confirmPinString) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);

    try {
      await userAPI.changePin({
        newPin: newPinString,
        currentPassword
      });
      
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error changing PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
    setCurrentPassword('');
    setError('');
    setShowPassword(false);
    setActiveStep('new');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const goBackToStep = (step: 'new' | 'confirm' | 'password') => {
    setActiveStep(step);
    setError('');
    if (step === 'new') {
      setTimeout(() => newPinRefs.current[0]?.focus(), 100);
    } else if (step === 'confirm') {
      setTimeout(() => confirmPinRefs.current[0]?.focus(), 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      {/* Modal */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Change PIN</h2>
              <p className="text-sm text-zinc-400">Update your 4-digit PIN</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              activeStep === 'new' ? 'bg-white text-black' : 
              newPin.every(d => d !== '') ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'
            }`}>
              1
            </div>
            <div className={`w-6 h-0.5 ${
              newPin.every(d => d !== '') ? 'bg-green-600' : 'bg-zinc-700'
            }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              activeStep === 'confirm' ? 'bg-white text-black' : 
              confirmPin.every(d => d !== '') && newPin.join('') === confirmPin.join('') ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'
            }`}>
              2
            </div>
            <div className={`w-6 h-0.5 ${
              confirmPin.every(d => d !== '') && newPin.join('') === confirmPin.join('') ? 'bg-green-600' : 'bg-zinc-700'
            }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              activeStep === 'password' ? 'bg-white text-black' : 'bg-zinc-700 text-zinc-400'
            }`}>
              3
            </div>
          </div>

          {/* Step 1: New PIN */}
          {activeStep === 'new' && (
            <div className="text-center">
              <label className="block text-sm font-medium mb-4">
                Enter your new 4-digit PIN
              </label>
              <div className="flex gap-3 justify-center mb-4">
                {newPin.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => newPinRefs.current[index] = el}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handlePinInputChange(index, e.target.value, false)}
                    onKeyDown={(e) => handlePinKeyDown(index, e, false)}
                    onFocus={(e) => e.target.select()}
                    className={`w-12 h-12 text-center text-xl font-bold bg-zinc-800 border-2 rounded-lg transition-all duration-200 ${
                      digit ? 'border-white' : 'border-zinc-600'
                    } focus:border-white focus:outline-none`}
                    maxLength={1}
                    disabled={isLoading}
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-500">This will be your new security PIN</p>
            </div>
          )}

          {/* Step 2: Confirm PIN */}
          {activeStep === 'confirm' && (
            <div className="text-center">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => goBackToStep('new')}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ← Back
                </button>
                <label className="block text-sm font-medium">
                  Confirm your new PIN
                </label>
                <div className="w-12" /> {/* Spacer */}
              </div>
              <div className="flex gap-3 justify-center mb-4">
                {confirmPin.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => confirmPinRefs.current[index] = el}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handlePinInputChange(index, e.target.value, true)}
                    onKeyDown={(e) => handlePinKeyDown(index, e, true)}
                    onFocus={(e) => e.target.select()}
                    className={`w-12 h-12 text-center text-xl font-bold bg-zinc-800 border-2 rounded-lg transition-all duration-200 ${
                      digit ? 'border-white' : 'border-zinc-600'
                    } focus:border-white focus:outline-none`}
                    maxLength={1}
                    disabled={isLoading}
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-500">Re-enter your PIN to confirm</p>
            </div>
          )}

          {/* Step 3: Current Password */}
          {activeStep === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => goBackToStep('confirm')}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ← Back
                </button>
                <label className="block text-sm font-medium">
                  Current Password
                </label>
                <div className="w-12" /> {/* Spacer */}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-field w-full pr-10"
                  placeholder="Enter your current password"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">Required to verify your identity</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            {activeStep === 'password' && (
              <button
                type="submit"
                disabled={isLoading || newPin.some(d => d === '') || confirmPin.some(d => d === '') || !currentPassword}
                className="flex-1 btn-primary"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                    Changing...
                  </>
                ) : (
                  'Change PIN'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePinModal;
