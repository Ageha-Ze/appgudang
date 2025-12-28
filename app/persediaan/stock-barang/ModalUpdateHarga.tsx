'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, TrendingUp } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ModalUpdateHargaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProdukId?: number;
  initialCabangId?: number;
  initialHpp?: number;
  initialHargaJual?: number;
  initialPersentase?: number;
  initialNamaProduk?: string;
  initialKodeProduk?: string;
  initialNamaCabang?: string;
  initialKodeCabang?: string;
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

interface StockData {
  stock: number;
  hpp: number;
  harga_jual: number;
  margin: number;
}

export default function ModalUpdateHarga({
  isOpen,
  onClose,
  onSuccess,
  initialProdukId,
  initialCabangId,
  initialHpp,
  initialHargaJual,
  initialPersentase,
  initialNamaProduk,
  initialKodeProduk,
  initialNamaCabang,
  initialKodeCabang
}: ModalUpdateHargaProps) {
  const [loading, setLoading] = useState(false);
  const [selectedProduk, setSelectedProduk] = useState<Produk | null>(null);
  const [selectedCabang, setSelectedCabang] = useState<Cabang | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);

  const [formData, setFormData] = useState({
    produk_id: 0,
    cabang_id: 0,
    hpp: 0,
    harga_jual: 0,
    persentase: 0,
  });

  // Initialize with provided data - no API calls needed since we have all the info
  useEffect(() => {
    if (isOpen && initialProdukId && initialCabangId) {
      // Set product and branch info from props (passed from parent component)
      setSelectedProduk({
        id: initialProdukId,
        nama_produk: initialNamaProduk || 'Unknown Product',
        kode_produk: initialKodeProduk || 'N/A',
        satuan: 'unit', // Will be updated if available from stock data
        stok: 0,
        hpp: initialHpp || 0,
        harga_jual: initialHargaJual || 0,
        margin: initialPersentase || 0,
      });

      setSelectedCabang({
        id: initialCabangId,
        nama_cabang: initialNamaCabang || 'Unknown Branch',
        kode_cabang: initialKodeCabang || 'N/A',
      });

      // Initialize form with provided initial values
      setFormData({
        produk_id: initialProdukId,
        cabang_id: initialCabangId,
        hpp: initialHpp || 0,
        harga_jual: initialHargaJual || 0,
        persentase: initialPersentase || 0,
      });

      // Fetch stock data for current prices display
      fetchStockData();
    }
  }, [isOpen, initialProdukId, initialCabangId, initialHpp, initialHargaJual, initialPersentase, initialNamaProduk, initialKodeProduk, initialNamaCabang, initialKodeCabang]);

  const fetchStockData = async () => {
    if (!initialProdukId || !initialCabangId) return;

    try {
      // Use the new query-based stock lookup API
      const params = new URLSearchParams({
        produk_id: initialProdukId.toString(),
        cabang_id: initialCabangId.toString(),
      });
      const res = await fetch(`/api/persediaan/stock-barang/get-stock?${params}`);
      const json = await res.json();

      if (json.success && json.data) {
        const data = json.data;
        setStockData({
          stock: data.stock,
          hpp: data.hpp,
          harga_jual: data.harga_jual,
          margin: data.margin,
        });
      } else {
        setStockData(null);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setStockData(null);
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
    }));
  };

  const handlePersentaseChange = (persentase: number) => {
    const harga_jual = formData.hpp + (formData.hpp * persentase / 100);
    setFormData(prev => ({
      ...prev,
      persentase,
      harga_jual,
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
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.produk_id || !formData.cabang_id) {
      alert('Produk dan Cabang wajib dipilih!');
      return;
    }

    setLoading(true);

    try {
      // Handle price update
      const res = await fetch('/api/persediaan/stock-barang/update-harga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produk_id: formData.produk_id,
          cabang_id: formData.cabang_id,
          hpp: formData.hpp,
          harga_jual: formData.harga_jual,
          persentase: formData.persentase,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Harga berhasil diupdate!');
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Gagal update harga');
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Mengupdate Harga...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6" />
              <div>
                <h2 className="text-2xl font-bold">💰 Update Harga</h2>
                <p className="text-sm opacity-95 mt-1">Update HPP dan harga jual produk</p>
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
          <div className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-gray-700 font-medium">
              💰 Update HPP dan harga jual produk
            </p>
          </div>

          {/* Produk - Read Only */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Produk
            </label>
            <input
              type="text"
              value={selectedProduk ? `${selectedProduk.nama_produk} (${selectedProduk.kode_produk})` : 'Loading...'}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          {/* Cabang - Read Only */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gudang/Cabang
            </label>
            <input
              type="text"
              value={selectedCabang ? `${selectedCabang.nama_cabang} (${selectedCabang.kode_cabang})` : 'Loading...'}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          {/* Harga Info */}
          {stockData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 font-medium mb-1">HPP Saat Ini</p>
                <p className="text-lg font-bold text-gray-800">
                  Rp {stockData.hpp.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Harga Jual</p>
                <p className="text-lg font-bold text-gray-800">
                  Rp {stockData.harga_jual.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-xs text-purple-600 font-medium mb-1">Margin</p>
                <p className="text-lg font-bold text-gray-800">
                  {stockData.margin.toFixed(2)}%
                </p>
              </div>
            </div>
          )}

          {/* HPP */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              HPP (Harga Pokok) ({selectedProduk?.satuan || 'unit'})
              <span className="text-red-500">*</span>
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
                required
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
              Harga Jual <span className="text-red-500">*</span>
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
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : '💾 Update Harga'}
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
