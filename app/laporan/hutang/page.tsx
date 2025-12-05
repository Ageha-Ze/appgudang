'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, TrendingUp, AlertCircle } from 'lucide-react';

interface HutangPembelian {
  id: number;
  pembelian_id: number;
  suplier_nama: string;
  total_hutang: number;
  dibayar: number;
  sisa: number;
  status: string;
  jatuh_tempo: string;
  created_at: string;
}

interface Summary {
  total_hutang: number;
  total_dibayar: number;
  total_sisa: number;
  jumlah_belum_lunas: number;
  jumlah_jatuh_tempo: number;
}

export default function LaporanHutangBeli() {
  const [data, setData] = useState<HutangPembelian[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: 'semua',
    startDate: '',
    endDate: '',
    search: ''
  });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status !== 'semua') params.append('status', filter.status);
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);
      if (filter.search) params.append('search', filter.search);

      const response = await fetch(`/api/laporan/hutang?${params}`);
      const result = await response.json();
      
      setData(result.data || []);
      setSummary(result.summary || null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['No', 'Tanggal', 'Supplier', 'Total Hutang', 'Dibayar', 'Sisa', 'Status', 'Jatuh Tempo'];
    const rows = data.map((item, index) => [
      index + 1,
      new Date(item.created_at).toLocaleDateString('id-ID'),
      item.suplier_nama,
      item.total_hutang,
      item.dibayar,
      item.sisa,
      item.status,
      item.jatuh_tempo ? new Date(item.jatuh_tempo).toLocaleDateString('id-ID') : '-'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-hutang-pembelian-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lunas':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Belum Lunas':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Jatuh Tempo':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Lunas':
        return 'Lunas';
      case 'Belum Lunas':
        return 'Belum Lunas';
      case 'Jatuh Tempo':
        return 'Jatuh Tempo';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Laporan Hutang Pembelian</h1>
          <p className="text-gray-600">Monitor dan kelola hutang pembelian kepada supplier</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Total Hutang</div>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatCurrency(summary.total_hutang)}</div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Total Dibayar</div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatCurrency(summary.total_dibayar)}</div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Sisa Hutang</div>
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatCurrency(summary.total_sisa)}</div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Jatuh Tempo</div>
                <Calendar className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{summary.jumlah_jatuh_tempo}</div>
              <div className="text-xs text-gray-500 mt-1">Transaksi</div>
            </div>
          </div>
        )}

        {/* Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari supplier..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all"
              >
                <option value="semua">Semua Status</option>
                <option value="Belum Lunas">Belum Lunas</option>
                <option value="Lunas">Lunas</option>
                <option value="Jatuh Tempo">Jatuh Tempo</option>
              </select>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            onClick={exportToCSV}
            className="mt-4 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">No</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Tanggal</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Supplier</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total Hutang</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Dibayar</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Sisa</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Jatuh Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Tidak ada data hutang pembelian
                    </td>
                  </tr>
                ) : (
                  data.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{item.suplier_nama}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-800">
                        {formatCurrency(item.total_hutang)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                        {formatCurrency(item.dibayar)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-orange-600 font-semibold">
                        {formatCurrency(item.sisa)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-600">
                        {item.jatuh_tempo ? new Date(item.jatuh_tempo).toLocaleDateString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
