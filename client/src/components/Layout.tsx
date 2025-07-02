import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, History, LogOut, Settings, Users, BarChart3, Bitcoin, UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { formatBitcoin } from '../utils/formatters';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isAdmin = false }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(0);
  const [sellRate, setSellRate] = useState<number>(0);
  const [showPersistentBar, setShowPersistentBar] = useState(false);

  useEffect(() => {
    // Fetch Bitcoin balance for non-admin users
    if (!isAdmin) {
      const fetchBalance = async () => {
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
      };
      fetchBalance();
    }

    // Scroll detection
    const handleScroll = () => {
      setShowPersistentBar(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAdmin]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userNavItems = [
    { name: 'Home', path: '/', icon: Home },
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
      <header className="bg-black border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-bold text-white">
            ₿itTrade {isAdmin && <span className="text-sm text-zinc-400">Admin</span>}
          </h1>
          <div className="flex items-center gap-3">
            {user?.is_admin && (
              <button
                onClick={() => navigate(isAdmin ? '/' : '/admin')}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
                title={isAdmin ? 'Switch to Trading Dashboard' : 'Switch to Admin Dashboard'}
              >
                <UserCog size={20} />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent Bitcoin Balance Bar */}
      {!isAdmin && showPersistentBar && (
        <div className="fixed top-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-zinc-700 px-4 py-2 z-40">
          <div className="flex items-center justify-center max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <Bitcoin className="w-4 h-4 text-white" />
              <span className="text-white font-medium">
                ₿{formatBitcoin(bitcoinBalance)}
              </span>
              <span className="text-zinc-400 text-sm">
                (₹{Math.floor(bitcoinBalance * sellRate).toLocaleString()})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pb-20 px-4 py-6">
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
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
    </div>
  );
};

export default Layout;
