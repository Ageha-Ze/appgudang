'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { HutangUmum } from '@/types/hutang';
import SingleOverlay from '../../../../components/SingleOverlay';

interface Kas {
  id: number;
  nama_kas: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hutang: HutangUmum;
}

const jenisHutangOptions = [
  'Bank',
  'Personal',
  'Supplier',
  'Vendor',
  'Pinjaman',
  'Lainnya',
];

export default function ModalEditHutang({ isOpen, onClose, onSuccess, hutang }: ModalProps) {
  const [formData, setFormData] = useState({
    jenis_hutang: '',
    tanggal_transaksi: '',
    pihak: '',
    keterangan: '',
    nominal_total: '',
    kas_id: '',
  });
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && hutang) {
      setFormData({
        jenis_hutang: hutang.jenis_hutang,
        tanggal_transaksi: hutang.tanggal_transaksi,
        pihak: hutang.pihak,
        keterangan: hutang.keterangan || '',
        nominal_total: hutang.nominal_total.toString(),
        kas_id: hutang.kas_id.toString(),
      });
      fetchKas();
    }
  }, [isOpen, hutang]);

  const fetchKas = async () => {
    try {
      const res = await fetch('/api/master/kas');
      const json = await res.json();
      setKasList(json.data || []);
    } catch (error) {
      console.error('Error fetching kas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.jenis_hutang || !formData.pihak || !formData.nominal_total || !formData.kas_id) {
      alert('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/keuangan/hutang-umum/${hutang.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert('Data hutang berhasil diupdate');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal mengupdate data');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Edit Data Hutang</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Jenis Hutang */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Jenis Hutang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.jenis_hutang}
                onChange={(e) => setFormData({ ...formData, jenis_hutang: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">-- Pilih Jenis Hutang --</option>
                {jenisHutangOptions.map((jenis) => (
                  <option key={jenis} value={jenis}>
                    {jenis}
                  </option>
                ))}
              </select>
            </div>

            {/* Tanggal Transaksi */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tanggal Transaksi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tanggal_transaksi}
                onChange={(e) => setFormData({ ...formData, tanggal_transaksi: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            {/* Pihak */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Pihak (Pemberi Hutang) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pihak}
                onChange={(e) => setFormData({ ...formData, pihak: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            {/* Nominal Total */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Nominal Total <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.nominal_total}
                onChange={(e) => setFormData({ ...formData, nominal_total: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Sisa akan dihitung ulang: Nominal Total - Sudah Dibayar
              </p>
            </div>

            {/* Rekening (Kas) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Rekening <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.kas_id}
                onChange={(e) => setFormData({ ...formData, kas_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">-- Pilih Rekening --</option>
                {kasList.map((kas) => (
                  <option key={kas.id} value={kas.id}>
                    {kas.nama_kas}
                  </option>
                ))}
              </select>
            </div>

            {/* Keterangan */}
            <div>
              <label className="block text-sm font-medium mb-1">Keterangan</label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      </div>
    </SingleOverlay>
  );
}
