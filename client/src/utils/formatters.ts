import { Transaction } from '../types';

export const getTransactionDisplayName = (type: Transaction['type'], status?: string): string => {
  const displayNames = {
    'DEPOSIT_INR': 'Cash Deposit',
    'BUY': '₿ Market Buy',
    'MARKET_BUY': '₿ Market Buy',
    'SELL': '₿ Market Sell', 
    'MARKET_SELL': '₿ Market Sell',
    'LIMIT_BUY': status === 'PENDING' ? '₿ Limit Buy Order' : 
                 status === 'CANCELLED' ? '₿ Limit Buy Cancelled' : '₿ Limit Buy Filled',
    'LIMIT_SELL': status === 'PENDING' ? '₿ Limit Sell Order' : 
                  status === 'CANCELLED' ? '₿ Limit Sell Cancelled' : '₿ Limit Sell Filled',
    'WITHDRAW_INR': 'Cash Withdrawal',
    'DEPOSIT_BTC': '₿ Deposit',
    'WITHDRAW_BTC': '₿ Withdrawal',
    'DCA_BUY': '₿ DCA Buy',
    'DCA_SELL': '₿ DCA Sell',
    'LOAN_CREATE': 'Loan Creation',
    'LOAN_BORROW': 'Cash Borrowed',
    'LOAN_REPAY': 'Loan Repay',
    'LOAN_ADD_COLLATERAL': 'Collateral Deposit',
    'INTEREST_ACCRUAL': 'Interest Accrual',
    'PARTIAL_LIQUIDATION': 'Partial Liquidation',
    'FULL_LIQUIDATION': 'Full Liquidation'
  };
  
  return displayNames[type] || type;
};

export const getTransactionIcon = (type: Transaction['type'], status?: string): string => {
  const icons = {
    'DEPOSIT_INR': 'ArrowUp',
    'BUY': 'TrendingUp',
    'MARKET_BUY': 'TrendingUp',
    'SELL': 'TrendingDown',
    'MARKET_SELL': 'TrendingDown',
    'LIMIT_BUY': status === 'PENDING' ? 'Target' : 
                 status === 'CANCELLED' ? 'X' : 'TrendingUp',
    'LIMIT_SELL': status === 'PENDING' ? 'Target' : 
                  status === 'CANCELLED' ? 'X' : 'TrendingDown',
    'WITHDRAW_INR': 'ArrowDown',
    'DEPOSIT_BTC': 'Plus',
    'WITHDRAW_BTC': 'Minus',
    'DCA_BUY': 'Repeat',
    'DCA_SELL': 'Repeat',
    'LOAN_CREATE': 'Lock',
    'LOAN_BORROW': 'ArrowDown',
    'LOAN_REPAY': 'ArrowUp',
    'LOAN_ADD_COLLATERAL': 'Plus',
    'INTEREST_ACCRUAL': 'Clock',
    'PARTIAL_LIQUIDATION': 'AlertTriangle',
    'FULL_LIQUIDATION': 'Zap'
  };
  
  return icons[type] || 'Circle';
};

export const getTransactionColor = (type: Transaction['type']): string => {
  return 'text-white';
};

export const formatCurrency = (amount: number, currency: 'INR' | 'BTC'): string => {
  if (currency === 'INR') {
    return formatCurrencyInr(amount);
  } else {
    return formatBitcoinDisplay(amount);
  }
};

export const formatBitcoin = (amount: number): string => {
  if (amount === 0) return '0';
  const formatted = amount.toFixed(8);
  // Remove trailing zeros but keep at least one decimal place for small amounts
  const trimmed = formatted.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed;
};

// Standardized INR formatting - ensures all INR values use the same format
export const formatInr = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// Standardized Bitcoin amount formatting - ensures all BTC values use the same format
export const formatBtc = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return '₿0';
  }
  return formatBitcoinDisplay(amount);
};

export const formatBitcoinWithINRValue = (btcAmount: number, sellRate: number): string => {
  const btcFormatted = formatBitcoin(btcAmount);
  const inrValue = Math.round(btcAmount * sellRate);
  return `₿${btcFormatted} (₹${inrValue.toLocaleString('en-IN')})`;
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
};

export const getPerformanceColor = (value: number): string => {
  return 'text-white';
};

export const formatPercentage = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return '0.00%';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatCurrencyInr = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

export const formatBitcoinDisplay = (amount: number): string => {
  if (amount === 0) return '₿0';
  
  // For display purposes, show appropriate precision
  if (amount >= 1) {
    return `₿${amount.toFixed(4)}`; // 4 decimal places for amounts >= 1 BTC
  } else if (amount >= 0.001) {
    return `₿${amount.toFixed(6)}`; // 6 decimal places for amounts >= 0.001 BTC
  } else {
    return `₿${formatBitcoin(amount)}`; // Use existing formatter for small amounts
  }
};

// Input-specific formatting that preserves trailing zeros for better UX
export const formatBitcoinInput = (value: string): string => {
  // If value is empty, return ₿0
  if (!value || value === '') return '₿0';
  
  // If value is just a decimal point, show it as is
  if (value === '.') return '₿.';
  
  // If value ends with decimal point, preserve it
  if (value.endsWith('.')) return `₿${value}`;
  
  // If value has trailing zeros after decimal point, preserve them
  if (value.includes('.')) {
    return `₿${value}`;
  }
  
  // For whole numbers, just add the symbol
  return `₿${value}`;
};

export const formatInrInput = (value: string): string => {
  // If value is empty, return ₹0
  if (!value || value === '') return '₹0';
  
  // For INR, just add the symbol (no decimal places needed)
  return `₹${value}`;
};
