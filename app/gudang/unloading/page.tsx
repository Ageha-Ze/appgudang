'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Eye, Trash2, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ModalTambahUnloading from './ModalTambahUnloading';
import { customToast } from '@/lib/toast';

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface UnloadingItem {
  id: number;
  tanggal: string;
  cabang: {
    nama_cabang: string;
  };
  pembelian?: {
    nota_supplier: string;
  };
  items: any[];
  total_qty: number;
  created_at: string;
}

export default function UnloadingListPage() {
  const router = useRouter();
  
  const [data, setData] = useState<UnloadingItem[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cabangFilter, setCabangFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCabang();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, cabangFilter]);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      if (res.ok) {
        const json = await res.json();
        setCabangList(json.data || json || []);
      }
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let url = `/api/gudang/unloading?page=${page}&limit=10&search=${encodeURIComponent(search)}`;
      if (cabangFilter) {
        url += `&cabang_id=${cabangFilter}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      } else {
        console.error('Failed to fetch data');
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      customToast.error('Gagal memuat data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (id: number) => {
    router.push(`/gudang/unloading/${id}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('⚠️ Menghapus unloading akan mengurangi stock produk!\n\nApakah Anda yakin?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/gudang/unloading?id=${id}`, {
        method: 'DELETE'
      });
      
      const json = await res.json();
      
      if (res.ok) {
        customToast.success('Berhasil menghapus data!');
        fetchData();
      } else {
        customToast.error(json.error || 'Gagal menghapus data');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      customToast.error('Terjadi kesalahan saat menghapus');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchData();
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
              page === i
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-indigo-100'
            }`}
          >
            {i}
          </button>
        );
      }
    } else {
      // Show first page
      buttons.push(
        <button
          key={1}
          onClick={() => setPage(1)}
          className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
            page === 1
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-indigo-100'
          }`}
        >
          1
        </button>
      );

      // Show dots if current page is far from start
      if (page > 3) {
        buttons.push(
          <span key="dots-start" className="px-2 text-indigo-600 flex items-center">
            ...
          </span>
        );
      }

      // Show pages around current page
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalPages - 1, page + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        buttons.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
              page === i
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-indigo-100'
            }`}
          >
            {i}
          </button>
        );
      }

      // Show dots if current page is far from end
      if (page < totalPages - 2) {
        buttons.push(
          <span key="dots-end" className="px-2 text-indigo-600 flex items-center">
            ...
          </span>
        );
      }

      // Show last page
      buttons.push(
        <button
          key={totalPages}
          onClick={() => setPage(totalPages)}
          className={`px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg transition flex-shrink-0 ${
            page === totalPages
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-indigo-100'
          }`}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8 bg-white p-3 sm:p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="bg-indigo-500 p-2 sm:p-3 rounded-lg">
          <Package className="text-white" size={20} />
        </div>
        <div>
          <p className="text-xs sm:text-sm text-indigo-600">Gudang</p>
          <h1 className="text-lg sm:text-2xl font-bold text-indigo-700">Unloading Barang</h1>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg mb-4 sm:mb-6">
        <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-4 sm:items-center sm:justify-between">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-4 sm:items-center sm:flex-1">
            {/* Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700">Search:</label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Cari produk, nota..."
              />
            </div>

            {/* Filter Cabang */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-600" />
              <select
                value={cabangFilter}
                onChange={(e) => {
                  setCabangFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Semua Cabang</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            Tambah Unloading
          </button>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Memuat data...</p>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Package className="w-12 h-12 opacity-50" />
              <p className="font-medium">Belum ada data unloading</p>
              <p className="text-sm">Klik tombol &quot;Tambah Unloading&quot; untuk mulai</p>
            </div>
          </div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-500">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {new Date(item.tanggal).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-xs text-gray-600">{item.cabang?.nama_cabang || '-'}</div>
                </div>
                {item.pembelian ? (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {item.pembelian.nota_supplier}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    Independent
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div>
                  <span className="text-gray-600">Item:</span>
                  <span className="ml-1 font-medium">{item.items?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-1 font-semibold text-green-600">{item.total_qty.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => handleViewDetail(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition text-sm"
                >
                  <Eye size={16} />
                  Detail
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm"
                >
                  <Trash2 size={16} />
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-xl shadow-lg border border-indigo-200">
        <table className="w-full border-collapse">
          <thead className="bg-indigo-100">
            <tr>
              <th className="px-4 py-3 text-left border border-indigo-200">Tanggal</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Cabang</th>
              <th className="px-4 py-3 text-left border border-indigo-200">Link Pembelian</th>
              <th className="px-4 py-3 text-right border border-indigo-200">Jumlah Item</th>
              <th className="px-4 py-3 text-right border border-indigo-200">Total Qty</th>
              <th className="px-4 py-3 text-center border border-indigo-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 border border-indigo-200">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Memuat data...</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 border border-indigo-200">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Package className="w-12 h-12 opacity-50" />
                    <p className="font-medium">Belum ada data unloading</p>
                    <p className="text-sm">Klik tombol &quot;Tambah Unloading&quot; untuk mulai</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-indigo-200 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'
                  } hover:bg-indigo-100 transition-colors`}
                >
                  <td className="px-4 py-3 border border-indigo-200">
                    {new Date(item.tanggal).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {item.cabang?.nama_cabang || '-'}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    {item.pembelian ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {item.pembelian.nota_supplier}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        Independent
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right border border-indigo-200 font-medium">
                    {item.items?.length || 0} item
                  </td>
                  <td className="px-4 py-3 text-right border border-indigo-200 font-semibold text-green-600">
                    {item.total_qty.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleViewDetail(item.id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
                        title="Detail"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
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
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-4 sm:mt-8 bg-white p-3 sm:p-4 rounded-lg shadow-md">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          
          <div className="flex gap-2 overflow-x-auto max-w-full pb-2 sm:pb-0">
            {renderPaginationButtons()}
          </div>
          
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal Tambah Unloading */}
      <ModalTambahUnloading
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}