import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Balances, Prices } from '../types';

interface EnhancedBalanceContextType {
  balances: Balances | null;
  prices: Prices | null;
  refreshBalance: () => void;
  updateBalance: () => void;
  balanceVersion: number;
  isLoading: boolean;
  error: string | null;
}

const EnhancedBalanceContext = createContext<EnhancedBalanceContextType | undefined>(undefined);

export const useEnhancedBalance = (): EnhancedBalanceContextType => {
  const context = useContext(EnhancedBalanceContext);
  if (context === undefined) {
    throw new Error('useEnhancedBalance must be used within an EnhancedBalanceProvider');
  }
  return context;
};

interface EnhancedBalanceProviderProps {
  children: ReactNode;
}

export const EnhancedBalanceProvider: React.FC<EnhancedBalanceProviderProps> = ({ children }) => {
  const { getDashboard, on, off } = useWebSocket();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [balanceVersion, setBalanceVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const dashboardData = await getDashboard();
        setBalances(dashboardData.balances);
        setPrices(dashboardData.prices);
      } catch (error) {
        console.error('Error fetching balance data:', error);
        setError('Failed to fetch balance data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getDashboard]);

  // Centralized WebSocket event handling
  useEffect(() => {
    const handleBalanceUpdate = (newBalances: Balances) => {
      console.log('Balance update received in context:', newBalances);
      setBalances(newBalances);
      setBalanceVersion(prev => prev + 1);
    };

    const handlePriceUpdate = (newPrices: Prices) => {
      console.log('Price update received in context:', newPrices);
      setPrices(newPrices);
    };

    // Subscribe to WebSocket events - SINGLE SOURCE OF TRUTH
    on('balance_update', handleBalanceUpdate);
    on('price_update', handlePriceUpdate);

    // Cleanup listeners on unmount
    return () => {
      off('balance_update', handleBalanceUpdate);
      off('price_update', handlePriceUpdate);
    };
  }, [on, off]);

  const refreshBalance = () => {
    setBalanceVersion(prev => prev + 1);
  };

  const updateBalance = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const dashboardData = await getDashboard();
      setBalances(dashboardData.balances);
      setPrices(dashboardData.prices);
      setBalanceVersion(prev => prev + 1);
    } catch (error) {
      console.error('Error updating balance:', error);
      setError('Failed to update balance');
    } finally {
      setIsLoading(false);
    }
  };

  const value: EnhancedBalanceContextType = {
    balances,
    prices,
    refreshBalance,
    updateBalance,
    balanceVersion,
    isLoading,
    error,
  };

  return (
    <EnhancedBalanceContext.Provider value={value}>
      {children}
    </EnhancedBalanceContext.Provider>
  );
};
