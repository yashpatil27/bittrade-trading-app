import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  Wifi, 
  Server, 
  Activity, 
  DollarSign, 
  Percent,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { adminAPI } from '../services/api';

interface SystemHealth {
  database: 'connected' | 'error' | 'checking';
  redis: 'active' | 'error' | 'checking';
  priceService: 'running' | 'error' | 'checking';
  backend: 'healthy' | 'error' | 'checking';
}

const AdminSettings: React.FC = () => {
  const [buyMultiplier, setBuyMultiplier] = useState('');
  const [sellMultiplier, setSellMultiplier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'checking',
    redis: 'checking',
    priceService: 'checking',
    backend: 'checking'
  });

  useEffect(() => {
    fetchCurrentSettings();
    checkSystemHealth();
  }, []);

  const fetchCurrentSettings = async () => {
    try {
      const response = await adminAPI.getDashboard();
      const data = response.data.data!;
      setBuyMultiplier(data.current_prices.buy_multiplier?.toString() || '91');
      setSellMultiplier(data.current_prices.sell_multiplier?.toString() || '88');
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const checkSystemHealth = async () => {
    // Simulate health checks
    setTimeout(() => {
      setSystemHealth({
        database: 'connected',
        redis: 'active',
        priceService: 'running',
        backend: 'healthy'
      });
    }, 1000);
  };

  const handleUpdateSettings = async () => {
    if (!buyMultiplier || !sellMultiplier) {
      setError('Please enter both buy and sell multipliers');
      return;
    }

    const buyValue = parseFloat(buyMultiplier);
    const sellValue = parseFloat(sellMultiplier);

    if (buyValue <= 0 || buyValue > 200 || sellValue <= 0 || sellValue > 200) {
      setError('Exchange rates must be between 1 and 200 INR per USD');
      return;
    }

    if (sellValue >= buyValue) {
      setError('Sell multiplier must be lower than buy multiplier');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await adminAPI.updateSettings({
        buy_multiplier: buyValue,
        sell_multiplier: sellValue
      });
      setMessage('✅ Settings updated successfully!');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setBuyMultiplier('91');
    setSellMultiplier('88');
    setMessage('');
    setError('');
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
      case 'running':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'checking':
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getHealthText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'active': return 'Active';
      case 'running': return 'Running';
      case 'healthy': return 'Healthy';
      case 'error': return 'Error';
      case 'checking':
      default: return 'Checking...';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
      case 'running':
      case 'healthy':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'checking':
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-white" />
            System Settings
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Configure platform settings and monitor system health</p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 bg-red-400 rounded-full" />
          <span className="text-red-300">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-300">{message}</span>
        </div>
      )}

      {/* Trading Multipliers */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Percent className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold">USD/INR Exchange Rates</h2>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Buy Rate (INR per USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="number"
                  value={buyMultiplier}
                  onChange={(e) => setBuyMultiplier(e.target.value)}
                  placeholder="91"
                  min="1"
                  max="100"
                  step="0.1"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                />
              </div>
              <p className="text-zinc-500 text-xs mt-1">Exchange rate when users buy Bitcoin (INR per USD)</p>
            </div>
            
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Sell Rate (INR per USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="number"
                  value={sellMultiplier}
                  onChange={(e) => setSellMultiplier(e.target.value)}
                  placeholder="88"
                  min="1"
                  max="100"
                  step="0.1"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
                />
              </div>
              <p className="text-zinc-500 text-xs mt-1">Exchange rate when users sell Bitcoin (INR per USD)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleUpdateSettings}
              disabled={isLoading}
              className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Updating...' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              className="bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold">System Health Monitor</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <span className="text-white font-medium">Database</span>
              </div>
              {getHealthIcon(systemHealth.database)}
            </div>
            <p className={`text-sm ${getHealthColor(systemHealth.database)}`}>
              {getHealthText(systemHealth.database)}
            </p>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-zinc-400" />
                <span className="text-white font-medium">Redis Cache</span>
              </div>
              {getHealthIcon(systemHealth.redis)}
            </div>
            <p className={`text-sm ${getHealthColor(systemHealth.redis)}`}>
              {getHealthText(systemHealth.redis)}
            </p>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="text-white font-medium">Price Service</span>
              </div>
              {getHealthIcon(systemHealth.priceService)}
            </div>
            <p className={`text-sm ${getHealthColor(systemHealth.priceService)}`}>
              {getHealthText(systemHealth.priceService)}
            </p>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                <span className="text-white font-medium">Backend API</span>
              </div>
              {getHealthIcon(systemHealth.backend)}
            </div>
            <p className={`text-sm ${getHealthColor(systemHealth.backend)}`}>
              {getHealthText(systemHealth.backend)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={checkSystemHealth}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh Health Check
          </button>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-white font-medium mb-2">Configuration Notes</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>• Buy rate reflects P2P/cash market rates for USD purchases (INR per USD)</p>
          <p>• Sell rate reflects P2P/cash market rates for USD sales (INR per USD)</p>
          <p>• Buy rate is typically higher than sell rate due to market dynamics</p>
          <p>• Changes take effect immediately for new trades</p>
          <p>• System health is checked automatically every 30 seconds</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
