import { Transaction } from '../types';

export const getTransactionDisplayName = (type: Transaction['type'], status?: string): string => {
  const displayNames = {
    'SETUP': 'Account Setup',
    'DEPOSIT_INR': 'Cash Top-up',
    'BUY': 'Bitcoin Purchase',
    'MARKET_BUY': 'Bitcoin Purchase',
    'SELL': 'Bitcoin Sale', 
    'MARKET_SELL': 'Bitcoin Sale',
    'LIMIT_BUY': status === 'PENDING' ? 'Limit Buy Order' : 
                 status === 'CANCELLED' ? 'Limit Buy Cancelled' : 'Limit Buy Filled',
    'LIMIT_SELL': status === 'PENDING' ? 'Limit Sell Order' : 
                  status === 'CANCELLED' ? 'Limit Sell Cancelled' : 'Limit Sell Filled',
    'WITHDRAW_INR': 'Cash Withdrawal',
    'DEPOSIT_BTC': 'Bitcoin Deposit',
    'WITHDRAW_BTC': 'Bitcoin Withdrawal',
    'DCA_BUY': 'DCA Bitcoin Purchase',
    'DCA_SELL': 'DCA Bitcoin Sale'
  };
  
  return displayNames[type] || type;
};

export const getTransactionIcon = (type: Transaction['type'], status?: string): string => {
  const icons = {
    'SETUP': 'User',
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
    'DCA_SELL': 'Repeat'
  };
  
  return icons[type] || 'Circle';
};

export const getTransactionColor = (type: Transaction['type']): string => {
  return 'text-white';
};

export const formatCurrency = (amount: number, currency: 'INR' | 'BTC'): string => {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  } else {
    return `₿${formatBitcoin(amount)}`;
  }
};

export const formatBitcoin = (amount: number): string => {
  if (amount === 0) return '0';
  const formatted = amount.toFixed(8);
  // Remove trailing zeros but keep at least one decimal place for small amounts
  const trimmed = formatted.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed;
};

export const formatBitcoinWithINRValue = (btcAmount: number, sellRate: number): string => {
  const btcFormatted = formatBitcoin(btcAmount);
  const inrValue = Math.floor(btcAmount * sellRate);
  return `₿${btcFormatted} (₹${inrValue.toLocaleString()})`;
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
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatCurrencyInr = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
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
