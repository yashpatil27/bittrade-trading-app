import axios, { AxiosResponse } from 'axios';
import { 
  AuthResponse, 
  ApiResponse, 
  DashboardData, 
  TradeRequest, 
  TradeResponse,
  Transaction,
  AdminDashboardData,
  AdminUser
} from '../types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://192.168.0.115:3001/api';

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
  
  updateSettings: (settings: { buy_multiplier?: number, sell_multiplier?: number }): Promise<AxiosResponse<ApiResponse>> =>
    api.patch('/admin/settings', settings),
  
  getAllTransactions: (page = 1, limit = 50): Promise<AxiosResponse<ApiResponse<{ transactions: any[], pagination: any }>>> =>
    api.get(`/admin/transactions?page=${page}&limit=${limit}`),
  
  externalBuy: (userId: number, inrAmount: number, btcAmount: number): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/users/${userId}/external-buy`, { inrAmount, btcAmount }),
};

export default api;
