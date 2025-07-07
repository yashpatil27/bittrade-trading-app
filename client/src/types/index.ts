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
  type: 'SETUP' | 'DEPOSIT_INR' | 'MARKET_BUY' | 'BUY' | 'MARKET_SELL' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL' | 'WITHDRAW_INR' | 'DEPOSIT_BTC' | 'WITHDRAW_BTC' | 'DCA_BUY' | 'DCA_SELL';
  status?: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  inr_amount: number;
  btc_amount: number;
  btc_price: number;
  inr_balance?: number; // Optional for admin views
  btc_balance?: number; // Optional for admin views
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
