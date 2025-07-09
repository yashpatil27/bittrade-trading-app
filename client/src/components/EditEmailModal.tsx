import React, { useState, useEffect } from 'react';
import { X, Mail, Eye, EyeOff } from 'lucide-react';
import { userAPI } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useAuth } from '../contexts/AuthContext';

interface EditEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

const EditEmailModal: React.FC<EditEmailModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onSuccess,
  onError
}) => {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setEmail(currentEmail);
      setCurrentPassword('');
      setShowPassword(false);
    }
  }, [isOpen, currentEmail]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      onError('Email is required');
      return;
    }

    if (!isValidEmail(email.trim())) {
      onError('Please enter a valid email address');
      return;
    }

    if (!currentPassword) {
      onError('Current password is required');
      return;
    }

    if (email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      onError('New email must be different from current email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await userAPI.updateProfile({
        email: email.trim().toLowerCase(),
        currentPassword
      });

      // Update user context
      const updatedUser = response.data.data?.user;
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      onSuccess('✅ Email updated successfully!');
    } catch (error: any) {
      onError(error.response?.data?.message || 'Failed to update email');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Edit Email</h2>
              <p className="text-zinc-400 text-sm">Update your email address</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
              placeholder="Enter your email address"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-zinc-300 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 pr-12 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                placeholder="Enter your current password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-zinc-500 text-xs mt-1">Required to verify your identity</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !currentPassword || !isValidEmail(email.trim())}
              className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors font-medium"
            >
              {isLoading ? 'Updating...' : 'Update Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmailModal;
