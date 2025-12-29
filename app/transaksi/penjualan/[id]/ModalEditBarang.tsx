'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalEditBarangProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  detail: any; // Detail penjualan yang akan diedit
  penjualanId: number;
  cabangId?: number; // ✅ Optional - bisa undefined saat loading
}

interface StockBarang {
  produk_id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  gudang: string;
  total_stock: number; // Stock fisik (masuk - keluar)
  available_stock?: number; // ✅ NEW: Available after reservations
  reserved_stock?: number; // ✅ NEW: Reserved by pending sales
  hpp: number;
  harga_jual: number;
  persentase: number;
  stock_masuk: number;
  stock_keluar: number;
}

export default function ModalEditBarang({
  isOpen,
  onClose,
  onSuccess,
  detail,
  penjualanId,
  cabangId, // ✅ TAMBAHKAN INI
}: ModalEditBarangProps) {
  const [formData, setFormData] = useState({
    harga: 0,
    jumlah: 0,
  });
  const [stockInfo, setStockInfo] = useState<StockBarang | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [originalJumlah, setOriginalJumlah] = useState(0);

  useEffect(() => {
    if (isOpen && detail) {
      
      // Set form data dari detail yang dipilih
      setFormData({
        harga: detail.harga || 0,
        jumlah: parseFloat(detail.jumlah) || 0,
      });
      setOriginalJumlah(parseFloat(detail.jumlah) || 0);
      
      // ✅ FIX: Gunakan detail.produk?.id jika produk_id tidak ada
      const produkId = detail.produk_id || detail.produk?.id;
      
      if (produkId && cabangId) {
        fetchStockInfo(produkId);
      } else {
        console.error('❌ Missing produk_id or cabangId:', { produkId, cabangId });
      }
    }
  }, [isOpen, detail?.id, cabangId]); // ✅ Use detail.id instead of whole detail object

  const fetchStockInfo = async (produkId: number) => {
    // ✅ Guard: Jangan fetch jika cabangId belum ada
    if (!cabangId) {
      console.warn('⚠️ cabangId not available yet, skipping stock fetch');
      return;
    }

    try {
      setLoadingStock(true);
      
      const url = `/api/persediaan/stock-barang?cabang_id=${cabangId}&mode=aggregated&limit=1000`;
      const res = await fetch(url);
      const json = await res.json();
      
      
      if (json.data && Array.isArray(json.data)) {
        
        const stock = json.data.find((s: StockBarang) => s.produk_id === produkId);
        setStockInfo(stock || null);
        
        // ✅ Warning jika stock tidak ditemukan
        if (!stock) {
          console.error(`❌ Stock untuk produk_id ${produkId} tidak ditemukan di cabang ${cabangId}`);
        }
      } else {
        console.error('❌ Invalid API response format:', json);
        setStockInfo(null);
      }
    } catch (error) {
      console.error('❌ Fetch error:', error);
      setStockInfo(null);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.jumlah <= 0) {
      alert('Jumlah berat harus lebih dari 0');
      return;
    }

    // ✅ SIMPLE VALIDATION: Just basic check, let backend handle details
    // Backend will validate against actual stock and reservations
    if (stockInfo && formData.jumlah > stockInfo.total_stock) {
      alert(
        `Jumlah terlalu besar!\n\n` +
        `Stock di sistem: ${stockInfo.total_stock.toFixed(2)} ${stockInfo.satuan}\n` +
        `Anda minta: ${formData.jumlah.toFixed(2)} ${stockInfo.satuan}`
      );
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: detail.id,
          harga: formData.harga,
          jumlah: formData.jumlah,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Barang berhasil diupdate');
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Gagal mengupdate barang');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => {
    return formData.harga * formData.jumlah;
  };

  const handleClose = () => {
    setFormData({ harga: 0, jumlah: 0 });
    setStockInfo(null);
    setOriginalJumlah(0);
    onClose();
  };

  if (!isOpen || !detail) return null;

  // ✅ SIMPLE: Display global stock from API
  const displayStock = stockInfo ? stockInfo.total_stock : 0;

  return (
    <>
      {/* Full Screen Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Memperbarui Barang...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 rounded-lg p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">EDIT BARANG</h2>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Debug Info */}
        {!cabangId && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
            ⚠️ Cabang ID tidak tersedia
          </div>
        )}
        {loadingStock && (
          <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded text-sm">
            Loading stock info...
          </div>
        )}
        {!loadingStock && !stockInfo && cabangId && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-700 rounded text-sm">
            ⚠️ Stock info tidak tersedia untuk produk ini di cabang saat ini
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Barang (Read-only) */}
          <div>
            <label className="block text-sm font-medium mb-1">Nama Barang</label>
            <input
              type="text"
              value={detail.produk?.nama_produk || '-'}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Kode: {detail.produk?.kode_produk || '-'}
            </p>
          </div>

          {/* Harga Jual & Satuan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Harga jual</label>
              <input
                type="number"
                value={formData.harga || ''}
                onChange={(e) =>
                  setFormData({ ...formData, harga: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Satuan</label>
              <input
                type="text"
                value={stockInfo?.satuan || detail.produk?.satuan || 'Kg'}
                disabled
                className="w-full px-3 py-2 border rounded bg-gray-100"
              />
            </div>
          </div>

          {/* Jumlah Berat & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Jumlah Berat</label>
              <input
                type="number"
                step="0.01"
                value={formData.jumlah || ''}
                onChange={(e) =>
                  setFormData({ ...formData, jumlah: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Sebelumnya: {originalJumlah.toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock ( Kg/Gr/Pcs/Ml )</label>
              <input
                type="text"
                value={displayStock.toFixed(2)}
                disabled
                className="w-full px-3 py-2 border rounded bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stock di sistem
              </p>
            </div>
          </div>

          {/* Sub Total */}
          <div>
            <label className="block text-sm font-medium mb-1">Sub Total</label>
            <input
              type="text"
              value={`Rp. ${calculateSubtotal().toLocaleString('id-ID')}`}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100 font-bold"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sebelumnya: Rp. {(detail.subtotal || 0).toLocaleString('id-ID')}
            </p>
          </div>

          {/* Info perubahan */}
          {formData.jumlah !== originalJumlah && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-700">
                <strong>Perubahan jumlah:</strong>
                <br />
                {originalJumlah.toFixed(2)} → {formData.jumlah.toFixed(2)} {stockInfo?.satuan || 'Kg'}
                <br />
                <span className={formData.jumlah > originalJumlah ? 'text-red-600' : 'text-green-600'}>
                  ({formData.jumlah > originalJumlah ? '+' : ''}{(formData.jumlah - originalJumlah).toFixed(2)})
                </span>
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-center mt-6">
            <button
              type="submit"
              disabled={loading || loadingStock}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Update'}
            </button>
            <button
              type="button"
              onClick={handleClose}
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
