import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, History, Settings, Users, BarChart3, Bitcoin, PieChart, User, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBalance } from '../contexts/BalanceContext';
import { userAPI } from '../services/api';
import { formatBitcoin } from '../utils/formatters';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isAdmin = false }) => {
  const { user } = useAuth();
  const { balanceVersion } = useBalance();
  const location = useLocation();
  const navigate = useNavigate();
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(0);
  const [sellRate, setSellRate] = useState<number>(0);
  const [showPersistentBar, setShowPersistentBar] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!isAdmin) {
      try {
        const response = await userAPI.getDashboard();
        const data = response.data.data;
        if (data) {
          setBitcoinBalance(data.balances.btc || 0);
          setSellRate(data.prices.sell_rate || 0);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchBalance();

    // Scroll detection
    const handleScroll = () => {
      const header = document.querySelector('header');
      if (header) {
        const headerHeight = header.offsetHeight;
        setShowPersistentBar(window.scrollY >= headerHeight);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAdmin, balanceVersion, fetchBalance]);


  const userNavItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Portfolio', path: '/portfolio', icon: PieChart },
    { name: 'Loans', path: '/loans', icon: Wallet },
    { name: 'History', path: '/history', icon: History },
  ];

  const adminNavItems = [
    { name: 'Dashboard', path: '/admin', icon: BarChart3 },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Transactions', path: '/admin/transactions', icon: History },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-zinc-800 px-4 py-1">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={() => navigate(isAdmin ? '/admin' : '/')}
            className="text-xl font-bold text-white hover:text-zinc-200 transition-colors cursor-pointer"
          >
            ₿itTrade {isAdmin && <span className="text-sm text-zinc-400">Admin</span>}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (location.pathname === '/profile') {
                  navigate('/');
                } else {
                  navigate('/profile');
                }
              }}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              title={location.pathname === '/profile' ? 'Go to Home' : 'Go to Profile'}
            >
              <User size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent Bitcoin Balance Bar */}
      {!isAdmin && (
        <div className={`fixed top-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-zinc-700 px-4 py-2 z-40 transition-transform duration-300 ease-in-out ${
          showPersistentBar ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="flex items-center justify-center max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <Bitcoin className="w-4 h-4 text-white" />
              <span className="text-white font-medium">
                ₿{formatBitcoin(bitcoinBalance)}
              </span>
              <span className="text-zinc-400 text-sm">
                (₹{Math.floor(bitcoinBalance * sellRate).toLocaleString('en-IN')})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`px-4 py-6 ${location.pathname === '/profile' ? 'pb-6' : 'pb-20'}`}>
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      {location.pathname !== '/profile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800">
          <div className="flex max-w-md mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors relative ${
                    isActive 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs mt-1">{item.name}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
