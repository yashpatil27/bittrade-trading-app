import React, { useState, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PinConfirmationModal from '../components/PinConfirmationModal';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [registrationData, setRegistrationData] = useState<{email: string, name: string, password: string, pin: string} | null>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { register, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pinString = pin.join('');
    if (pinString.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    // Prepare registration data and open PIN confirmation modal
    setRegistrationData({ email, name, password, pin: pinString });
    setIsPinModalOpen(true);
  };

  const handlePinConfirm = async (pin: string) => {
    if (!registrationData || pin !== registrationData.pin) {
      setError('PIN does not match. Please try again.');
      return false;
    }

    // Complete registration
    setIsLoading(true);
    try {
      await register(registrationData.email, registrationData.name, registrationData.password, registrationData.pin);
      return true;
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      return false;
    } finally {
      setIsLoading(false);
      setIsPinModalOpen(false);
      setRegistrationData(null);
    }
  };
  
  const handlePinChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Move to next input if digit entered
    if (value && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">₿itTrade</h1>
          <p className="text-zinc-400 text-sm">Stay Humble, Stack Sats</p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full"
              placeholder="Enter your full name"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full"
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="Enter your password"
                required
                minLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Password must be at least 6 characters long
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Security PIN (4 digits)
            </label>
            <div className="flex gap-3 justify-center mb-2">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={el => pinInputRefs.current[index] = el}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !pin[index] && index > 0) {
                      pinInputRefs.current[index - 1]?.focus();
                    }
                  }}
                  className="w-12 h-12 text-center text-xl font-bold bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-white transition-colors"
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Used to confirm trading actions
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password || !name || pin.some(digit => digit === '') || password.length < 6}
            className="btn-primary w-full"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-zinc-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      
      {/* PIN Confirmation Modal */}
      <PinConfirmationModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setRegistrationData(null);
        }}
        onConfirm={handlePinConfirm}
        title="Confirm Your PIN"
        message="Please re-enter your PIN to complete registration"
        isLoading={isLoading}
      />
    </div>
  );
};

export default Register;
