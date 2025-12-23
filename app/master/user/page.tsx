'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Shield, User, Crown, Filter, Download, MoreVertical } from 'lucide-react';
import { UserData } from '@/types/user';

import UserModal from './UserModal';
import DeleteModal from '@/components/DeleteModal';

export default function UserPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredData, setFilteredData] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);

  const itemsPerPage = 8;

  const fetchData = async () => {
    try {
      const response = await fetch('/api/master/user');
      const result = await response.json();

      if (result.success) {
        setUsers(result.data || []);
        setFilteredData(result.data || []);
      } else {
        console.error('Error fetching users:', result.error);
        setUsers([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
      setFilteredData([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredData(users);
    } else {
      const filtered = users.filter((user) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          user.username.toLowerCase().includes(searchLower) ||
          String(user.level).toLowerCase().includes(searchLower)
        );
      });
      setFilteredData(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, users]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: UserData) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (user: UserData) => {
    setDeleteTarget(user);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try {
        const response = await fetch(`/api/master/user?id=${deleteTarget.id}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (result.success) {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
          fetchData();
          alert(result.message || 'User berhasil dihapus');
        } else {
          alert(result.error || 'Gagal menghapus user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Terjadi kesalahan saat menghapus user');
      }
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const totalUsers = users.length;
  const adminUsers = users.filter(u =>
    String(u.level).toLowerCase() === 'admin' ||
    String(u.level).toLowerCase() === 'super_admin'
  ).length;
  const regularUsers = users.filter(u => String(u.level).toLowerCase() !== 'admin' && String(u.level).toLowerCase() !== 'super_admin').length;

  const getLevelBadge = (level: string | number) => {
    const levelLower = String(level).toLowerCase();
    if (levelLower === 'super_admin') {
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: Crown
      };
    } else if (levelLower === 'admin') {
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        icon: Crown
      };
    } else if (levelLower === 'keuangan') {
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        icon: Shield
      };
    } else if (levelLower === 'kasir') {
      return {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: User
      };
    } else if (levelLower === 'gudang') {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: User
      };
    } else if (levelLower === 'sales') {
      return {
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        icon: User
      };
    } else {
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        icon: User
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master User</h1>
            <p className="text-sm text-gray-600 mt-1">Kelola akses dan hak pengguna sistem</p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Tambah User</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg shadow-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-white mt-1">{totalUsers}</p>
                <p className="text-xs text-blue-100 mt-1">Pengguna terdaftar</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg shadow-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-100 font-medium">Administrators</p>
                <p className="text-2xl font-bold text-white mt-1">{adminUsers}</p>
                <p className="text-xs text-purple-100 mt-1">Admin aktif</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 shadow-lg shadow-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-100 font-medium">Regular Users</p>
                <p className="text-2xl font-bold text-white mt-1">{regularUsers}</p>
                <p className="text-xs text-emerald-100 mt-1">Pengguna biasa</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari username atau level..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block lg:hidden space-y-4">
            {currentData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data'}
              </div>
            ) : (
              currentData.map((user, idx) => {
                const levelStyle = getLevelBadge(user.level);
                const LevelIcon = levelStyle.icon;

                return (
                  <div key={user.id} className="bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-blue-100 mb-1">👤 Username</p>
                          <p className="font-mono text-base font-bold">{user.username}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="space-y-2.5 mb-4">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🆔</span>
                          <div className="flex-1">
                            <p className="text-xs text-blue-100">User ID</p>
                            <p className="text-sm font-semibold">{user.id}</p>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/20 my-4"></div>

                      {/* Level Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-base">🏷️</span>
                        <div>
                          <p className="text-xs text-blue-100">Level Akses</p>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}>
                            <LevelIcon className="w-3.5 h-3.5" />
                            {user.level}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                        >
                          <Edit2 size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-900 font-semibold">
                            {searchTerm ? 'Tidak ada hasil' : 'Belum ada data user'}
                          </p>
                          <p className="text-gray-500 text-sm mt-1">
                            {searchTerm 
                              ? 'Coba gunakan kata kunci lain' 
                              : 'Klik tombol "Tambah User" untuk membuat user baru'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentData.map((user) => {
                    const levelStyle = getLevelBadge(user.level);
                    const LevelIcon = levelStyle.icon;
                    
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{user.username}</p>
                              <p className="text-xs text-gray-500">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}>
                            <LevelIcon className="w-3.5 h-3.5" />
                            {user.level}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-medium text-gray-900">{Math.min(endIndex, filteredData.length)}</span> of{' '}
                  <span className="font-medium text-gray-900">{filteredData.length}</span> results
                </p>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer for single page */}
          {filteredData.length > 0 && totalPages <= 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/50">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{filteredData.length}</span> of{' '}
                <span className="font-medium text-gray-900">{users.length}</span> users
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onSuccess={fetchData}
      />

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName="User"
        itemValue={deleteTarget?.username || ''}
      />
    </div>
  );
}
