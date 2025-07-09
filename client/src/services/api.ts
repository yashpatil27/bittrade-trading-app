import axios, { AxiosResponse } from 'axios';
import { 
  AuthResponse, 
  ApiResponse, 
  DashboardData, 
  TradeRequest, 
  TradeResponse,
  Transaction,
  AdminDashboardData,
  AdminUser,
  LoanDepositResponse,
  LoanBorrowResponse,
  LoanRepayResponse,
  LoanStatus,
  LoanHistory,
  LiquidationRisk,
  FullLiquidationResponse
} from '../types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Error:', error.response?.status, error.response?.data?.message);
    
    if (error.response?.status === 401) {
      console.log('Authentication error - logging out');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 429) {
      console.warn('Rate limit exceeded - not logging out');
      // Don't logout on rate limit, just show error
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (email: string, name: string, password: string, pin: string): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register', { email, name, password, pin }),
  
  login: (email: string, password: string): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login', { email, password }),
  
  profile: (): Promise<AxiosResponse<ApiResponse<{ user: any }>>> =>
    api.get('/auth/profile'),
  
  logout: (): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/logout'),
};

// User API
export const userAPI = {
  getDashboard: (): Promise<AxiosResponse<ApiResponse<DashboardData>>> =>
    api.get('/user/dashboard'),
  
  getBalances: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/user/balances'),
  
  getPrices: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/user/prices'),
  
  buyBitcoin: (data: TradeRequest): Promise<AxiosResponse<ApiResponse<TradeResponse>>> =>
    api.post('/user/buy', data),
  
  sellBitcoin: (data: TradeRequest): Promise<AxiosResponse<ApiResponse<TradeResponse>>> =>
    api.post('/user/sell', data),
  
  placeLimitBuyOrder: (data: { inrAmount: number; targetPrice: number }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/user/limit-buy', { amount: data.inrAmount, targetPrice: data.targetPrice }),
  
  placeLimitSellOrder: (data: { btcAmount: number; targetPrice: number }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/user/limit-sell', { amount: data.btcAmount, targetPrice: data.targetPrice }),
  
  getRecentTransactions: (limit = 5): Promise<AxiosResponse<ApiResponse<Transaction[]>>> =>
    api.get(`/user/transactions/recent?limit=${limit}`),
  
  getAllTransactions: (page = 1, limit = 20): Promise<AxiosResponse<ApiResponse<{ transactions: Transaction[], pagination: any }>>> =>
    api.get(`/user/transactions?page=${page}&limit=${limit}`),
  
  portfolio: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/user/portfolio'),
  
  updateProfile: (data: { name?: string; email?: string; currentPassword: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch('/user/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch('/user/password', data),
  
  verifyPin: (pin: string): Promise<AxiosResponse<ApiResponse<{ valid: boolean }>>> =>
    api.post('/user/verify-pin', { pin }),
  
  changePin: (data: { newPin: string; currentPassword: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch('/user/pin', data),
  
  exportData: (): Promise<AxiosResponse<string>> =>
    api.get('/user/export-data', { responseType: 'text' }),
  
  getBitcoinData: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/user/bitcoin/data'),
  
  getBitcoinSentiment: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/user/bitcoin/sentiment'),
  
  getLimitOrders: (): Promise<AxiosResponse<ApiResponse<Transaction[]>>> =>
    api.get('/user/limit-orders'),
  
  cancelLimitOrder: (orderId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/user/limit-orders/${orderId}`),
  
  createDcaBuyPlan: (data: {
    amountPerExecution: number;
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    totalExecutions?: number;
    maxPrice?: number;
    minPrice?: number;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/user/dca-buy', data),
  
  createDcaSellPlan: (data: {
    amountPerExecution: number;
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    totalExecutions?: number;
    maxPrice?: number;
    minPrice?: number;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/user/dca-sell', data),
  
  getDcaPlans: (): Promise<AxiosResponse<ApiResponse<any[]>>> =>
    api.get('/user/dca-plans'),
  
  cancelDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/user/dca-plans/${planId}`),

  pauseDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch(`/user/dca-plans/${planId}/pause`),

  resumeDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch(`/user/dca-plans/${planId}/resume`),

  // Loan APIs
  depositCollateral: (collateralAmount: number): Promise<AxiosResponse<ApiResponse<LoanDepositResponse>>> =>
    api.post('/user/loan/deposit-collateral', { collateralAmount }),
  
  borrowFunds: (amount: number): Promise<AxiosResponse<ApiResponse<LoanBorrowResponse>>> =>
    api.post('/user/loan/borrow', { amount }),
  
  repayFunds: (amount: number): Promise<AxiosResponse<ApiResponse<LoanRepayResponse>>> =>
    api.post('/user/loan/repay', { amount }),
  
  addCollateralToLoan: (collateralAmount: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/user/loan/add-collateral', { collateralAmount }),
  
  getLoanStatus: (): Promise<AxiosResponse<ApiResponse<LoanStatus>>> =>
    api.get('/user/loan/status'),
  
  getLoanHistory: (loanId?: number): Promise<AxiosResponse<ApiResponse<LoanHistory[]>>> =>
    api.get(`/user/loan/history${loanId ? `?loanId=${loanId}` : ''}`),
  
  executeFullLiquidation: (): Promise<AxiosResponse<ApiResponse<FullLiquidationResponse>>> =>
    api.post('/user/loan/full-liquidation'),
  
  getLiquidationRisk: (): Promise<AxiosResponse<ApiResponse<LiquidationRisk[]>>> =>
    api.get('/user/loan/liquidation-risk'),
};

// Admin API
export const adminAPI = {
  getDashboard: (): Promise<AxiosResponse<ApiResponse<AdminDashboardData>>> =>
    api.get('/admin/dashboard'),
  
  getUsers: (page = 1, limit = 20): Promise<AxiosResponse<ApiResponse<{ users: AdminUser[], pagination: any }>>> =>
    api.get(`/admin/users?page=${page}&limit=${limit}`),
  
  createUser: (userData: { email: string, name: string, password: string, is_admin?: boolean }): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/admin/users', userData),
  
  deleteUser: (userId: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/users/${userId}`),
  
  changeUserPassword: (userId: number, password: string): Promise<AxiosResponse<ApiResponse>> =>
    api.patch(`/admin/users/${userId}/password`, { password }),
  
  depositINR: (userId: number, amount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/deposit-inr`, { amount }),
  
  withdrawINR: (userId: number, amount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/withdraw-inr`, { amount }),
  
  depositBTC: (userId: number, amount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/deposit-btc`, { amount }),
  
  withdrawBTC: (userId: number, amount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/withdraw-btc`, { amount }),
  
  getSettings: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/settings'),
  
  updateSettings: (settings: { buy_multiplier?: number, sell_multiplier?: number, loan_interest_rate?: number }): Promise<AxiosResponse<ApiResponse>> =>
    api.patch('/admin/settings', settings),
  
  getTransactions: (page = 1, limit = 50): Promise<AxiosResponse<ApiResponse<{ transactions: any[], pagination: any }>>> =>
    api.get(`/admin/transactions?page=${page}&limit=${limit}`),
  
  getAllTransactions: (page = 1, limit = 50): Promise<AxiosResponse<ApiResponse<{ transactions: any[], pagination: any }>>> =>
    api.get(`/admin/transactions?page=${page}&limit=${limit}`),
  
  externalBuy: (userId: number, inrAmount: number, btcAmount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/external-buy`, { inrAmount, btcAmount }),
  
  // System health and monitoring
  getSystemHealth: (): Promise<AxiosResponse<any>> =>
    axios.get(`${API_BASE_URL.replace('/api', '')}/health`),
  
  // Limit order management
  getLimitOrdersSummary: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/limit-orders/summary'),
  
  getPendingLimitOrders: (): Promise<AxiosResponse<ApiResponse<any[]>>> =>
    api.get('/admin/limit-orders/pending'),
  
  executeLimitOrders: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/admin/limit-orders/execute'),
  
  cancelLimitOrder: (orderId: number, reason?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/admin/limit-orders/${orderId}`, { data: { reason } }),
  
  controlLimitOrderService: (action: 'start' | 'stop'): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/admin/limit-orders/service/${action}`),
  
  // DCA plans management
  getDcaPlans: (page = 1, limit = 50): Promise<AxiosResponse<ApiResponse<{ dcaPlans: any[], pagination: any }>>> =>
    api.get(`/admin/dca-plans?page=${page}&limit=${limit}`),
  
  getAllDcaPlans: (): Promise<AxiosResponse<ApiResponse<any[]>>> =>
    api.get('/admin/dca-plans'),
  
  pauseDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch(`/admin/dca-plans/${planId}/pause`),
  
  resumeDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.patch(`/admin/dca-plans/${planId}/resume`),
  
  deleteDcaPlan: (planId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/admin/dca-plans/${planId}`),
};

export default api;
