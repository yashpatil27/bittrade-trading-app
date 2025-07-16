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
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatBitcoin, formatCurrencyInr } from '../utils/formatters';
import { useBalance } from '../contexts/BalanceContext';
import PinConfirmationModal from './PinConfirmationModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
  const { refreshBalance } = useBalance();
  const { sendMessage } = useWebSocket();
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
  
  // PIN confirmation state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pinModalTitle, setPinModalTitle] = useState('');
  const [pinModalMessage, setPinModalMessage] = useState('');

  useBodyScrollLock(isOpen);

  const { on, off } = useWebSocket();
  
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

      const handleUserUpdate = (updatedUser: AdminUser) => {
        if (user && user.id === updatedUser.id) {
          // Update the user data in the parent component
          onUserUpdated();
        }
      };

      // Subscribe to real-time updates
      on('user_update', handleUserUpdate);

      return () => {
        // Cleanup listeners on unmount or when modal closes
        off('user_update', handleUserUpdate);
      };
    }
  }, [isOpen, user, on, off, onUserUpdated]);

  // PIN confirmation methods
  const requirePinConfirmation = (action: () => Promise<void>, title: string, message: string) => {
    setPendingAction(() => action);
    setPinModalTitle(title);
    setPinModalMessage(message);
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN
      const response = await sendMessage('user.verify-pin', { pin });
      if (response?.valid && pendingAction) {
        // PIN is correct, execute the pending action
        await pendingAction();
        setIsPinModalOpen(false);
        setPendingAction(null);
        return true;
      } else {
        // PIN is incorrect
        return false;
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
    setPendingAction(null);
  };

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
          await sendMessage('admin.deposit-inr', { userId: user.id, amount: parsedAmount });
          setMessage(`✅ ${formatCurrencyInr(parsedAmount)} deposited successfully`);
        } else {
          await sendMessage('admin.withdraw-inr', { userId: user.id, amount: parsedAmount });
          setMessage(`✅ ${formatCurrencyInr(parsedAmount)} withdrawn successfully`);
        }
        setInrAmount('');
      } else {
        if (operation === 'deposit') {
          await sendMessage('admin.deposit-btc', { userId: user.id, amount: parsedAmount });
          setMessage(`✅ ₿${parsedAmount} deposited successfully`);
        } else {
          await sendMessage('admin.withdraw-btc', { userId: user.id, amount: parsedAmount });
          setMessage(`✅ ₿${parsedAmount} withdrawn successfully`);
        }
        setBtcAmount('');
      }
      
      onUserUpdated();
      
      // Refresh balance for persistent top bar if this is the current user
      refreshBalance();
    } catch (error: any) {
      setError(error.message || `Failed to ${operation} ${currency}`);
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
      await sendMessage('admin.change-user-password', { userId: user.id, newPassword });
      setMessage('✅ Password updated successfully');
      setNewPassword('');
    } catch (error: any) {
      setError(error.message || 'Failed to update password');
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
      await sendMessage('admin.delete-user', { userId: user.id });
      setMessage('User deleted successfully');
      setTimeout(() => {
        onUserUpdated();
        onClose();
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete user');
      setIsLoading(false);
    }
  };

  const handleExternalBuy = async () => {
    if (!externalInrAmount || !externalBtcAmount || parseFloat(externalInrAmount) <= 0 || parseFloat(externalBtcAmount) <= 0) {
      setError('Please enter valid ₹ and ₿ amounts');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const inrAmount = parseInt(externalInrAmount);
      const btcAmount = parseFloat(externalBtcAmount);
      
      if (!Number.isInteger(inrAmount)) {
        setError('₹ amount must be a whole number');
        return;
      }

      await sendMessage('admin.external-buy', { userId: user.id, inrAmount, btcAmount });
      setMessage(`✅ External buy recorded: ${formatCurrencyInr(inrAmount)} → ₿${btcAmount}`);
      setExternalInrAmount('');
      setExternalBtcAmount('');
      onUserUpdated();
      
      // Refresh balance for persistent top bar if this is the current user
      refreshBalance();
    } catch (error: any) {
      setError(error.message || 'Failed to record external buy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden">
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
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-zinc-400 text-sm">Email</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-400 text-sm">Member Since</p>
                  <p className="text-white font-medium">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-400 text-sm">Role</p>
                  <p className="text-white font-medium">{user.is_admin ? 'Admin' : 'User'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                  <DollarSign className="w-6 h-6 text-white mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">₹ Balance</p>
            <p className="text-white font-bold">{formatCurrencyInr(user.inr_balance)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                  <Bitcoin className="w-6 h-6 text-white mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">₿ Balance</p>
                  <p className="text-white font-bold">₿{formatBitcoin(user.btc_balance)}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  requirePinConfirmation(
                    handleDeleteUser,
                    'Confirm Delete User',
                    `Are you sure you want to delete user "${user.name}"? This action cannot be undone.`
                  );
                }}
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
                  <p className="text-zinc-400 text-xs">₹ Balance</p>
                    <p className="text-white font-bold text-lg">{formatCurrencyInr(user.inr_balance)}</p>
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
                    ₹
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
                    ₿
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
                      inputMode={balanceMode === 'INR' ? 'numeric' : 'decimal'}
                      pattern={balanceMode === 'INR' ? '[0-9]*' : '[0-9]*[.]?[0-9]*'}
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
                      onClick={() => {
                        const amount = balanceMode === 'INR' ? inrAmount : btcAmount;
                        const currency = balanceMode;
                        requirePinConfirmation(
                          () => handleBalanceOperation('deposit', currency),
                          'Confirm Deposit',
                          `Deposit ${currency === 'INR' ? formatCurrencyInr(parseFloat(amount)) : '₿' + amount} to ${user.name}?`
                        );
                      }}
                      disabled={isLoading || (balanceMode === 'INR' ? !inrAmount : !btcAmount)}
                      className="bg-green-900/20 border border-green-800 text-green-300 hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Deposit
                    </button>
                    <button
                      onClick={() => {
                        const amount = balanceMode === 'INR' ? inrAmount : btcAmount;
                        const currency = balanceMode;
                        requirePinConfirmation(
                          () => handleBalanceOperation('withdraw', currency),
                          'Confirm Withdrawal',
                          `Withdraw ${currency === 'INR' ? formatCurrencyInr(parseFloat(amount)) : '₿' + amount} from ${user.name}?`
                        );
                      }}
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
                    <p className="text-zinc-400 text-xs">₹ Balance</p>
                    <p className="text-white font-bold text-lg">{formatCurrencyInr(user.inr_balance)}</p>
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
                      <label className="block text-zinc-400 text-sm mb-2">₹ Amount</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        step="1"
                        value={externalInrAmount}
                        onChange={(e) => setExternalInrAmount(e.target.value)}
                        placeholder="10000"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-2">₿ Amount</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
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
                        {formatCurrencyInr(parseFloat(externalInrAmount) / parseFloat(externalBtcAmount))} per BTC
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      requirePinConfirmation(
                        handleExternalBuy,
                        'Confirm External Buy',
                        `Record external Bitcoin purchase: ${formatCurrencyInr(parseFloat(externalInrAmount))} → ₿${externalBtcAmount} for ${user.name}?`
                      );
                    }}
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
                  <strong>Note:</strong> This creates two transactions: a deposit of the ₹ amount (timestamped a few seconds earlier) and a buy transaction for the Bitcoin amount at the calculated rate.
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
                    onClick={() => {
                      requirePinConfirmation(
                        handlePasswordReset,
                        'Confirm Password Reset',
                        `Reset password for ${user.name}?`
                      );
                    }}
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
      
      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title={pinModalTitle}
        message={pinModalMessage}
        isLoading={isLoading}
      />
    </div>
  );
};

export default UserManagementModal;
