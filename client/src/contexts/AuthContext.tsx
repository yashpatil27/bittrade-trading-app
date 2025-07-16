import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import webSocketManager from '../services/webSocketManager';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simple synchronous initialization to prevent loops
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(userData);
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      // Try WebSocket authentication first
      const response = await webSocketManager.authenticate(email, password);
      const { token: newToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser);
      
      // Reconnect WebSocket with new token
      webSocketManager.disconnect();
      webSocketManager.connect();
    } catch (error: any) {
      console.error('WebSocket authentication failed, trying HTTP fallback:', error);
      
      // Fallback to HTTP authentication for mobile
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://192.168.1.164:3001/api';
        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Login failed');
        }
        
        const data = await response.json();
        const { token: newToken, user: newUser } = data.data;
        
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        
        setToken(newToken);
        setUser(newUser);
        
        // Try to connect WebSocket with new token
        webSocketManager.disconnect();
        webSocketManager.connect();
      } catch (httpError: any) {
        const message = httpError.message || 'Login failed';
        throw new Error(message);
      }
    }
  };

  const register = async (email: string, name: string, password: string, pin: string): Promise<void> => {
    try {
      const response = await webSocketManager.register(email, name, password, pin);
      const { token: newToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser);
    } catch (error: any) {
      const message = error.message || 'Registration failed';
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await webSocketManager.sendMessage('auth.logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      webSocketManager.disconnect();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    setUser,
    isAuthenticated: !!token && !!user,
    isAdmin: !!(user?.is_admin === true || user?.is_admin === 1),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
