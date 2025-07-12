export interface User {
  id: number;
  email: string;
  name: string;
  is_admin: boolean | number;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface Balances {
  inr: number;
  btc: number;
}

export interface Prices {
  btc_usd: number;
  buy_rate: number;
  sell_rate: number;
  buy_multiplier?: number;
  sell_multiplier?: number;
  last_update?: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'SETUP' | 'DEPOSIT_INR' | 'MARKET_BUY' | 'BUY' | 'MARKET_SELL' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL' | 'WITHDRAW_INR' | 'DEPOSIT_BTC' | 'WITHDRAW_BTC' | 'DCA_BUY' | 'DCA_SELL' | 'LOAN_CREATE' | 'LOAN_BORROW' | 'LOAN_REPAY' | 'LOAN_ADD_COLLATERAL' | 'INTEREST_ACCRUAL' | 'PARTIAL_LIQUIDATION' | 'FULL_LIQUIDATION';
  status?: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  inr_amount: number;
  btc_amount: number;
  btc_price: number;
  execution_price?: number; // Actual price used for liquidations and trades
  inr_balance?: number; // Optional for admin views
  btc_balance?: number; // Optional for admin views
  loan_id?: number; // For loan operations
  notes?: string; // Additional details
  executed_at?: string; // When operation was executed
  created_at: string;
}

export interface DashboardData {
  balances: Balances;
  prices: Prices;
  recent_transactions: Transaction[];
}

export interface TradeRequest {
  amount: number;
}

export interface TradeResponse {
  transaction_id: number;
  inr_amount: number;
  btc_amount: number;
  buy_rate?: number;
  sell_rate?: number;
  new_balances: Balances;
}

export interface AdminStats {
  total_users: number;
  total_trades: number;
  total_inr_on_platform: number;
  total_btc_on_platform: number;
}

export interface AdminDashboardData {
  stats: AdminStats;
  current_prices: Prices;
}

export interface AdminUser extends User {
  inr_balance: number;
  btc_balance: number;
}

export interface DcaPlan {
  id: number;
  user_id?: number;
  plan_type: 'DCA_BUY' | 'DCA_SELL';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  amount_per_execution: number;
  amount?: number; // For admin interface compatibility
  total_invested?: number; // For admin interface compatibility
  executions_count?: number; // For admin interface compatibility
  next_execution_at: string;
  total_executions: number | null;
  remaining_executions: number | null;
  max_price: number | null;
  min_price: number | null;
  created_at: string;
}

// Loan-related types
export interface LoanDepositResponse {
  loanId: number;
  collateralAmount: number;
  maxBorrowable: number;
  ltvRatio: number;
  interestRate: number;
  liquidationPrice: number;
  currentBtcPrice: number;
}

export interface LoanBorrowResponse {
  loanId: number;
  borrowAmount: number;
  newBorrowedTotal: number;
  availableCapacity: number;
  currentBtcPrice: number;
}

export interface LoanRepayResponse {
  loanId: number;
  repayAmount: number;
  remainingDebt: number;
  loanStatus: 'ACTIVE' | 'REPAID';
  collateralReturned: number;
}

export interface LoanStatus {
  loanId: number;
  collateralAmount: number;
  borrowedAmount: number;
  interestRate: number;
  ltvRatio: number;
  liquidationPrice: number;
  maxBorrowable: number;
  availableCapacity: number;
  currentLtv: number;
  currentBtcPrice: number;
  riskStatus: 'SAFE' | 'WARNING' | 'LIQUIDATE';
  minimumInterestDue?: number;
}

export interface LoanHistory {
  type: 'LOAN_CREATE' | 'LOAN_BORROW' | 'LOAN_REPAY' | 'LOAN_ADD_COLLATERAL' | 'INTEREST_ACCRUAL' | 'PARTIAL_LIQUIDATION' | 'FULL_LIQUIDATION';
  status?: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  inr_amount: number;
  btc_amount: number;
  notes: string;
  created_at: string;
  executed_at?: string;
}

export interface LiquidationRisk {
  id: number;
  user_id: number;
  btc_collateral_amount: number;
  inr_borrowed_amount: number;
  ltv_ratio: number;
  liquidation_price: number;
  current_btc_price: number;
  current_ltv: number;
  risk_status: 'SAFE' | 'WARNING' | 'LIQUIDATE';
}

export interface FullLiquidationResponse {
  loanId: number;
  btcSold: number;
  debtCleared: number;
  collateralReturned: number;
  loanStatus: 'REPAID';
}
