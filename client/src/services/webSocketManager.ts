import { io, Socket } from 'socket.io-client';

interface QueuedMessage {
  id: string;
  action: string;
  payload: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface WebSocketResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

class WebSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: QueuedMessage[] = [];
  private pendingRequests = new Map<string, QueuedMessage>();
  private eventListeners = new Map<string, Function[]>();

  constructor() {
    this.connect();
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:3001';
    
    return `${protocol}//${host}`;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('token');
  }

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      console.log('No auth token found, WebSocket connection skipped');
      return;
    }

    this.socket = io(this.getWebSocketUrl(), {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.processMessageQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.handleDisconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    });

    this.socket.on('response', (response: WebSocketResponse) => {
      this.handleResponse(response);
    });

    // Real-time event listeners
    this.socket.on('balance_update', (data) => {
      this.emit('balance_update', data);
    });

    this.socket.on('transaction_notification', (data) => {
      this.emit('transaction_notification', data);
    });

    this.socket.on('limit_order_notification', (data) => {
      this.emit('limit_order_notification', data);
    });

    this.socket.on('dca_plan_notification', (data) => {
      this.emit('dca_plan_notification', data);
    });

    this.socket.on('price_update', (data) => {
      this.emit('price_update', data);
    });

    this.socket.on('system_notification', (data) => {
      this.emit('system_notification', data);
    });

    // Admin-specific events
    this.socket.on('user_created', (data) => {
      this.emit('user_created', data);
    });

    this.socket.on('user_deleted', (data) => {
      this.emit('user_deleted', data);
    });

    this.socket.on('settings_updated', (data) => {
      this.emit('settings_updated', data);
    });
  }

  private handleDisconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Exponential backoff, max 30s
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection_lost', { reconnectAttempts: this.reconnectAttempts });
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Try to refresh token and reconnect
      this.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.action, message.payload, message.id)
          .then(message.resolve)
          .catch(message.reject);
      }
    }
  }

  private handleResponse(response: WebSocketResponse): void {
    const pendingRequest = this.pendingRequests.get(response.id);
    
    if (pendingRequest) {
      this.pendingRequests.delete(response.id);
      
      if (response.success) {
        pendingRequest.resolve(response.data);
      } else {
        pendingRequest.reject(new Error(response.error || 'Unknown error'));
      }
    }
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  sendMessage(action: string, payload: any = {}, messageId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = messageId || this.generateMessageId();
      const message: QueuedMessage = {
        id,
        action,
        payload,
        resolve,
        reject,
        timestamp: Date.now()
      };

      if (!this.isConnected || !this.socket?.connected) {
        // Queue message for when connection is restored
        this.messageQueue.push(message);
        
        // Try to reconnect if not connected
        if (!this.isConnected) {
          this.connect();
        }
        
        return;
      }

      // Send immediately if connected
      this.pendingRequests.set(id, message);
      
      this.socket.emit('request', {
        id,
        action,
        payload
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  // Event emitter methods
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Convenience methods for common operations
  async authenticate(email: string, password: string): Promise<any> {
    return this.sendMessage('auth.login', { email, password });
  }

  async register(email: string, name: string, password: string, pin: string): Promise<any> {
    return this.sendMessage('auth.register', { email, name, password, pin });
  }

  async getDashboard(): Promise<any> {
    return this.sendMessage('user.dashboard');
  }

  async getBalances(): Promise<any> {
    return this.sendMessage('user.balances');
  }

  async getPrices(): Promise<any> {
    return this.sendMessage('user.prices');
  }

  async buyBitcoin(amount: number): Promise<any> {
    return this.sendMessage('user.buy', { amount });
  }

  async sellBitcoin(amount: number): Promise<any> {
    return this.sendMessage('user.sell', { amount });
  }

  async placeLimitBuyOrder(amount: number, targetPrice: number): Promise<any> {
    return this.sendMessage('user.limit-buy', { amount, targetPrice });
  }

  async placeLimitSellOrder(amount: number, targetPrice: number): Promise<any> {
    return this.sendMessage('user.limit-sell', { amount, targetPrice });
  }

  async cancelLimitOrder(orderId: number): Promise<any> {
    return this.sendMessage('user.cancel-limit-order', { orderId });
  }

  async getTransactions(page: number = 1, limit: number = 20): Promise<any> {
    return this.sendMessage('user.transactions', { page, limit });
  }

  async getPortfolio(): Promise<any> {
    return this.sendMessage('user.portfolio');
  }

  async getLimitOrders(): Promise<any> {
    return this.sendMessage('user.limit-orders');
  }

  async getDcaPlans(): Promise<any> {
    return this.sendMessage('user.dca-plans');
  }

  async createDcaBuyPlan(data: any): Promise<any> {
    return this.sendMessage('user.create-dca-buy', data);
  }

  async createDcaSellPlan(data: any): Promise<any> {
    return this.sendMessage('user.create-dca-sell', data);
  }

  async pauseDcaPlan(planId: number): Promise<any> {
    return this.sendMessage('user.pause-dca-plan', { planId });
  }

  async resumeDcaPlan(planId: number): Promise<any> {
    return this.sendMessage('user.resume-dca-plan', { planId });
  }

  async deleteDcaPlan(planId: number): Promise<any> {
    return this.sendMessage('user.delete-dca-plan', { planId });
  }

  // Public API methods (no authentication required)
  async getBitcoinPrice(): Promise<any> {
    return this.sendMessage('public.bitcoin-price');
  }

  async getBitcoinData(): Promise<any> {
    return this.sendMessage('public.bitcoin-data');
  }

  async getBitcoinSentiment(): Promise<any> {
    return this.sendMessage('public.bitcoin-sentiment');
  }

  async getBitcoinCharts(timeframe?: string): Promise<any> {
    return this.sendMessage('public.bitcoin-charts', { timeframe });
  }

  async getMarketData(): Promise<any> {
    return this.sendMessage('public.market-data');
  }

  async getTradingRates(): Promise<any> {
    return this.sendMessage('public.trading-rates');
  }

  async getPlatformStats(): Promise<any> {
    return this.sendMessage('public.platform-stats');
  }

  // Admin API methods
  async getAdminDashboard(): Promise<any> {
    return this.sendMessage('admin.dashboard');
  }

  async getUsers(page: number = 1, limit: number = 20): Promise<any> {
    return this.sendMessage('admin.get-users', { page, limit });
  }

  async createUser(userData: any): Promise<any> {
    return this.sendMessage('admin.create-user', userData);
  }

  async deleteUser(userId: number): Promise<any> {
    return this.sendMessage('admin.delete-user', { userId });
  }

  async depositINR(userId: number, amount: number): Promise<any> {
    return this.sendMessage('admin.deposit-inr', { userId, amount });
  }

  async withdrawINR(userId: number, amount: number): Promise<any> {
    return this.sendMessage('admin.withdraw-inr', { userId, amount });
  }

  async getSettings(): Promise<any> {
    return this.sendMessage('admin.get-settings');
  }

  async updateSettings(settings: any): Promise<any> {
    return this.sendMessage('admin.update-settings', settings);
  }

  async getSystemStatus(): Promise<any> {
    return this.sendMessage('admin.system-status');
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.pendingRequests.clear();
    this.messageQueue.length = 0;
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected && this.socket?.connected) {
      return 'connected';
    } else if (this.socket && !this.socket.connected && this.reconnectAttempts > 0) {
      return 'connecting';
    } else {
      return 'disconnected';
    }
  }
}

// Export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager;
