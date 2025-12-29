'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { UserData } from '@/types/user';
import { User, Lock, Shield } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData | null;
  onSuccess: () => void;
}

// Definisi UserLevel yang valid
type UserLevel = 'super_admin' | 'admin' | 'keuangan' | 'kasir' | 'gudang' | 'sales';

// Data untuk select options
const USER_LEVELS: { value: UserLevel; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'kasir', label: 'Kasir' },
  { value: 'gudang', label: 'Gudang' },
  { value: 'sales', label: 'Sales' },
];

export default function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    level: UserLevel;
    updatePassword: boolean;
  }>({
    username: '',
    password: '',
    level: 'kasir',
    updatePassword: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        level: user.level as UserLevel,
        updatePassword: false,
      });
    } else {
      setFormData({
        username: '',
        password: '',
        level: 'kasir',
        updatePassword: false,
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async () => {
    // Validasi username
    if (!formData.username.trim()) {
      alert('Username harus diisi');
      return;
    }

    // Validasi panjang username (sesuai database VARCHAR(100))
    if (formData.username.length > 100) {
      alert('Username maksimal 100 karakter');
      return;
    }

    // Validasi password untuk user baru
    if (!user && !formData.password.trim()) {
      alert('Password harus diisi untuk user baru');
      return;
    }

    // Validasi panjang password
    if ((!user || formData.updatePassword) && formData.password.length > 255) {
      alert('Password maksimal 255 karakter');
      return;
    }

    // Validasi password untuk update
    if (user && formData.updatePassword && !formData.password.trim()) {
      alert('Password harus diisi jika ingin mengupdate password');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: {
        username: string;
        password?: string;
        level: string;
      } = {
        username: formData.username.trim(),
        level: formData.level,
      };

      // Tambahkan password jika diperlukan
      if (!user || formData.updatePassword) {
        data.password = formData.password;
      }

      let response;
      if (user) {
        response = await fetch(`/api/master/user?id=${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch('/api/master/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) {
        let errorMessage = 'Terjadi kesalahan';

        if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menyimpan data user.';
        } else {
          const errorJson = await response.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage = errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        alert(result.message || 'Berhasil menyimpan data');
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          username: '',
          password: '',
          level: 'kasir',
          updatePassword: false,
        });
      } else {
        throw new Error(result.error || 'Gagal menyimpan data user');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SingleOverlay>
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
          <label className="block text-gray-700 font-medium mb-2">
            Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Masukkan username"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="relative">
          <label className="block text-gray-700 font-medium mb-2">
            Password {!user && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={user ? "" : "Masukkan password"}
              disabled={isSubmitting || (!!user && !formData.updatePassword)}
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
                setFormData({ ...formData, updatePassword: e.target.checked, password: '' })
              }
              disabled={isSubmitting}
            />
            <span className="text-sm text-gray-700 font-medium">
              Centang jika ingin mengubah password
            </span>
          </div>
        )}

        <div className="relative">
          <label className="block text-gray-700 font-medium mb-2">
            Level Akses <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Shield size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
            <select
              className="w-full pl-10 pr-10 py-3 bg-blue-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 hover:bg-blue-100 appearance-none"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as UserLevel })}
              disabled={isSubmitting}
            >
              {USER_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
    </SingleOverlay>
  );
}
