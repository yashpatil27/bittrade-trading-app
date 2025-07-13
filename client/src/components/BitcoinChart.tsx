import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { LineChart as LineChartIcon, Activity, Loader2 } from 'lucide-react';
import axios from 'axios';

interface ChartDataPoint {
  timestamp: number;
  price: number;
  date: string;
}

interface ChartData {
  timeframe: string;
  price_data: string | [number, number][] | {timestamp: number, price: number}[];
  data_points_count: number;
  date_from: string;
  date_to: string;
}

interface BitcoinChartProps {
  onPriceRefresh?: () => void;
}

export interface BitcoinChartRef {
  refreshPrice: () => Promise<void>;
}

const BitcoinChart = forwardRef<BitcoinChartRef, BitcoinChartProps>(({ onPriceRefresh }, ref) => {
  const [activeTab, setActiveTab] = useState('7d');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);
  const [chartDataCache, setChartDataCache] = useState<Map<string, { data: ChartDataPoint[], timestamp: number }>>(new Map());

  const timeframeTabs = [
    { key: '1d', label: '1D', name: '1 Day' },
    { key: '7d', label: '1W', name: '1 Week' },
    { key: '30d', label: '1M', name: '1 Month' },
    { key: '90d', label: '3M', name: '3 Months' },
    { key: '365d', label: '1Y', name: '1 Year' }
  ];

  const fetchChartData = async (timeframe: string) => {
    // Check if data is already cached
    const cached = chartDataCache.get(timeframe);
    const now = Date.now();

    if (cached && (now - cached.timestamp < 300000)) { // Cache valid for 5 minutes
      setChartData(cached.data);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.get(`/api/public/bitcoin/charts?timeframe=${timeframe}`);
      if (response.data.success) {
        const data = response.data.data;
        
        if (!data) {
          // No data available for this timeframe yet
          setError(`No ${timeframeTabs.find(tab => tab.key === timeframe)?.name} data available yet`);
          setChartData([]);
          return;
        }
        
        const chartData = data as ChartData;
        // Handle both string and array formats for price_data
        const priceData = typeof chartData.price_data === 'string' 
          ? JSON.parse(chartData.price_data) 
          : chartData.price_data;
        
        // Transform price data for chart - handle both array and object formats
        const formattedData = priceData.map((point: [number, number] | {timestamp: number, price: number}) => {
          let timestamp: number;
          let price: number;
          
          // Handle both formats: [timestamp, price] and {timestamp, price}
          if (Array.isArray(point)) {
            timestamp = point[0];
            price = point[1];
          } else {
            timestamp = point.timestamp;
            price = point.price;
          }
          
          const date = new Date(timestamp);
          
          return {
            timestamp,
            price,
            date: timeframe === '1d' 
              ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          };
        });
        
        setChartData(formattedData);
        
        // Cache the processed data
        setChartDataCache(prev => new Map(prev).set(timeframe, {
          data: formattedData,
          timestamp: Date.now()
        }));
      } else {
        throw new Error('Failed to fetch chart data');
      }
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      setError('Unable to load chart data');
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(activeTab);
    fetchCurrentPrice();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCurrentPrice = async () => {
    try {
      const response = await axios.get('/api/public/bitcoin/price');
      if (response.data.success) {
        setCurrentBtcPrice(response.data.data.btc_usd);
      }
    } catch (error) {
      console.error('Error fetching current price:', error);
    }
  };

  // Expose refreshPrice function to parent component
  useImperativeHandle(ref, () => ({
    refreshPrice: fetchCurrentPrice
  }));

  const handleTabChange = (timeframe: string) => {
    setActiveTab(timeframe);
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const getChangeColor = () => {
    if (chartData.length < 2) return 'text-white';
    const firstPrice = chartData[0]?.price || 0;
    const lastPrice = chartData[chartData.length - 1]?.price || 0;
    return lastPrice >= firstPrice ? 'text-green-400' : 'text-red-400';
  };

  const getChangePercentage = () => {
    if (chartData.length < 2) return null;
    const firstPrice = chartData[0]?.price || 0;
    const lastPrice = chartData[chartData.length - 1]?.price || 0;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    return change;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-800 rounded-lg p-3 shadow-xl">
          <p className="text-zinc-400 text-xs mb-1">{label}</p>
          <p className="text-white font-bold">
            {formatPrice(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-zinc-700 rounded-lg">
              <LineChartIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Price Chart</h3>
              <p className="text-zinc-400 text-xs">
                {timeframeTabs.find(tab => tab.key === activeTab)?.name} trend
              </p>
            </div>
          </div>
          
          {/* Price Change Indicator */}
          {currentBtcPrice && (
            <div className="text-right">
              <p className="text-white font-bold text-base">
                ${currentBtcPrice.toLocaleString('en-US')}
              </p>
              {chartData.length > 0 && getChangePercentage() !== null && (
                <p className={`text-xs font-medium ${getChangeColor()}`}>
                  {getChangePercentage()! > 0 ? '+' : ''}
                  {getChangePercentage()!.toFixed(2)}%
                </p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Chart Area */}
      <div className="p-4">
        <div className="h-64 w-full">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-3 text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading chart data...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">{error}</p>
                <button
                  onClick={() => fetchChartData(activeTab)}
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                  height={0}
                />
                <YAxis 
                  hide 
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  fill="url(#priceGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeWidth: 2
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">No chart data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeframe Tabs - moved below chart */}
      <div className="p-4 pt-0">
        <div className="flex bg-zinc-700/50 rounded-lg p-1 gap-1">
          {timeframeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-600/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
});

BitcoinChart.displayName = 'BitcoinChart';
export default BitcoinChart;
