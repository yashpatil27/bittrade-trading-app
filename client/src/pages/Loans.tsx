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
  Clock,
  DollarSign
} from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useBalance } from '../contexts/BalanceContext';
import { LoanStatus, LoanHistory, Transaction, Balances } from '../types';
import { formatBitcoin, getTransactionDisplayName, getTransactionIcon, formatTimeAgo, formatCurrency, formatInr, formatPercentage } from '../utils/formatters';
import DepositCollateralModal from '../components/DepositCollateralModal';
import BorrowModal from '../components/BorrowModal';
import RepayModal from '../components/RepayModal';
import AddCollateralModal from '../components/AddCollateralModal';
import PartialLiquidationModal from '../components/PartialLiquidationModal';
import TransactionDetailModal from '../components/TransactionDetailModal';

const Loans: React.FC = () => {
  const [loanStatus, setLoanStatus] = useState<LoanStatus | null>(null);
  const [loanHistory, setLoanHistory] = useState<LoanHistory[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);
  const [showPartialLiquidationModal, setShowPartialLiquidationModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const { getLoanStatus, getLoanHistory, getDashboard } = useWebSocket();

  useEffect(() => {
    fetchLoanData();
  }, []);

  const fetchLoanData = async () => {
    try {
      setLoading(true);
      
      // Get dashboard data (includes balances)
      const dashboardData = await getDashboard();
      setBalances(dashboardData.balances);
      
      // Try to get loan status
      try {
        const statusResponse = await getLoanStatus();
        
        // Check if user has an active loan
        if (statusResponse && statusResponse.hasActiveLoan) {
          setLoanStatus(statusResponse);
          
          // Get loan history for active loans
          const historyResponse = await getLoanHistory();
          setLoanHistory(historyResponse || []);
        } else {
          // No active loan
          setLoanStatus(null);
          setLoanHistory([]);
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
      setError('Error fetching loan data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskStatus: string) => {
    return 'text-white';
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
        <div className="bg-zinc-800/50 rounded-lg p-4 animate-pulse">
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

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Loan Status */}
      {loanStatus ? (
        <div className="space-y-6">
          {/* Loan Overview Header */}
          <div className="bg-black border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-700 rounded-lg">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Active Loan</h2>
                  <p className="text-zinc-400 text-xs">Loan ID: #{loanStatus.loanId || 'N/A'}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 ${getRiskColor(loanStatus.riskStatus)}`}>
                {getRiskIcon(loanStatus.riskStatus)}
                <span className="text-sm font-medium">{loanStatus.riskStatus}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-400">Loan Duration</p>
                <p className="text-white font-medium">
                  Active loan
                </p>
              </div>
              <div>
                <p className="text-zinc-400">Next Interest</p>
                <p className="text-white font-medium">
                  Daily at 12:00 AM (+{formatInr((loanStatus.borrowedAmount * loanStatus.interestRate / 100) / 365)})
                </p>
                <p className="text-yellow-400 text-xs mt-1">
                  ⚠️ Minimum 30-day interest applies
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary - Reordered 6 boxes */}
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1: Collateral Value, Total Due */}
            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Collateral Value</p>
              </div>
              <p className="text-white font-bold text-sm">
                ₿{formatBitcoin(loanStatus.collateralAmount / 100000000)}
              </p>
              <p className="text-zinc-500 text-xs">
                {formatInr((loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000)}
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {formatInr(loanStatus.currentBtcPrice)}
              </p>
              <div className="mt-auto pt-3">
                <button
                  onClick={() => setShowAddCollateralModal(true)}
                  className="w-full bg-white text-black hover:bg-zinc-200 py-2 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Collateral
                </button>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Total Due</p>
              </div>
              <p className="text-white font-bold text-sm">
                {formatInr(loanStatus.borrowedAmount + (loanStatus.minimumInterestDue || 0))}
              </p>
              <p className="text-zinc-500 text-xs">
                Principal + Minimum Interest
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                To fully repay (30-day minimum)
              </p>
              <div className="mt-auto pt-3">
                <button
                  onClick={() => setShowRepayModal(true)}
                  disabled={loanStatus.borrowedAmount <= 0}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <ArrowUp className="w-4 h-4" />
                  Repay Loan
                </button>
              </div>
            </div>

            {/* Row 2: Available to Borrow, Liquidation Health */}
            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Available to Borrow</p>
              </div>
              <p className="text-white font-bold text-sm">
                {formatInr(loanStatus.availableCapacity)}
              </p>
              <p className="text-zinc-500 text-xs">
                Max {loanStatus.ltvRatio}% LTV
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {formatPercentage((loanStatus.availableCapacity / ((loanStatus.collateralAmount * loanStatus.currentBtcPrice) / 100000000)) * 100)} capacity used
              </p>
              <div className="mt-auto pt-3">
                <button
                  onClick={() => setShowBorrowModal(true)}
                  disabled={loanStatus.availableCapacity <= 0}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <ArrowDown className="w-4 h-4" />
                  Borrow More
                </button>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Liquidation Health</p>
              </div>
              <p className="text-white font-bold text-sm">
                {formatPercentage((loanStatus.currentBtcPrice - loanStatus.liquidationPrice) / loanStatus.currentBtcPrice * 100)} buffer
              </p>
              <p className="text-zinc-500 text-xs">
                {formatInr(loanStatus.currentBtcPrice - loanStatus.liquidationPrice)} margin
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                Liquidation @ {formatInr(loanStatus.liquidationPrice)}
              </p>
              <div className="mt-auto pt-3">
                <button
                  onClick={() => setShowPartialLiquidationModal(true)}
                  className="w-full bg-white text-black hover:bg-zinc-200 py-2 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Close Loan
                </button>
              </div>
            </div>

            {/* Row 3: Interest Accrued, Principal Borrowed (no buttons) */}
            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Interest Accrued</p>
              </div>
              <p className="text-white font-bold text-sm">
                {formatInr(loanStatus.minimumInterestDue || 0)}
              </p>
              <p className="text-zinc-500 text-xs">
                {formatInr((loanStatus.borrowedAmount * loanStatus.interestRate / 100) / 365)}/day
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {loanStatus.interestRate}% APR (30-day minimum)
              </p>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="w-4 h-4 text-white" />
                <p className="text-zinc-400 text-sm">Principal Borrowed</p>
              </div>
              <p className="text-white font-bold text-sm">
                {formatInr(loanStatus.borrowedAmount)}
              </p>
              <p className="text-zinc-500 text-xs">
                {formatPercentage(loanStatus.currentLtv)} LTV
              </p>
              <div className="w-full bg-zinc-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(loanStatus.currentLtv / loanStatus.ltvRatio) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Enhanced Risk Visualization */}
          <div className="bg-black border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold">Liquidation Risk Monitor</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Current Price</span>
                <span className="text-white font-medium">{formatInr(loanStatus.currentBtcPrice)}</span>
              </div>
              
              <div className="relative">
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      loanStatus.riskStatus === 'SAFE' ? 'bg-green-500' :
                      loanStatus.riskStatus === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((loanStatus.currentLtv / 90) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-zinc-400 mt-1">
                  <span>Safe</span>
                  <span>Warning</span>
                  <span>Liquidation</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Liquidation Price</span>
                <span className="text-white font-medium">{formatInr(loanStatus.liquidationPrice)}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Safety Margin</span>
                <span className="text-white font-medium">
                  {formatInr(loanStatus.currentBtcPrice - loanStatus.liquidationPrice)}
                  ({formatPercentage((loanStatus.currentBtcPrice - loanStatus.liquidationPrice) / loanStatus.currentBtcPrice * 100)})
                </span>
              </div>
            </div>
          </div>

          {/* Performance Tracking */}
          <div className="bg-black border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold">Loan Performance</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-400 text-xs">Interest Paid to Date</p>
                <p className="text-white font-semibold text-sm">
                  {formatInr(0)}
                </p>
                <p className="text-zinc-500 text-xs">
                  0% of principal
                </p>
              </div>
              
              <div>
                <p className="text-zinc-400 text-xs">Effective Interest Rate</p>
                <p className="text-white font-semibold text-sm">
                  {loanStatus.interestRate}% APR
                </p>
                <p className="text-zinc-500 text-xs">
                  {formatPercentage(loanStatus.interestRate / 100 / 365)} daily
                </p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* No Active Loan */
        <div className="space-y-3">
          <div className="bg-black border border-zinc-800 rounded-xl p-4 text-center">
            <Wallet className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <h2 className="text-sm font-semibold">No Active Loan</h2>
            <p className="text-zinc-400 mb-4">
              Deposit Bitcoin as collateral to start borrowing ₹
            </p>
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-white text-black hover:bg-zinc-200 py-2 px-4 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Deposit Collateral
            </button>
          </div>
          
          {/* 30-Day Minimum Policy Notice */}
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="p-1 bg-yellow-800/50 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1">Important: 30-Day Minimum Interest</h3>
                <p className="text-yellow-200 text-xs mb-2">
                  All loans are subject to a minimum 30-day interest charge, regardless of repayment timing.
                  This encourages longer-term borrowing and helps us provide better rates.
                </p>
                <div className="text-yellow-300 text-xs">
                  <p>• Early repayment still charges 30 days of interest</p>
                  <p>• Optimal loan duration: 30+ days for best value</p>
                  <p>• No additional fees for longer-term loans</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan History */}
      {loanHistory.length > 0 && (
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold">Loan History</h2>
          </div>
          
          <div className="p-3">
            <div className="space-y-2">
              {loanHistory.map((item, index) => (
                <div 
                  key={index} 
                  onClick={() => handleTransactionClick(item)}
                  className="bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-zinc-700 rounded-lg">
                        {getIconComponent(getTransactionIcon(item.type, item.status))}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white text-xs">
                            {getTransactionDisplayName(item.type, item.status)}
                          </p>
                          {item.status === 'PENDING' && (
                            <span className="px-1 py-0.5 text-xs bg-orange-900/20 border border-orange-800 text-orange-300 rounded">
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
                          <p className="font-bold text-xs text-white">
                            {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Collateral Locked
                          </p>
                        </div>
                      ) : item.type === 'LOAN_ADD_COLLATERAL' ? (
                        <div>
                          <p className="font-bold text-xs text-white">
                            {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Collateral Added
                          </p>
                        </div>
                      ) : item.type.includes('LOAN') || item.type.includes('INTEREST') || item.type.includes('LIQUIDATION') ? (
                        <div>
                          {item.inr_amount > 0 && (
                            <p className="font-bold text-xs text-white">
                              {formatInr(item.inr_amount)}
                            </p>
                          )}
                          {item.btc_amount > 0 && (
                            <p className="text-xs text-zinc-400">
                              {formatCurrency(item.btc_amount / 100000000, 'BTC')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold text-xs text-white">
                          {item.inr_amount > 0 ? formatInr(item.inr_amount) : 
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
        balances={balances}
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

      <PartialLiquidationModal
        isOpen={showPartialLiquidationModal}
        onClose={() => setShowPartialLiquidationModal(false)}
        loanStatus={loanStatus}
        onSuccess={() => {
          setShowPartialLiquidationModal(false);
          fetchLoanData();
        }}
      />

      
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
