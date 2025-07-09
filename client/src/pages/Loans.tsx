import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  Shield, 
  Plus, 
  ArrowDown,
  ArrowUp,
  Zap,
  User,
  TrendingDown,
  Minus,
  Circle,
  Target,
  X,
  Repeat,
  Lock,
  Clock
} from 'lucide-react';
import { userAPI } from '../services/api';
import { LoanStatus, LoanHistory, Transaction } from '../types';
import { formatBitcoin, getTransactionDisplayName, getTransactionIcon, formatTimeAgo, formatCurrency } from '../utils/formatters';
import DepositCollateralModal from '../components/DepositCollateralModal';
import BorrowModal from '../components/BorrowModal';
import RepayModal from '../components/RepayModal';
import AddCollateralModal from '../components/AddCollateralModal';
import TransactionDetailModal from '../components/TransactionDetailModal';

const Loans: React.FC = () => {
  const [loanStatus, setLoanStatus] = useState<LoanStatus | null>(null);
  const [loanHistory, setLoanHistory] = useState<LoanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);
  const [showFullLiquidationModal, setShowFullLiquidationModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  useEffect(() => {
    fetchLoanData();
  }, []);

  const fetchLoanData = async () => {
    try {
      setLoading(true);
      
      // Try to get loan status
      try {
        const statusResponse = await userAPI.getLoanStatus();
        setLoanStatus(statusResponse.data.data || null);
        
        // If we have an active loan, get history
        if (statusResponse.data.data) {
          const historyResponse = await userAPI.getLoanHistory();
          setLoanHistory(historyResponse.data.data || []);
        }
      } catch (statusError: any) {
        if (statusError.response?.status === 404) {
          // No active loan found
          setLoanStatus(null);
          setLoanHistory([]);
        } else {
          throw statusError;
        }
      }
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error fetching loan data');
    } finally {
      setLoading(false);
    }
  };

  const handleFullLiquidation = async () => {
    try {
      await userAPI.executeFullLiquidation();
      setShowFullLiquidationModal(false);
      fetchLoanData(); // Refresh data
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error executing full liquidation');
    }
  };

  const getRiskColor = (riskStatus: string) => {
    switch (riskStatus) {
      case 'SAFE':
        return 'text-green-400';
      case 'WARNING':
        return 'text-yellow-400';
      case 'LIQUIDATE':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getRiskIcon = (riskStatus: string) => {
    switch (riskStatus) {
      case 'SAFE':
        return <Shield className="w-4 h-4" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4" />;
      case 'LIQUIDATE':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const handleTransactionClick = (transaction: LoanHistory) => {
    // Convert LoanHistory to Transaction format for the modal
    const transactionData: Transaction = {
      id: Date.now(), // Generate a temporary ID
      user_id: 0,
      type: transaction.type as Transaction['type'],
      status: transaction.status || 'EXECUTED',
      inr_amount: transaction.inr_amount,
      btc_amount: transaction.btc_amount,
      btc_price: 0,
      notes: transaction.notes,
      executed_at: transaction.executed_at,
      created_at: transaction.created_at
    };
    setSelectedTransaction(transactionData);
    setIsTransactionModalOpen(true);
  };

  const getIconComponent = (iconName: string) => {
    const iconProps = { className: "w-3 h-3 text-white" };
    switch (iconName) {
      case 'User': return <User {...iconProps} />;
      case 'ArrowUp': return <ArrowUp {...iconProps} />;
      case 'TrendingUp': return <TrendingUp {...iconProps} />;
      case 'TrendingDown': return <TrendingDown {...iconProps} />;
      case 'ArrowDown': return <ArrowDown {...iconProps} />;
      case 'Plus': return <Plus {...iconProps} />;
      case 'Minus': return <Minus {...iconProps} />;
      case 'Target': return <Target {...iconProps} />;
      case 'X': return <X {...iconProps} />;
      case 'Repeat': return <Repeat {...iconProps} />;
      case 'Lock': return <Lock {...iconProps} />;
      case 'Clock': return <Clock {...iconProps} />;
      case 'AlertTriangle': return <AlertTriangle {...iconProps} />;
      case 'Zap': return <Zap {...iconProps} />;
      default: return <Circle {...iconProps} />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-white" />
          <div>
            <h1 className="text-2xl font-bold">Bitcoin Loans</h1>
            <p className="text-zinc-400">Borrow against your Bitcoin</p>
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-6 animate-pulse">
          <div className="h-4 bg-zinc-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-zinc-700 rounded"></div>
            <div className="h-3 bg-zinc-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet className="w-8 h-8 text-white" />
        <div>
          <h1 className="text-2xl font-bold">Bitcoin Loans</h1>
          <p className="text-zinc-400">Borrow against your Bitcoin</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Loan Status */}
      {loanStatus ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Active Loan</h2>
            <div className={`flex items-center gap-2 ${getRiskColor(loanStatus.riskStatus)}`}>
              {getRiskIcon(loanStatus.riskStatus)}
              <span className="text-sm font-medium">{loanStatus.riskStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">Collateral</p>
              <p className="text-white font-semibold">
                ₿{formatBitcoin(loanStatus.collateralAmount / 100000000)}
              </p>
              <p className="text-zinc-500 text-xs">
                ₹{Math.floor((loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">Borrowed</p>
              <p className="text-white font-semibold">
                ₹{loanStatus.borrowedAmount.toLocaleString('en-IN')}
              </p>
              <p className="text-zinc-500 text-xs">
                {loanStatus.currentLtv.toFixed(1)}% LTV
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">Available to Borrow</p>
              <p className="text-white font-semibold">
                ₹{loanStatus.availableCapacity.toLocaleString('en-IN')}
              </p>
              <p className="text-zinc-500 text-xs">
                Max {loanStatus.ltvRatio}% LTV
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">Interest Rate</p>
              <p className="text-white font-semibold">
                {loanStatus.interestRate}% APR
              </p>
              <p className="text-zinc-500 text-xs">
                Daily compound
              </p>
            </div>
          </div>

          {/* Liquidation Warning */}
          {loanStatus.riskStatus !== 'SAFE' && (
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-medium">
                  {loanStatus.riskStatus === 'WARNING' ? 'Liquidation Warning' : 'Liquidation Risk'}
                </span>
              </div>
              <p className="text-yellow-200 text-sm">
                {loanStatus.riskStatus === 'WARNING' 
                  ? 'Your loan is approaching liquidation threshold. Consider repaying or adding collateral.'
                  : 'Your loan is at risk of liquidation. Take immediate action to avoid losing collateral.'
                }
              </p>
              <p className="text-yellow-300 text-xs mt-1">
                Liquidation Price: ₹{loanStatus.liquidationPrice.toLocaleString('en-IN')} per BTC
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowBorrowModal(true)}
              disabled={loanStatus.availableCapacity <= 0}
              className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowDown className="w-4 h-4" />
              Borrow
            </button>
            
            <button
              onClick={() => setShowRepayModal(true)}
              disabled={loanStatus.borrowedAmount <= 0}
              className="bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUp className="w-4 h-4" />
              Repay
            </button>
            
            <button
              onClick={() => setShowAddCollateralModal(true)}
              className="bg-green-700 text-white hover:bg-green-600 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Collateral
            </button>
            
            <button
              onClick={() => setShowFullLiquidationModal(true)}
              className="bg-red-700 text-white hover:bg-red-600 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Close Loan
            </button>
          </div>
        </div>
      ) : (
        /* No Active Loan */
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <Wallet className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Loan</h2>
          <p className="text-zinc-400 mb-6">
            Deposit Bitcoin as collateral to start borrowing INR
          </p>
          <button
            onClick={() => setShowDepositModal(true)}
            className="bg-white text-black hover:bg-zinc-200 py-3 px-6 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Deposit Collateral
          </button>
        </div>
      )}

      {/* Loan History */}
      {loanHistory.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">Loan History</h2>
          </div>
          
          <div className="p-4">
            <div className="space-y-3">
              {loanHistory.map((item, index) => (
                <div 
                  key={index} 
                  onClick={() => handleTransactionClick(item)}
                  className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-700 rounded-lg">
                        {getIconComponent(getTransactionIcon(item.type, item.status))}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white text-sm">
                            {getTransactionDisplayName(item.type, item.status)}
                          </p>
                          {item.status === 'PENDING' && (
                            <span className="px-1.5 py-0.5 text-xs bg-orange-900/20 border border-orange-800 text-orange-300 rounded">
                              PENDING
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-xs">
                          {formatTimeAgo(item.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.type === 'LOAN_CREATE' ? (
                        <div>
                          <p className="font-bold text-sm text-white">
                            {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Collateral Locked
                          </p>
                        </div>
                      ) : item.type === 'LOAN_ADD_COLLATERAL' ? (
                        <div>
                          <p className="font-bold text-sm text-white">
                            {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Collateral Added
                          </p>
                        </div>
                      ) : item.type.includes('LOAN') || item.type.includes('INTEREST') || item.type.includes('LIQUIDATION') ? (
                        <div>
                          {item.inr_amount > 0 && (
                            <p className="font-bold text-sm text-white">
                              ₹{item.inr_amount.toLocaleString('en-IN')}
                            </p>
                          )}
                          {item.btc_amount > 0 && (
                            <p className="text-xs text-zinc-400">
                              {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold text-sm text-white">
                          {item.inr_amount > 0 ? `₹${item.inr_amount.toLocaleString('en-IN')}` : 
                           item.btc_amount > 0 ? formatCurrency(item.btc_amount / 100000000, 'BTC') : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DepositCollateralModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => {
          setShowDepositModal(false);
          fetchLoanData();
        }}
      />

      <BorrowModal
        isOpen={showBorrowModal}
        onClose={() => setShowBorrowModal(false)}
        loanStatus={loanStatus}
        onSuccess={() => {
          setShowBorrowModal(false);
          fetchLoanData();
        }}
      />

      <RepayModal
        isOpen={showRepayModal}
        onClose={() => setShowRepayModal(false)}
        loanStatus={loanStatus}
        onSuccess={() => {
          setShowRepayModal(false);
          fetchLoanData();
        }}
      />

      <AddCollateralModal
        isOpen={showAddCollateralModal}
        onClose={() => setShowAddCollateralModal(false)}
        loanStatus={loanStatus}
        onSuccess={() => {
          setShowAddCollateralModal(false);
          fetchLoanData();
        }}
      />

      {/* Full Liquidation Confirmation Modal */}
      {showFullLiquidationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/50 rounded-lg">
                <Zap className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Close Loan</h2>
                <p className="text-zinc-400 text-sm">This will liquidate your collateral</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
              <p className="text-red-200 text-sm">
                This will sell enough of your Bitcoin collateral to repay the loan completely. 
                Any remaining Bitcoin will be returned to your available balance.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFullLiquidationModal(false)}
                className="flex-1 bg-zinc-700 text-white hover:bg-zinc-600 py-3 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFullLiquidation}
                className="flex-1 bg-red-700 text-white hover:bg-red-600 py-3 rounded-lg font-medium transition-colors"
              >
                Close Loan
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        transaction={selectedTransaction}
        onTransactionUpdate={fetchLoanData}
      />
    </div>
  );
};

export default Loans;
