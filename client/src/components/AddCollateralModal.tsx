import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, TrendingUp, Shield, Bitcoin } from 'lucide-react';
import { userAPI } from '../services/api';
import { LoanStatus } from '../types';
import { formatBitcoin } from '../utils/formatters';
import PinConfirmationModal from './PinConfirmationModal';
import { useBalance } from '../contexts/BalanceContext';

interface AddCollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  onSuccess: () => void;
}

const AddCollateralModal: React.FC<AddCollateralModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  onSuccess
}) => {
  const [collateralAmount, setCollateralAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [availableBtc, setAvailableBtc] = useState(0);
  const { updateBalance } = useBalance();

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBalance();
    }
  }, [isOpen]);

  const fetchAvailableBalance = async () => {
    try {
      const dashboardResponse = await userAPI.getDashboard();
      setAvailableBtc(dashboardResponse.data.data?.balances.btc || 0);
    } catch (error) {
      console.error('Error fetching available balance:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      setError('Please enter a valid collateral amount');
      return;
    }

    const btcAmount = parseFloat(collateralAmount);
    if (btcAmount > availableBtc) {
      setError('Insufficient Bitcoin balance');
      return;
    }

    setError('');
    setShowPinModal(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Verify PIN first
      const pinResponse = await userAPI.verifyPin(pin);
      if (!pinResponse.data.data?.valid) {
        return false;
      }

      // Add collateral
      await userAPI.addCollateralToLoan(parseFloat(collateralAmount));
      
      // Update balance
      await updateBalance();
      
      setShowPinModal(false);
      onSuccess();
      return true;
    } catch (error: any) {
      console.error('Add collateral error:', error);
      setError(error.response?.data?.message || 'Failed to add collateral');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCollateralAmount('');
      setError('');
      setShowPinModal(false);
      onClose();
    }
  };

  const getMaxAmount = () => {
    return availableBtc.toFixed(8);
  };

  const calculateNewMetrics = () => {
    if (!loanStatus || !collateralAmount) return null;

    const additionalBtc = parseFloat(collateralAmount);
    const currentBtc = loanStatus.collateralAmount / 100000000;
    const newTotalBtc = currentBtc + additionalBtc;
    
    // Calculate new max borrowable (60% LTV)
    const newMaxBorrowable = Math.floor((newTotalBtc * loanStatus.currentBtcPrice * 60) / 100);
    const newAvailableCapacity = newMaxBorrowable - loanStatus.borrowedAmount;
    
    // Calculate new LTV
    const newCurrentLtv = (loanStatus.borrowedAmount / (newTotalBtc * loanStatus.currentBtcPrice)) * 100;
    
    return {
      newTotalBtc,
      newMaxBorrowable,
      newAvailableCapacity,
      newCurrentLtv
    };
  };

  const newMetrics = calculateNewMetrics();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
        <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-900/50 rounded-lg">
                <Plus className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Add Collateral</h2>
                <p className="text-zinc-400 text-sm">Improve your loan position</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Current Loan Info */}
          {loanStatus && (
            <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-400">Current Collateral</p>
                  <p className="text-white font-medium">
                    ₿{formatBitcoin(loanStatus.collateralAmount / 100000000)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">Current LTV</p>
                  <p className="text-white font-medium">
                    {loanStatus.currentLtv.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">Borrowed</p>
                  <p className="text-white font-medium">
                    ₹{loanStatus.borrowedAmount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">Available to Borrow</p>
                  <p className="text-white font-medium">
                    ₹{loanStatus.availableCapacity.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Available Balance */}
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Available Bitcoin:</span>
              <span className="font-medium">
                ₿{formatBitcoin(availableBtc)}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Collateral Amount Input */}
            <div>
              <label htmlFor="collateralAmount" className="block text-sm font-medium text-zinc-300 mb-2">
                Additional Collateral Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  id="collateralAmount"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.00000001"
                  step="0.00000001"
                  min="0"
                  max={getMaxAmount()}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                  disabled={loading}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Bitcoin className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              
              {/* Percentage Quick Select Buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setCollateralAmount((availableBtc * 0.25).toFixed(8))}
                  className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
                  disabled={loading}
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => setCollateralAmount((availableBtc * 0.5).toFixed(8))}
                  className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
                  disabled={loading}
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setCollateralAmount((availableBtc * 0.75).toFixed(8))}
                  className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
                  disabled={loading}
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => setCollateralAmount(getMaxAmount())}
                  className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
                  disabled={loading}
                >
                  Max
                </button>
              </div>
            </div>

            {/* New Metrics Preview */}
            {newMetrics && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium text-sm">After Adding Collateral</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-300">Total Collateral</p>
                    <p className="text-white font-medium">
                      ₿{formatBitcoin(newMetrics.newTotalBtc)}
                    </p>
                  </div>
                  <div>
                    <p className="text-green-300">New LTV</p>
                    <p className="text-white font-medium">
                      {newMetrics.newCurrentLtv.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-green-300">Max Borrowable</p>
                    <p className="text-white font-medium">
                      ₹{newMetrics.newMaxBorrowable.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-green-300">New Available to Borrow</p>
                    <p className="text-white font-medium">
                      ₹{newMetrics.newAvailableCapacity.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="text-zinc-300 text-xs">
                  <p>Adding collateral improves LTV ratio, increases borrowing capacity, and reduces liquidation risk.</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-200 text-sm">{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 py-3 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !collateralAmount || parseFloat(collateralAmount) <= 0 || parseFloat(collateralAmount) > availableBtc}
                className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-600 rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Collateral
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onConfirm={handlePinConfirm}
        title="Confirm Collateral Addition"
        message={`Add ₿${formatBitcoin(parseFloat(collateralAmount || '0'))} as additional collateral?`}
        isLoading={loading}
      />
    </>
  );
};

export default AddCollateralModal;
