import React, { useState, useEffect } from 'react';
import { X, ArrowUp, Calculator, Info } from 'lucide-react';
import { userAPI } from '../services/api';
import { LoanStatus } from '../types';
import { useBalance } from '../contexts/BalanceContext';
import PinConfirmationModal from './PinConfirmationModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  onSuccess: () => void;
}

const RepayModal: React.FC<RepayModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  const { updateBalance } = useBalance();

  useBodyScrollLock(isOpen && !isPinModalOpen);

  useEffect(() => {
    if (isOpen && error) {
      setError('');
    }
    if (isOpen) {
      fetchAvailableBalance();
    }
  }, [isOpen, error]);

  const fetchAvailableBalance = async () => {
    try {
      const response = await userAPI.getDashboard();
      setAvailableBalance(response.data.data?.balances.inr || 0);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const getTotalDue = () => {
    if (!loanStatus) return 0;
    return loanStatus.borrowedAmount + (loanStatus.minimumInterestDue || 0);
  };

  const calculateNewLtv = () => {
    if (!amount || !loanStatus) return loanStatus?.currentLtv || 0;
    const repayAmount = parseFloat(amount);
    const newBorrowedTotal = Math.max(0, loanStatus.borrowedAmount - repayAmount);
    const collateralValue = (loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000;
    return newBorrowedTotal > 0 ? (newBorrowedTotal / collateralValue) * 100 : 0;
  };

  const getRiskColor = (ltv: number) => {
    if (ltv >= 90) return 'text-red-400';
    if (ltv >= 85) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskText = (ltv: number) => {
    if (ltv >= 90) return 'HIGH RISK';
    if (ltv >= 85) return 'MEDIUM RISK';
    return 'LOW RISK';
  };

  const handleRepay = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!loanStatus) {
      setError('No active loan found');
      return;
    }

    const repayAmount = parseFloat(amount);
    if (repayAmount > availableBalance) {
      setError('Insufficient INR balance');
      return;
    }

    if (repayAmount > getTotalDue()) {
      setError('Amount exceeds total due amount');
      return;
    }

    setError('');
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN first
      const pinResponse = await userAPI.verifyPin(pin);
      if (!pinResponse.data.data?.valid) {
        return false;
      }

      // PIN is correct, now proceed with the operation
      setLoading(true);
      
      // Repay funds
      await userAPI.repayFunds(parseFloat(amount));
      
      // Update balance
      await updateBalance();
      
      setIsPinModalOpen(false);
      onSuccess();
      
      return true;
    } catch (error: any) {
      console.error('Repay error:', error);
      setError(error.response?.data?.message || 'Error repaying funds');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
  };

  const getMaxAmount = () => {
    return Math.min(availableBalance, getTotalDue());
  };

  if (!isOpen || !loanStatus) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <ArrowUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Repay Loan</h2>
              <p className="text-sm text-zinc-400">
                Repay your borrowed amount
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Loan Status */}
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400">Total Due</p>
              <p className="text-white font-semibold">
                ₹{getTotalDue().toLocaleString('en-IN')}
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                Principal + Interest
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Available Balance</p>
              <p className="text-white font-semibold">
                ₹{availableBalance.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Amount to Repay (INR)
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="1000"
              step="1"
              min="0"
              max={getMaxAmount()}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 text-sm">
              ₹
            </div>
          </div>
          
          {/* Percentage Quick Select Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setAmount((getTotalDue() * 0.25).toFixed(0))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              25%
            </button>
            <button
              onClick={() => setAmount((getTotalDue() * 0.5).toFixed(0))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              50%
            </button>
            <button
              onClick={() => setAmount((getTotalDue() * 0.75).toFixed(0))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              75%
            </button>
            <button
              onClick={() => setAmount(getMaxAmount().toFixed(0))}
              className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Loan Impact Preview */}
        {amount && parseFloat(amount) > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">Repayment Impact</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Amount Repaid:</span>
                <span className="text-white">
                  ₹{parseFloat(amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Remaining Debt:</span>
                <span className="text-white">
                  ₹{Math.max(0, getTotalDue() - parseFloat(amount)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">New LTV:</span>
                <span className={getRiskColor(calculateNewLtv())}>
                  {calculateNewLtv().toFixed(1)}% ({getRiskText(calculateNewLtv())})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Remaining Balance:</span>
                <span className="text-white">
                  ₹{(availableBalance - parseFloat(amount)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
            <div className="text-zinc-300 text-xs">
              {amount && parseFloat(amount) >= getTotalDue() ? (
                <p><strong>Full repayment</strong> clears all debt. Collateral stays locked for future use.</p>
              ) : (
                <p>Total due = Principal + 30-day minimum interest. Repayment improves LTV ratio.</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleRepay}
            disabled={
              !amount || 
              parseFloat(amount) <= 0 || 
              loading || 
              parseFloat(amount) > getMaxAmount()
            }
            className="flex-1 font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUp className="w-4 h-4" />
                Repay Loan
              </>
            )}
          </button>
        </div>
      </div>

      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title="Confirm Repayment"
        message={`Enter your PIN to confirm repaying ₹${amount}`}
        isLoading={loading}
      />
    </div>
  );
};

export default RepayModal;
