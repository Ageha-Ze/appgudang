'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { UserData } from '@/types/user';
import { addUser, updateUser } from './actions';
import { User, Lock, Shield } from 'lucide-react'; // Added icons for better UX

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData | null;
  onSuccess: () => void;
}

export default function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    level: 'user',
    updatePassword: false,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        level: user.level,
        updatePassword: false,
      });
    } else {
      setFormData({
        username: '',
        password: '',
        level: 'user',
        updatePassword: false,
      });
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!formData.username) {
      alert('Username harus diisi');
      return;
    }

    if (!user && !formData.password) {
      alert('Password harus diisi');
      return;
    }

    if (user && formData.updatePassword && !formData.password) {
      alert('Password harus diisi');
      return;
    }

    const data = {
      username: formData.username,
      password: formData.password || undefined,
      level: formData.level,
    };

    let result;
    if (user) {
      if (!formData.updatePassword) {
        delete data.password;
      }
      result = await updateUser(user.id, data);
    } else {
      result = await addUser(data as any);
    }

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      alert(result.error || 'Terjadi kesalahan');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'EDIT USER' : 'TAMBAH USER'}
    >
      <div className="space-y-6 p-2">
        {user && (
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-2">ID User</label>
            <div className="relative">
              <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                value={user.id}
                disabled
              />
            </div>
          </div>
        )}

        <div className="relative">
          <label className="block text-gray-700 font-medium mb-2">Username</label>
          <div className="relative">
            <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>
        </div>

        <div className="relative">
          <label className="block text-gray-700 font-medium mb-2">Password</label>
          <div className="relative">
            <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
            />
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              checked={formData.updatePassword}
              onChange={(e) =>
                setFormData({ ...formData, updatePassword: e.target.checked })
              }
            />
            <span className="text-sm text-gray-700 font-medium">
              Check this box if you want to update your password
            </span>
          </div>
        )}

        <div className="relative">
          <label className="block text-gray-700 font-medium mb-2">Level Akses</label>
          <div className="relative">
            <Shield size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100 appearance-none"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="keuangan">Keuangan</option>
              <option value="kasir">Kasir</option>
              <option value="gudang">Gudang</option>
              <option value="sales">Sales</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-semibold"
          >
            Simpan
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-semibold"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
  );
}
