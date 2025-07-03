import React, { useState } from 'react';
import {
  User,
  Mail,
  Calendar,
  Edit3,
  Key,
  Download,
  BookOpen,
  Shield,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import EditNameModal from '../components/EditNameModal';
import EditEmailModal from '../components/EditEmailModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ChangePinModal from '../components/ChangePinModal';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [isEditEmailOpen, setIsEditEmailOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setError('');
      setMessage('');
      
      const response = await userAPI.exportData();
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
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

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-white" />
          Profile
        </h1>
        <div className="text-center py-8">
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-white" />
          Profile
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your account settings</p>
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

      {/* Profile Information */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-white" />
          Account Information
        </h2>

        <div className="space-y-6">
          {/* Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => {
                clearMessages();
                setIsEditNameOpen(true);
              }}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                clearMessages();
                setIsEditEmailOpen(true);
              }}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Account Created */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Member Since</p>
              <p className="font-medium">
                {user.created_at ? formatDate(user.created_at) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Admin Badge */}
          {(user.is_admin === true || user.is_admin === 1) && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-medium">Administrator Account</span>
            </div>
          )}
        </div>
      </div>

      {/* Account Actions */}
      <div className="space-y-4">
        {/* Change Password */}
        <button
          onClick={() => {
            clearMessages();
            setIsChangePasswordOpen(true);
          }}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">Change Password</p>
              <p className="text-zinc-400 text-sm">Update your account password</p>
            </div>
          </div>
          <Edit3 className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Change PIN */}
        <button
          onClick={() => {
            clearMessages();
            setIsChangePinOpen(true);
          }}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">Change PIN</p>
              <p className="text-zinc-400 text-sm">Update your 4-digit security PIN</p>
            </div>
          </div>
          <Edit3 className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Export Data */}
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">Export Trading Data</p>
              <p className="text-zinc-400 text-sm">Download your transaction history as CSV</p>
            </div>
          </div>
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Educational Resources */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-white" />
          Educational Resources
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <a 
            href="https://casebitcoin.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-orange-400" />
            <div className="flex-1">
              <p className="font-medium">The Case for Bitcoin</p>
              <p className="text-zinc-400 text-sm">Learn why Bitcoin matters</p>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400" />
          </a>
          
          <a 
            href="https://endthefud.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Shield className="w-5 h-5 text-blue-400" />
            <div className="flex-1">
              <p className="font-medium">End The FUD</p>
              <p className="text-zinc-400 text-sm">Bitcoin education & resources</p>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* Modals */}
      <EditNameModal
        isOpen={isEditNameOpen}
        onClose={() => setIsEditNameOpen(false)}
        currentName={user.name}
        onSuccess={(message) => {
          setMessage(message);
          setIsEditNameOpen(false);
        }}
        onError={(error) => {
          setError(error);
          setIsEditNameOpen(false);
        }}
      />

      <EditEmailModal
        isOpen={isEditEmailOpen}
        onClose={() => setIsEditEmailOpen(false)}
        currentEmail={user.email}
        onSuccess={(message) => {
          setMessage(message);
          setIsEditEmailOpen(false);
        }}
        onError={(error) => {
          setError(error);
          setIsEditEmailOpen(false);
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={(message) => {
          setMessage(message);
          setIsChangePasswordOpen(false);
        }}
        onError={(error) => {
          setError(error);
          setIsChangePasswordOpen(false);
        }}
      />

      <ChangePinModal
        isOpen={isChangePinOpen}
        onClose={() => setIsChangePinOpen(false)}
        onSuccess={() => {
          setMessage('✅ PIN changed successfully!');
          setIsChangePinOpen(false);
        }}
      />
    </div>
  );
};

export default Profile;
