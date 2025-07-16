import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import webSocketManager from '../services/webSocketManager';

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  sendMessage: (action: string, payload?: any) => Promise<any>;
  on: (event: string, callback: Function) => void;
  off: (event: string, callback: Function) => void;
  
  // Convenience methods
  getDashboard: () => Promise<any>;
  getBalances: () => Promise<any>;
  getPrices: () => Promise<any>;
  buyBitcoin: (amount: number) => Promise<any>;
  sellBitcoin: (amount: number) => Promise<any>;
  placeLimitBuyOrder: (amount: number, targetPrice: number) => Promise<any>;
  placeLimitSellOrder: (amount: number, targetPrice: number) => Promise<any>;
  cancelLimitOrder: (orderId: number) => Promise<any>;
  getTransactions: (page?: number, limit?: number) => Promise<any>;
  getPortfolio: () => Promise<any>;
  getLimitOrders: () => Promise<any>;
  getDcaPlans: () => Promise<any>;
  createDcaBuyPlan: (data: any) => Promise<any>;
  createDcaSellPlan: (data: any) => Promise<any>;
  pauseDcaPlan: (planId: number) => Promise<any>;
  resumeDcaPlan: (planId: number) => Promise<any>;
  deleteDcaPlan: (planId: number) => Promise<any>;
  
  // Loan methods
  getLoanStatus: () => Promise<any>;
  getLoanHistory: () => Promise<any>;
  createLoan: (btcAmount: number) => Promise<any>;
  borrowMore: (amount: number) => Promise<any>;
  repayLoan: (amount: number) => Promise<any>;
  addCollateral: (btcAmount: number) => Promise<any>;
  partialLiquidation: (amount: number) => Promise<any>;
  
  // Public methods
  getBitcoinPrice: () => Promise<any>;
  getBitcoinData: () => Promise<any>;
  getBitcoinSentiment: () => Promise<any>;
  getBitcoinCharts: (timeframe?: string) => Promise<any>;
  getMarketData: () => Promise<any>;
  getTradingRates: () => Promise<any>;
  getPlatformStats: () => Promise<any>;
  
  // Admin methods
  getAdminDashboard: () => Promise<any>;
  getUsers: (page?: number, limit?: number) => Promise<any>;
  createUser: (userData: any) => Promise<any>;
  deleteUser: (userId: number) => Promise<any>;
  depositINR: (userId: number, amount: number) => Promise<any>;
  withdrawINR: (userId: number, amount: number) => Promise<any>;
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<any>;
  getSystemStatus: () => Promise<any>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Setup connection status monitoring
    const updateConnectionStatus = () => {
      const status = webSocketManager.getConnectionStatus();
      setConnectionStatus(status);
      setIsConnected(status === 'connected');
    };

    // Initial status check
    updateConnectionStatus();

    // Listen for connection changes
    webSocketManager.on('connect', updateConnectionStatus);
    webSocketManager.on('disconnect', updateConnectionStatus);
    webSocketManager.on('reconnect', updateConnectionStatus);

    // Less aggressive status check - only when necessary
    const statusInterval = setInterval(updateConnectionStatus, 5000); // Reduced from 1000ms to 5000ms

    return () => {
      clearInterval(statusInterval);
      webSocketManager.off('connect', updateConnectionStatus);
      webSocketManager.off('disconnect', updateConnectionStatus);
      webSocketManager.off('reconnect', updateConnectionStatus);
    };
  }, []);

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionStatus,
    sendMessage: webSocketManager.sendMessage.bind(webSocketManager),
    on: webSocketManager.on.bind(webSocketManager),
    off: webSocketManager.off.bind(webSocketManager),
    
    // User methods
    getDashboard: webSocketManager.getDashboard.bind(webSocketManager),
    getBalances: webSocketManager.getBalances.bind(webSocketManager),
    getPrices: webSocketManager.getPrices.bind(webSocketManager),
    buyBitcoin: webSocketManager.buyBitcoin.bind(webSocketManager),
    sellBitcoin: webSocketManager.sellBitcoin.bind(webSocketManager),
    placeLimitBuyOrder: webSocketManager.placeLimitBuyOrder.bind(webSocketManager),
    placeLimitSellOrder: webSocketManager.placeLimitSellOrder.bind(webSocketManager),
    cancelLimitOrder: webSocketManager.cancelLimitOrder.bind(webSocketManager),
    getTransactions: webSocketManager.getTransactions.bind(webSocketManager),
    getPortfolio: webSocketManager.getPortfolio.bind(webSocketManager),
    getLimitOrders: webSocketManager.getLimitOrders.bind(webSocketManager),
    getDcaPlans: webSocketManager.getDcaPlans.bind(webSocketManager),
    createDcaBuyPlan: webSocketManager.createDcaBuyPlan.bind(webSocketManager),
    createDcaSellPlan: webSocketManager.createDcaSellPlan.bind(webSocketManager),
    pauseDcaPlan: webSocketManager.pauseDcaPlan.bind(webSocketManager),
    resumeDcaPlan: webSocketManager.resumeDcaPlan.bind(webSocketManager),
    deleteDcaPlan: webSocketManager.deleteDcaPlan.bind(webSocketManager),
    
    // Loan methods
    getLoanStatus: webSocketManager.getLoanStatus.bind(webSocketManager),
    getLoanHistory: webSocketManager.getLoanHistory.bind(webSocketManager),
    createLoan: webSocketManager.createLoan.bind(webSocketManager),
    borrowMore: webSocketManager.borrowMore.bind(webSocketManager),
    repayLoan: webSocketManager.repayLoan.bind(webSocketManager),
    addCollateral: webSocketManager.addCollateral.bind(webSocketManager),
    partialLiquidation: webSocketManager.partialLiquidation.bind(webSocketManager),
    
    // Public methods
    getBitcoinPrice: webSocketManager.getBitcoinPrice.bind(webSocketManager),
    getBitcoinData: webSocketManager.getBitcoinData.bind(webSocketManager),
    getBitcoinSentiment: webSocketManager.getBitcoinSentiment.bind(webSocketManager),
    getBitcoinCharts: webSocketManager.getBitcoinCharts.bind(webSocketManager),
    getMarketData: webSocketManager.getMarketData.bind(webSocketManager),
    getTradingRates: webSocketManager.getTradingRates.bind(webSocketManager),
    getPlatformStats: webSocketManager.getPlatformStats.bind(webSocketManager),
    
    // Admin methods
    getAdminDashboard: webSocketManager.getAdminDashboard.bind(webSocketManager),
    getUsers: webSocketManager.getUsers.bind(webSocketManager),
    createUser: webSocketManager.createUser.bind(webSocketManager),
    deleteUser: webSocketManager.deleteUser.bind(webSocketManager),
    depositINR: webSocketManager.depositINR.bind(webSocketManager),
    withdrawINR: webSocketManager.withdrawINR.bind(webSocketManager),
    getSettings: webSocketManager.getSettings.bind(webSocketManager),
    updateSettings: webSocketManager.updateSettings.bind(webSocketManager),
    getSystemStatus: webSocketManager.getSystemStatus.bind(webSocketManager),
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
