'use client';

import { useState, useEffect } from 'react';
import SingleOverlay from '../../../../components/SingleOverlay';

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
}

interface Pegawai {
  id: number;
  nama: string;
}

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface ProduksiData {
  id: number;
  tanggal: string;
  produk_id: number;
  jumlah: number;
  satuan: string;
  pegawai_id: number;
  cabang_id: number;
  status: string;
  produk?: { nama_produk: string };
  pegawai?: { nama: string };
  cabang?: { nama_cabang: string };
}

interface ModalEditProduksiProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produksiData: ProduksiData | null;
}

export default function ModalEditProduksi({
  isOpen,
  onClose,
  onSuccess,
  produksiData
}: ModalEditProduksiProps) {
  const [form, setForm] = useState({
    produk_id: '',
    jumlah: '',
    pegawai_id: ''
  });
  const [produks, setProduks] = useState<Produk[]>([]);
  const [pegawais, setPegawais] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(false);
  
  // show full-screen overlay while saving

  // Populate form when produksiData changes
  useEffect(() => {
    if (isOpen && produksiData) {
      setForm({
        produk_id: produksiData.produk_id.toString(),
        jumlah: produksiData.jumlah.toString(),
        pegawai_id: produksiData.pegawai_id.toString()
      });
    }
  }, [isOpen, produksiData]);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProduks();
      fetchPegawais();
    }
  }, [isOpen]);

  const fetchProduks = async () => {
    try {
      const res = await fetch('/api/master/produk');
      const json = await res.json();
      if (res.ok) {
        setProduks(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching produk:', error);
    }
  };

  const fetchPegawais = async () => {
    try {
      const res = await fetch('/api/master/pegawai');
      const json = await res.json();
      if (res.ok) {
        setPegawais(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching pegawai:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!produksiData) {
      alert('Data produksi tidak ditemukan');
      return;
    }

    const qty = parseFloat(form.jumlah);

    if (qty <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/gudang/produksi/${produksiData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produk_id: parseInt(form.produk_id),
          jumlah: qty,
          pegawai_id: parseInt(form.pegawai_id)
        }),
      });

      const responseData = await res.json();

      if (res.ok) {
        alert('Produksi berhasil diupdate');
        setForm({ produk_id: '', jumlah: '', pegawai_id: '' });
        onSuccess();
        onClose();
      } else {
        alert('Error: ' + (responseData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating produksi:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">Menyimpan...</p>
                <p className="text-sm text-gray-600">Mohon tunggu</p>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Produksi</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Produk */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Produk <span className="text-red-500">*</span>
            </label>
            <select
              value={form.produk_id}
              onChange={(e) => setForm({ ...form, produk_id: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-violet-500"
              disabled={loading}
            >
              <option value="">Pilih Produk</option>
              {produks.map((produk) => (
                <option key={produk.id} value={produk.id}>
                  {produk.nama_produk} ({produk.kode_produk})
                </option>
              ))}
            </select>
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Jumlah <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.jumlah}
              onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
              required
              min="0.01"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-violet-500"
              placeholder="0"
              disabled={loading}
            />
          </div>

          {/* Select Pegawai */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Pegawai <span className="text-red-500">*</span>
            </label>
            <select
              value={form.pegawai_id}
              onChange={(e) => setForm({ ...form, pegawai_id: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-violet-500"
              disabled={loading}
            >
              <option value="">Pilih Pegawai</option>
              {pegawais.map((pegawai) => (
                <option key={pegawai.id} value={pegawai.id}>
                  {pegawai.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Menyimpan...' : 'Update'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 transition-all"
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
