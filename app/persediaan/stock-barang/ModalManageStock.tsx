'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertCircle, Search, RefreshCw } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ModalManageStockProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    produk_id: number;
    nama_produk: string;
    kode_produk: string;
    satuan: string;
    stock: number;
    hpp: number;
    cabang_id: number;
    cabang: string;
  };
  mode?: 'add' | 'remove' | 'adjust';
}

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stok: number;
  hpp: number;
}

interface Cabang {
  id: number;
  nama_cabang: string;
  kode_cabang: string;
}

export default function ModalManageStock({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  mode = 'add'
}: ModalManageStockProps) {
  const [action, setAction] = useState<'add' | 'remove' | 'adjust'>(mode);
  const [loading, setLoading] = useState(false);
  const [produks, setProduks] = useState<Produk[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  
  const [formData, setFormData] = useState({
    produk_id: initialData?.produk_id || 0,
    cabang_id: initialData?.cabang_id || 0,
    jumlah: 0,
    hpp: initialData?.hpp || 0,
    harga_jual: 0,
    persentase: 0,
    keterangan: '',
  });

  // Audit state
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    calculated_stock: number;
    db_stock: number;
    transactions: any[];
    invalid_transactions: any[];
    status: string;
  } | null>(null);

  // Fetch master data
  useEffect(() => {
    if (isOpen) {
      fetchProduks();
      fetchCabangs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        produk_id: initialData.produk_id,
        cabang_id: initialData.cabang_id,
        hpp: initialData.hpp,
      }));
    }
  }, [initialData]);

  // Reset action when mode changes
  useEffect(() => {
    setAction(mode);
  }, [mode]);

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

  const performAudit = async () => {
    if (!formData.produk_id || !formData.cabang_id) {
      alert('Produk dan Cabang harus dipilih untuk audit');
      return;
    }

    setAuditLoading(true);
    setAuditResult(null);

    try {
      const res = await fetch(`/api/persediaan/stock-barang/debug-check?produk_id=${formData.produk_id}&cabang_id=${formData.cabang_id}`);
      const result = await res.json();

      if (res.ok) {
        setAuditResult(result.data);
      } else {
        alert('Gagal mengaudit stock');
      }
    } catch (error) {
      console.error('Error auditing stock:', error);
      alert('Terjadi kesalahan dalam audit stock');
    } finally {
      setAuditLoading(false);
    }
  };

  // Auto calculate margin
  const handleHppChange = (hpp: number) => {
    const persentase = formData.persentase;
    const harga_jual = hpp + (hpp * persentase / 100);
    setFormData(prev => ({ ...prev, hpp, harga_jual }));
  };

  const handlePersentaseChange = (persentase: number) => {
    const harga_jual = formData.hpp + (formData.hpp * persentase / 100);
    setFormData(prev => ({ ...prev, persentase, harga_jual }));
  };

  const handleHargaJualChange = (harga_jual: number) => {
    const persentase = formData.hpp > 0 
      ? ((harga_jual - formData.hpp) / formData.hpp * 100) 
      : 0;
    setFormData(prev => ({ ...prev, harga_jual, persentase }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.produk_id || !formData.cabang_id || !formData.jumlah) {
      alert('Produk, Cabang, dan Jumlah wajib diisi!');
      return;
    }

    // Validation for remove action
    if (action === 'remove') {
      const currentStock = initialData?.stock || 0;
      if (formData.jumlah > currentStock) {
        alert(`❌ Stock tidak cukup!\n\nStock tersedia: ${currentStock} ${initialData?.satuan}\nAnda input: ${formData.jumlah} ${initialData?.satuan}\n\nSilakan kurangi jumlah yang akan dikeluarkan.`);
        return;
      }
    }

    setLoading(true);

    try {
      // Determine tipe based on action
      const tipe = action === 'remove' ? 'keluar' : 'masuk';
      
      let endpoint = '/api/persediaan/stock-barang';
      let method = 'POST';
      let body: any = {
        produk_id: formData.produk_id,
        cabang_id: formData.cabang_id,
        jumlah: formData.jumlah,
        tipe: tipe,
        hpp: formData.hpp,
        harga_jual: formData.harga_jual,
        persentase_harga_jual: formData.persentase,
        keterangan: formData.keterangan || `Stock ${action === 'add' ? 'masuk' : action === 'remove' ? 'keluar' : 'adjustment'} manual`,
      };

      // For adjust, use different endpoint and include audit trail
      if (action === 'adjust') {
        endpoint = '/api/persediaan/stock-barang/adjust';
        body = {
          produk_id: formData.produk_id,
          cabang_id: formData.cabang_id,
          jumlah_baru: formData.jumlah,
          hpp: formData.hpp,
          harga_jual: formData.harga_jual,
          persentase_harga_jual: formData.persentase,
          keterangan: formData.keterangan || 'Penyesuaian stock manual',
          user_info: 'User Manual Adjustment', // ✅ Added for audit trail
        };
      }


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
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedProduk = produks.find(p => p.id === formData.produk_id);
  const currentStock = initialData?.stock || selectedProduk?.stok || 0;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Mengelola Stock...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className={`sticky top-0 text-white p-6 rounded-t-2xl ${
          action === 'add' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
          action === 'remove' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
          'bg-gradient-to-r from-blue-500 to-indigo-600'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {action === 'add' && <Plus className="w-6 h-6" />}
              {action === 'remove' && <Minus className="w-6 h-6" />}
              {action === 'adjust' && <AlertCircle className="w-6 h-6" />}
              <h2 className="text-2xl font-bold">
                {action === 'add' && '➕ Tambah Stock'}
                {action === 'remove' && '➖ Kurangi Stock'}
                {action === 'adjust' && '🔧 Penyesuaian Stock'}
              </h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Action Selector (if not from card) */}
          {!initialData && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pilih Aksi
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAction('add')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    action === 'add'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Plus className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">Tambah</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAction('remove')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    action === 'remove'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Minus className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">Kurangi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAction('adjust')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    action === 'adjust'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">Sesuaikan</span>
                </button>
              </div>
            </div>
          )}

          {/* Info Alert */}
          <div className={`p-4 rounded-xl border-2 ${
            action === 'add' ? 'bg-green-50 border-green-200' :
            action === 'remove' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <p className="text-sm text-gray-700 font-medium">
              {action === 'add' && '✅ Stock akan bertambah sesuai jumlah yang diinput'}
              {action === 'remove' && '⚠️ Stock akan berkurang sesuai jumlah yang diinput'}
              {action === 'adjust' && 'ℹ️ Input stock baru yang diinginkan (bukan selisih)'}
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
                const produk = produks.find(p => p.id === parseInt(e.target.value));
                setFormData({
                  ...formData,
                  produk_id: parseInt(e.target.value),
                  hpp: produk?.hpp || 0,
                });
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
              disabled={!!initialData}
            >
              <option value={0}>Pilih Produk</option>
              {produks.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nama_produk} ({p.kode_produk}) - Stock: {p.stok} {p.satuan}
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
              disabled={!!initialData}
            >
              <option value={0}>Pilih Gudang</option>
              {cabangs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nama_cabang} ({c.kode_cabang})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Info */}
          {(action === 'remove' || initialData) && (
            <div className={`p-4 rounded-xl border-2 ${
              currentStock === 0 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Stock Tersedia Saat Ini:</p>
                  <p className={`text-2xl font-bold ${
                    currentStock === 0 ? 'text-red-600' : 'text-blue-700'
                  }`}>
                    {currentStock} {initialData?.satuan || selectedProduk?.satuan || 'unit'}
                  </p>
                </div>
                {action === 'remove' && currentStock === 0 && (
                  <div className="text-red-600">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                )}
              </div>
              {action === 'remove' && currentStock === 0 && (
                <p className="text-xs text-red-600 mt-2 font-semibold">
                  ⚠️ Stock kosong! Tidak bisa mengurangi stock.
                </p>
              )}
            </div>
          )}

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {action === 'adjust' ? 'Stock Baru' : action === 'add' ? 'Jumlah Tambah' : 'Jumlah Kurangi'} 
              ({initialData?.satuan || selectedProduk?.satuan || 'unit'}) 
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.jumlah || ''}
              onChange={(e) => setFormData({ ...formData, jumlah: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0.00"
              required
              max={action === 'remove' ? currentStock : undefined}
              disabled={action === 'remove' && currentStock === 0}
            />
            {action === 'remove' && formData.jumlah > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Sisa stock setelah dikurangi:</span>
                  <span className={`ml-2 font-bold ${
                    (currentStock - formData.jumlah) < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(currentStock - formData.jumlah).toFixed(2)} {initialData?.satuan || selectedProduk?.satuan}
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

          {/* HPP (for add action) */}
          {action === 'add' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                HPP (Harga Pokok) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.hpp || ''}
                onChange={(e) => handleHppChange(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0.00"
                required
              />
            </div>
          )}

          {/* Margin % */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Margin (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.persentase || ''}
              onChange={(e) => handlePersentaseChange(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0.00"
            />
          </div>

          {/* Harga Jual */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Harga Jual <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.harga_jual || ''}
              onChange={(e) => handleHargaJualChange(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0.00"
              required
            />
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

          {/* Audit Stock Section */}
          {formData.produk_id > 0 && formData.cabang_id > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  🔍 Audit Stock
                </label>
                <button
                  type="button"
                  onClick={performAudit}
                  disabled={auditLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-colors"
                >
                  {auditLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {auditLoading ? 'Mengecek...' : 'Periksa'}
                </button>
              </div>

              {auditResult && (
                <div className={`p-4 rounded-xl border-2 space-y-3 ${
                  auditResult.status === 'INKONSISTEN' ? 'bg-red-50 border-red-300' :
                  auditResult.invalid_transactions.length > 0 ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Stock Bersesuaian:</p>
                      <p className="text-lg font-bold text-blue-700">{auditResult.calculated_stock.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Stock di Database:</p>
                      <p className="text-lg font-bold text-blue-700">{auditResult.db_stock.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      auditResult.status === 'KONSISTEN' ? 'bg-green-100 text-green-800' :
                      auditResult.status === 'INKONSISTEN' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {auditResult.status}
                    </div>
                    <div className="text-sm text-gray-600">
                      Selisih: {(auditResult.calculated_stock - auditResult.db_stock).toFixed(2)}
                    </div>
                  </div>

                  {auditResult.invalid_transactions.length > 0 && (
                    <div className="bg-red-100 p-3 rounded-lg border border-red-200">
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        ⚠️ Transaksi Tidak Valid: {auditResult.invalid_transactions.length}
                      </p>
                      <div className="max-h-32 overflow-y-auto text-xs text-red-700 font-mono">
                        {auditResult.invalid_transactions.map((t: any, i: number) => (
                          <div key={i} className="mb-1">
                            ID {t.id}: {t.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    Total transaksi yang diperiksa: {auditResult.transactions.length}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                Audit akan memeriksa konsistensi stock dengan menghitung ulang dari transaksi dan membandingkan dengan data di database.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
                action === 'add' ? 'bg-green-500 hover:bg-green-600' :
                action === 'remove' ? 'bg-red-500 hover:bg-red-600' :
                'bg-blue-500 hover:bg-blue-600'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
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
