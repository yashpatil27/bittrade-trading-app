import React, { useState } from 'react';
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
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useBodyScrollLock(isOpen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPin || !confirmPin || !currentPassword) {
      setError('All fields are required');
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);

    try {
      await userAPI.changePin({
        newPin,
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
    setNewPin('');
    setConfirmPin('');
    setCurrentPassword('');
    setError('');
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-2xl border border-zinc-800 p-6 mx-4 w-full max-w-md shadow-2xl">
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New PIN */}
          <div>
            <label className="block text-sm font-medium mb-2">
              New PIN (4 digits)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-field w-full"
              placeholder="1234"
              maxLength={4}
              disabled={isLoading}
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Confirm New PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-field w-full"
              placeholder="1234"
              maxLength={4}
              disabled={isLoading}
            />
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="••••••••"
                disabled={isLoading}
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
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !newPin || !confirmPin || !currentPassword}
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePinModal;
