import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Mail,
  Calendar,
  Edit3,
  Key,
  Download,
  BookOpen,
  Shield,
  ExternalLink,
  LogOut,
  UserCog
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import TextInputModal from '../components/TextInputModal';
import ChangePinModal from '../components/ChangePinModal';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<'name' | 'email' | 'password' | 'pin' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { sendMessage } = useWebSocket();

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setError('');
      setMessage('');
      
      const response = await sendMessage('user.export-data');
      
      // Create blob and download
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bittrade-data.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setMessage('✅ Data exported successfully!');
    } catch (error: any) {
      console.error('Export error:', error);
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handleTextInputConfirm = async (values: Record<string, string>) => {
    setIsLoading(true);
    try {
      if (activeModal === 'name') {
        await sendMessage('user.update-profile', { name: values.name, currentPassword: values.currentPassword });
        setMessage('✅ Name updated successfully!');
      } else if (activeModal === 'email') {
        await sendMessage('user.update-profile', { email: values.email, currentPassword: values.currentPassword });
        setMessage('✅ Email updated successfully!');
      } else if (activeModal === 'password') {
        await sendMessage('user.change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
        setMessage('✅ Password changed successfully!');
      }
      setActiveModal(null);
    } catch (error: any) {
      setError(error.message || 'An error occurred');
      setActiveModal(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getModalConfig = () => {
    if (!activeModal) return null;

    switch (activeModal) {
      case 'name':
        return {
          title: 'Edit Name',
          fields: [
            {
              id: 'name',
              label: 'Full Name',
              type: 'text' as const,
              value: user?.name || '',
              required: true,
              placeholder: 'Enter your full name',
              validation: (value: string) => {
                if (!value.trim()) return 'Name is required';
                if (value.trim().length < 2) return 'Name must be at least 2 characters';
                return null;
              }
            },
            {
              id: 'currentPassword',
              label: 'Current Password',
              type: 'password' as const,
              value: '',
              required: true,
              placeholder: 'Enter your current password to confirm changes'
            }
          ]
        };
      
      case 'email':
        return {
          title: 'Edit Email',
          fields: [
            {
              id: 'email',
              label: 'Email Address',
              type: 'email' as const,
              value: user?.email || '',
              required: true,
              placeholder: 'Enter your email address',
              validation: (value: string) => {
                if (!value.trim()) return 'Email is required';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) return 'Please enter a valid email address';
                return null;
              }
            },
            {
              id: 'currentPassword',
              label: 'Current Password',
              type: 'password' as const,
              value: '',
              required: true,
              placeholder: 'Enter your current password to confirm changes'
            }
          ]
        };
      
      case 'password':
        return {
          title: 'Change Password',
          fields: [
            {
              id: 'currentPassword',
              label: 'Current Password',
              type: 'password' as const,
              value: '',
              required: true,
              placeholder: 'Enter your current password'
            },
            {
              id: 'newPassword',
              label: 'New Password',
              type: 'password' as const,
              value: '',
              required: true,
              placeholder: 'Enter your new password',
              validation: (value: string) => {
                if (!value.trim()) return 'New password is required';
                if (value.length < 6) return 'Password must be at least 6 characters';
                return null;
              }
            },
            {
              id: 'confirmPassword',
              label: 'Confirm New Password',
              type: 'password' as const,
              value: '',
              required: true,
              placeholder: 'Confirm your new password'
            }
          ]
        };
      
      default:
        return null;
    }
  };

  const modalConfig = getModalConfig();

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-white text-sm font-semibold">Profile</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}
        {message && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-300 text-sm">{message}</span>
          </div>
        )}

        {/* Profile Information */}
        <div className="bg-black border border-zinc-800 rounded-xl p-3">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-white" />
            Account Information
          </h2>

          <div className="space-y-4">
            {/* Name */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800 rounded-lg">
                  <User className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-zinc-400 text-xs">Name</p>
                  <p className="font-medium text-sm">{user.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  clearMessages();
                  setActiveModal('name');
                }}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800 rounded-lg">
                  <Mail className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-zinc-400 text-xs">Email</p>
                  <p className="font-medium text-sm">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  clearMessages();
                  setActiveModal('email');
                }}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            {/* Account Created */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-zinc-800 rounded-lg">
                <Calendar className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-zinc-400 text-xs">Member Since</p>
                <p className="font-medium text-sm">
                  {user.created_at ? formatDate(user.created_at) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Admin Badge */}
            {(user.is_admin === true || user.is_admin === 1) && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-2 flex items-center gap-2">
                <Shield className="w-3 h-3 text-blue-400" />
                <span className="text-blue-300 font-medium text-xs">Administrator Account</span>
              </div>
            )}
          </div>
        </div>

        {/* Admin Dashboard Access */}
        {(user.is_admin === true || user.is_admin === 1) && (
          <button
            onClick={() => {
              clearMessages();
              navigate('/admin');
            }}
            className="w-full bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-zinc-800 rounded-lg">
                <UserCog className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Access Admin Dashboard</p>
                <p className="text-zinc-400 text-xs">Manage users, transactions, and system settings</p>
              </div>
            </div>
            <UserCog className="w-3 h-3 text-zinc-400" />
          </button>
        )}

        {/* Account Actions */}
        <div className="space-y-3">
          {/* Change Password */}
          <button
            onClick={() => {
              clearMessages();
              setActiveModal('password');
            }}
            className="w-full bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-zinc-800 rounded-lg">
                <Key className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Change Password</p>
                <p className="text-zinc-400 text-xs">Update your account password</p>
              </div>
            </div>
            <Edit3 className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Change PIN */}
          <button
            onClick={() => {
              clearMessages();
              setActiveModal('pin');
            }}
            className="w-full bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-zinc-800 rounded-lg">
                <Shield className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Change PIN</p>
                <p className="text-zinc-400 text-xs">Update your 4-digit security PIN</p>
              </div>
            </div>
            <Edit3 className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Logout Button */}
          <button
            onClick={async () => {
              clearMessages();
              await logout();
            }}
            className="w-full bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-zinc-800 rounded-lg">
                <LogOut className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Logout</p>
                <p className="text-zinc-400 text-xs">Sign out of your account</p>
              </div>
            </div>
            <LogOut className="w-3 h-3 text-zinc-400" />
          </button>
        </div>

        {/* Educational Resources */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-white" />
            Educational Resources
          </h3>

          <div className="grid grid-cols-1 gap-2">
            <a 
              href="https://casebitcoin.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-orange-400" />
              <div className="flex-1">
                <p className="font-medium text-sm">The Case for Bitcoin</p>
                <p className="text-zinc-400 text-xs">Learn why Bitcoin matters</p>
              </div>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
            
            <a 
              href="https://endthefud.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Shield className="w-4 h-4 text-blue-400" />
              <div className="flex-1">
                <p className="font-medium text-sm">End The FUD</p>
                <p className="text-zinc-400 text-xs">Bitcoin education & resources</p>
              </div>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Modals - Rendered via Portal to bypass Layout constraints */}
      {modalConfig && createPortal(
        <TextInputModal
          isOpen={activeModal === 'name' || activeModal === 'email' || activeModal === 'password'}
          onClose={() => setActiveModal(null)}
          title={modalConfig.title}
          fields={modalConfig.fields}
          onConfirm={handleTextInputConfirm}
          isLoading={isLoading}
        />,
        document.body
      )}

      {createPortal(
        <ChangePinModal
          isOpen={activeModal === 'pin'}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setMessage('✅ PIN changed successfully!');
            setActiveModal(null);
          }}
        />,
        document.body
      )}
      
    </>
  );
};

export default Profile;
