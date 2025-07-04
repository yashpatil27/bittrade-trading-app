import React, { useState, useEffect } from 'react';
import { X, User, Eye, EyeOff } from 'lucide-react';
import { userAPI } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useAuth } from '../contexts/AuthContext';

interface EditNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

const EditNameModal: React.FC<EditNameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onSuccess,
  onError
}) => {
  const { setUser } = useAuth();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setCurrentPassword('');
      setShowPassword(false);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      onError('Name is required');
      return;
    }

    if (!currentPassword) {
      onError('Current password is required');
      return;
    }

    if (name.trim() === currentName) {
      onError('New name must be different from current name');
      return;
    }

    setIsLoading(true);

    try {
      const response = await userAPI.updateProfile({
        name: name.trim(),
        currentPassword
      });

      // Update user context
      const updatedUser = response.data.data?.user;
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      onSuccess('✅ Name updated successfully!');
    } catch (error: any) {
      onError(error.response?.data?.message || 'Failed to update name');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-fix bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Edit Name</h2>
              <p className="text-zinc-400 text-sm">Update your display name</p>
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
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
              placeholder="Enter your name"
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
              disabled={isLoading || !name.trim() || !currentPassword}
              className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors font-medium"
            >
              {isLoading ? 'Updating...' : 'Update Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNameModal;
