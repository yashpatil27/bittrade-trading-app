import React, { useState } from 'react';
import { Sparkles, Bitcoin, DollarSign } from 'lucide-react';
import SingleInputModal from '../components/SingleInputModal';

const ModalDemo: React.FC = () => {
  const [isBtcModalOpen, setIsBtcModalOpen] = useState(false);
  const [isInrModalOpen, setIsInrModalOpen] = useState(false);
  const [lastSubmittedValue, setLastSubmittedValue] = useState<{type: string, value: string} | null>(null);

  const handleBtcConfirm = async (value: string) => {
    console.log('BTC Value submitted:', value);
    setLastSubmittedValue({ type: 'BTC', value });
    setIsBtcModalOpen(false);
  };

  const handleInrConfirm = async (value: string) => {
    console.log('INR Value submitted:', value);
    setLastSubmittedValue({ type: 'INR', value });
    setIsInrModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-blue-400" />
            Modal Demo Page
          </h1>
          <p className="text-zinc-400">Test the SingleInputModal component with different types</p>
        </div>

        {/* Last Submitted Value Display */}
        {lastSubmittedValue && (
          <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800 rounded-lg p-4 mb-6">
            <h3 className="text-green-300 font-semibold mb-2">Last Submitted Value:</h3>
            <p className="text-white">
              <span className="text-green-400">{lastSubmittedValue.type}:</span> {lastSubmittedValue.value}
            </p>
          </div>
        )}

        {/* Demo Buttons */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">SingleInputModal Types</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BTC Modal Button */}
              <button
                onClick={() => setIsBtcModalOpen(true)}
                className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white font-medium py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <Bitcoin className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-bold">BTC Input Modal</div>
                  <div className="text-sm opacity-90">With decimal keypad</div>
                </div>
              </button>

              {/* INR Modal Button */}
              <button
                onClick={() => setIsInrModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <DollarSign className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-bold">INR Input Modal</div>
                  <div className="text-sm opacity-90">Integer numbers only</div>
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-br from-blue-950/20 to-purple-950/20 border border-blue-800/30 rounded-xl p-6">
            <h3 className="text-blue-300 font-semibold mb-3">Instructions:</h3>
            <ul className="text-zinc-300 space-y-2 text-sm">
              <li>• <strong>BTC Modal:</strong> Includes a decimal point (.) button for precise Bitcoin amounts</li>
              <li>• <strong>INR Modal:</strong> Only integer input, no decimal point for rupee amounts</li>
              <li>• Both modals format the display value automatically using existing formatters</li>
              <li>• Drag down or tap the X to close modals</li>
              <li>• Values are logged to console and displayed above when submitted</li>
            </ul>
          </div>
        </div>
      </div>

      {/* BTC Input Modal */}
      <SingleInputModal
        isOpen={isBtcModalOpen}
        onClose={() => setIsBtcModalOpen(false)}
        title="Enter Bitcoin Amount"
        placeholder="Enter BTC amount"
        type="btc"
        confirmText="Confirm BTC"
        onConfirm={handleBtcConfirm}
        isLoading={false}
        validation={(value) => {
          // Allow partial inputs like "." or "0." while typing
          if (value === '.' || value === '0.' || value.endsWith('.')) {
            return null; // Allow decimal point while typing
          }
          
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) {
            return "Please enter a valid BTC amount";
          }
          if (num > 100) {
            return "Amount too large (max 100 BTC)";
          }
          return null;
        }}
      />

      {/* INR Input Modal */}
      <SingleInputModal
        isOpen={isInrModalOpen}
        onClose={() => setIsInrModalOpen(false)}
        title="Enter INR Amount"
        placeholder="Enter rupee amount"
        type="inr"
        confirmText="Confirm INR"
        onConfirm={handleInrConfirm}
        isLoading={false}
        validation={(value) => {
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) {
            return "Please enter a valid amount";
          }
          if (num > 1000000) {
            return "Amount too large (max ₹10,00,000)";
          }
          return null;
        }}
      />
    </div>
  );
};

export default ModalDemo;
