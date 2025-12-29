'use client';

import { useState, useEffect } from 'react';
import { FileText, Filter, Download, Search, Package, DollarSign, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface ReportData {
  detail: any[];
  summary: { [key: string]: any };
  overall: {
    total_transaksi: number;
    total_produk: number;
    total_nilai_titip: number;
    total_nilai_terjual: number;
    total_keuntungan: number;
    total_titip: number;
    total_terjual: number;
    total_sisa: number;
    total_kembali: number;
  };
  filters: {
    cabang_id: string;
    start_date?: string;
    end_date?: string;
  };
  message?: string;
}

export default function LaporanKonsinyasiPage() {
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCabang, setLoadingCabang] = useState(true);

  // Filter states
  const [filters, setFilters] = useState({
    cabang_id: '',
    start_date: '',
    end_date: '',
    status: 'Semua',
  });

  useEffect(() => {
    fetchCabang();
  }, []);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      if (!res.ok) {
        throw new Error('Failed to fetch cabang');
      }
      const json = await res.json();
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
      alert('Gagal memuat data cabang');
    } finally {
      setLoadingCabang(false);
    }
  };

  const fetchReport = async () => {
    if (!filters.cabang_id) {
      alert('Pilih cabang terlebih dahulu');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('cabang_id', filters.cabang_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.status !== 'Semua') params.append('status', filters.status);

      const res = await fetch(`/api/laporan/konsinyasi?${params.toString()}`);
      const json = await res.json();

      if (res.ok) {
        setReportData(json.data);
      } else {
        alert(json.error || 'Gagal memuat laporan');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

 const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const exportToExcel = () => {
    if (!reportData) return;

    // Prepare data for Excel
    const excelData = Object.values(reportData.summary).map((product: any) => ({
      'Produk': product.produk_nama,
      'Kode Produk': product.produk_kode,
      'HPP': product.hpp || 0,
      'Rata Harga Konsinyasi': product.rata_harga_konsinyasi || 0,
      'Rata Harga Jual': product.rata_harga_jual_toko || 0,
      'Keuntungan per Produk': (product.rata_harga_konsinyasi || 0) - (product.hpp || 0),
      'Total Titip': product.total_titip || 0,
      'Total Terjual': product.total_terjual || 0,
      'Sisa': product.total_sisa || 0,
      'Kembali': product.total_kembali || 0,
      'Total Keuntungan': ((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * (product.total_terjual || 0),
    }));

    // Add summary row
    const summaryRow = {
      'Produk': 'TOTAL KESELURUHAN',
      'Kode Produk': '',
      'HPP': 0,
      'Rata Harga Konsinyasi': 0,
      'Rata Harga Jual': 0,
      'Keuntungan per Produk': 0,
      'Total Titip': reportData.overall.total_titip || 0,
      'Total Terjual': reportData.overall.total_terjual || 0,
      'Sisa': reportData.overall.total_sisa || 0,
      'Kembali': reportData.overall.total_kembali || 0,
      'Total Keuntungan': Object.values(reportData.summary).reduce((total: number, product: any) =>
        total + (((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * (product.total_terjual || 0)), 0),
    };

    excelData.push(summaryRow);

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Produk
      { wch: 15 }, // Kode Produk
      { wch: 12 }, // HPP
      { wch: 20 }, // Rata Harga Konsinyasi
      { wch: 15 }, // Rata Harga Jual
      { wch: 20 }, // Keuntungan per Produk
      { wch: 12 }, // Total Titip
      { wch: 12 }, // Total Terjual
      { wch: 8 },  // Sisa
      { wch: 10 }, // Kembali
      { wch: 15 }, // Total Keuntungan
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Konsinyasi');

    // Generate filename with current date
    const now = new Date();
    const filename = `Laporan_Konsinyasi_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50">
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Ccircle cx='7' cy='7' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-6 rounded-2xl shadow-xl border border-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-4 rounded-2xl shadow-lg">
              <FileText className="text-white" size={28} />
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wide">Laporan</p>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
                Laporan Konsinyasi
              </h1>
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Data Terbaru</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Filter size={20} />
            Filter Laporan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={filters.cabang_id}
                onChange={(e) => handleFilterChange('cabang_id', e.target.value)}
                disabled={loadingCabang}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id.toString()}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
              {loadingCabang && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-500"></div>
                  <p className="text-xs text-gray-500">Memuat cabang...</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Selesai">Selesai</option>
                <option value="Batal">Batal</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Tanggal Mulai</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Tanggal Akhir</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchReport}
                disabled={loading || !filters.cabang_id}
                className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={20} />
                {loading ? 'Memuat...' : 'Tampilkan'}
              </button>
            </div>
          </div>
        </div>

        {reportData && reportData.detail.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Package className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Transaksi</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatNumber(reportData.overall.total_transaksi)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <DollarSign className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Keuntungan</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(Object.values(reportData.summary).reduce((total: number, product: any) =>
                        total + (((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * product.total_terjual), 0))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <BarChart3 className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Terjual</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatNumber(reportData.overall.total_terjual)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <TrendingUp className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Produk</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatNumber(reportData.overall.total_produk)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Ringkasan per Produk</h2>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Download size={20} />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-indigo-100">
                    <tr>
                      <th className="px-4 py-3 text-left border border-indigo-200">Produk</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">HPP</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Rata Harga Konsinyasi</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Rata Harga Jual</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Keuntungan per Produk</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Total Titip</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Total Terjual</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Sisa</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Kembali</th>
                      <th className="px-4 py-3 text-right border border-indigo-200">Total Keuntungan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(reportData.summary).map((product: any, index: number) => (
                      <tr key={product.produk_id} className={`border-b border-indigo-200 ${index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100`}>
                        <td className="px-4 py-3 border border-indigo-200">
                          <div>
                            <p className="font-medium">{product.produk_nama}</p>
                            <p className="text-sm text-gray-600">{product.produk_kode}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200">
                          {formatCurrency(product.hpp)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200">
                          {formatCurrency(product.rata_harga_konsinyasi)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200">
                          {formatCurrency(product.rata_harga_jual_toko || 0)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200 text-green-600">
                          {formatCurrency((product.rata_harga_konsinyasi || 0) - (product.hpp || 0))}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200">
                          {formatNumber(product.total_titip)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200 text-green-600 font-medium">
                          {formatNumber(product.total_terjual)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200 text-blue-600">
                          {formatNumber(product.total_sisa)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200 text-orange-600">
                          {formatNumber(product.total_kembali)}
                        </td>
                        <td className="px-4 py-3 text-right border border-indigo-200 font-semibold text-green-600">
                          {formatCurrency(((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * product.total_terjual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-indigo-200 font-bold">
                    <tr>
                      <td className="px-4 py-3 border border-indigo-300 font-bold" colSpan={5}>
                        TOTAL KESELURUHAN
                      </td>
                      <td className="px-4 py-3 text-right border border-indigo-300">
                        {formatNumber(reportData.overall.total_titip)}
                      </td>
                      <td className="px-4 py-3 text-right border border-indigo-300">
                        {formatNumber(reportData.overall.total_terjual)}
                      </td>
                      <td className="px-4 py-3 text-right border border-indigo-300">
                        {formatNumber(reportData.overall.total_sisa)}
                      </td>
                      <td className="px-4 py-3 text-right border border-indigo-300">
                        {formatNumber(reportData.overall.total_kembali)}
                      </td>
                      <td className="px-4 py-3 text-right border border-indigo-300">
                        {formatCurrency(Object.values(reportData.summary).reduce((total: number, product: any) =>
                          total + (((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * product.total_terjual), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {Object.values(reportData.summary).map((product: any) => (
                  <div key={product.produk_id} className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200 shadow-sm">
                    <div className="mb-3 pb-3 border-b border-indigo-200">
                      <h3 className="font-bold text-gray-800">{product.produk_nama}</h3>
                      <p className="text-sm text-gray-600">{product.produk_kode}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">HPP</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(product.hpp)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Harga Konsinyasi</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(product.rata_harga_konsinyasi)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Harga Jual</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(product.rata_harga_jual_toko || 0)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Keuntungan/Item</p>
                        <p className="font-semibold text-green-600">{formatCurrency((product.rata_harga_konsinyasi || 0) - (product.hpp || 0))}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Total Titip</p>
                        <p className="font-semibold text-gray-800">{formatNumber(product.total_titip)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Total Terjual</p>
                        <p className="font-semibold text-green-600">{formatNumber(product.total_terjual)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Sisa</p>
                        <p className="font-semibold text-blue-600">{formatNumber(product.total_sisa)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Kembali</p>
                        <p className="font-semibold text-orange-600">{formatNumber(product.total_kembali)}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-indigo-200">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">Total Keuntungan</span>
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * product.total_terjual)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Mobile Summary Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg p-4 text-white shadow-lg">
                  <h3 className="font-bold text-lg mb-3">TOTAL KESELURUHAN</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-indigo-100 mb-1">Total Titip</p>
                      <p className="font-bold">{formatNumber(reportData.overall.total_titip)}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 mb-1">Total Terjual</p>
                      <p className="font-bold">{formatNumber(reportData.overall.total_terjual)}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 mb-1">Sisa</p>
                      <p className="font-bold">{formatNumber(reportData.overall.total_sisa)}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 mb-1">Kembali</p>
                      <p className="font-bold">{formatNumber(reportData.overall.total_kembali)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-indigo-400">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total Keuntungan</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(Object.values(reportData.summary).reduce((total: number, product: any) =>
                          total + (((product.rata_harga_konsinyasi || 0) - (product.hpp || 0)) * product.total_terjual), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {reportData && reportData.detail.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-yellow-100 p-4 rounded-full">
                <AlertCircle className="text-yellow-600" size={48} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Tidak ada transaksi konsinyasi
                </h3>
                <p className="text-gray-600">
                  {reportData.message || 'Tidak ada data konsinyasi pada periode yang dipilih'}
                </p>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Filter yang diterapkan:</p>
                  <ul className="mt-2 space-y-1">
                    {filters.status !== 'Semua' && <li>Status: {filters.status}</li>}
                    {filters.start_date && <li>Dari: {filters.start_date}</li>}
                    {filters.end_date && <li>Sampai: {filters.end_date}</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {!reportData && !loading && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-gray-100 p-4 rounded-full">
                <FileText className="text-gray-400" size={48} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Belum ada data laporan</h3>
                <p className="text-gray-600">
                  Pilih cabang dan klik "Tampilkan" untuk melihat laporan konsinyasi
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
