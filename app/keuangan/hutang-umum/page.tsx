'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Eye, Edit, Trash2, Search } from 'lucide-react';
import ModalTambahHutang from './ModalTambahHutang';
import DeleteModal from '@/components/DeleteModal';
import { HutangUmum } from '@/types/hutang';

export default function HutangUmumPage() {
  const router = useRouter();
  const [hutangs, setHutangs] = useState<HutangUmum[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModalTambah, setShowModalTambah] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchHutangs();
  }, [page, search]);

  const fetchHutangs = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/keuangan/hutang-umum?page=${page}&limit=10&search=${search}`
      );
      const json = await res.json();

      setHutangs(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching hutangs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    try {
      const res = await fetch(`/api/keuangan/hutang-umum/${selectedId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Data berhasil dihapus');
        fetchHutangs();
        setShowDeleteModal(false);
        setSelectedId(null);
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal menghapus data');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const openDeleteModal = (id: number) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Hutang Umum</h1>
            <p className="text-gray-500 text-sm mt-1">Kelola hutang umum perusahaan</p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari pihak, jenis hutang..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowModalTambah(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
            >
              + Hutang Baru
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  No
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Jenis Hutang
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pihak
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Nominal Total
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Sudah Dibayar
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Sisa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-500 font-medium">Memuat data...</p>
                    </div>
                  </td>
                </tr>
              ) : hutangs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <CreditCard className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold text-lg">
                          {search ? 'Tidak ada hasil' : 'Belum ada hutang'}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                          {search 
                            ? 'Coba gunakan kata kunci lain' 
                            : 'Data hutang umum akan muncul di sini'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                hutangs.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-gray-600 font-medium">{(page - 1) * 10 + index + 1}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 capitalize">{item.jenis_hutang}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 text-sm">
                        {new Date(item.tanggal_transaksi).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-medium">{item.pihak}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-semibold text-gray-900">{formatRupiah(Number(item.nominal_total))}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-green-600 font-medium">{formatRupiah(Number(item.dibayar))}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-orange-600 font-semibold">{formatRupiah(Number(item.sisa))}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                          item.status === 'Lunas'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.status === 'Lunas' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => router.push(`/keuangan/hutang-umum/${item.id}`)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => router.push(`/keuangan/hutang-umum/${item.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
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

        {/* Footer */}
        {hutangs.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Menampilkan <span className="font-semibold text-gray-900">{hutangs.length}</span> hutang dari total <span className="font-semibold text-gray-900">{totalPages * 10}</span>
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`px-4 py-2 border border-gray-300 rounded-lg transition ${
                  page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          {totalPages > 5 && <span className="px-2 text-gray-600">...</span>}
          {totalPages > 5 && (
            <button
              onClick={() => setPage(totalPages)}
              className={`px-4 py-2 border border-gray-300 rounded-lg transition ${
                page === totalPages ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              {totalPages}
            </button>
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      <ModalTambahHutang
        isOpen={showModalTambah}
        onClose={() => setShowModalTambah(false)}
        onSuccess={fetchHutangs}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedId(null);
        }}
        onConfirm={handleDelete}
        itemName="hutang"
        itemValue={selectedId ? hutangs.find(h => h.id === selectedId)?.pihak || '' : ''}
      />
    </div>
  );
}
