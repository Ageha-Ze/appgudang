'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { PegawaiData } from '@/types/pegawai';

interface PegawaiModalProps {
  isOpen: boolean;
  onClose: () => void;
  pegawai: PegawaiData | null;
  onSuccess: () => void;
}

const jabatanOptions = ['Sales', 'Produksi', 'Accounting'];
const levelJabatanOptions = ['Training', 'Junior', 'Senior', 'Supervisor', 'Leader', 'Manajemen'];

export default function PegawaiModal({ isOpen, onClose, pegawai, onSuccess }: PegawaiModalProps) {
  const [cabangList, setCabangList] = useState<Array<{ id: number; kode_cabang: string; nama_cabang: string }>>([]);
  const [userList, setUserList] = useState<Array<{ id: number; username: string }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    jabatan: '',
    nama: '',
    no_telp: '',
    level_jabatan: '',
    daerah_operasi: '',
    nomor_ktp: '',
    tanggal_lahir: '',
    cabang_id: '',
    user_id: '',
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      setError(null);
      
      try {
        console.log('[Modal] Loading cabang and users...');
        
        // Fetch cabang and users using API routes
        const [cabangResponse, userResponse] = await Promise.all([
          fetch('/api/master/pegawai?type=cabang', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
          fetch('/api/master/pegawai?type=users', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        ]);
        
        console.log('[Modal] Cabang response status:', cabangResponse.status);
        console.log('[Modal] Users response status:', userResponse.status);
        
        if (!cabangResponse.ok || !userResponse.ok) {
          throw new Error('Failed to load data');
        }
        
        const cabangData = await cabangResponse.json();
        const userData = await userResponse.json();
        
        console.log('[Modal] Cabang data:', cabangData);
        console.log('[Modal] Users data:', userData);
        
        if (cabangData.success) {
          setCabangList(cabangData.data || []);
        } else {
          setError(cabangData.error || 'Gagal memuat data cabang');
        }
        
        if (userData.success) {
          setUserList(userData.data || []);
        } else {
          setError(userData.error || 'Gagal memuat data user');
        }
        
      } catch (err: any) {
        console.error('[Modal] Error loading data:', err);
        setError(`Terjadi kesalahan saat memuat data: ${err.message}`);
      } finally {
        setIsLoadingData(false);
      }
    };
    
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (pegawai) {
      setFormData({
        jabatan: pegawai.jabatan,
        nama: pegawai.nama,
        no_telp: pegawai.no_telp,
        level_jabatan: pegawai.level_jabatan,
        daerah_operasi: pegawai.daerah_operasi,
        nomor_ktp: pegawai.nomor_ktp,
        tanggal_lahir: pegawai.tanggal_lahir,
        cabang_id: pegawai.cabang_id?.toString() || '',
        user_id: pegawai.user_id?.toString() || '',
      });
    } else {
      setFormData({
        jabatan: '',
        nama: '',
        no_telp: '',
        level_jabatan: '',
        daerah_operasi: '',
        nomor_ktp: '',
        tanggal_lahir: '',
        cabang_id: '',
        user_id: '',
      });
    }
    setError(null);
  }, [pegawai, isOpen]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.nama || !formData.jabatan) {
      setError('Nama Pegawai dan Jabatan harus diisi');
      return;
    }

    // Validate date of birth
    if (formData.tanggal_lahir) {
      const selectedDate = new Date(formData.tanggal_lahir);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day

      if (selectedDate >= today) {
        setError('Tanggal lahir tidak boleh hari ini atau di masa depan');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        jabatan: formData.jabatan,
        nama: formData.nama,
        no_telp: formData.no_telp,
        level_jabatan: formData.level_jabatan,
        daerah_operasi: formData.daerah_operasi,
        nomor_ktp: formData.nomor_ktp,
        tanggal_lahir: formData.tanggal_lahir,
        cabang_id: formData.cabang_id ? parseInt(formData.cabang_id) : null,
        user_id: formData.user_id ? parseInt(formData.user_id) : null,
      };

      console.log('[Modal] Submitting data:', data);
      console.log('[Modal] Is update?', !!pegawai);

      let response;
      if (pegawai) {
        // Update existing pegawai
        console.log('[Modal] Updating pegawai ID:', pegawai.id);
        response = await fetch(`/api/master/pegawai?id=${pegawai.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } else {
        // Add new pegawai
        console.log('[Modal] Creating new pegawai');
        response = await fetch('/api/master/pegawai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      }

      console.log('[Modal] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Modal] Response not OK:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Modal] Result:', result);

      if (result.success) {
        onSuccess();
        onClose();

        let message = result.message || 'Operasi berhasil';
        if (result.isOffline) {
          message += ' (akan disimpan saat koneksi kembali)';
        } else if (result.queued) {
          message += ' (dalam antrian)';
        }

        alert(message);
      } else {
        let errorMessage = result.error || result.message || 'Terjadi kesalahan';

        if (result.isOffline) {
          errorMessage += ' - Operasi akan dicoba otomatis saat koneksi kembali';
        } else if (result.queued) {
          errorMessage += ' - Operasi telah dimasukkan ke antrian offline';
        }

        setError(errorMessage);
      }
    } catch (err: any) {
      console.error('[Modal] Error submitting form:', err);
      setError(`Terjadi kesalahan saat menyimpan data: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pegawai ? 'EDIT PEGAWAI' : 'TAMBAH PEGAWAI'}
    >
      <div className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button 
              onClick={() => setError(null)}
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

        {pegawai && (
          <div>
            <label className="block text-gray-700 mb-2">Kode Sales</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
              value={pegawai.id}
              disabled
            />
          </div>
        )}

        <div>
          <label className="block text-gray-700 mb-2">Pilih Jabatan <span className="text-red-500">*</span></label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.jabatan}
            onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">Pilih Jabatan</option>
            {jabatanOptions.map((jab) => (
              <option key={jab} value={jab}>
                {jab}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Nama Pegawai <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            disabled={isSubmitting}
            placeholder="Masukkan nama pegawai"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">No Telepon</label>
          <input
            type="tel"
            inputMode="numeric"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.no_telp}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              setFormData({ ...formData, no_telp: value });
            }}
            disabled={isSubmitting}
            placeholder="Contoh: 081234567890"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Level Jabatan</label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.level_jabatan}
            onChange={(e) => setFormData({ ...formData, level_jabatan: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">Pilih Level Jabatan</option>
            {levelJabatanOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Daerah Operasi</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.daerah_operasi}
            onChange={(e) => setFormData({ ...formData, daerah_operasi: e.target.value })}
            disabled={isSubmitting}
            placeholder="Contoh: Yogyakarta"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Nomor KTP</label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nomor_ktp}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              setFormData({ ...formData, nomor_ktp: value });
            }}
            disabled={isSubmitting}
            placeholder="16 digit nomor KTP"
            maxLength={16}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Tanggal Lahir</label>
          <input
            type="date"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.tanggal_lahir}
            onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
            disabled={isSubmitting}
            max={new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Yesterday or earlier
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Pilih Kantor</label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.cabang_id}
            onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">Pilih Kantor</option>
            {cabangList.map((cabang) => (
              <option key={cabang.id} value={cabang.id}>
                {cabang.kode_cabang} - {cabang.nama_cabang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Pilih User</label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">Tanpa User</option>
            {userList.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingData}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
  );
}