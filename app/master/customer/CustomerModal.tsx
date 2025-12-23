'use client';

import { useState, useEffect } from 'react';
import { Customer } from '@/types/customer';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess: () => void;
}

interface Cabang {
  id: number;
  nama_cabang: string;
}

export default function CustomerModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: CustomerModalProps) {
  const [formData, setFormData] = useState({
    kode_customer: '',
    nama: '',
    alamat: '',
    no_hp: '',
    cabang_id: null as number | null,
  });
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCabangList();
      
      if (customer) {
        setFormData({
          kode_customer: customer.kode_customer,
          nama: customer.nama,
          alamat: customer.alamat || '',
          no_hp: customer.no_hp || '',
          cabang_id: customer.cabang_id,
        });
      } else {
        setFormData({
          kode_customer: '',
          nama: '',
          alamat: '',
          no_hp: '',
          cabang_id: null,
        });
      }
      setError('');
    }
  }, [isOpen, customer]);

  const loadCabangList = async () => {
    setIsLoadingData(true);
    setError('');

    try {
      const response = await fetch('/api/master/cabang');

      if (!response.ok) {
        throw new Error('Gagal memuat data cabang');
      }

      const result = await response.json();

      if (result.success) {
        setCabangList(result.data || []);
      } else {
        throw new Error(result.error || 'Gagal memuat data cabang');
      }
    } catch (err) {
      console.error('Error loading cabang:', err);
      setError('Terjadi kesalahan saat memuat data cabang');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nama.trim()) {
      setError('Nama customer harus diisi');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let response;
      if (customer) {
        response = await fetch(`/api/master/customer?id=${customer.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } else {
        response = await fetch('/api/master/customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      }

      if (!response.ok) {
        let errorMessage = 'Terjadi kesalahan';

        if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menyimpan data customer.';
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
        onSuccess();
        onClose();
        alert(result.message || 'Operasi berhasil');
      } else {
        throw new Error(result.error || 'Gagal menyimpan data customer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-yellow-100 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">
            {customer ? 'EDIT CUSTOMER' : 'TAMBAH CUSTOMER'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
              <span className="text-sm">{error}</span>
              <button 
                type="button"
                onClick={() => setError('')}
                className="text-red-700 hover:text-red-900 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoadingData && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
            </div>
          )}

          {/* Kode Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {customer ? 'Kode Customer' : 'Id Customer'}
            </label>
            <input
              type="text"
              value={customer ? formData.kode_customer : 'Auto Generate'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
            />
          </div>

          {/* Nama Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Customer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nama}
              onChange={(e) =>
                setFormData({ ...formData, nama: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
              placeholder="Masukkan nama customer"
            />
          </div>

          {/* Kantor/Cabang */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kantor
            </label>
            <select
              value={formData.cabang_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cabang_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">Pilih Kantor</option>
              {cabangList.map((cabang) => (
                <option key={cabang.id} value={cabang.id}>
                  {cabang.nama_cabang}
                </option>
              ))}
            </select>
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alamat
            </label>
            <textarea
              value={formData.alamat}
              onChange={(e) =>
                setFormData({ ...formData, alamat: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              disabled={isLoading}
              placeholder="Masukkan alamat lengkap"
            />
          </div>

          {/* No HP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No HP
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={formData.no_hp}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, no_hp: value });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              placeholder="Contoh: 081234567890"
              maxLength={15}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 bg-yellow-100 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
            <button
              type="submit"
              disabled={isLoading || isLoadingData}
              className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 bg-red-500 text-white py-2 rounded-md hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
