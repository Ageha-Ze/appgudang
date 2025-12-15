'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Minus, Edit, History, Download, Search, X, List, LayoutGrid } from 'lucide-react';
import { usePermissions, ReadOnlyBanner } from '@/components/PermissionGuard';
import ModalStockManager from './ModalStockManager';
import ModalHistory from './ModalHistory';
import { customToast } from '@/lib/toast';


interface StockItem {
  produk_id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stock: number;
  stock_masuk: number;
  stock_keluar: number;
  hpp: number;
  harga_jual: number;
  margin: number;
  cabang: string;
  cabang_id: number;
  has_negative: boolean;
}

export default function StockBarangPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCabang, setSelectedCabang] = useState<number>(0);
  const [cabangs, setCabangs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card'); // Add view mode toggle

  // Modal states
  const [showModalStockManager, setShowModalStockManager] = useState(false);
  const [showModalHistory, setShowModalHistory] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove' | 'adjust' | 'price'>('add');
  const [error, setError] = useState<string | null>(null);

  // Permission guards - Kasir can only view, gudang can manage
  const { canView, canManage } = usePermissions({
    canView: 'stock.view',
    canManage: 'stock.manage',
  });

  const isReadOnly = canView && !canManage;

  useEffect(() => {
    fetchCabangs();
    fetchStocks();
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [page, search, selectedCabang]);

  const fetchCabangs = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangs(json.data || []);
    } catch (error) {
      console.error('Error fetching cabangs:', error);
    }
  };

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        search: search,
        cabang_id: selectedCabang.toString(),
      });

      const res = await fetch(`/api/persediaan/stock-barang?${params}`);
      const json = await res.json();

      if (json.success) {
        setStocks(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageStock = (stock: StockItem | null = null) => {
    setSelectedStock(stock ? {
      produk_id: stock.produk_id,
      nama_produk: stock.nama_produk,
      kode_produk: stock.kode_produk,
      satuan: stock.satuan,
      stock: stock.stock,
      hpp: stock.hpp,
      cabang_id: stock.cabang_id,
      cabang: stock.cabang,
    } : null); // Pass null for bulk operations
    setModalMode('add'); // Default mode, user can change within modal
    setShowModalStockManager(true);
  };

  const handleOpenHistory = (stock: StockItem) => {
    setSelectedStock(stock);
    setShowModalHistory(true);
  };

  const handleModalSuccess = () => {
    fetchStocks();
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: 'overview',
        cabang_id: selectedCabang.toString(),
      });

      const response = await fetch(`/api/persediaan/stock-barang/export?${params}`);

      if (!response.ok) {
        let errorMessage = 'Gagal mengekspor data stok';

        if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk mengekspor data stok.';
        } else if (response.status === 404) {
          errorMessage = 'Data stok tidak ditemukan.';
        } else if (response.status === 500) {
          errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
        }

        // Try to get error details from response
        try {
          const json = await response.json();
          if (json?.error) {
            errorMessage += ': ' + json.error;
          }
        } catch {
          // If can't parse error response, use default message
        }

        throw new Error(errorMessage);
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'Stock_Overview.xlsx';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Success notification
      customToast.success('Success!');

    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error.message?.includes('Gagal mengekspor') ?
        error.message : 'Terjadi kesalahan saat mengekspor data. Silakan periksa koneksi internet Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Reset & Rebuild dengan Indonesian error handling
  const handleResetRebuild = async () => {
    const confirmMessage = `🔄 RESET & REBUILD STOCK?
    
⚠️  PERINGATAN PENTING:
• Semua data stock_barang akan dihapus secara permanen
• Data akan direbuild dari semua transaksi pembelian & produksi
• Proses ini tidak dapat dibatalkan

💡  Apakah Anda ingin melihat detail perhitungan terlebih dahulu?`;

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    setError(null);

    try {
      // Check mode - get summary first
      const checkRes = await fetch('/api/persediaan/stock-barang/reset-rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'check' }),
      });

      if (!checkRes.ok) {
        throw new Error(`HTTP ${checkRes.status}: Gagal memeriksa data stock`);
      }

      const checkJson = await checkRes.json();

      if (checkJson.success) {
        let message = `📊 RINGKASAN RESET & REBUILD STOCK\n\n`;
        message += `📋 Data Saat Ini:\n`;
        message += `• Total Record Stock: ${checkJson.summary.current_stock_records}\n\n`;
        message += `🔄 Yang Akan Dibuat Ulang:\n`;
        message += `• Transaksi Pembelian: ${checkJson.summary.will_be_created.pembelian}\n`;
        message += `• Produksi: ${checkJson.summary.will_be_created.produksi}\n`;
        message += `• Konsinyasi: ${checkJson.summary.will_be_created.konsinyasi}\n`;
        message += `• Penjualan: ${checkJson.summary.will_be_created.penjualan}\n`;
        message += `• Stock Opname: ${checkJson.summary.will_be_created.stock_opname}\n`;
        message += `• Bahan Produksi: ${checkJson.summary.will_be_created.bahan_produksi}\n\n`;
        message += `📊 Total Record Baru: ${Object.values(checkJson.summary.will_be_created).reduce((a: any, b: any) => a + b, 0)}\n\n`;
        message += `⚠️  Yakin ingin melanjutkan proses reset?`;

        if (confirm(message)) {
          // Execute reset
          const resetRes = await fetch('/api/persediaan/stock-barang/reset-rebuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'reset' }),
          });

          if (!resetRes.ok) {
            let errorMessage = 'Gagal melakukan reset & rebuild stock';

            if (resetRes.status === 500) {
              errorMessage = 'Server mengalami masalah selama proses reset. Silakan coba lagi.';
            } else {
              const errorJson = await resetRes.json().catch(() => null);
              if (errorJson?.error) {
                errorMessage += ': ' + errorJson.error;
              }
            }

            throw new Error(errorMessage);
          }

          const resetJson = await resetRes.json();

          if (resetJson.success) {
            // Success notification with detailed information
            customToast.success('Success!');

            // Refresh data
            await fetchStocks();
          } else {
            setError(resetJson.error || 'Gagal melakukan reset & rebuild stock');
          }
        }
      } else {
        setError(checkJson.error || 'Gagal memeriksa data stock untuk reset');
      }
    } catch (error: any) {
      console.error('Error reset rebuild:', error);
      const errorMessage = error.message?.includes('Terjadi kesalahan') || error.message?.includes('HTTP ') ?
        error.message : 'Terjadi kesalahan saat melakukan reset stock. Silakan periksa koneksi internet Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Delete Stock dengan Indonesian error handling
  const handleDeleteStock = async (stock: StockItem) => {
    const confirmMessage = `⚠️ KONFIRMASI PENGHAPUSAN STOCK PRODUK

🎯 Produk: ${stock.nama_produk}
🏷️  Kode: ${stock.kode_produk}
📍 Cabang: ${stock.cabang}

⚠️  PERINGATAN PENTING:
• Semua data stock untuk produk ini akan dihapus permanen
• Stock akan diset ke 0
• Data tidak dapat dikembalikan

❓ Yakin ingin menghapus stock produk ini?`;

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/persediaan/stock-barang/delete-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produk_id: stock.produk_id,
          cabang_id: stock.cabang_id,
        }),
      });

      if (!res.ok) {
        let errorMessage = 'Gagal menghapus stock produk';

        if (res.status === 409) {
          errorMessage = 'Stock produk tidak dapat dihapus karena masih memiliki referensi aktif.';
        } else if (res.status === 404) {
          errorMessage = 'Data stock produk tidak ditemukan.';
        } else if (res.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menghapus stock produk.';
        } else {
          try {
            const json = await res.json();
            if (json?.error) {
              errorMessage += ': ' + json.error;
            }
          } catch {
            // Use generic error message if can't parse response
          }
        }

        throw new Error(errorMessage);
      }

      const json = await res.json();

      if (json.success) {
        // Show success toast
        customToast.success('Success!');

        // Refresh data
        await fetchStocks();
      } else {
        setError(json.error || 'Gagal menghapus stock produk');
      }

    } catch (error: any) {
      console.error('Error deleting stock:', error);
      const errorMessage = error.message?.includes('Gagal menghapus') ?
        error.message : 'Terjadi kesalahan saat menghapus stock. Silakan periksa koneksi internet Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fix Negative Stock dengan Indonesian error handling
  const handleFixNegativeStock = async () => {
    const confirmMessage = `🔧 PANTAU & PERBAIKI STOCK

⚠️  PERINGATAN:
Fitur ini akan memeriksa dan memperbaiki ketidaksesuaian stock dari:
• Transaksi pembelian belum tercatat
• Produksi yang belum tercatat di stock
• Stock minus/discrepancy

Proses ini akan memperbaiki data stock secara otomatis.

💡  Apakah ingin memulai pemeriksaan?`;

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    setError(null);

    try {
      // Check mode - get summary first
      const checkRes = await fetch('/api/persediaan/stock-barang/fix-comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'check' }),
      });

      if (!checkRes.ok) {
        let errorMessage = 'Gagal memeriksa ketidaksesuaian stock';

        if (checkRes.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk memperbaiki stock.';
        } else if (checkRes.status === 500) {
          errorMessage = 'Server mengalami masalah dalam proses pemeriksaan.';
        }

        const errorJson = await checkRes.json().catch(() => null);
        if (errorJson?.error) {
          errorMessage += ': ' + errorJson.error;
        }

        throw new Error(errorMessage);
      }

      const checkJson = await checkRes.json();

      if (checkJson.success) {
        let message = `📊 HASIL PEMERIKSAAN STOCK\n\n`;
        message += `🚨 Record Stock yang Diperlukan:\n`;
        message += `• Transaksi Pembelian: ${checkJson.summary.pembelian_missing}\n`;
        message += `• Produksi: ${checkJson.summary.produksi_missing}\n`;
        message += `• Konsinyasi: ${checkJson.summary.penjualan_konsinyasi_missing}\n`;
        message += `• Stock Opname: ${checkJson.summary.stock_opname_missing}\n`;
        message += `• Bahan Produksi: ${checkJson.summary.detail_produksi_missing}\n\n`;

        if (checkJson.details.pembelian_missing.length > 0) {
          message += `📦 Pembelian Belum Tercatat (5 pertama):\n`;
          checkJson.details.pembelian_missing.slice(0, 5).forEach((p: any) => {
            message += `• ${p.nama_produk}: ${p.jumlah} unit (${p.tanggal})\n`;
          });
          if (checkJson.details.pembelian_missing.length > 5) {
            message += `... dan ${checkJson.details.pembelian_missing.length - 5} lagi\n`;
          }
          message += `\n`;
        }

        if (checkJson.details.produksi_missing.length > 0) {
          message += `🏭 Produksi Belum Tercatat (5 pertama):\n`;
          checkJson.details.produksi_missing.slice(0, 5).forEach((p: any) => {
            message += `• ${p.nama_produk}: ${p.jumlah} unit (${p.tanggal})\n`;
          });
          if (checkJson.details.produksi_missing.length > 5) {
            message += `... dan ${checkJson.details.produksi_missing.length - 5} lagi\n`;
          }
          message += `\n`;
        }

        // Show additional sections only if they exist
        if (checkJson.details.penjualan_konsinyasi_missing.length > 0 ||
            checkJson.details.stock_opname_missing.length > 0 ||
            checkJson.details.detail_produksi_missing.length > 0) {
          message += `📋 Rincian Tambahan:\n`;

          if (checkJson.details.penjualan_konsinyasi_missing.length > 0) {
            message += `• Konsinyasi: ${checkJson.details.penjualan_konsinyasi_missing.slice(0, 3).map((p: any) => p.nama_produk).join(', ')}\n`;
          }
          if (checkJson.details.stock_opname_missing.length > 0) {
            message += `• Stock Opname: ${checkJson.details.stock_opname_missing.length} adjustment\n`;
          }
          if (checkJson.details.detail_produksi_missing.length > 0) {
            message += `• Bahan Produksi: ${checkJson.details.detail_produksi_missing.length} bahan\n`;
          }
          message += `\n`;
        }

        message += `❓ Yakin ingin melanjutkan perbaikan stock?`;

        if (confirm(message)) {
          // Execute fix
          const fixRes = await fetch('/api/persediaan/stock-barang/fix-comprehensive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'fix' }),
          });

          if (!fixRes.ok) {
            let errorMessage = 'Gagal memperbaiki stock';

            if (fixRes.status === 403) {
              errorMessage = 'Anda tidak memiliki akses untuk memperbaiki stock.';
            } else if (fixRes.status === 500) {
              errorMessage = 'Server mengalami masalah selama proses perbaikan.';
            }

            const errorJson = await fixRes.json().catch(() => null);
            if (errorJson?.error) {
              errorMessage += ': ' + errorJson.error;
            }

            throw new Error(errorMessage);
          }

          const fixJson = await fixRes.json();

          if (fixJson.success) {
            // Success notification with detailed information
            customToast.success('Success!');

            // Refresh data
            await fetchStocks();
          } else {
            setError(fixJson.error || 'Gagal memperbaiki stock');
          }
        }
      } else {
        setError(checkJson.error || 'Gagal memeriksa ketidaksesuaian stock');
      }
    } catch (error: any) {
      console.error('Error fixing stock:', error);
      const errorMessage = error.message?.includes('Terjadi kesalahan') || error.message?.includes('HTTP ') ?
        error.message : 'Terjadi kesalahan saat memperbaiki stock. Silakan periksa koneksi internet Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredStocks = stocks;
  const totalItems = filteredStocks.length;

  // 🐛 BUG FIX: Proper stock calculation by unit/satuan
  // For "All Cabang" (selectedCabang === 0): Use produk.stok directly (no summation)
  // For "Specific Branch" (selectedCabang > 0): Sum branch-specific stocks
  const stockBySatuan = filteredStocks.reduce((acc, item) => {
    const satuan = item.satuan || 'Unknown';
    if (!acc[satuan]) {
      acc[satuan] = { count: 0, total: 0 };
    }

    // For branch view: sum the (masuk - keluar) calculations
    // For global view: the individual stock values represent each product's total
    acc[satuan].count += 1;
    if (selectedCabang > 0) {
      // Branch-specific view: sum up all products' stocks for this branch
      acc[satuan].total += item.stock;
    } else {
      // Global view: don't sum, as each product shows its own total stock
      // But we need to calculate totals properly for the summary cards
      // Count products rather than summing stocks for global view
    }

    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  // For global view (all cabang), calculate actual total stock by summing all product stocks
  let totalStockSummary: Record<string, number>;
  if (selectedCabang === 0) {
    // Global view: sum up ALL produk.stok values (but we don't have them all here due to pagination)
    // Use a different approach for global summary
    totalStockSummary = {};
    // For now, just show counts per unit without totals for global view
    Object.entries(stockBySatuan).forEach(([satuan, data]) => {
      totalStockSummary[satuan] = data.count; // Just show product count, not sum of stocks
    });
  } else {
    // Branch view: we can sum the branch-specific stocks
    totalStockSummary = {};
    Object.entries(stockBySatuan).forEach(([satuan, data]) => {
      totalStockSummary[satuan] = data.total;
    });
  }

  const lowStockCount = filteredStocks.filter(item => item.stock > 0 && item.stock < 100).length;
  const negativeStockCount = filteredStocks.filter(item => item.stock < 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-500 rounded-lg sm:rounded-xl">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
            </div>
            Stock Barang
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Kelola persediaan barang gudang dengan mudah</p>
        </div>

        {/* Read-only banner for kasir users */}
        {isReadOnly && <ReadOnlyBanner />}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <span className="text-red-500">⚠️</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 font-bold text-lg"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Item</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{totalItems}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Stock</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(totalStockSummary).map(([satuan, value]) => (
                <div key={satuan} className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-600">{satuan}:</span>
                  <span className="text-lg font-bold text-gray-800">{value.toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(totalStockSummary).length === 0 && (
                <p className="text-gray-400 text-sm">Tidak ada stock</p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Stock Rendah / Minus</p>
                <p className="text-3xl font-bold mt-1">
                  {lowStockCount} / <span className="text-yellow-300">{negativeStockCount}</span>
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari nama atau kode produk..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Branch Filter (Table View) */}
              <div className="flex items-center gap-3">
                {viewMode === 'table' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Gudang:</span>
                    <select
                      value={selectedCabang}
                      onChange={(e) => {
                        setSelectedCabang(parseInt(e.target.value));
                        setPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    >
                      <option value={0}>Semua Cabang</option>
                      {cabangs.map((cabang) => (
                        <option key={cabang.id} value={cabang.id}>
                          {cabang.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* View Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tampilan:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 inline mr-1" />
                    Tabel
                  </button>
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'card'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <List className="w-4 h-4 inline mr-1" />
                    Kartu
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Responsive Button Layout - Only show for users with stock.manage */}
            {canManage && (
              <div className="flex gap-2 sm:gap-3 justify-end sm:justify-start">
    <button
      onClick={() => handleManageStock(null)}
      className="sm:flex-none px-3 py-2.5 sm:px-4 sm:py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
    >
      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline whitespace-nowrap">Tambah Stock</span>
    </button>

    <button
      onClick={handleFixNegativeStock}
      className={`sm:flex-none px-3 py-2.5 sm:px-4 sm:py-3 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm relative ${
        negativeStockCount > 0
          ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 animate-pulse'
          : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
      }`}
      title="Fix stock discrepancies from pembelian & produksi"
    >
      <span className="text-lg">🔧</span>
      {negativeStockCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center sm:hidden">
          {negativeStockCount}
        </span>
      )}
      <span className="hidden sm:inline whitespace-nowrap">
        Fix Stock {negativeStockCount > 0 ? `(${negativeStockCount})` : ''}
      </span>
    </button>

    <button
      onClick={handleResetRebuild}
      className="sm:flex-none px-3 py-2.5 sm:px-4 sm:py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 active:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
      title="Reset & rebuild all stock from scratch"
    >
      <span className="text-lg">🔄</span>
      <span className="hidden sm:inline whitespace-nowrap">Reset & Rebuild</span>
    </button>

    <button
      onClick={handleExport}
      className="sm:flex-none px-3 py-2.5 sm:px-4 sm:py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
    >
      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline whitespace-nowrap">Export</span>
    </button>
  </div>
)}

{/* Kasir can export stock data */}
{!canManage && (
  <div className="flex gap-2 sm:gap-3 justify-end sm:justify-start">
    <button
      onClick={handleExport}
      className="sm:flex-none px-3 py-2.5 sm:px-4 sm:py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
    >
      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline whitespace-nowrap">Export</span>
    </button>
  </div>
)}

            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredStocks.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada data stock</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full table-auto bg-white rounded-lg shadow-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Barang</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Gudang</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">HPP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Harga Jual</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Persentase</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stock ({filteredStocks[0]?.satuan || 'Kg'})</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Info Box</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map((item) => {
                      const isLowStock = item.stock > 0 && item.stock < 100;
                      const isNegative = item.stock < 0;
                      return (
                        <tr key={`${item.produk_id}-${item.cabang_id}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-900">{item.nama_produk}</p>
                              <p className="text-sm text-gray-500">{item.kode_produk}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-700">{item.cabang}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-700">Rp {item.hpp.toLocaleString('id-ID')}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-700">Rp {item.harga_jual.toLocaleString('id-ID')}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              item.margin >= 20 ? 'bg-green-100 text-green-700' :
                              item.margin >= 10 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {item.margin.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${
                                isNegative ? 'text-red-600' :
                                isLowStock ? 'text-orange-600' : 'text-gray-900'
                              }`}>
                                {item.stock.toFixed(item.satuan.toLowerCase() === 'kg' ? 3 : 2)}
                              </span>
                              <span className="text-sm text-gray-500">{item.satuan}</span>
                              {(item.stock_masuk > 0 || item.stock_keluar > 0) && (
                                <span className="text-xs text-gray-400">
                                  (↗️{item.stock_masuk?.toFixed(item.satuan.toLowerCase() === 'kg' ? 3 : 2) || 0} ↘️{item.stock_keluar?.toFixed(item.satuan.toLowerCase() === 'kg' ? 3 : 2) || 0})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {isNegative ? (
                                <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
                                  MINUS!
                                </span>
                              ) : isLowStock ? (
                                <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                                  LOW
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              {canManage && (
                                <button
                                  onClick={() => handleManageStock(item)}
                                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
                                  title="Manage Stock & Price"
                                >
                                  <Edit className="w-3 h-3" />
                                  Manage
                                </button>
                              )}
                              {canView && viewMode === 'table' && selectedCabang > 0 && (
                                <button
                                  onClick={() => handleOpenHistory(item)}
                                  className="px-3 py-1 bg-purple-500 text-white text-xs rounded-md hover:bg-purple-600 transition-colors flex items-center gap-1"
                                  title="History"
                                >
                                  <History className="w-3 h-3" />
                                  History
                                </button>
                              )}
                            </div>
                            {/* Delete Button - Below others */}
                            {canManage && (
                              <button
                                onClick={() => handleDeleteStock(item)}
                                className="mt-1 px-3 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-red-600 transition-colors flex items-center gap-1 w-full justify-center"
                                title="Delete Stock"
                              >
                                <X className="w-3 h-3" />
                                Hapus Stock
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStocks.map((item) => {
                  const isLowStock = item.stock > 0 && item.stock < 100;
                  const isNegative = item.stock < 0;
                  return (
                    <div
                      key={`${item.produk_id}-${item.cabang_id}`}
                      className={`bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 border-2 ${
                        isNegative ? 'border-red-500 bg-red-50' :
                        isLowStock ? 'border-orange-300' : 'border-gray-200'
                      } hover:shadow-lg transition-all duration-200`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 text-lg">{item.nama_produk}</h3>
                          <p className="text-xs text-gray-500">{item.kode_produk}</p>
                        </div>
                        {isNegative ? (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded-full animate-pulse">
                            MINUS!
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                            LOW
                          </span>
                        ) : null}
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-bold ${
                            isNegative ? 'text-red-600' :
                            isLowStock ? 'text-orange-600' : 'text-gray-800'
                          }`}>
                            {item.stock.toFixed(item.satuan.toLowerCase() === 'kg' ? 3 : 2)}
                          </span>
                          <span className="text-gray-500 text-sm">{item.satuan}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">📍 {item.cabang}</p>
                        {(item.stock_masuk > 0 || item.stock_keluar > 0) && (
                          <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                            <p>↗️ Masuk: <span className="font-semibold text-green-600">{item.stock_masuk?.toFixed(2) || 0}</span></p>
                            <p>↘️ Keluar: <span className="font-semibold text-red-600">{item.stock_keluar?.toFixed(2) || 0}</span></p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-white rounded-lg border border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">HPP</p>
                          <p className="text-sm font-semibold text-gray-700">
                            Rp {item.hpp.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Harga Jual</p>
                          <p className="text-sm font-semibold text-gray-700">
                            Rp {item.harga_jual.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          item.margin >= 20 ? 'bg-green-100 text-green-700' :
                          item.margin >= 10 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          Margin: {item.margin.toFixed(2)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {canManage && (
                          <button
                            onClick={() => handleManageStock(item)}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                            title="Manage Stock & Price"
                          >
                            <Edit className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Manage</span>
                          </button>
                        )}
                        {/* History button only shown in table view with specific branch filter */}
                      </div>

                      {/* Delete Button - Full Width Below - Only for gudang */}
                      {canManage && (
                        <button
                          onClick={() => handleDeleteStock(item)}
                          className="w-full mt-2 p-2 bg-gray-700 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 text-sm"
                          title="Delete Stock"
                        >
                          <X className="w-4 h-4" />
                          Hapus Stock
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalStockManager
        isOpen={showModalStockManager}
        onClose={() => setShowModalStockManager(false)}
        onSuccess={handleModalSuccess}
        mode={modalMode}
      />

      <ModalHistory
        isOpen={showModalHistory}
        onClose={() => setShowModalHistory(false)}
        produkId={selectedStock?.produk_id}
        namaProduk={selectedStock?.nama_produk}
        cabangId={selectedStock?.cabang_id}
      />
      
    </div>
  );
}

