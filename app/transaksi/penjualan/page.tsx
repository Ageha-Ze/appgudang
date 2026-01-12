'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Printer, Trash2, ShoppingCart } from 'lucide-react';
import { usePermissions, ReadOnlyBanner } from '@/components/PermissionGuard';
import PermissionGuard from '@/components/PermissionGuard';
import ModalTambahPenjualan from './ModalTambahPenjualan';
import ModalPrintNota from './ModalPrintNota';
import { customToast } from '@/lib/toast';

interface Penjualan {
  id: number;
  tanggal: string;
  nota_penjualan: string;
  total: number;
  sisa_tagihan: number;
  status: string;
  status_pembayaran: string;
  jenis_pembayaran: string;
  customer?: {
    nama: string;
  };
  pegawai?: {
    nama: string;
    cabang?: {
      nama_cabang: string;
    };
  };
}

export default function PenjualanListPage() {
  const router = useRouter();
  const [penjualans, setPenjualans] = useState<Penjualan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModalTambah, setShowModalTambah] = useState(false);
  const [showModalPrint, setShowModalPrint] = useState(false);
  const [selectedPenjualanId, setSelectedPenjualanId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  // Permission guards
  const { canView, canCreate, canEdit, canDelete } = usePermissions({
    canView: 'sales.read',
    canCreate: 'sales.create',
    canEdit: ['sales.update.today', 'sales.update.all'],
    canDelete: 'sales.delete',
  });

  const isReadOnly = canView && !canCreate;

  useEffect(() => {
    fetchPenjualans();
  }, [page, search]);

  const fetchPenjualans = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error sebelum fetch

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search
      });

      const res = await fetch(`/api/transaksi/penjualan?${params}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();

      if (json.success === false) {
        throw new Error(json.error || 'Gagal memuat data penjualan');
      }

      setPenjualans(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error: any) {
      console.error('Error fetching penjualans:', error);
      let errorMessage = 'Terjadi kesalahan saat memuat data penjualan. Silakan coba lagi.';

      if (error.message?.includes('HTTP 401')) {
        errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
      } else if (error.message?.includes('HTTP 403')) {
        errorMessage = 'Anda tidak memiliki akses untuk melihat data penjualan.';
      } else if (error.message?.includes('HTTP 500')) {
        errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('NetworkError')) {
        errorMessage = 'Koneksi internet bermasalah. Periksa koneksi Anda.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setPenjualans([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleDelete = async (id: number) => {
    // Find the item for better confirmation message
    const penjualanItem = penjualans.find(p => p.id === id);

    // Improved Indonesian confirmation dialog
    const confirmMessage = `🎯 KONFIRMASI PENGHAPUSAN DATA PENJUALAN

📄 Nota Penjualan: ${penjualanItem?.nota_penjualan || 'N/A'}
👤 Customer: ${penjualanItem?.customer?.nama || 'N/A'}
💰 Total: Rp ${penjualanItem?.total?.toLocaleString('id-ID') || '0'}

⚠️  PERINGATAN PENTING:
• Semua detail barang akan dihapus
• Data cicilan akan dibatalkan (jika ada)
• Piutang customer akan dihapus
• Saldo kas akan dikembalikan otomatis

❓ Yakin ingin menghapus transaksi penjualan ini?`;

    if (!confirm(confirmMessage)) return;

    if (!id) {
      setError('ID penjualan tidak valid. Silakan refresh halaman dan coba lagi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transaksi/penjualan/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        let errorMessage = 'Gagal menghapus data penjualan';

        if (res.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (res.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menghapus data penjualan ini.';
        } else if (res.status === 404) {
          errorMessage = 'Data penjualan tidak ditemukan. Mungkin sudah dihapus sebelumnya.';
        } else if (res.status === 409) {
          errorMessage = 'Data penjualan tidak dapat dihapus karena masih memiliki referensi aktif.';
        } else if (res.status >= 500) {
          errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
        }

        const json = await res.json().catch(() => null);
        if (json?.error) {
          errorMessage += ': ' + json.error;
        }

        setError(errorMessage);
        return;
      }

      const json = await res.json();

      if (json.success) {
        // Show success toast
        customToast.success('Data penjualan telah dihapus dan saldo kas dikembalikan.');

        // Refresh data
        await fetchPenjualans();
      } else {
        setError(json.error || 'Gagal menghapus data penjualan');
      }

    } catch (error: any) {
      console.error('❌ Delete error:', error);
      let errorMessage = 'Terjadi kesalahan saat menghapus data. Silakan periksa koneksi internet Anda.';

      if (error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Koneksi internet bermasalah. Data tidak dapat dihapus.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (id: number) => {
    setSelectedPenjualanId(id);
    setShowModalPrint(true);
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8 bg-white p-3 sm:p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="bg-indigo-500 p-2 sm:p-3 rounded-lg">
          <ShoppingCart className="text-white" size={20} />
        </div>
        <div>
          <p className="text-xs sm:text-sm text-indigo-600">Transaksi</p>
          <h1 className="text-lg sm:text-2xl font-bold text-indigo-700">Penjualan Barang</h1>
        </div>
      </div>

      {/* Read-only banner for roles without create permission */}
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

      {/* Search & Add Button */}
<div className="flex flex-col gap-3 mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow-md sm:flex-row sm:justify-between sm:items-center">
  {/* Search Input */}
  <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-md">
    <label className="text-xs sm:text-sm font-medium text-gray-700 shrink-0">Search:</label>
    <input
      type="text"
      value={search}
      onChange={(e) => handleSearch(e.target.value)}
      className="flex-1 min-w-0 px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      placeholder="Cari..."
    />
  </div>
  
  {/* Add Button */}
  {canCreate && (
    <button
      onClick={() => setShowModalTambah(true)}
      className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
    >
      <Plus size={18} />
      <span>Tambah</span>
    </button>
  )}
</div>
      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Memuat data...</p>
          </div>
        ) : penjualans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada data
          </div>
        ) : (
          penjualans.map((item, index) => (
            <div key={item.id} className="bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-cyan-100 mb-1">📋 Nota</p>
                    <p className="font-mono text-base font-bold">{item.nota_penjualan}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    item.status === 'billed' ? 'bg-green-400 text-green-900' : 'bg-yellow-400 text-yellow-900'
                  }`}>
                    {item.status === 'billed' ? 'Selesai' : 'Pending'}
                  </span>
                </div>
                
                {/* Customer & Sales Info */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">👤</span>
                    <div className="flex-1">
                      <p className="text-xs text-cyan-100">Officer</p>
                      <p className="text-sm font-semibold">{item.pegawai?.nama || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🏢</span>
                    <div className="flex-1">
                      <p className="text-xs text-cyan-100">Customer</p>
                      <p className="text-sm font-semibold">{item.customer?.nama || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📅</span>
                      <div>
                        <p className="text-xs text-cyan-100">Tanggal</p>
                        <p className="text-sm font-semibold">{new Date(item.tanggal).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    
                    
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/20 my-4"></div>

                {/* Payment Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cyan-100">Total</span>
                    <span className="text-xl font-bold">Rp. {item.total.toLocaleString('id-ID')}</span>
                  </div>
                  {item.status === 'billed' && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-cyan-100">Sisa Tagihan</span>
                      <span className={`text-base font-bold ${
                        item.sisa_tagihan > 0 ? 'text-red-300' : 'text-green-300'
                      }`}>
                        Rp. {item.sisa_tagihan.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cyan-100">Status Pembayaran</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status_pembayaran === 'Lunas' ? 'bg-green-400 text-green-900' :
                      item.status_pembayaran === 'Cicil' ? 'bg-blue-400 text-blue-900' :
                      'bg-red-400 text-red-900'
                    }`}>
                      {item.status_pembayaran}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/transaksi/penjualan/${item.id}`)}
                    className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                  >
                    <Eye size={16} />
                    Detail
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handlePrint(item.id)}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-white/30"
                    >
                      <Printer size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Check Icon for Completed */}
                {item.sisa_tagihan === 0 && item.status === 'billed' && (
                  <div className="mt-3 flex items-center gap-2 text-green-300">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold">Sesi Telah Selesai</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto bg-white rounded-xl shadow-lg border border-indigo-200">
        <table className="w-full border-collapse">
          <thead className="bg-indigo-100">
            <tr>
              <th className="px-4 py-3 text-left border border-indigo-200">No</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Tanggal</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Nota</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Customer</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Sales</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Cabang</th>
              <th className="px-4 py-3 text-right border border-indigo-200">Total</th>
              <th className="px-4 py-3 text-right border border-indigo-200">Sisa Tagihan</th>
              <th className="px-4 py-3 text-center border border-indigo-200">Status</th>
              <th className="px-4 py-3 text-center border border-indigo-200">Pembayaran</th>
              <th className="px-4 py-3 text-center border border-indigo-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="text-center py-8 border border-indigo-200">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Memuat data...</p>
                  </div>
                </td>
              </tr>
            ) : penjualans.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-8 border border-indigo-200">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              penjualans.map((item, index) => (
                <tr key={item.id} className={`border-b border-indigo-200 ${index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100`}>
                  <td className="px-4 py-3 border border-indigo-200">
                    {(page - 1) * limit + index + 1}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {new Date(item.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200 font-mono text-sm">
                    {item.nota_penjualan}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {item.customer?.nama || '-'}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {item.pegawai?.nama || '-'}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {item.pegawai?.cabang?.nama_cabang || '-'}
                  </td>
                  <td className="px-4 py-3 text-right border border-indigo-200">
                    Rp. {item.total.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right border border-indigo-200">
                    {item.status === 'billed' ? (
                      <span className={`font-bold ${
                        item.sisa_tagihan > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        Rp. {item.sisa_tagihan.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'billed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status === 'billed' ? 'Billed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' :
                      item.status_pembayaran === 'Cicil' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status_pembayaran}
                    </span>
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => router.push(`/transaksi/penjualan/${item.id}`)}
                        className="text-blue-600 hover:text-blue-800 transition"
                        title="Detail"
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handlePrint(item.id)}
                          className="text-purple-600 hover:text-purple-800 transition"
                          title="Print"
                        >
                          <Printer size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-4 sm:mt-8 bg-white p-3 sm:p-4 rounded-lg shadow-md">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          <div className="flex gap-2 overflow-x-auto max-w-full pb-2 sm:pb-0">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
                    page === pageNum ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && <span className="px-2 text-indigo-600 flex items-center">...</span>}
            {totalPages > 5 && (
              <button
                onClick={() => setPage(totalPages)}
                className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
                  page === totalPages ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-100'
                }`}
              >
                {totalPages}
              </button>
            )}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal Tambah Penjualan */}
      <ModalTambahPenjualan
        isOpen={showModalTambah}
        onClose={() => setShowModalTambah(false)}
        onSuccess={() => {
          setShowModalTambah(false);
          fetchPenjualans();
        }}
      />

      {/* Modal Print Nota */}
      <ModalPrintNota
        isOpen={showModalPrint}
        onClose={() => setShowModalPrint(false)}
        penjualanId={selectedPenjualanId}
      />
    </div>
  );
}
