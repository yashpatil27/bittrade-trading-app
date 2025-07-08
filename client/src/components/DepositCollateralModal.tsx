import React, { useState, useEffect } from 'react';
import { X, Wallet, Bitcoin, Calculator, Info } from 'lucide-react';
import { userAPI } from '../services/api';
import { useBalance } from '../contexts/BalanceContext';
import { formatBitcoin } from '../utils/formatters';
import PinConfirmationModal from './PinConfirmationModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface DepositCollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DepositCollateralModal: React.FC<DepositCollateralModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [btcSellRate, setBtcSellRate] = useState(0);
  const [availableBtc, setAvailableBtc] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const { updateBalance } = useBalance();

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const [dashboardResponse, pricesResponse] = await Promise.all([
        userAPI.getDashboard(),
        userAPI.getPrices()
      ]);
      
      setAvailableBtc(dashboardResponse.data.data?.balances.btc || 0);
      setBtcSellRate(pricesResponse.data.data?.sell_rate || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const calculateMaxBorrowable = () => {
    if (!amount || !btcSellRate) return 0;
    const btcAmount = parseFloat(amount);
    const collateralValue = btcAmount * btcSellRate;
    return Math.floor(collateralValue * 0.6); // 60% LTV
  };

  const calculateLiquidationPrice = () => {
    if (!btcSellRate) return 0;
    return Math.floor(btcSellRate * (60 / 90)); // 90% LTV triggers liquidation
  };

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const btcAmount = parseFloat(amount);
    if (btcAmount > availableBtc) {
      setError('Insufficient Bitcoin balance');
      return;
    }

    setError('');
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Verify PIN
      const pinResponse = await userAPI.verifyPin(pin);
      if (!pinResponse.data.data?.valid) {
        return false;
      }

      // Convert BTC to satoshis
      const satoshiAmount = Math.floor(parseFloat(amount) * 100000000);
      
      // Deposit collateral
      await userAPI.depositCollateral(satoshiAmount);
      
      // Update balance
      await updateBalance();
      
      setIsPinModalOpen(false);
      onSuccess();
      
      return true;
    } catch (error: any) {
      console.error('Deposit error:', error);
      setError(error.response?.data?.message || 'Error depositing collateral');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
  };

  const getMaxAmount = () => {
    return availableBtc.toFixed(8);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Deposit Collateral</h2>
              <p className="text-sm text-zinc-400">
                Lock Bitcoin to create loan facility
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

        {/* Available Balance */}
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Available Bitcoin:</span>
            <span className="font-medium">
              ₿{formatBitcoin(availableBtc)}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Bitcoin Amount to Deposit
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.001"
              step="0.00000001"
              min="0"
              max={getMaxAmount()}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Bitcoin className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          
          {/* Percentage Quick Select Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setAmount((availableBtc * 0.25).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              25%
            </button>
            <button
              onClick={() => setAmount((availableBtc * 0.5).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              50%
            </button>
            <button
              onClick={() => setAmount((availableBtc * 0.75).toFixed(8))}
              className="flex-1 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded transition-colors"
            >
              75%
            </button>
            <button
              onClick={() => setAmount(getMaxAmount())}
              className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Loan Terms Preview */}
        {amount && parseFloat(amount) > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">Loan Terms</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Collateral Value:</span>
                <span className="text-white">
                  ₹{Math.floor(parseFloat(amount) * btcSellRate).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Max Borrowable (60% LTV):</span>
                <span className="text-white">
                  ₹{calculateMaxBorrowable().toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Interest Rate:</span>
                <span className="text-white">12% APR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Liquidation Price:</span>
                <span className="text-yellow-400">
                  ₹{calculateLiquidationPrice().toLocaleString('en-IN')} per BTC
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-blue-200 text-sm">
              <p className="mb-1">
                Your Bitcoin will be locked as collateral. You can borrow up to 60% of its value.
              </p>
              <p>
                Liquidation occurs if Bitcoin price drops below the liquidation threshold.
              </p>
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
            onClick={handleDeposit}
            disabled={
              !amount || 
              parseFloat(amount) <= 0 || 
              loading || 
              parseFloat(amount) > availableBtc
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
                <Wallet className="w-4 h-4" />
                Deposit Collateral
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
        title="Confirm Collateral Deposit"
        message={`Enter your PIN to confirm depositing ${amount} BTC as collateral`}
        isLoading={loading}
      />
    </div>
  );
};

export default DepositCollateralModal;
