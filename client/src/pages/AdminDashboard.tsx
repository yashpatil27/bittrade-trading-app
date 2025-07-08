import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { AdminDashboardData } from '../types';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Bitcoin, 
  Activity, 
  Clock, 
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { formatCurrencyInr, formatBitcoin } from '../utils/formatters';

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [limitOrdersSummary, setLimitOrdersSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [dashboardResponse, limitOrdersResponse] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getLimitOrdersSummary().catch(() => ({ data: { data: null } })) // Don't fail if limit orders aren't available
      ]);
      
      setData(dashboardResponse.data.data!);
      setSystemHealth({ status: 'running' }); // Static health status since endpoint is removed
      setLimitOrdersSummary(limitOrdersResponse.data.data);
      
    } catch (error: any) {
      console.error('Error fetching admin dashboard:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const getServiceStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'stopped':
      case 'disconnected':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getServiceStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'connected':
        return 'text-green-400';
      case 'stopped':
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300">{error}</p>
          <button 
            onClick={fetchAllData} 
            className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button 
          onClick={fetchAllData}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <Activity className="w-5 h-5" />
        </button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-zinc-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold">{data?.stats.total_users || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-zinc-400 text-sm">Total Trades</p>
          <p className="text-2xl font-bold">{data?.stats.total_trades || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-zinc-400 text-sm">Total INR</p>
          <p className="text-xl font-bold">{formatCurrencyInr(data?.stats.total_inr_on_platform || 0)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Bitcoin className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-zinc-400 text-sm">Total BTC</p>
          <p className="text-xl font-bold">₿{formatBitcoin(data?.stats.total_btc_on_platform || 0)}</p>
        </div>
      </div>

      {/* Current Prices */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Bitcoin className="w-5 h-5 text-orange-400" />
          Current Prices
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">BTC/USD</span>
            <span className="font-medium">${(data?.current_prices.btc_usd || 0).toLocaleString('en-US')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Buy Rate</span>
            <span className="font-medium text-green-400">₹{(data?.current_prices.buy_rate || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Sell Rate</span>
            <span className="font-medium text-red-400">₹{(data?.current_prices.sell_rate || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="border-t border-zinc-800 pt-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Buy Multiplier</span>
              <span className="text-zinc-400">{data?.current_prices.buy_multiplier || 91}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Sell Multiplier</span>
              <span className="text-zinc-400">{data?.current_prices.sell_multiplier || 88}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          System Health
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Database</span>
            <div className="flex items-center gap-2">
              {getServiceStatusIcon('connected')}
              <span className={getServiceStatusText('connected')}>Connected</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Bitcoin Data Service</span>
            <div className="flex items-center gap-2">
              {getServiceStatusIcon(systemHealth?.services?.bitcoin_data_service || 'stopped')}
              <span className={getServiceStatusText(systemHealth?.services?.bitcoin_data_service || 'stopped')}>
                {systemHealth?.services?.bitcoin_data_service || 'Unknown'}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Limit Order Service</span>
            <div className="flex items-center gap-2">
              {getServiceStatusIcon(systemHealth?.services?.limit_order_execution || 'stopped')}
              <span className={getServiceStatusText(systemHealth?.services?.limit_order_execution || 'stopped')}>
                {systemHealth?.services?.limit_order_execution || 'Unknown'}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">DCA Execution Service</span>
            <div className="flex items-center gap-2">
              {getServiceStatusIcon(systemHealth?.services?.dca_execution || 'stopped')}
              <span className={getServiceStatusText(systemHealth?.services?.dca_execution || 'stopped')}>
                {systemHealth?.services?.dca_execution || 'Unknown'}
              </span>
            </div>
          </div>
          {systemHealth?.timestamp && (
            <div className="border-t border-zinc-800 pt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Last Updated</span>
                <span className="text-zinc-400">
                  {new Date(systemHealth.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Limit Orders Summary */}
      {limitOrdersSummary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Limit Orders
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-zinc-400 text-sm">Pending Orders</p>
              <p className="text-2xl font-bold">{limitOrdersSummary.pending_orders?.total_orders || 0}</p>
              <div className="text-xs text-zinc-500 mt-1">
                {limitOrdersSummary.pending_orders?.buy_orders || 0} Buy • {limitOrdersSummary.pending_orders?.sell_orders || 0} Sell
              </div>
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-sm">Total Value</p>
              <p className="text-lg font-bold">
                ₹{(limitOrdersSummary.pending_orders?.total_buy_inr || 0).toLocaleString('en-IN')}
              </p>
              <div className="text-xs text-zinc-500 mt-1">
                {(limitOrdersSummary.pending_orders?.total_sell_btc || 0).toFixed(6)} BTC
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Service Status</span>
              <div className="flex items-center gap-2">
                {limitOrdersSummary.service_status?.is_running ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className={limitOrdersSummary.service_status?.is_running ? 'text-green-400' : 'text-red-400'}>
                  {limitOrdersSummary.service_status?.is_running ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            {limitOrdersSummary.service_status?.execution_in_progress && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-zinc-500">Execution Status</span>
                <span className="text-yellow-400">In Progress...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
