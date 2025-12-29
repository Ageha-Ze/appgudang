'use client';

import { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Movement {
  id: number;
  tanggal: string;
  tipe: 'masuk' | 'keluar';
  jumlah_awal: number;
  jumlah_sisa: number;
  hpp_per_unit: number;
  referensi_type: string;
  referensi_id: number;
  keterangan: string;
  produk: {
    nama_produk: string;
    kode_produk: string;
  };
  cabang: {
    nama_cabang: string;
  };
}

interface Summary {
  total_masuk: number;
  total_keluar: number;
  stock_tersedia: number;
  nilai_stock: number;
}

export default function LaporanMovementPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    produk_id: '',
    cabang_id: '',
    tipe: '',
    start_date: '',
    end_date: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMovements();
  }, [page, filters]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      });

      const res = await fetch(`/api/persediaan/stock-fifo/movement?${params}`);
      const json = await res.json();

      setMovements(json.data || []);
      setSummary(json.summary || null);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startIndex = (page - 1) * 20;
  const endIndex = startIndex + movements.length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Cards - Mini Version */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Total Masuk</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.total_masuk.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Kg/Gr</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Total Keluar</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.total_keluar.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Kg/Gr</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Stock Tersedia</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.stock_tersedia.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Kg/Gr</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 shadow-sm text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs font-medium">Nilai Stock</p>
                <p className="text-xl font-bold mt-1">
                  Rp. {(summary.nilai_stock / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-blue-100 mt-1">
                  Rp. {summary.nilai_stock.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Laporan Stock Movement (FIFO)</h3>
              <p className="text-blue-100 mt-1">Tracking pergerakan persediaan barang</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Filters */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tipe</label>
  <select
    value={filters.tipe}
    onChange={(e) => {
      setFilters({ ...filters, tipe: e.target.value });
      setPage(1);
    }}
    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
  >
    <option value="">Semua</option>
    <option value="masuk">Masuk</option>
    <option value="keluar">Keluar</option>
  </select>
</div>

<div>
  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
  <input
    type="date"
    value={filters.start_date}
    onChange={(e) => {
      setFilters({ ...filters, start_date: e.target.value });
      setPage(1);
    }}
    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />
</div>

<div>
  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
  <input
    type="date"
    value={filters.end_date}
    onChange={(e) => {
      setFilters({ ...filters, end_date: e.target.value });
      setPage(1);
    }}
    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />
</div>

              <div className="col-span-2 flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      produk_id: '',
                      cabang_id: '',
                      tipe: '',
                      start_date: '',
                      end_date: '',
                    });
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mb-4 text-sm text-gray-600">
            Menampilkan {startIndex + 1} - {endIndex} dari {totalPages * 20} transaksi
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tanggal</th>
                  <th className="px-6 py-4 text-left font-semibold">Produk</th>
                  <th className="px-6 py-4 text-left font-semibold">Gudang</th>
                  <th className="px-6 py-4 text-center font-semibold">Tipe</th>
                  <th className="px-6 py-4 text-right font-semibold">Jumlah</th>
                  <th className="px-6 py-4 text-right font-semibold">Sisa</th>
                  <th className="px-6 py-4 text-right font-semibold">HPP/Unit</th>
                  <th className="px-6 py-4 text-right font-semibold">Nilai</th>
                  <th className="px-6 py-4 text-left font-semibold">Referensi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      Tidak ada data movement
                    </td>
                  </tr>
                ) : (
                  movements.map((item, idx) => (
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
                        <div>
                          <p className="font-medium text-gray-800">{item.produk.nama_produk}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.produk.kode_produk}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{item.cabang.nama_cabang}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            item.tipe === 'masuk'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.tipe.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-800 font-semibold">
                        {Number(item.jumlah_awal).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {Number(item.jumlah_sisa).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">
                        Rp. {Number(item.hpp_per_unit).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-800 font-bold">
                        Rp.{' '}
                        {(Number(item.jumlah_awal) * Number(item.hpp_per_unit)).toLocaleString(
                          'id-ID'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="capitalize text-gray-800 font-medium">{item.referensi_type}</p>
                          <p className="text-xs text-gray-500">#{item.referensi_id}</p>
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
