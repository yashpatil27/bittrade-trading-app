import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Wallet, 
  Key, 
  Plus, 
  Minus, 
  Trash2, 
  DollarSign,
  Bitcoin,
  Eye,
  EyeOff,
  TrendingUp
} from 'lucide-react';
import { AdminUser } from '../types';
import { adminAPI } from '../services/api';
import { formatBitcoin } from '../utils/formatters';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onUserUpdated: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'balances' | 'trade' | 'password'>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Balance management
  const [inrAmount, setInrAmount] = useState('');
  const [btcAmount, setBtcAmount] = useState('');
  const [balanceMode, setBalanceMode] = useState<'INR' | 'BTC'>('INR');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  // External trade form
  const [externalInrAmount, setExternalInrAmount] = useState('');
  const [externalBtcAmount, setExternalBtcAmount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('info');
      setInrAmount('');
      setBtcAmount('');
      setNewPassword('');
      setExternalInrAmount('');
      setExternalBtcAmount('');
      setMessage('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleBalanceOperation = async (operation: 'deposit' | 'withdraw', currency: 'INR' | 'BTC') => {
    const amount = currency === 'INR' ? inrAmount : btcAmount;
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const parsedAmount = parseFloat(amount);
      
      if (currency === 'INR') {
        if (operation === 'deposit') {
          await adminAPI.depositINR(user.id, parsedAmount);
          setMessage(`✅ ₹${parsedAmount.toLocaleString()} deposited successfully`);
        } else {
          await adminAPI.withdrawINR(user.id, parsedAmount);
          setMessage(`✅ ₹${parsedAmount.toLocaleString()} withdrawn successfully`);
        }
        setInrAmount('');
      } else {
        if (operation === 'deposit') {
          await adminAPI.depositBTC(user.id, parsedAmount);
          setMessage(`✅ ₿${parsedAmount} deposited successfully`);
        } else {
          await adminAPI.withdrawBTC(user.id, parsedAmount);
          setMessage(`✅ ₿${parsedAmount} withdrawn successfully`);
        }
        setBtcAmount('');
      }
      
      onUserUpdated();
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to ${operation} ${currency}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await adminAPI.changeUserPassword(user.id, newPassword);
      setMessage('✅ Password updated successfully');
      setNewPassword('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await adminAPI.deleteUser(user.id);
      setMessage('User deleted successfully');
      setTimeout(() => {
        onUserUpdated();
        onClose();
      }, 1000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete user');
      setIsLoading(false);
    }
  };

  const handleExternalBuy = async () => {
    if (!externalInrAmount || !externalBtcAmount || parseFloat(externalInrAmount) <= 0 || parseFloat(externalBtcAmount) <= 0) {
      setError('Please enter valid INR and BTC amounts');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const inrAmount = parseInt(externalInrAmount);
      const btcAmount = parseFloat(externalBtcAmount);
      
      if (!Number.isInteger(inrAmount)) {
        setError('INR amount must be a whole number');
        return;
      }

      await adminAPI.externalBuy(user.id, inrAmount, btcAmount);
      setMessage(`✅ External buy recorded: ₹${inrAmount.toLocaleString()} → ₿${btcAmount}`);
      setExternalInrAmount('');
      setExternalBtcAmount('');
      onUserUpdated();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to record external buy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Manage User</h2>
              <p className="text-zinc-400 text-sm">{user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'balances'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab('trade')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'trade'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Trade
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'password'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Security
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}
          {message && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-green-300 text-sm">{message}</span>
            </div>
          )}

          {/* User Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-400 text-sm">Email</p>
                  <p className="text-white font-medium">{user.email}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-400 text-sm">Role</p>
                  <p className="text-white font-medium">{user.is_admin ? 'Admin' : 'User'}</p>
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-zinc-400 text-sm">Member Since</p>
                <p className="text-white font-medium">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                  <DollarSign className="w-6 h-6 text-white mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">INR Balance</p>
            <p className="text-white font-bold">₹{user.inr_balance.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                  <Bitcoin className="w-6 h-6 text-white mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">₿ Balance</p>
                  <p className="text-white font-bold">₿{formatBitcoin(user.btc_balance)}</p>
                </div>
              </div>

              <button
                onClick={handleDeleteUser}
                disabled={isLoading || !!(user.is_admin === true || user.is_admin === 1)}
                className="w-full bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete User
              </button>
              {!!(user.is_admin === true || user.is_admin === 1) && (
                <p className="text-zinc-500 text-xs text-center">Admin users cannot be deleted</p>
              )}
            </div>
          )}

          {/* Balances Tab */}
          {activeTab === 'balances' && (
            <div className="space-y-4">
              {/* Current Balances */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Current Balances
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-zinc-400 text-xs">INR Balance</p>
                    <p className="text-white font-bold text-lg">₹{user.inr_balance.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-zinc-400 text-xs">₿ Balance</p>
                    <p className="text-white font-bold text-lg">₿{formatBitcoin(user.btc_balance)}</p>
                  </div>
                </div>
              </div>

              {/* Currency Toggle */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex bg-zinc-700 rounded-lg p-1 mb-4">
                  <button
                    onClick={() => setBalanceMode('INR')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      balanceMode === 'INR' 
                        ? 'bg-white text-black' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    INR
                  </button>
                  <button
                    onClick={() => setBalanceMode('BTC')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      balanceMode === 'BTC' 
                        ? 'bg-white text-black' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Bitcoin className="w-4 h-4" />
                    BTC
                  </button>
                </div>

                {/* Amount Input */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">
                      Amount ({balanceMode === 'INR' ? '₹' : '₿'})
                    </label>
                    <input
                      type="number"
                      step={balanceMode === 'BTC' ? '0.00000001' : '1'}
                      value={balanceMode === 'INR' ? inrAmount : btcAmount}
                      onChange={(e) => balanceMode === 'INR' ? setInrAmount(e.target.value) : setBtcAmount(e.target.value)}
                      placeholder={`Enter ${balanceMode} amount...`}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleBalanceOperation('deposit', balanceMode)}
                      disabled={isLoading || (balanceMode === 'INR' ? !inrAmount : !btcAmount)}
                      className="bg-green-900/20 border border-green-800 text-green-300 hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Deposit
                    </button>
                    <button
                      onClick={() => handleBalanceOperation('withdraw', balanceMode)}
                      disabled={isLoading || (balanceMode === 'INR' ? !inrAmount : !btcAmount)}
                      className="bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Minus className="w-4 h-4" />
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trade Tab */}
          {activeTab === 'trade' && (
            <div className="space-y-4">
              {/* Current Balances Display */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Current User Balances
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-zinc-400 text-xs">INR Balance</p>
                    <p className="text-white font-bold text-lg">₹{user.inr_balance.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-zinc-400 text-xs">₿ Balance</p>
                    <p className="text-white font-bold text-lg">₿{formatBitcoin(user.btc_balance)}</p>
                  </div>
                </div>
              </div>

              {/* External Buy Form */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Record External Buy
                </h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Record a Bitcoin purchase that happened outside the platform. This will create a deposit and buy transaction.
                </p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-2">INR Amount (₹)</label>
                      <input
                        type="number"
                        step="1"
                        value={externalInrAmount}
                        onChange={(e) => setExternalInrAmount(e.target.value)}
                        placeholder="10000"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-2">Bitcoin Amount (₿)</label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={externalBtcAmount}
                        onChange={(e) => setExternalBtcAmount(e.target.value)}
                        placeholder="0.001"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>
                  
                  {/* Calculated Rate Display */}
                  {externalInrAmount && externalBtcAmount && parseFloat(externalInrAmount) > 0 && parseFloat(externalBtcAmount) > 0 && (
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs mb-1">Calculated Rate</p>
                      <p className="text-white font-medium">
                        ₹{(parseFloat(externalInrAmount) / parseFloat(externalBtcAmount)).toLocaleString('en-IN', { maximumFractionDigits: 2 })} per BTC
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleExternalBuy}
                    disabled={isLoading || !externalInrAmount || !externalBtcAmount || parseFloat(externalInrAmount) <= 0 || parseFloat(externalBtcAmount) <= 0}
                    className="w-full bg-blue-900/20 border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {isLoading ? 'Recording...' : 'Record External Buy'}
                  </button>
                </div>
              </div>
              
              <div className="bg-zinc-700/30 rounded-lg p-3">
                <p className="text-zinc-400 text-xs">
                  <strong>Note:</strong> This creates two transactions: a deposit of the INR amount (timestamped a few seconds earlier) and a buy transaction for the Bitcoin amount at the calculated rate.
                </p>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Reset Password
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password..."
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 pr-10 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">Minimum 6 characters</p>
                  </div>
                  <button
                    onClick={handlePasswordReset}
                    disabled={isLoading || !newPassword}
                    className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors font-medium"
                  >
                    {isLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
