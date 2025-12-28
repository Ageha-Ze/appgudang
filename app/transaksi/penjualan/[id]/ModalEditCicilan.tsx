'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalEditCicilanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cicilan: {
    id: number;
    tanggal_cicilan: string;
    jumlah_cicilan: number;
    keterangan: string;
  };
  penjualanId: number;
}

interface PenjualanData {
  id: number;
  cabang_id: number;
}

interface Kas {
  id: number;
  nama_kas: string;
  saldo: number;
}

export default function ModalEditCicilan({
  isOpen,
  onClose,
  onSuccess,
  cicilan,
  penjualanId,
}: ModalEditCicilanProps) {
  const [formData, setFormData] = useState({
    kas_id: 0,
    tanggal_cicilan: '',
    jumlah_cicilan: 0,
  });
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(false);
  const [penjualanData, setPenjualanData] = useState<PenjualanData | null>(null);

  useEffect(() => {
    if (isOpen && cicilan) {
      setFormData({
        kas_id: 0,
        tanggal_cicilan: cicilan.tanggal_cicilan,
        jumlah_cicilan: parseFloat(cicilan.jumlah_cicilan.toString()),
      });
      fetchPenjualanData();
    }
  }, [isOpen, cicilan]);

  const fetchPenjualanData = async () => {
    try {
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}`);
      const json = await res.json();
      if (json.success !== false && json.data) {
        setPenjualanData(json.data);
        fetchKas(json.data.cabang_id);
      }
    } catch (error) {
      console.error('Error fetching penjualan data:', error);
    }
  };

  const fetchKas = async (cabangId?: number) => {
    try {
      const url = cabangId ? `/api/master/kas?cabang_id=${cabangId}` : '/api/master/kas';
      const res = await fetch(url);
      const json = await res.json();
      setKasList(json.data || []);
    } catch (error) {
      console.error('Error fetching kas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.kas_id === 0) {
      alert('Pilih rekening terlebih dahulu');
      return;
    }

    if (formData.jumlah_cicilan <= 0) {
      alert('Jumlah cicilan harus lebih dari 0');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `/api/transaksi/penjualan/${penjualanId}/cicilan/${cicilan.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (res.ok) {
        alert('Cicilan berhasil diupdate');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal mengupdate cicilan');
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
    <>
      {/* Full Screen Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Mengupdate Cicilan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 rounded-lg p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">EDIT CICILAN PENJUALAN</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tanggal Cicilan */}
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Cicilan</label>
            <input
              type="date"
              value={formData.tanggal_cicilan}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_cicilan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          {/* Pilih Rekening */}
          <div>
            <label className="block text-sm font-medium mb-1">Pilih Rekening</label>
            <select
              value={formData.kas_id}
              onChange={(e) =>
                setFormData({ ...formData, kas_id: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value={0}>-- Pilih Rekening --</option>
              {kasList.map((kas) => (
                <option key={kas.id} value={kas.id}>
                  {kas.nama_kas} - Saldo: Rp. {kas.saldo.toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>

          {/* Nilai Cicilan */}
          <div>
            <label className="block text-sm font-medium mb-1">Nilai Cicilan</label>
            <input
              type="number"
              value={formData.jumlah_cicilan || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jumlah_cicilan: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border rounded"
              placeholder="0"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-center mt-6">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Update'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  </>
);
}
