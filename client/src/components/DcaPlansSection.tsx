import React, { useState, useEffect } from 'react';
import { 
  Repeat, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  X, 
  AlertTriangle,
  CheckCircle,
  Pause
} from 'lucide-react';
import { userAPI } from '../services/api';
import { DcaPlan } from '../types';
import { formatCurrency, formatTimeAgo } from '../utils/formatters';

interface DcaPlansSectionProps {
  onUpdate?: () => void;
}

const DcaPlansSection: React.FC<DcaPlansSectionProps> = ({ onUpdate }) => {
  const [dcaPlans, setDcaPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingPlan, setCancellingPlan] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDcaPlans();
  }, []);

  const fetchDcaPlans = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getDcaPlans();
      setDcaPlans(response.data.data || []);
    } catch (error) {
      console.error('Error fetching DCA plans:', error);
      setError('Failed to fetch DCA plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPlan = async (planId: number) => {
    try {
      setCancellingPlan(planId);
      await userAPI.cancelDcaPlan(planId);
      await fetchDcaPlans();
      onUpdate?.();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cancel DCA plan');
    } finally {
      setCancellingPlan(null);
    }
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
        return 'text-zinc-400 bg-zinc-800/20 border-zinc-700';
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Repeat className="w-5 h-5 text-white" />
            Active DCA Plans
          </h2>
        </div>
        <div className="p-4 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full mx-auto"></div>
          <p className="text-zinc-400 text-sm mt-2">Loading DCA plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Repeat className="w-5 h-5 text-white" />
          Active DCA Plans
          {dcaPlans.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded-full">
              {dcaPlans.length}
            </span>
          )}
        </h2>
      </div>
      
      <div className="p-4">
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {dcaPlans.length > 0 ? (
          <div className="space-y-3">
            {dcaPlans.map((plan) => (
              <div 
                key={plan.id} 
                className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-700 rounded-lg">
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
                  
                  {plan.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleCancelPlan(plan.id)}
                      disabled={cancellingPlan === plan.id}
                      className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-red-400 disabled:opacity-50"
                      title="Cancel DCA Plan"
                    >
                      {cancellingPlan === plan.id ? (
                        <div className="animate-spin w-3 h-3 border border-zinc-500 border-t-red-400 rounded-full"></div>
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-400">Amount per execution</p>
                    <p className="font-bold text-white">
                      {plan.plan_type === 'DCA_BUY' 
                        ? `₹${plan.amount_per_execution.toLocaleString('en-IN')}`
                        : formatCurrency(plan.amount_per_execution, 'BTC')
                      }
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-zinc-400">Next execution</p>
                    <p className="font-bold text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatNextExecution(plan.next_execution_at)}
                    </p>
                  </div>

                  {plan.remaining_executions !== null && (
                    <div>
                      <p className="text-zinc-400">Remaining</p>
                      <p className="font-bold text-white">
                        {plan.remaining_executions} of {plan.total_executions}
                      </p>
                    </div>
                  )}

                  {(plan.max_price || plan.min_price) && (
                    <div>
                      <p className="text-zinc-400">Price limits</p>
                      <div className="font-bold text-white text-xs">
                        {plan.max_price && (
                          <p>Max: ₹{plan.max_price.toLocaleString('en-IN')}</p>
                        )}
                        {plan.min_price && (
                          <p>Min: ₹{plan.min_price.toLocaleString('en-IN')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No active DCA plans</p>
            <p className="text-zinc-500 text-sm">Create a DCA plan to start automated investing!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DcaPlansSection;
