'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Search, Trash2, Eye, Clock, CheckCircle } from 'lucide-react';
import ModalTambahProduksi from './ModalTambahProduksi';
import { customToast } from '@/lib/toast';

interface Produksi {
  id: number;
  tanggal: string;
  produk?: { nama_produk: string };
  jumlah: number;
  satuan: string;
  pegawai?: { nama: string };
  cabang?: { nama_cabang: string };
  status: string;
}

export default function ProduksiPage() {
  const router = useRouter();
  const [produksis, setProduksis] = useState<Produksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsPerPage = 10;

  useEffect(() => {
    fetchProduksis();
  }, [page, search]);

  const fetchProduksis = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/gudang/produksi?page=${page}&limit=10&search=${search}`);

      if (!res.ok) {
        let errorMessage = 'Gagal memuat data produksi';

        if (res.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (res.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk melihat data produksi.';
        } else if (res.status === 500) {
          errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
        } else {
          const errorJson = await res.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage += ': ' + errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const json = await res.json();

      if (json.success === false) {
        throw new Error(json.error || 'Gagal memuat data produksi');
      }

      setProduksis(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error: any) {
      console.error('Error fetching produksis:', error);
      let errorMessage = 'Terjadi kesalahan saat memuat data. Silakan periksa koneksi internet Anda.';
      if (error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Koneksi internet bermasalah. Tidak dapat memuat data produksi.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      setProduksis([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (produksiId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data produksi ini? Data yang sudah dihapus tidak dapat dikembalikan.')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/gudang/produksi/${produksiId}`, { method: 'DELETE' });

      if (!res.ok) {
        let errorMessage = 'Gagal menghapus data produksi';

        if (res.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (res.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk menghapus data produksi.';
        } else if (res.status === 404) {
          errorMessage = 'Data produksi tidak ditemukan. Mungkin sudah dihapus sebelumnya.';
        } else if (res.status === 409) {
          errorMessage = 'Data produksi tidak dapat dihapus karena masih ada referensi aktif di sistem.';
        } else if (res.status === 500) {
          errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
        } else {
          const errorJson = await res.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage += ': ' + errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const json = await res.json();

      if (json.success) {
        // Show success toast
        customToast.success('Success!');

        await fetchProduksis();
      } else {
        setError(json.error || 'Gagal menghapus data produksi');
      }

    } catch (error: any) {
      console.error('Error deleting production:', error);
      const errorMessage = error.message?.includes('Gagal menghapus') || error.message?.includes('Gagal memuat') ?
        error.message : 'Terjadi kesalahan saat menghapus data produksi. Silakan coba lagi.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async (produksiId: number) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push(`/gudang/produksi/${produksiId}`);
  };

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  // Stats calculations
  const totalProductions = produksis.length;
  const pendingCount = produksis.filter(p => p.status === 'pending').length;
  const postedCount = produksis.filter(p => p.status === 'posted').length;

  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + produksis.length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Cards - Mini Version */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Produksi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalProductions}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Pending</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{pendingCount}</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium">Posted</p>
              <p className="text-2xl font-bold mt-1">{postedCount}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

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

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">Data Produksi</h3>
              <p className="text-blue-100 mt-1">Kelola data produksi dengan mudah</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <Plus size={20} className="mr-2" />
              Tambah Produksi
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Search and Info */}
          <div className="mb-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Menampilkan {startIndex + 1} - {endIndex} data
            </div>
            <div className="relative w-80">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produksi..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block lg:hidden space-y-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Memuat data...</p>
              </div>
            ) : produksis.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {search ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data'}
              </div>
            ) : (
              produksis.map((item, idx) => (
                <div key={item.id} className="bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
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
                        <p className="text-xs text-blue-100 mb-1">📦 Produk</p>
                        <p className="font-mono text-base font-bold">{item.produk?.nama_produk || 'Produk'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'posted' ? 'bg-green-400 text-green-900' :
                          item.status === 'pending' ? 'bg-yellow-400 text-yellow-900' :
                          'bg-gray-400 text-gray-900'
                        }`}>
                          {item.status === 'posted' ? 'Posted' : item.status === 'pending' ? 'Pending' : item.status}
                        </span>
                      </div>
                    </div>

                    {/* Production Info */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">📅</span>
                        <div className="flex-1">
                          <p className="text-xs text-blue-100">Tanggal Produksi</p>
                          <p className="text-sm font-semibold">{new Date(item.tanggal).toLocaleDateString('id-ID')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚙️</span>
                          <div>
                            <p className="text-xs text-blue-100">Jumlah</p>
                            <p className="text-sm font-semibold">{item.jumlah} {item.satuan}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-base">🏭</span>
                          <div>
                            <p className="text-xs text-blue-100">Cabang</p>
                            <p className="text-sm font-semibold">{item.cabang?.nama_cabang || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-4"></div>

                    {/* Pegawai */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">👤</span>
                      <div>
                        <p className="text-xs text-blue-100">Pegawai Produksi</p>
                        <p className="text-sm font-semibold">{item.pegawai?.nama || '-'}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/gudang/produksi/${item.id}`)}
                        className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                      >
                        <Eye size={16} />
                        Detail
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tanggal</th>
                  <th className="px-6 py-4 text-left font-semibold">Produk</th>
                  <th className="px-6 py-4 text-left font-semibold">Jumlah</th>
                  <th className="px-6 py-4 text-left font-semibold">Pegawai</th>
                  <th className="px-6 py-4 text-left font-semibold">Cabang</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : produksis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {search ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data'}
                    </td>
                  </tr>
                ) : (
                  produksis.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-colors duration-200`}
                    >
                      <td className="px-6 py-4 text-gray-700">
                        {new Date(item.tanggal).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {(item.produk?.nama_produk || 'P').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-gray-800 font-medium">{item.produk?.nama_produk || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className="font-medium">{item.jumlah}</span> {item.satuan}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{item.pegawai?.nama || '-'}</td>
                      <td className="px-6 py-4 text-gray-700">{item.cabang?.nama_cabang || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === 'posted' ? 'bg-green-100 text-green-800' :
                          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status === 'posted' ? 'Posted' : item.status === 'pending' ? 'Pending' : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => router.push(`/gudang/produksi/${item.id}`)}
                            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                            title="Detail"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                            title="Hapus"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>

              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    page === pageNum
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ModalTambahProduksi
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
