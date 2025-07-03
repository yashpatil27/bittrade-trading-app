import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Settings,
  DollarSign,
  Bitcoin,
  Eye,
  UserCheck,
  UserX,
  ChevronRight
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { AdminUser } from '../types';
import UserManagementModal from '../components/UserManagementModal';
import { formatBitcoin } from '../utils/formatters';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getUsers(1, 50); // Get more users initially
      const { users: fetchedUsers, pagination } = response.data.data!;
      setUsers(fetchedUsers);
      setHasMore(pagination.has_more);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleUserUpdated = () => {
    fetchUsers(); // Refresh the user list
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalINR = users.reduce((sum, user) => sum + user.inr_balance, 0);
  const totalBTC = users.reduce((sum, user) => sum + user.btc_balance, 0);
  const adminCount = users.filter(user => user.is_admin).length;
  const regularCount = users.filter(user => !user.is_admin).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-white" />
            User Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage all platform users and their balances</p>
        </div>
        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <UserCheck className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold">{users.length}</p>
          <p className="text-xs text-zinc-500">{adminCount} Admin • {regularCount} Users</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <DollarSign className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total INR</p>
          <p className="text-xl font-bold">₹{totalINR.toLocaleString('en-IN')}</p>
          <p className="text-xs text-zinc-500">Platform Total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Bitcoin className="w-8 h-8 text-white mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Total Bitcoin</p>
          <p className="text-xl font-bold">₿{formatBitcoin(totalBTC)}</p>
          <p className="text-xs text-zinc-500">Platform Total</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-400 focus:outline-none focus:border-white"
        />
      </div>

      {/* Users List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-white" />
            All Users ({filteredUsers.length})
          </h2>
        </div>
        
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Loading users...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  onClick={() => handleUserClick(user)}
                  className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-700 rounded-lg">
                        {user.is_admin ? (
                          <UserCheck className="w-4 h-4 text-white" />
                        ) : (
                          <UserX className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{user.name}</p>
                          {!!(user.is_admin === true || user.is_admin === 1) && (
                            <span className="bg-zinc-700 text-white text-xs px-2 py-1 rounded-full">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-sm">{user.email}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-zinc-500">
                            ₹{user.inr_balance.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-zinc-500">
                            ₿{formatBitcoin(user.btc_balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-zinc-400" />
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">
                {searchTerm ? 'No users found' : 'No users yet'}
              </p>
              <p className="text-zinc-500 text-sm">
                {searchTerm ? 'Try adjusting your search terms' : 'Users will appear here once they sign up!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};

export default AdminUsers;
