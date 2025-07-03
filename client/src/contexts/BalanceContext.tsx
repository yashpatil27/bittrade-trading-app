import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BalanceContextType {
  refreshBalance: () => void;
  balanceVersion: number;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const useBalance = (): BalanceContextType => {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
};

interface BalanceProviderProps {
  children: ReactNode;
}

export const BalanceProvider: React.FC<BalanceProviderProps> = ({ children }) => {
  const [balanceVersion, setBalanceVersion] = useState(0);

  const refreshBalance = () => {
    setBalanceVersion(prev => prev + 1);
  };

  const value: BalanceContextType = {
    refreshBalance,
    balanceVersion,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
};
