import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { AdminDashboardData } from '../types';

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await adminAPI.getDashboard();
        setData(response.data.data!);
      } catch (error) {
        console.error('Error fetching admin dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="text-center py-8">
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-zinc-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold">{data?.stats.total_users || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-zinc-400 text-sm">Total Trades</p>
          <p className="text-2xl font-bold">{data?.stats.total_trades || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-zinc-400 text-sm">Total INR</p>
          <p className="text-xl font-bold">₹{(data?.stats.total_inr_on_platform || 0).toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-zinc-400 text-sm">Total BTC</p>
          <p className="text-xl font-bold">{(data?.stats.total_btc_on_platform || 0).toFixed(8)}</p>
        </div>
      </div>

      {/* Current Prices */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Current Prices</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-400">BTC/USD:</span>
            <span>${(data?.current_prices.btc_usd || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Buy Rate:</span>
            <span>₹{(data?.current_prices.buy_rate || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Sell Rate:</span>
            <span>₹{(data?.current_prices.sell_rate || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Buy Multiplier:</span>
            <span className="text-zinc-400">{data?.current_prices.buy_multiplier || 91}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Sell Multiplier:</span>
            <span className="text-zinc-400">{data?.current_prices.sell_multiplier || 88}</span>
          </div>
        </div>
      </div>

      
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Price Service:</span>
            <span className="text-green-400 text-sm">🟢 Running</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Database:</span>
            <span className="text-green-400 text-sm">🟢 Connected</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Cache:</span>
            <span className="text-green-400 text-sm">🟢 Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
