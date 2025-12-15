'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Minus, Edit, AlertCircle, DollarSign, TrendingUp, Package } from 'lucide-react';

interface ModalStockManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'add' | 'remove' | 'adjust' | 'price';
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

interface StockData {
  stock: number;
  hpp: number;
  harga_jual: number;
  margin: number;
}

export default function ModalStockManager({
  isOpen,
  onClose,
  onSuccess,
  mode = 'add',
  initialProdukId,
  initialCabangId,
  initialHpp,
  initialHargaJual,
  initialPersentase
}: ModalStockManagerProps) {
  const [currentMode, setCurrentMode] = useState<'add' | 'remove' | 'adjust' | 'price'>(mode);
  const [loading, setLoading] = useState(false);
  const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false);
  const [produks, setProduks] = useState<Produk[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [selectedProduk, setSelectedProduk] = useState<Produk | null>(null);

  const [formData, setFormData] = useState({
    produk_id: 0,
    cabang_id: 0,
    jumlah: 0,
    hpp: 0,
    harga_jual: 0,
    persentase: 0,
    keterangan: '',
  });

  // Fetch master data and initialize form with initial values
  useEffect(() => {
    if (isOpen && !hasUserSelectedMode) {
      fetchProduks();
      fetchCabangs();
      setCurrentMode(mode);

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

        // Find selected product
        if (initialProdukId && produks.length > 0) {
          const produk = produks.find(p => p.id === initialProdukId);
          setSelectedProduk(produk || null);
        }
      }
    }
  }, [isOpen, mode, initialProdukId, initialCabangId, initialHpp, initialHargaJual, initialPersentase, hasUserSelectedMode]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasUserSelectedMode(false);
      setCurrentMode(mode); // Reset to prop mode when closed
    }
  }, [isOpen, mode]);

  useEffect(() => {
    // Reset form when produk changes
    if (formData.produk_id && currentMode !== 'price') {
      fetchStockData();
    }
  }, [formData.produk_id, formData.cabang_id]);

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

  const fetchStockData = async () => {
    if (!formData.produk_id || !formData.cabang_id) return;

    try {
      // Use the new query-based stock lookup API
      const params = new URLSearchParams({
        produk_id: formData.produk_id.toString(),
        cabang_id: formData.cabang_id.toString(),
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
        const produk = produks.find(p => p.id === formData.produk_id);
        setSelectedProduk(produk || null);
      } else {
        setStockData(null);
        setSelectedProduk(null);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setStockData(null);
      setSelectedProduk(null);
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
      // Explicitly preserve jumlah and other non-price fields
      jumlah: prev.jumlah || 0
    }));
  };

  const handlePersentaseChange = (persentase: number) => {
    const harga_jual = formData.hpp + (formData.hpp * persentase / 100);
    setFormData(prev => ({
      ...prev,
      persentase,
      harga_jual,
      // Explicitly preserve jumlah and other non-price fields
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
      // Explicitly preserve jumlah and other non-price fields
      jumlah: prev.jumlah || 0
    }));
  };

  const handleModeChange = (newMode: 'add' | 'remove' | 'adjust' | 'price') => {
    setCurrentMode(newMode);
    setHasUserSelectedMode(true); // This prevents useEffect from overriding the mode
    // ✅ CRITICAL FIX: Complete form reset when switching modes
    setFormData({
      produk_id: 0,
      cabang_id: 0,
      jumlah: 0,
      hpp: 0,
      harga_jual: 0,
      persentase: 0,
      keterangan: '',
    });
    // Clear stock data to force re-fetch when product/cabang selected
    setStockData(null);
    setSelectedProduk(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.produk_id || !formData.cabang_id) {
      alert(' Produk dan Cabang wajib dipilih!');
      return;
    }

    if (currentMode !== 'price' && !formData.jumlah) {
      alert('Jumlah wajib diisi!');
      return;
    }

    // Validation for remove action
    if (currentMode === 'remove' && stockData) {
      if (formData.jumlah > stockData.stock) {
        alert(`❌ Stock tidak cukup!\n\nStock tersedia: ${stockData.stock} ${selectedProduk?.satuan}\nAnda input: ${formData.jumlah} ${selectedProduk?.satuan}\n\nSilakan kurangi jumlah yang akan dikeluarkan.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (currentMode === 'price') {
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
      } else {
        // Handle stock management (add, remove, adjust)
        const tipe = currentMode === 'remove' ? 'keluar' : 'masuk';

        let endpoint = '/api/persediaan/stock-barang';
        let method = 'POST';
        let body: any = {
          produk_id: formData.produk_id,
          cabang_id: formData.cabang_id,
          jumlah: formData.jumlah,
          tipe: tipe,
          hpp: selectedProduk?.hpp || 0,
          harga_jual: selectedProduk?.harga_jual || 0,
          persentase_harga_jual: selectedProduk?.margin || 0,
          keterangan: formData.keterangan || `Stock ${currentMode} manual`,
        };

        // For adjust, use different endpoint and include audit trail
        if (currentMode === 'adjust') {
          endpoint = '/api/persediaan/stock-barang/adjust';
          body = {
            produk_id: formData.produk_id,
            cabang_id: formData.cabang_id,
            jumlah_baru: formData.jumlah,
            hpp: selectedProduk?.hpp || 0,
            harga_jual: selectedProduk?.harga_jual || 0,
            persentase_harga_jual: selectedProduk?.margin || 0,
            keterangan: formData.keterangan || 'Penyesuaian stock manual',
            user_info: 'User Manual Adjustment',
          };
        }

        console.log('📤 Sending request:', { endpoint, body });

        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = await res.json();

        if (res.ok) {
          alert(json.message || 'Stock berhasil diupdate!');
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
          alert(json.error || 'Gagal update stock');
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentCabang = () => cabangs.find(c => c.id === formData.cabang_id);

  if (!isOpen) return null;

  const currentStock = stockData?.stock || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className={`sticky top-0 text-white p-6 rounded-t-2xl ${
          currentMode === 'add' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
          currentMode === 'remove' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
          currentMode === 'adjust' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
          'bg-gradient-to-r from-yellow-500 to-orange-600'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {currentMode === 'add' && <Plus className="w-6 h-6" />}
              {currentMode === 'remove' && <Minus className="w-6 h-6" />}
              {currentMode === 'adjust' && <AlertCircle className="w-6 h-6" />}
              {currentMode === 'price' && <DollarSign className="w-6 h-6" />}
              <div>
                <h2 className="text-2xl font-bold">
                  {currentMode === 'add' && '➕ Kelola Stock'}
                  {currentMode === 'remove' && '➖ Kelola Stock'}
                  {currentMode === 'adjust' && '🔧 Kelola Stock'}
                  {currentMode === 'price' && '💰 Kelola Stock'}
                </h2>
                <p className="text-sm opacity-95 mt-1">
                  {currentMode === 'add' && 'Tambah stock baru ke gudang'}
                  {currentMode === 'remove' && 'Kurangi stock dari gudang'}
                  {currentMode === 'adjust' && 'Sesuaikan jumlah stock'}
                  {currentMode === 'price' && 'Update harga produk'}
                </p>
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

          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Pilih Aksi
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleModeChange('add')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentMode === 'add'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Plus className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Tambah</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('remove')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentMode === 'remove'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Minus className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Kurangi</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('adjust')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentMode === 'adjust'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Sesuai</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('price')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentMode === 'price'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Update Harga</span>
              </button>
            </div>
          </div>

          {/* Info Alert */}
          <div className={`p-4 rounded-xl border-2 ${
            currentMode === 'add' ? 'bg-green-50 border-green-200' :
            currentMode === 'remove' ? 'bg-red-50 border-red-200' :
            currentMode === 'adjust' ? 'bg-blue-50 border-blue-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <p className="text-sm text-gray-700 font-medium">
              {currentMode === 'add' && '✅ Stock akan bertambah sesuai jumlah yang diinput'}
              {currentMode === 'remove' && '⚠️ Stock akan berkurang sesuai jumlah yang diinput'}
              {currentMode === 'adjust' && 'ℹ️ Input stock baru yang diinginkan (bukan selisih)'}
              {currentMode === 'price' && '💰 Update HPP dan harga jual produk'}
            </p>
          </div>

          {/* Produk */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Produk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.produk_id}
              onChange={async (e) => {
                const produkId = parseInt(e.target.value);
                const produk = produks.find(p => p.id === produkId);

                // Fetch current stock for this produk + cabang immediately
                if (produk && formData.cabang_id) {
                  try {
                    const params = new URLSearchParams({
                      produk_id: produkId.toString(),
                      cabang_id: formData.cabang_id.toString(),
                    });
                    const res = await fetch(`/api/persediaan/stock-barang/get-stock?${params}`);
                    const json = await res.json();

                    if (json.success && json.data) {
                      setStockData(json.data);
                      setSelectedProduk(produk || null);

                      // Show calculated branch stock in preference to master
                      setFormData({
                        ...formData,
                        produk_id: produkId,
                        hpp: json.data.hpp || 0, // Use branch stock data
                        harga_jual: json.data.harga_jual || 0,
                        persentase: json.data.margin || 0,
                      });
                    } else {
                      console.error('Failed to fetch stock data:', json.error);
                      setStockData(null);
                      setSelectedProduk(produk || null);
                      setFormData({
                        ...formData,
                        produk_id: produkId,
                        hpp: produk?.hpp || 0,
                        harga_jual: produk?.harga_jual || 0,
                        persentase: produk?.margin || 0,
                      });
                    }
                  } catch (error) {
                    console.error('Error fetching branch stock:', error);
                    setStockData(null);
                    setSelectedProduk(produk || null);
                  }
                } else {
                  setSelectedProduk(produk || null);
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value={0}>Pilih Produk</option>
              {produks.map(p => {
                // Show branch stock if available, otherwise master stock
                const displayStock = stockData && p.id === formData.produk_id
                  ? stockData.stock
                  : p.stok;

                return (
                  <option key={p.id} value={p.id}>
                    {p.nama_produk} ({p.kode_produk}) - Stock: {displayStock} {p.satuan}
                  </option>
                );
              })}
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

          {/* Current Stock Info (for non-price operations) */}
          {currentMode !== 'price' && stockData && (
            <div className={`p-4 rounded-xl border-2 ${currentStock === 0 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Stock Saat Ini:</p>
                  <p className={`text-2xl font-bold ${currentStock === 0 ? 'text-red-600' : 'text-blue-700'}`}>
                    {currentStock.toFixed(2)} {selectedProduk?.satuan || 'unit'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {getCurrentCabang()?.nama_cabang || 'Kantor'}
                  </p>
                </div>
                {currentMode === 'remove' && currentStock === 0 && (
                  <div className="text-red-600">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                )}
              </div>
              {currentMode === 'remove' && currentStock === 0 && (
                <p className="text-xs text-red-600 mt-2 font-semibold">
                  ⚠️ Stock kosong! Tidak bisa mengurangi stock.
                </p>
              )}
            </div>
          )}

          {/* Harga Info (for price operation) */}
          {currentMode === 'price' && stockData && (
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

          {/* Jumlah (for non-price operations) */}
          {currentMode !== 'price' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {currentMode === 'adjust' ? 'Stock Baru' : currentMode === 'add' ? 'Jumlah Tambah' : 'Jumlah Kurangi'}
                ({selectedProduk?.satuan || 'unit'})
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.jumlah || ''}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  // Allow empty string and handle non-numeric input gracefully
                  if (rawValue === '') {
                    setFormData({ ...formData, jumlah: 0 });
                    return;
                  }
                  const parsedValue = parseFloat(rawValue);
                  if (isNaN(parsedValue)) return; // Don't update if invalid
                  setFormData({ ...formData, jumlah: Math.max(0, parsedValue) });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0"
                required
                max={currentMode === 'remove' ? Math.max(0, currentStock) : undefined}
                disabled={currentMode === 'remove' && currentStock <= 0}
                min="0"
              />
              {currentMode === 'remove' && stockData && formData.jumlah > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Sisa stock setelah dikurangi:</span>
                    <span className={`ml-2 font-bold ${(currentStock - formData.jumlah) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {(currentStock - formData.jumlah).toFixed(2)} {selectedProduk?.satuan}
                    </span>
                  </p>
                  {(currentStock - formData.jumlah) < 0 && (
                    <p className="text-xs text-red-600 mt-1 font-semibold">
                      ❌ Jumlah melebihi stock yang tersedia!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Price Fields (for price operation or add operation) */}
          {(currentMode === 'price' || currentMode === 'add') && (
            <>
              {/* HPP */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  HPP (Harga Pokok) ({selectedProduk?.satuan || 'unit'})
                  {currentMode === 'price' ? <span className="text-red-500">*</span> : ''}
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
                    required={currentMode === 'price'}
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
            </>
          )}

          {/* Keterangan */}
          {currentMode !== 'price' && (
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
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
                currentMode === 'add' ? 'bg-green-500 hover:bg-green-600' :
                currentMode === 'remove' ? 'bg-red-500 hover:bg-red-600' :
                currentMode === 'adjust' ? 'bg-blue-500 hover:bg-blue-600' :
                'bg-yellow-500 hover:bg-yellow-600'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {loading ? 'Menyimpan...' : (
                <>
                  {currentMode === 'add' && '➕ Tambah Stock'}
                  {currentMode === 'remove' && '➖ Kurangi Stock'}
                  {currentMode === 'adjust' && '🔧 Sesuaikan Stock'}
                  {currentMode === 'price' && '💾 Update Harga'}
                </>
              )}
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
  );
}
