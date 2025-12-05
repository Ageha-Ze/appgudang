'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Printer, Trash2, ShoppingCart } from 'lucide-react';
import ModalTambahPenjualan from './ModalTambahPenjualan';
import ModalPrintNota from './ModalPrintNota';

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
  const limit = 10;

  useEffect(() => {
    fetchPenjualans();
  }, [page, search]);

  const fetchPenjualans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search
      });
      
      const res = await fetch(`/api/transaksi/penjualan?${params}`);
      const json = await res.json();
      
      setPenjualans(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus penjualan ini?')) return;

    try {
      const res = await fetch(`/api/transaksi/penjualan/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Penjualan berhasil dihapus');
        fetchPenjualans();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal menghapus penjualan');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
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

      {/* Search & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow-md">
        <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
          <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-0 sm:max-w-xs px-3 sm:px-4 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Cari..."
          />
        </div>
        <button
          onClick={() => setShowModalTambah(true)}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus size={18} />
          Tambah
        </button>
      </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Memuat data...</p>
            </div>
          </div>
        ) : penjualans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500">Tidak ada data</p>
          </div>
        ) : (
          penjualans.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-500">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-indigo-700">{item.nota_penjualan}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(item.tanggal).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                    item.status === 'billed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status === 'billed' ? 'Billed' : 'Pending'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                    item.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' :
                    item.status_pembayaran === 'Cicil' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status_pembayaran}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{item.customer?.nama || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales:</span>
                  <span className="font-medium">{item.pegawai?.nama || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cabang:</span>
                  <span className="font-medium">{item.pegawai?.cabang?.nama_cabang || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-semibold text-indigo-700">
                    Rp. {item.total.toLocaleString('id-ID')}
                  </span>
                </div>
                {item.status === 'billed' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sisa Tagihan:</span>
                    <span className={`font-semibold ${
                      item.sisa_tagihan > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      Rp. {item.sisa_tagihan.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => router.push(`/transaksi/penjualan/${item.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm"
                >
                  <Eye size={16} />
                  Detail
                </button>
                <button
                  onClick={() => handlePrint(item.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-sm"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm"
                >
                  <Trash2 size={16} />
                </button>
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
                      <button
                        onClick={() => handlePrint(item.id)}
                        className="text-purple-600 hover:text-purple-800 transition"
                        title="Print"
                      >
                        <Printer size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800 transition"
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
