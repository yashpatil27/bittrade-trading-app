import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface PriceUpdateTimerProps {
  className?: string;
}

const PriceUpdateTimer: React.FC<PriceUpdateTimerProps> = ({ className = '' }) => {
  const [countdown, setCountdown] = useState(30);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Simulate price update
          setIsUpdating(true);
          setTimeout(() => setIsUpdating(false), 1000);
          return 30; // Reset to 30 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      {isUpdating ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Updating...</span>
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" />
          <span>Next update: {formatTime(countdown)}</span>
        </>
      )}
    </div>
  );
};

export default PriceUpdateTimer;
