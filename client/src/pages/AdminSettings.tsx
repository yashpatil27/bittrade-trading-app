import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  Server, 
  Activity, 
  DollarSign, 
  Percent,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Repeat,
  Clock
} from 'lucide-react';
import { adminAPI, userAPI } from '../services/api';
import PinConfirmationModal from '../components/PinConfirmationModal';

const AdminSettings: React.FC = () => {
  const [buyMultiplier, setBuyMultiplier] = useState('');
  const [sellMultiplier, setSellMultiplier] = useState('');
  const [loanInterestRate, setLoanInterestRate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  
  // PIN confirmation state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<{ buy_multiplier: number; sell_multiplier: number; loan_interest_rate: number } | null>(null);

  useEffect(() => {
    fetchCurrentSettings();
    checkSystemHealth();
  }, []);

  const fetchCurrentSettings = async () => {
    try {
      // Get settings from admin settings endpoint
      const settingsResponse = await adminAPI.getSettings();
      const settings = settingsResponse.data.data;
      
      setBuyMultiplier(settings.buy_multiplier?.toString() || '91');
      setSellMultiplier(settings.sell_multiplier?.toString() || '88');
      setLoanInterestRate(settings.loan_interest_rate?.toString() || '15');
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Fallback to default values
      setBuyMultiplier('91');
      setSellMultiplier('88');
      setLoanInterestRate('15');
    }
  };

  const checkSystemHealth = async () => {
    try {
      setIsHealthLoading(true);
      const response = await adminAPI.getSystemHealth();
      setSystemHealth(response.data);
    } catch (error) {
      console.error('Error fetching system health:', error);
      setSystemHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const validateAndPrepareSettings = () => {
    if (!buyMultiplier || !sellMultiplier || !loanInterestRate) {
      setError('Please enter all required settings');
      return null;
    }

    const buyValue = parseFloat(buyMultiplier);
    const sellValue = parseFloat(sellMultiplier);
    const interestValue = parseFloat(loanInterestRate);

    if (buyValue <= 0 || buyValue > 200 || sellValue <= 0 || sellValue > 200) {
      setError('Exchange rates must be between 1 and 200 INR per USD');
      return null;
    }

    if (interestValue <= 0 || interestValue > 100) {
      setError('Loan interest rate must be between 0 and 100%');
      return null;
    }

    if (sellValue >= buyValue) {
      setError('Sell multiplier must be lower than buy multiplier');
      return null;
    }

    return { buy_multiplier: buyValue, sell_multiplier: sellValue, loan_interest_rate: interestValue };
  };

  const handleUpdateSettings = async () => {
    const settings = validateAndPrepareSettings();
    if (!settings) return;

    setPendingSettings(settings);
    setIsPinModalOpen(true);
  };

  const executeSettingsUpdate = async () => {
    if (!pendingSettings) return;

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await adminAPI.updateSettings(pendingSettings);
      setMessage('✅ Settings updated successfully!');
      setPendingSettings(null);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    try {
      // Verify PIN
      const response = await userAPI.verifyPin(pin);
      if (response.data.data?.valid) {
        // PIN is correct, execute the settings update
        await executeSettingsUpdate();
        setIsPinModalOpen(false);
        return true;
      } else {
        // PIN is incorrect
        return false;
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  };

  const handlePinModalClose = () => {
    setIsPinModalOpen(false);
    setPendingSettings(null);
  };

  const handleReset = () => {
    setBuyMultiplier('91');
    setSellMultiplier('88');
    setLoanInterestRate('15');
    setMessage('');
    setError('');
  };

  const getHealthIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'active':
      case 'running':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'stopped':
      case 'disconnected':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'checking':
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getHealthText = (status: string) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getHealthColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'active':
      case 'running':
      case 'healthy':
        return 'text-green-400';
      case 'stopped':
      case 'disconnected':
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
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-6">
          <Percent className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold">USD/INR Exchange Rates</h2>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Buy Rate</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
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
              <label className="block text-zinc-400 text-sm mb-2">Sell Rate</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
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

          {/* Loan Interest Rate */}
          <div className="pt-4 border-t border-zinc-700">
            <label className="block text-zinc-400 text-sm mb-2">Loan Interest Rate</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value={loanInterestRate}
                onChange={(e) => setLoanInterestRate(e.target.value)}
                placeholder="15"
                min="0.1"
                max="100"
                step="0.1"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
              />
            </div>
            <p className="text-zinc-500 text-xs mt-1">Annual interest rate for Bitcoin-backed loans (%)</p>
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
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold">System Health Monitor</h2>
          </div>
          <button
            onClick={checkSystemHealth}
            disabled={isHealthLoading}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Activity className={`w-4 h-4 ${isHealthLoading ? 'animate-spin' : ''}`} />
            {isHealthLoading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
        
        {systemHealth ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-medium">Database</span>
                  </div>
                  {getHealthIcon('connected')}
                </div>
                <p className={`text-sm ${getHealthColor('connected')}`}>
                  Connected
                </p>
              </div>

              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-medium">Bitcoin Data Service</span>
                  </div>
                  {getHealthIcon(systemHealth?.services?.bitcoin_data_service || 'unknown')}
                </div>
                <p className={`text-sm ${getHealthColor(systemHealth?.services?.bitcoin_data_service || 'unknown')}`}>
                  {getHealthText(systemHealth?.services?.bitcoin_data_service || 'Unknown')}
                </p>
              </div>

              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-medium">Limit Order Service</span>
                  </div>
                  {getHealthIcon(systemHealth?.services?.limit_order_execution || 'unknown')}
                </div>
                <p className={`text-sm ${getHealthColor(systemHealth?.services?.limit_order_execution || 'unknown')}`}>
                  {getHealthText(systemHealth?.services?.limit_order_execution || 'Unknown')}
                </p>
              </div>

              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-medium">DCA Execution Service</span>
                  </div>
                  {getHealthIcon(systemHealth?.services?.dca_execution || 'unknown')}
                </div>
                <p className={`text-sm ${getHealthColor(systemHealth?.services?.dca_execution || 'unknown')}`}>
                  {getHealthText(systemHealth?.services?.dca_execution || 'Unknown')}
                </p>
              </div>
            </div>
            
            {systemHealth?.timestamp && (
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-400">Last Updated</span>
                  </div>
                  <span className="text-white font-medium">
                    {new Date(systemHealth.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">Unable to fetch system health data</p>
            <button
              onClick={checkSystemHealth}
              className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <Activity className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}
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
      
      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={handlePinModalClose}
        onConfirm={handlePinConfirm}
        title="Confirm Rate Changes"
        message={pendingSettings ? `Update settings:\nBuy Rate: ${pendingSettings.buy_multiplier}\nSell Rate: ${pendingSettings.sell_multiplier}\nLoan Interest Rate: ${pendingSettings.loan_interest_rate}%` : ''}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AdminSettings;
