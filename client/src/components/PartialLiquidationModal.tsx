import React, { useState, useEffect } from 'react';
import { X, Zap, Calculator, Info, Bitcoin } from 'lucide-react';
import { userAPI } from '../services/api';
import { LoanStatus } from '../types';
import PinConfirmationModal from './PinConfirmationModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { formatBitcoin, formatCurrencyInr } from '../utils/formatters';

interface PartialLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanStatus: LoanStatus | null;
  onSuccess: () => void;
}

const PartialLiquidationModal: React.FC<PartialLiquidationModalProps> = ({
  isOpen,
  onClose,
  loanStatus,
  onSuccess
}) => {
  const [btcAmount, setBtcAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useBodyScrollLock(isOpen && !isPinModalOpen);

  useEffect(() => {
    if (isOpen && error) {
      setError('');
    }
  }, [isOpen, error]);

  const getTotalDue = () => {
    if (!loanStatus) return 0;
    return loanStatus.borrowedAmount + (loanStatus.minimumInterestDue || 0);
  };

  const handlePartialLiquidation = () => {
    if (!btcAmount || parseFloat(btcAmount) <= 0) {
      setError('Please enter a valid ₿ amount');
      return;
    }

    if (!loanStatus) {
      setError('No active loan found');
      return;
    }

    const btcToLiquidate = parseFloat(btcAmount);
    const maxBtcLiquidation = loanStatus.collateralAmount / 100000000; // Convert satoshis to BTC

    if (btcToLiquidate > maxBtcLiquidation) {
      setError('Amount exceeds available collateral');
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

      // Execute partial liquidation
      await userAPI.executePartialLiquidation(parseFloat(btcAmount));

      setIsPinModalOpen(false);
      onSuccess();
      return true;
    } catch (error: any) {
      console.error('Partial liquidation error:', error);
      // Check if error is from PIN verification or liquidation
      if (error.response?.status === 400 && error.response?.data?.message?.includes('PIN')) {
        return false;
      }
      // If it's a liquidation error, set the error message but don't close the PIN modal
      setError(error.response?.data?.message || 'Error executing partial liquidation');
      setIsPinModalOpen(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
  };

  if (!isOpen || !loanStatus) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Close Loan</h2>
              <p className="text-sm text-zinc-400">
                Liquidate your ₿ collateral to reduce or close debt
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* BTC Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            ₿ to Liquidate
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9]*"
              value={btcAmount}
              onChange={(e) => setBtcAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.01"
              step="0.0001"
              min="0"
              max={loanStatus.collateralAmount / 100000000}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Bitcoin className="w-4 h-4 text-zinc-400" />
            </div>
          </div>

          {/* Percentage Quick Select Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setBtcAmount(((getTotalDue() / loanStatus.currentBtcPrice) * 0.25).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              25%
            </button>
            <button
              onClick={() => setBtcAmount(((getTotalDue() / loanStatus.currentBtcPrice) * 0.5).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              50%
            </button>
            <button
              onClick={() => setBtcAmount(((getTotalDue() / loanStatus.currentBtcPrice) * 0.75).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              75%
            </button>
            <button
              onClick={() => setBtcAmount((getTotalDue() / loanStatus.currentBtcPrice).toFixed(8))}
              className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Liquidation Impact Preview */}
        {btcAmount && parseFloat(btcAmount) > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">Liquidation Impact</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">₿ Liquidated:</span>
                <span className="text-white">
                  ₿{formatBitcoin(parseFloat(btcAmount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Est. ₹ Proceeds:</span>
                <span className="text-white">
                  {formatCurrencyInr(Math.round(parseFloat(btcAmount) * loanStatus.currentBtcPrice))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Remaining Collateral:</span>
                <span className="text-white">
                  ₿{formatBitcoin((loanStatus.collateralAmount / 100000000) - parseFloat(btcAmount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Remaining Debt:</span>
                <span className="text-white">
                  {formatCurrencyInr(Math.round(Math.max(0, getTotalDue() - (parseFloat(btcAmount) * loanStatus.currentBtcPrice))))}
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
              {!btcAmount || parseFloat(btcAmount) === 0 ? (
                <div>
                  <p className="mb-2">Liquidate part of your collateral to reduce debt and improve your position.</p>
                  <p><strong>Note:</strong> Total debt includes principal + 30-day minimum interest.</p>
                </div>
              ) : (
                <div>
                  <p className="mb-2">Bitcoin will be sold at current market price to reduce your loan debt.</p>
                  <p>The proceeds will be applied to your total outstanding balance (principal + interest).</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-700 text-white hover:bg-zinc-600 py-2 rounded-lg font-medium transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handlePartialLiquidation}
            disabled={
              !btcAmount || 
              parseFloat(btcAmount) <= 0 || 
              loading || 
              parseFloat(btcAmount) > (loanStatus.collateralAmount / 100000000)
            }
            className="flex-1 bg-white text-black hover:bg-zinc-200 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Processing...' : 'Liquidate ₿'}
          </button>
        </div>
      </div>

      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title="Confirm Liquidation"
        message={`Enter your PIN to confirm liquidating ${btcAmount} ₿`}
        isLoading={loading}
      />
    </div>
  );
};

export default PartialLiquidationModal;

