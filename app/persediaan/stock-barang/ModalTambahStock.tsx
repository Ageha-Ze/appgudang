'use client';

import { useState, useEffect } from 'react';
import { X, Package, TrendingUp } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ModalTambahStockProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProdukId?: number;
  initialCabangId?: number;
  initialHpp?: number;
  initialHargaJual?: number;
  initialPersentase?: number;
}

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stok: number;
  hpp: number;
  harga_jual: number;
  margin: number;
}

interface Cabang {
  id: number;
  nama_cabang: string;
  kode_cabang: string;
}

export default function ModalTambahStock({
  isOpen,
  onClose,
  onSuccess,
  initialProdukId,
  initialCabangId,
  initialHpp,
  initialHargaJual,
  initialPersentase
}: ModalTambahStockProps) {
  const [loading, setLoading] = useState(false);
  const [produks, setProduks] = useState<Produk[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);

  const [formData, setFormData] = useState({
    produk_id: 0,
    cabang_id: 0,
    jumlah: 0,
    hpp: 0,
    harga_jual: 0,
    persentase: 0,
    keterangan: '',
  });

  // Fetch master data
  useEffect(() => {
    if (isOpen) {
      fetchProduks();
      fetchCabangs();

      // Initialize form with provided initial values
      if (initialProdukId || initialCabangId) {
        setFormData({
          produk_id: initialProdukId || 0,
          cabang_id: initialCabangId || 0,
          hpp: initialHpp || 0,
          harga_jual: initialHargaJual || 0,
          persentase: initialPersentase || 0,
          jumlah: 0,
          keterangan: '',
        });
      }
    }
  }, [isOpen, initialProdukId, initialCabangId, initialHpp, initialHargaJual, initialPersentase]);

  const fetchProduks = async () => {
    try {
      const res = await fetch('/api/master/produk');
      const json = await res.json();
      setProduks(json.data || []);
    } catch (error) {
      console.error('Error fetching produks:', error);
    }
  };

  const fetchCabangs = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangs(json.data || []);
    } catch (error) {
      console.error('Error fetching cabangs:', error);
    }
  };

  // Auto calculate margin - Only modify price-related fields, never quantity
  const handleHppChange = (hpp: number) => {
    const persentase = formData.persentase;
    const harga_jual = hpp + (hpp * persentase / 100);
    setFormData(prev => ({
      ...prev,
      hpp,
      harga_jual,
      // Explicitly preserve jumlah
      jumlah: prev.jumlah || 0
    }));
  };

  const handlePersentaseChange = (persentase: number) => {
    const harga_jual = formData.hpp + (formData.hpp * persentase / 100);
    setFormData(prev => ({
      ...prev,
      persentase,
      harga_jual,
      // Explicitly preserve jumlah
      jumlah: prev.jumlah || 0
    }));
  };

  const handleHargaJualChange = (harga_jual: number) => {
    const persentase = formData.hpp > 0
      ? ((harga_jual - formData.hpp) / formData.hpp * 100)
      : 0;
    setFormData(prev => ({
      ...prev,
      harga_jual,
      persentase,
      // Explicitly preserve jumlah
      jumlah: prev.jumlah || 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.produk_id || !formData.cabang_id) {
      alert('Produk dan Cabang wajib dipilih!');
      return;
    }

    if (!formData.jumlah) {
      alert('Jumlah wajib diisi!');
      return;
    }

    setLoading(true);

    try {
      const body = {
        produk_id: formData.produk_id,
        cabang_id: formData.cabang_id,
        jumlah: formData.jumlah,
        tipe: 'masuk',
        hpp: formData.hpp || 0,
        harga_jual: formData.harga_jual || 0,
        persentase_harga_jual: formData.persentase || 0,
        keterangan: formData.keterangan || `Stock tambah manual`,
      };

      console.log('📤 Sending request:', body);

      const res = await fetch('/api/persediaan/stock-barang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Stock berhasil ditambah!');
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          produk_id: 0,
          cabang_id: 0,
          jumlah: 0,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
          keterangan: '',
        });
      } else {
        alert(json.error || 'Gagal menambah stock');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menambah Stock...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              <div>
                <h2 className="text-2xl font-bold">➕ Tambah Stock</h2>
                <p className="text-sm opacity-95 mt-1">Tambah stock baru ke gudang</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Info Alert */}
          <div className="p-4 rounded-xl border-2 bg-green-50 border-green-200">
            <p className="text-sm text-gray-700 font-medium">
              ✅ Stock akan bertambah sesuai jumlah yang diinput
            </p>
          </div>

          {/* Produk */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Produk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.produk_id}
              onChange={(e) => {
                const produkId = parseInt(e.target.value);
                const produk = produks.find(p => p.id === produkId);
                setFormData({
                  ...formData,
                  produk_id: produkId,
                  hpp: produk?.hpp || 0,
                  harga_jual: produk?.harga_jual || 0,
                  persentase: produk?.margin || 0,
                });
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value={0}>Pilih Produk</option>
              {produks.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nama_produk} ({p.kode_produk})
                </option>
              ))}
            </select>
          </div>

          {/* Cabang */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gudang/Cabang <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.cabang_id}
              onChange={(e) => setFormData({ ...formData, cabang_id: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value={0}>Pilih Gudang</option>
              {cabangs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nama_cabang} ({c.kode_cabang})
                </option>
              ))}
            </select>
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Jumlah Tambah ({produks.find(p => p.id === formData.produk_id)?.satuan || 'unit'})
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.jumlah || ''}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (rawValue === '') {
                  setFormData({ ...formData, jumlah: 0 });
                  return;
                }
                const parsedValue = parseFloat(rawValue);
                if (isNaN(parsedValue)) return;
                setFormData({ ...formData, jumlah: Math.max(0, parsedValue) });
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0"
              required
              min="0"
            />
          </div>

          {/* HPP */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              HPP (Harga Pokok) ({produks.find(p => p.id === formData.produk_id)?.satuan || 'unit'})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <input
                type="number"
                step="0.01"
                value={formData.hpp || ''}
                onChange={(e) => handleHppChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Margin */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Margin (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={formData.persentase || ''}
                onChange={(e) => handlePersentaseChange(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0.00"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <TrendingUp className={`w-5 h-5 ${
                  formData.persentase >= 20 ? 'text-green-600' :
                  formData.persentase >= 10 ? 'text-yellow-600' :
                  'text-red-600'
                }`} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Otomatis menghitung harga jual berdasarkan margin
            </p>
          </div>

          {/* Harga Jual */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Harga Jual
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <input
                type="number"
                step="0.01"
                value={formData.harga_jual || ''}
                onChange={(e) => handleHargaJualChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Keterangan
            </label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              placeholder="Opsional - catatan tambahan"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : '➕ Tambah Stock'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
      )}
    </SingleOverlay>
  );
}
