'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { KasData, TransaksiKasData } from '@/types/kas';
import { ArrowLeft, Banknote, Building2, Calendar, TrendingUp, TrendingDown, Search, FileText, Clock, DollarSign, AlertTriangle, RotateCcw } from 'lucide-react';

// Extended type untuk transaksi dengan reversal info
interface TransaksiKasWithReversal extends TransaksiKasData {
  is_reversed?: boolean;
  reversal_info?: {
    reversed_at: string;
    reversed_by: string;
    reversal_reason: string;
    source_module: string; // 'penjualan', 'pembelian', 'pengeluaran', etc.
    source_transaction_id: number;
  };
}

export default function DetailKasPage() {
  const router = useRouter();
  const params = useParams();
  const kasId = parseInt(params.id as string);

  const [kas, setKas] = useState<KasData | null>(null);
  const [transaksi, setTransaksi] = useState<TransaksiKasWithReversal[]>([]);
  const [filteredData, setFilteredData] = useState<TransaksiKasWithReversal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReversedOnly, setShowReversedOnly] = useState(false);

  const itemsPerPage = 10;

 // ✅ GANTI DENGAN FETCH API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch kas data
        const kasResponse = await fetch('/api/master/kas');
        
        if (!kasResponse.ok) {
          throw new Error('Gagal memuat data kas');
        }

        const kasResult = await kasResponse.json();
        
        if (kasResult.success) {
          const selectedKas = kasResult.data.find((k: KasData) => k.id === kasId);
          if (selectedKas) {
            setKas(selectedKas);
          } else {
            setError('Data kas tidak ditemukan');
            setIsLoading(false);
            return;
          }
        } else {
          setError(kasResult.error || 'Gagal memuat data kas');
          setIsLoading(false);
          return;
        }

        // Fetch transaksi data
        const transaksiResponse = await fetch(`/api/master/kas/${kasId}/transaksi`);
        
        if (!transaksiResponse.ok) {
          throw new Error('Gagal memuat data transaksi');
        }

        const transaksiResult = await transaksiResponse.json();
        
        if (transaksiResult.success) {
          // Sort by date descending (newest first), then by id descending
          const sortedData = (transaksiResult.data || []).sort((a: TransaksiKasWithReversal, b: TransaksiKasWithReversal) => {
            const dateCompare = new Date(b.tanggal_transaksi).getTime() - new Date(a.tanggal_transaksi).getTime();
            if (dateCompare !== 0) return dateCompare;
            return b.id - a.id;
          });
          setTransaksi(sortedData);
          setFilteredData(sortedData);
        } else {
          setError(transaksiResult.error || 'Gagal memuat data transaksi');
        }
      } catch (error: any) {
        console.error('Error loading data:', error);
        setError(error.message || 'Terjadi kesalahan saat memuat data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (kasId) {
      fetchData();
    }
  }, [kasId]);
  
  // Search and filter function
  useEffect(() => {
    let filtered = transaksi;

    // Filter by reversed status
    if (showReversedOnly) {
      filtered = filtered.filter(t => t.is_reversed);
    }

    // Filter by search term
    if (searchTerm !== '') {
      filtered = filtered.filter((t) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          t.id.toString().includes(searchLower) ||
          t.tanggal_transaksi.includes(searchLower) ||
          t.kredit.toString().includes(searchLower) ||
          t.debit.toString().includes(searchLower) ||
          t.keterangan.toLowerCase().includes(searchLower) ||
          (t.reversal_info?.source_module.toLowerCase().includes(searchLower)) ||
          (t.reversal_info?.reversal_reason.toLowerCase().includes(searchLower))
        );
      });
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, transaksi, showReversedOnly]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { 
      day: 'numeric',
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getModuleBadgeColor = (module: string) => {
    const colors: Record<string, string> = {
      penjualan: 'bg-blue-100 text-blue-700',
      pembelian: 'bg-purple-100 text-purple-700',
      pengeluaran: 'bg-orange-100 text-orange-700',
      pemasukan: 'bg-green-100 text-green-700',
      transfer: 'bg-cyan-100 text-cyan-700',
      lainnya: 'bg-gray-100 text-gray-700',
    };
    return colors[module.toLowerCase()] || colors.lainnya;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error && !kas) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }
  
  if (!kas) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Data kas tidak ditemukan</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalKredit = transaksi.reduce((sum, t) => sum + t.kredit, 0);
  const totalDebit = transaksi.reduce((sum, t) => sum + t.debit, 0);
  const totalTransaksi = transaksi.length;
  const totalReversed = transaksi.filter(t => t.is_reversed).length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors group"
      >
        <div className="p-2 rounded-lg group-hover:bg-white transition-colors">
          <ArrowLeft size={20} />
        </div>
        <span className="font-medium">Kembali</span>
      </button>

      {/* Error Alert for Transaksi */}
      {error && kas && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats Cards - Mini Version */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Transaksi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalTransaksi}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Kredit</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatRupiah(totalKredit)}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-lg p-4 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs font-medium">Total Debit</p>
              <p className="text-xl font-bold mt-1">{formatRupiah(totalDebit)}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg p-4 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-xs font-medium">Transaksi Reversed</p>
              <p className="text-2xl font-bold mt-1">{totalReversed}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">Informasi Rekening</h3>
              <p className="text-blue-100 mt-1">Detail informasi kas dan rekening bank</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Nama Bank */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-blue-600" />
                <label className="text-gray-600 text-xs font-medium">Nama Bank</label>
              </div>
              <p className="text-gray-900 font-semibold text-lg">{kas.nama_kas}</p>
            </div>

            {/* No Rekening */}
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <label className="text-gray-600 text-xs font-medium">No Rekening</label>
              </div>
              <p className="text-gray-900 font-semibold text-lg font-mono">{kas.no_rekening}</p>
            </div>

            {/* Saldo */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <label className="text-gray-600 text-xs font-medium">Saldo</label>
              </div>
              <p className="text-gray-900 font-bold text-xl">{formatRupiah(kas.saldo)}</p>
            </div>

            {/* Tipe Kas */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <label className="text-gray-600 text-xs font-medium">Tipe Kas</label>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                kas.tipe_kas.toLowerCase() === 'bank' ? 'bg-green-100 text-green-700' :
                kas.tipe_kas.toLowerCase() === 'tunai' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {kas.tipe_kas.toLowerCase() === 'bank' ? 'Bank' :
                 kas.tipe_kas.toLowerCase() === 'tunai' || kas.tipe_kas.toLowerCase() === 'tunai' ? 'Tunai' :
                 kas.tipe_kas}
              </span>
            </div>

            {/* Kantor */}
            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-cyan-600" />
                <label className="text-gray-600 text-xs font-medium">Kantor</label>
              </div>
              <p className="text-gray-900 font-semibold text-lg">{kas.cabang?.nama_cabang || '-'}</p>
            </div>

            {/* Total Transaksi */}
            <div className="bg-rose-50 rounded-lg p-4 border border-cyan-100">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-rose-600" />
                <label className="text-gray-600 text-xs font-medium">Total Transaksi</label>
              </div>
              <p className="text-gray-900 font-bold text-xl">{totalTransaksi}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">Riwayat Transaksi</h3>
              <p className="text-blue-100 mt-1">Detail transaksi masuk dan keluar</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Search and Filter */}
          <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} data
              </div>
              
              {/* Filter Reversed */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReversedOnly}
                  onChange={(e) => setShowReversedOnly(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700 font-medium">Hanya Reversed</span>
              </label>
            </div>

            <div className="relative w-full md:w-80">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transaksi..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">ID</th>
                  <th className="px-6 py-4 text-left font-semibold">Tanggal</th>
                  <th className="px-6 py-4 text-right font-semibold">Kredit</th>
                  <th className="px-6 py-4 text-right font-semibold">Debit</th>
                  <th className="px-6 py-4 text-left font-semibold">Keterangan</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length > 0 ? (
                  currentData.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-colors duration-200 ${
                        item.is_reversed ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-semibold text-sm ${
                          item.is_reversed ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item.id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900 font-medium">{formatDate(item.tanggal_transaksi)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.kredit > 0 ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">{formatRupiah(item.kredit)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.debit > 0 ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 rounded-full">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="font-semibold text-red-700">{formatRupiah(item.debit)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-gray-900">{item.keterangan}</p>
                          {item.is_reversed && item.reversal_info && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  getModuleBadgeColor(item.reversal_info.source_module)
                                }`}>
                                  {item.reversal_info.source_module}
                                </span>
                              </div>
                              <p className="text-xs text-orange-600 font-medium">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {item.reversal_info.reversal_reason}
                              </p>
                              <p className="text-xs text-gray-500">
                                Reversed: {formatDateTime(item.reversal_info.reversed_at)} oleh {item.reversal_info.reversed_by}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.is_reversed ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                            <RotateCcw className="w-3 h-3" />
                            Reversed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Aktif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || showReversedOnly ? 'Tidak ada data yang cocok dengan filter' : 'Belum ada transaksi'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>

              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    currentPage === page
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
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
