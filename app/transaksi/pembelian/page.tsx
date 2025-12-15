'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Printer, Trash2, Eye } from 'lucide-react';
import { usePermissions, ReadOnlyBanner } from '@/components/PermissionGuard';
import PermissionGuard from '@/components/PermissionGuard';
import ModalTambahPembelian from './ModalTambahPembelian';
import ModalPrintNotaPembelian from './ModalPrintNotaPembelian';
import { customToast } from '@/lib/toast';


interface DetailPembelian {
  id: number;
  jumlah: number;
  harga: number;
  subtotal: number;
}

interface Pembelian {
  id: number;
  tanggal: string;
  nota_supplier: string;
  total: number;
  status_barang: string;
  status_pembayaran: string;
  uang_muka: number;
  biaya_kirim: number;
  tagihan: number;  
  suplier?: {
    nama: string;
  };
  cabang?: {
    nama_cabang: string;
  };
  detail_pembelian?: DetailPembelian[];
}

export default function PembelianPage() {
  const router = useRouter();
  const [pembelians, setPembelians] = useState<Pembelian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showModalPrint, setShowModalPrint] = useState(false);
  const [selectedPembelianId, setSelectedPembelianId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Permission guards
  const { canView, canCreate, canEdit, canDelete } = usePermissions({
    canView: 'purchase.read',
    canCreate: 'purchase.manage',
    canEdit: 'purchase.manage',
    canDelete: 'purchase.manage',
  });

  const isReadOnly = canView && !canCreate;

  useEffect(() => {
    fetchPembelians();
  }, [page, search]);

  const fetchPembelians = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error sebelum fetch

      const res = await fetch(`/api/transaksi/pembelian?page=${page}&limit=10&search=${search}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();

      if (json.success === false) {
        throw new Error(json.error || 'Gagal memuat data pembelian');
      }

      setPembelians(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error: any) {
      console.error('Error fetching pembelians:', error);
      let errorMessage = 'Terjadi kesalahan saat memuat data pembelian. Silakan coba lagi.';

      if (error.message?.includes('HTTP 401')) {
        errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        // Optional: redirect to login
        // router.push('/login');
      } else if (error.message?.includes('HTTP 403')) {
        errorMessage = 'Anda tidak memiliki akses untuk melihat data pembelian.';
      } else if (error.message?.includes('HTTP 500')) {
        errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('NetworkError')) {
        errorMessage = 'Koneksi internet bermasalah. Periksa koneksi Anda.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setPembelians([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pembelianId: number) => {
    // Improved Indonesian confirmation dialog
    const confirmMessage = `🎯 KONFIRMASI PENGHAPUSAN DATA
                
📄 Nota Supplier: ${pembelians.find(p => p.id === pembelianId)?.nota_supplier || 'N/A'}

⚠️  PERINGATAN PENTING:
• Semua detail barang akan dihapus
• Data cicilan akan dibatalkan
• Hutang supplier akan dihapus
• Saldo kas akan dikembalikan otomatis

❓ Yakin ingin menghapus transaksi ini?`;

    if (!confirm(confirmMessage)) return;

    if (!pembelianId) {
      setError('ID pembelian tidak valid. Silakan refresh halaman dan coba lagi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        let errorMessage = 'Gagal menghapus data pembelian';

        if (res.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (res.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menghapus data ini.';
        } else if (res.status === 404) {
          errorMessage = 'Data pembelian tidak ditemukan. Mungkin sudah dihapus sebelumnya.';
        } else if (res.status === 409) {
          errorMessage = 'Data tidak dapat dihapus karena masih memiliki referensi aktif.';
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
        console.log('✅ Delete successful:', json);
        // Show success toast
        customToast.success('Success!');

        // Refresh data
        await fetchPembelians();
      } else {
        setError(json.error || 'Gagal menghapus data pembelian');
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
  setSelectedPembelianId(id);
  setShowModalPrint(true);
};

  const handleSuccess = async (pembelianId: number) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push(`/transaksi/pembelian/${pembelianId}`);
  };

  const calculateTotalHargaProduk = (item: Pembelian) => {
    return item.detail_pembelian?.reduce(
      (sum, detail) => sum + (detail.jumlah * detail.harga),
      0
    ) || 0;
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-purple-50 to-violet-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8 bg-white p-3 sm:p-4 rounded-xl shadow-lg border-l-4 border-violet-500">
        <div className="bg-violet-500 p-2 sm:p-3 rounded-lg">
          <FileText className="text-white" size={20} />
        </div>
        <div>
          <p className="text-xs sm:text-sm text-violet-600">Transaksi</p>
          <h1 className="text-lg sm:text-2xl font-bold text-violet-700">Pembelian Barang</h1>
        </div>
      </div>

      {/* Read-only banner for Keuangan users */}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow-md">
        <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
          <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-0 sm:max-w-xs px-3 sm:px-4 py-2 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Cari..."
          />
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} />
            Tambah
          </button>
        )}
      </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Memuat data...</p>
            </div>
          </div>
        ) : pembelians.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500">No data available</p>
          </div>
        ) : (
          pembelians.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-violet-500">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-violet-700">{item.nota_supplier}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(item.tanggal).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                    item.status_barang === 'Diterima' ? 'bg-green-100 text-green-800' :
                    item.status_barang === 'Belum Diterima' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {item.status_barang}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                    item.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' :
                    item.status_pembayaran === 'Cicil' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status_pembayaran}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Supplier:</span>
                  <span className="font-medium">{item.suplier?.nama || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Kantor:</span>
                  <span className="font-medium">{item.cabang?.nama_cabang || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Harga:</span>
                  <span className="font-semibold text-violet-700">
                    Rp. {calculateTotalHargaProduk(item).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sisa Tagihan:</span>
                  <span className="font-semibold text-red-600">
                    Rp. {item.tagihan.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => router.push(`/transaksi/pembelian/${item.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition text-sm"
                >
                  <Eye size={16} />
                  Detail
                </button>
                {canEdit && (
                  <button
                    onClick={() => handlePrint(item.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm"
                  >
                    <Printer size={16} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto bg-white rounded-xl shadow-lg border border-violet-200">
        <table className="w-full border-collapse">
          <thead className="bg-violet-100">
            <tr>
              <th className="px-4 py-3 text-left border border-violet-200">Nota Supplier</th>
              <th className="px-4 py-3 text-left border border-violet-200">Tgl Beli</th>
              <th className="px-4 py-3 text-left border border-violet-200">Nama Suplier</th>
              <th className="px-4 py-3 text-left border border-violet-200">Nama Kantor</th>
              <th className="px-4 py-3 text-left border border-violet-200">Status Barang</th>
              <th className="px-4 py-3 text-left border border-violet-200">Status Pembayaran</th>
              <th className="px-4 py-3 text-right border border-violet-200">Total Harga Produk</th>
              <th className="px-4 py-3 text-right border border-violet-200">Sisa Tagihan</th>
              <th className="px-4 py-3 text-center border border-violet-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 border border-violet-200">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Memuat data...</p>
                  </div>
                </td>
              </tr>
            ) : pembelians.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 border border-violet-200">
                  No data available in table
                </td>
              </tr>
            ) : (
              pembelians.map((item, index) => (
                <tr key={item.id} className={`border-b border-violet-200 ${index % 2 === 0 ? 'bg-white' : 'bg-violet-50'} hover:bg-violet-100`}>
                  <td className="px-4 py-3 border border-violet-200">{item.nota_supplier}</td>
                  <td className="px-4 py-3 border border-violet-200">
                    {new Date(item.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 border border-violet-200">{item.suplier?.nama || '-'}</td>
                  <td className="px-4 py-3 border border-violet-200">{item.cabang?.nama_cabang || '-'}</td>
                  <td className="px-4 py-3 border border-violet-200">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status_barang === 'Diterima' ? 'bg-green-100 text-green-800' :
                      item.status_barang === 'Belum Diterima' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {item.status_barang}
                    </span>
                  </td>
                  <td className="px-4 py-3 border border-violet-200">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' :
                      item.status_pembayaran === 'Cicil' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status_pembayaran}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right border border-violet-200">
                    RP. {calculateTotalHargaProduk(item).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right border border-violet-200">
                    RP. {item.tagihan.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 border border-violet-200">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => router.push(`/transaksi/pembelian/${item.id}`)}
                        className="text-green-600 hover:text-green-800 transition"
                        title="Detail"
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handlePrint(item.id)}
                          className="text-blue-600 hover:text-blue-800 transition"
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
            className="w-full sm:w-auto px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                  className={`px-3 sm:px-4 py-2 text-sm border border-violet-300 rounded-lg transition flex-shrink-0 ${
                    page === pageNum ? 'bg-violet-600 text-white' : 'hover:bg-violet-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && <span className="px-2 text-violet-600 flex items-center">...</span>}
            {totalPages > 5 && (
              <button
                onClick={() => setPage(totalPages)}
                className={`px-3 sm:px-4 py-2 text-sm border border-violet-300 rounded-lg transition flex-shrink-0 ${
                  page === totalPages ? 'bg-violet-600 text-white' : 'hover:bg-violet-100'
                }`}
              >
                {totalPages}
              </button>
            )}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      <ModalTambahPembelian
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
      <ModalPrintNotaPembelian
  isOpen={showModalPrint}
  onClose={() => setShowModalPrint(false)}
  pembelianId={selectedPembelianId}
/>
    </div>
  );
}

