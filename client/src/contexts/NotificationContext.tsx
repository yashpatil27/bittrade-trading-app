import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Transaction } from '../types';

interface NotificationContextType {
  notifications: TransactionNotification[];
  addNotification: (notification: TransactionNotification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  hasUnreadNotifications: boolean;
}

interface TransactionNotification {
  id: string;
  type: 'transaction' | 'limit_order' | 'dca_plan' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { on, off } = useWebSocket();
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);

  // Centralized WebSocket event handling for notifications
  useEffect(() => {
    const handleTransactionNotification = (data: any) => {
      console.log('Transaction notification received:', data);
      const notification: TransactionNotification = {
        id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'transaction',
        title: 'Transaction Complete',
        message: data.message || 'A transaction has been completed',
        timestamp: new Date(),
        read: false,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50 notifications
    };

    const handleLimitOrderNotification = (data: any) => {
      console.log('Limit order notification received:', data);
      const notification: TransactionNotification = {
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'limit_order',
        title: 'Limit Order Update',
        message: data.message || 'A limit order has been updated',
        timestamp: new Date(),
        read: false,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    };

    const handleDcaPlanNotification = (data: any) => {
      console.log('DCA plan notification received:', data);
      const notification: TransactionNotification = {
        id: `dca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'dca_plan',
        title: 'DCA Plan Update',
        message: data.message || 'A DCA plan has been updated',
        timestamp: new Date(),
        read: false,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    };

    const handleSystemNotification = (data: any) => {
      console.log('System notification received:', data);
      const notification: TransactionNotification = {
        id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'system',
        title: 'System Update',
        message: data.message || 'A system update has occurred',
        timestamp: new Date(),
        read: false,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    };

    // Subscribe to WebSocket events - SINGLE SOURCE OF TRUTH
    on('transaction_notification', handleTransactionNotification);
    on('limit_order_notification', handleLimitOrderNotification);
    on('dca_plan_notification', handleDcaPlanNotification);
    on('system_notification', handleSystemNotification);

    // Cleanup listeners on unmount
    return () => {
      off('transaction_notification', handleTransactionNotification);
      off('limit_order_notification', handleLimitOrderNotification);
      off('dca_plan_notification', handleDcaPlanNotification);
      off('system_notification', handleSystemNotification);
    };
  }, [on, off]);

  const addNotification = (notification: TransactionNotification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 49)]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const hasUnreadNotifications = notifications.some(n => !n.read);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    hasUnreadNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
