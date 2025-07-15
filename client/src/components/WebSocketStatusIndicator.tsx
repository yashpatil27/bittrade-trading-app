import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Wifi, WifiOff, Zap, AlertCircle } from 'lucide-react';

interface WebSocketStatusIndicatorProps {
  className?: string;
}

const WebSocketStatusIndicator: React.FC<WebSocketStatusIndicatorProps> = ({ className = '' }) => {
  const { connectionStatus, isConnected, on, off } = useWebSocket();
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const handlePriceUpdate = () => {
      setLastPriceUpdate(new Date());
    };

    const handleBalanceUpdate = (data: any) => {
      setNotification('Balance updated');
      setTimeout(() => setNotification(null), 3000);
    };

    const handleTransactionNotification = (data: any) => {
      setNotification(`Transaction: ${data.type} - ${data.status}`);
      setTimeout(() => setNotification(null), 5000);
    };

    const handleLimitOrderNotification = (data: any) => {
      setNotification(`Limit order: ${data.type} - ${data.status}`);
      setTimeout(() => setNotification(null), 5000);
    };

    const handleConnectionLost = () => {
      setNotification('Connection lost - trying to reconnect');
      setTimeout(() => setNotification(null), 5000);
    };

    // Subscribe to WebSocket events
    on('price_update', handlePriceUpdate);
    on('balance_update', handleBalanceUpdate);
    on('transaction_notification', handleTransactionNotification);
    on('limit_order_notification', handleLimitOrderNotification);
    on('connection_lost', handleConnectionLost);

    return () => {
      off('price_update', handlePriceUpdate);
      off('balance_update', handleBalanceUpdate);
      off('transaction_notification', handleTransactionNotification);
      off('limit_order_notification', handleLimitOrderNotification);
      off('connection_lost', handleConnectionLost);
    };
  }, [on, off]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1">
        {getStatusIcon()}
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      {isConnected && lastPriceUpdate && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-400">
            Live
          </span>
        </div>
      )}
      
      {notification && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1">
          <span className="text-xs text-orange-400">{notification}</span>
        </div>
      )}
    </div>
  );
};

export default WebSocketStatusIndicator;
