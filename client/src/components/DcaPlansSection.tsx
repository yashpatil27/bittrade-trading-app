import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Repeat, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  X, 
  AlertTriangle,
  CheckCircle,
  Pause,
} from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { DcaPlan, Balances, Prices } from '../types';
import { formatCurrency, formatTimeAgo, formatCurrencyInr } from '../utils/formatters';
import DcaPlanModal from './DcaPlanModal';

interface DcaPlansSectionProps {
  onUpdate?: () => void;
  balances?: Balances | null;
  prices?: Prices | null;
}

export interface DcaPlansSectionRef {
  refresh: () => Promise<void>;
}

const DcaPlansSection = forwardRef<DcaPlansSectionRef, DcaPlansSectionProps>(({ onUpdate, balances, prices }, ref) => {
  const { getDcaPlans, deleteDcaPlan, pauseDcaPlan, resumeDcaPlan, on, off } = useWebSocket();
  const [dcaPlans, setDcaPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<DcaPlan | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [cancellingPlan, setCancellingPlan] = useState<number | null>(null);
  const [pausingPlan, setPausingPlan] = useState<number | null>(null);
  const [resumingPlan, setResumingPlan] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isDcaPlanModalOpen, setIsDcaPlanModalOpen] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDcaPlans();
  }, []);

  // Real-time WebSocket updates for DCA plans
  useEffect(() => {
    const handleDcaPlanUpdate = (updatedPlan: DcaPlan) => {
      setDcaPlans(prev => {
        const existingIndex = prev.findIndex(plan => plan.id === updatedPlan.id);
        if (existingIndex >= 0) {
          // Update existing plan
          const newPlans = [...prev];
          newPlans[existingIndex] = updatedPlan;
          return newPlans;
        } else {
          // Add new plan
          return [updatedPlan, ...prev];
        }
      });
    };

    const handleDcaPlanDelete = (planId: number) => {
      setDcaPlans(prev => prev.filter(plan => plan.id !== planId));
    };

    const handleDcaPlanExecution = (execution: any) => {
      // Refresh DCA plans when execution happens
      fetchDcaPlans();
      onUpdate?.(); // Notify parent component
    };

    // Subscribe to real-time updates
    on('dca_plan_update', handleDcaPlanUpdate);
    on('dca_plan_delete', handleDcaPlanDelete);
    on('dca_plan_execution', handleDcaPlanExecution);
    on('transaction_update', (transaction: any) => {
      // If it's a DCA-related transaction, refresh plans
      if (transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') {
        fetchDcaPlans();
      }
    });

    // Cleanup listeners on unmount
    return () => {
      off('dca_plan_update', handleDcaPlanUpdate);
      off('dca_plan_delete', handleDcaPlanDelete);
      off('dca_plan_execution', handleDcaPlanExecution);
      off('transaction_update', (transaction: any) => {
        if (transaction.type === 'DCA_BUY' || transaction.type === 'DCA_SELL') {
          fetchDcaPlans();
        }
      });
    };
  }, [on, off, onUpdate]);

  useImperativeHandle(ref, () => ({
    refresh: fetchDcaPlans
  }));

  const fetchDcaPlans = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      console.log('Fetching DCA plans...');
      
      const data = await getDcaPlans();
      console.log('DCA plans response:', data);
      
      setDcaPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching DCA plans:', error);
      
      let errorMessage = 'Failed to fetch DCA plans';
      
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error: Unable to connect to server';
      } else {
        // Something else happened
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPlan = async (planId: number) => {
    try {
      setCancellingPlan(planId);
      await deleteDcaPlan(planId);
      await fetchDcaPlans();
      onUpdate?.();
      setShowDetailsModal(false);
      setSelectedPlan(null);
    } catch (error: any) {
      setError(error.message || 'Failed to cancel DCA plan');
    } finally {
      setCancellingPlan(null);
    }
  };

  const handlePausePlan = async (planId: number) => {
    try {
      setPausingPlan(planId);
      await pauseDcaPlan(planId);
      await fetchDcaPlans();
      onUpdate?.();
      setShowDetailsModal(false);
      setSelectedPlan(null);
    } catch (error: any) {
      setError(error.message || 'Failed to pause DCA plan');
    } finally {
      setPausingPlan(null);
    }
  };

  const handleResumePlan = async (planId: number) => {
    try {
      setResumingPlan(planId);
      await resumeDcaPlan(planId);
      await fetchDcaPlans();
      onUpdate?.();
      setShowDetailsModal(false);
      setSelectedPlan(null);
    } catch (error: any) {
      setError(error.message || 'Failed to resume DCA plan');
    } finally {
      setResumingPlan(null);
    }
  };

  const handleDcaPlanSuccess = () => {
    setSuccess('DCA plan created successfully!');
    fetchDcaPlans();
    onUpdate?.();
    // Clear success message after 5 seconds
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleDcaPlanError = (message: string) => {
    setError(message);
    // Clear error message after 5 seconds
    setTimeout(() => setError(''), 5000);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-400 bg-green-900/20 border-green-800';
      case 'PAUSED':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      case 'COMPLETED':
        return 'text-blue-400 bg-blue-900/20 border-blue-800';
      case 'CANCELLED':
        return 'text-red-400 bg-red-900/20 border-red-800';
      default:
        return 'text-zinc-400 bg-zinc-800/20 border-zinc-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="w-3 h-3" />;
      case 'PAUSED':
        return <Pause className="w-3 h-3" />;
      case 'COMPLETED':
        return <CheckCircle className="w-3 h-3" />;
      case 'CANCELLED':
        return <X className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const formatNextExecution = (nextExecutionAt: string) => {
    const nextDate = new Date(nextExecutionAt);
    const now = new Date();
    const diffMs = nextDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Due now';
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return (
      <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-zinc-800">
          <h2 className="text-white text-sm font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4 text-white" />
            Active DCA Plans
          </h2>
        </div>
        <div className="p-3 text-center">
          <div className="animate-spin w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-2">Loading DCA plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4 text-white" />
            Active DCA Plans
            {dcaPlans.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded-full">
                {dcaPlans.length}
              </span>
            )}
          </h2>
        </div>
      </div>
      
      <div className="p-3">
        {success && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-sm">{success}</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
            <div className="text-xs text-red-400 mb-2">
              <div>API URL: {process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}</div>
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
            </div>
            <button
              onClick={fetchDcaPlans}
              disabled={loading}
              className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}

        {dcaPlans.length > 0 ? (
          <div className="space-y-2">
            {dcaPlans.map((plan) => (
              <div 
                key={plan.id} 
                className="bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => { setSelectedPlan(plan); setShowDetailsModal(true); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-zinc-700 rounded">
                      {plan.plan_type === 'DCA_BUY' ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm">
                          {plan.plan_type === 'DCA_BUY' ? 'DCA Buy' : 'DCA Sell'} - {plan.frequency}
                        </p>
                        <span className={`px-1.5 py-0.5 text-xs border rounded flex items-center gap-1 ${getStatusColor(plan.status)}`}>
                          {getStatusIcon(plan.status)}
                          {plan.status}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs">
                        Created {formatTimeAgo(plan.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-400">Amount per execution</p>
                    <p className="font-semibold text-white">
                      {plan.plan_type === 'DCA_BUY' 
                        ? formatCurrencyInr(plan.amount_per_execution)
                        : formatCurrency(plan.amount_per_execution, 'BTC')
                      }
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-zinc-400">Next execution</p>
                    <p className="font-semibold text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatNextExecution(plan.next_execution_at)}
                    </p>
                  </div>

                  {plan.remaining_executions !== null && (
                    <div>
                      <p className="text-zinc-400">Remaining</p>
                      <p className="font-semibold text-white">
                        {plan.remaining_executions} of {plan.total_executions}
                      </p>
                    </div>
                  )}

                  {(plan.max_price || plan.min_price) && (
                    <div>
                      <p className="text-zinc-400">Price limits</p>
                      <div className="font-semibold text-white text-xs">
                        {plan.max_price && (
                          <p>Max: {formatCurrencyInr(plan.max_price)}</p>
                        )}
                        {plan.min_price && (
                          <p>Min: {formatCurrencyInr(plan.min_price)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">No active DCA plans</p>
            <p className="text-zinc-500 text-xs">Create a DCA plan to start automated investing!</p>
          </div>
        )}
      </div>
      
      {/* Modal for managing selected DCA plan */}
      {showDetailsModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  {selectedPlan.plan_type === 'DCA_BUY' ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">DCA Plan Details</h2>
                  <p className="text-zinc-400 text-sm">{selectedPlan.plan_type === 'DCA_BUY' ? 'DCA Buy' : 'DCA Sell'} Plan</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              {/* Plan Details - 4 Separate Sections */}
              <div className="grid grid-cols-2 gap-3">
                {/* Frequency */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Frequency</p>
                  <p className="text-white font-medium text-sm">{selectedPlan.frequency}</p>
                </div>
                
                {/* Amount per Execution */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Amount per Execution</p>
                  <p className="text-white font-medium text-sm">
                    {selectedPlan.plan_type === 'DCA_BUY' 
                      ? formatCurrencyInr(selectedPlan.amount_per_execution)
                      : formatCurrency(selectedPlan.amount_per_execution, 'BTC')
                    }
                  </p>
                </div>
                
                {/* Next Execution */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Next Execution</p>
                  <p className="text-white font-medium text-sm flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatNextExecution(selectedPlan.next_execution_at)}
                  </p>
                </div>
                
                {/* Status */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-400 text-xs mb-1">Status</p>
                  <span className={`px-2 py-1 text-xs border rounded flex items-center gap-1 w-fit ${getStatusColor(selectedPlan.status)}`}>
                    {getStatusIcon(selectedPlan.status)}
                    {selectedPlan.status}
                  </span>
                </div>
              </div>

              {/* Optional Details */}
              {(selectedPlan.remaining_executions !== null || selectedPlan.max_price || selectedPlan.min_price) && (
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    {selectedPlan.remaining_executions !== null && (
                      <div>
                        <span className="text-zinc-400">Progress: </span>
                        <span className="text-white">{selectedPlan.remaining_executions} of {selectedPlan.total_executions} remaining</span>
                      </div>
                    )}
                    {(selectedPlan.max_price || selectedPlan.min_price) && (
                      <div>
                        <span className="text-zinc-400">Price Limits: </span>
                        <span className="text-white">
                          {selectedPlan.max_price && `Max ${formatCurrencyInr(selectedPlan.max_price)}`}
                          {selectedPlan.max_price && selectedPlan.min_price && ', '}
                          {selectedPlan.min_price && `Min ${formatCurrencyInr(selectedPlan.min_price)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedPlan.status === 'ACTIVE' && (
                  <button 
                    onClick={() => handlePausePlan(selectedPlan.id)} 
                    disabled={pausingPlan === selectedPlan.id} 
                    className="flex-1 bg-yellow-900/20 border border-yellow-800 text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    {pausingPlan === selectedPlan.id ? 'Pausing...' : 'Pause'}
                  </button>
                )}
                {selectedPlan.status === 'PAUSED' && (
                  <button 
                    onClick={() => handleResumePlan(selectedPlan.id)} 
                    disabled={resumingPlan === selectedPlan.id} 
                    className="flex-1 bg-green-900/20 border border-green-800 text-green-300 hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {resumingPlan === selectedPlan.id ? 'Resuming...' : 'Resume'}
                  </button>
                )}
                <button 
                  onClick={() => handleCancelPlan(selectedPlan.id)} 
                  disabled={cancellingPlan === selectedPlan.id} 
                  className="flex-1 bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {cancellingPlan === selectedPlan.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isDcaPlanModalOpen && (
        <DcaPlanModal
          isOpen={isDcaPlanModalOpen}
          onClose={() => setIsDcaPlanModalOpen(false)}
          type={dcaPlanType}
          balances={balances || null}
          prices={prices || null}
          onSuccess={handleDcaPlanSuccess}
          onError={handleDcaPlanError}
        />
      )}
    </div>
  );
});

DcaPlansSection.displayName = 'DcaPlansSection';

export default DcaPlansSection;
