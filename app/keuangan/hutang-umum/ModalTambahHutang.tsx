'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface Kas {
  id: number;
  nama_kas: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const jenisHutangOptions = [
  'Bank',
  'Personal',
  'Supplier',
  'Vendor',
  'Pinjaman',
  'Lainnya',
];

export default function ModalTambahHutang({ isOpen, onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState({
    jenis_hutang: '',
    tanggal_transaksi: new Date().toISOString().split('T')[0],
    pihak: '',
    keterangan: '',
    nominal_total: '',
    kas_id: '',
  });
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchKas();
    }
  }, [isOpen]);

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
      const res = await fetch('/api/keuangan/hutang-umum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert('Hutang berhasil ditambahkan');
        onSuccess();
        handleClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal menambahkan hutang');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      jenis_hutang: '',
      tanggal_transaksi: new Date().toISOString().split('T')[0],
      pihak: '',
      keterangan: '',
      nominal_total: '',
      kas_id: '',
    });
    onClose();
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
          <h2 className="text-xl font-bold">Hutang Baru</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
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
              placeholder="Nama pemberi hutang"
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
              placeholder="0"
              required
            />
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
              placeholder="Keterangan tambahan..."
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
              onClick={handleClose}
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
