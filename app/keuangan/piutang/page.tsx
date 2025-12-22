'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Search, Download, X, Plus, Calendar, Check } from 'lucide-react';

interface PiutangItem {
  id: number;
  nota: string;
  tanggal: string;
  cabang: string;
  cabangId: number;
  customer: string;
  customerId: number;
  customerTelp?: string;
  customerAlamat?: string;
  sales: string;
  totalPiutang: number;
  terbayar: number;
  sisaPiutang: number;
  persenPembayaran: number;
  status: string;
  jatuhTempo: string;
  keterangan?: string;
}

interface PiutangDetail extends PiutangItem {
  pembayaran: Array<{
    id: number;
    tanggal: string;
    jumlah: number;
    keterangan: string;
    kas: string;
  }>;
}

interface Cabang {
  id: number;
  nama_cabang: string;
  kode_cabang: string;
}

export default function PiutangPenjualanPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCabang, setSelectedCabang] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPembayaranModal, setShowPembayaranModal] = useState(false);
  const [selectedPiutang, setSelectedPiutang] = useState<PiutangDetail | null>(null);
  const [piutangData, setPiutangData] = useState<PiutangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kasList, setKasList] = useState<Array<{ id: number; nama_kas: string }>>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [error, setError] = useState<string | null>(null);

  // Form pembayaran
  const [formPembayaran, setFormPembayaran] = useState({
    jumlahBayar: '',
    tanggalBayar: new Date().toISOString().split('T')[0],
    keterangan: '',
    kasId: ''
  });

  const fetchKasList = async () => {
  try {
    console.log('🔍 Fetching kas list...');
    const response = await fetch('/api/master/kas');
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('📦 Raw result:', result);
      
      const kasData = result.data || result;
      console.log('📋 Kas Data:', kasData);
      console.log('📋 Is Array?', Array.isArray(kasData));
      
      // Ensure kasData is an array
      const kasArray = Array.isArray(kasData) ? kasData : [];
      console.log('📋 Kas Array:', kasArray);
      
      setKasList(kasArray);
      
      // Set default kas_id jika ada
      if (kasArray.length > 0) {
        console.log('✅ Setting default kas:', kasArray[0]);
        setFormPembayaran(prev => ({ 
          ...prev, 
          kasId: kasArray[0].id.toString() 
        }));
      } else {
        console.warn('⚠️ Kas list kosong!');
      }
    } else {
      console.error('❌ Response not OK:', response.status);
      setKasList([]); // Ensure it's an array even on error
    }
  } catch (error) {
    console.error('❌ Error fetching kas list:', error);
    setKasList([]); // Ensure it's an array even on error
  }
};

  useEffect(() => {
    fetchPiutangData();
    fetchCabangList();
    fetchKasList();
  }, [selectedCabang, selectedStatus, searchQuery]);

  const fetchPiutangData = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error sebelum fetch

      const params = new URLSearchParams({
        cabang_id: selectedCabang,
        status: selectedStatus,
        search: searchQuery
      });

      const response = await fetch(`/api/keuangan/piutang?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // API returns array directly, not wrapped in success object
      if (Array.isArray(data)) {
        setPiutangData(data);
      } else if (data.success === false) {
        throw new Error(data.error || 'Gagal memuat data piutang');
      } else {
        // Handle case where it returns object with data field
        setPiutangData(data.data || data || []);
      }
    } catch (error: any) {
      console.error('Error fetching piutang data:', error);
      let errorMessage = 'Terjadi kesalahan saat memuat data piutang. Silakan coba lagi.';

      if (error.message?.includes('HTTP 401')) {
        errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
      } else if (error.message?.includes('HTTP 403')) {
        errorMessage = 'Anda tidak memiliki akses untuk melihat data piutang.';
      } else if (error.message?.includes('HTTP 500')) {
        errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('NetworkError')) {
        errorMessage = 'Koneksi internet bermasalah. Periksa koneksi Anda.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setPiutangData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCabangList = async () => {
  try {
    console.log('🔍 Fetching cabang list...');
    const response = await fetch('/api/master/cabang');
    console.log('📡 Cabang API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('📦 Cabang raw data:', data);

      // Check if data is wrapped in a data property (common API pattern)
      const cabangData = data.data || data;
      console.log('📋 Processed cabang data:', cabangData);
      console.log('📋 Is Array?', Array.isArray(cabangData));
      console.log('📋 Array length:', Array.isArray(cabangData) ? cabangData.length : 'N/A');

      if (Array.isArray(cabangData) && cabangData.length > 0) {
        console.log('✅ Sample cabang item:', cabangData[0]);
      }

      // Ensure cabangData is an array
      const finalData = Array.isArray(cabangData) ? cabangData : [];
      console.log('🔄 Final cabang data to set:', finalData);
      setCabangList(finalData);
    } else {
      console.error('❌ Response not OK:', response.status);
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      setCabangList([]);
    }
  } catch (error) {
    console.error('💥 Error fetching cabang list:', error);
    console.error('💥 Error details:', error);
    setCabangList([]);
  }
};


  const fetchDetailPiutang = async (piutangId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/keuangan/piutang/${piutangId}`);

      if (!response.ok) {
        let errorMessage = 'Gagal memuat detail piutang';

        if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk melihat detail piutang.';
        } else if (response.status === 404) {
          errorMessage = 'Data piutang tidak ditemukan.';
        } else {
          const errorJson = await response.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage += ': ' + errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Gagal memuat detail piutang');
      }

      setSelectedPiutang(data);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error fetching detail piutang:', error);
      const errorMessage = error.message?.includes('Gagal memuat') ?
        error.message : 'Terjadi kesalahan saat memuat detail piutang. Silakan coba lagi.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputPembayaran = async () => {
    if (!selectedPiutang) {
      setError('Data piutang tidak ditemukan. Silakan refresh halaman.');
      return;
    }

    const jumlahBayar = parseFloat(formPembayaran.jumlahBayar);

    if (isNaN(jumlahBayar) || jumlahBayar <= 0) {
      setError('Jumlah pembayaran tidak valid. Masukkan angka positif.');
      return;
    }

    if (jumlahBayar > selectedPiutang.sisaPiutang) {
      setError('Jumlah pembayaran melebihi sisa piutang. Maksimal pembayaran adalah ' + formatRupiah(selectedPiutang.sisaPiutang));
      return;
    }

    if (!formPembayaran.tanggalBayar) {
      setError('Tanggal pembayaran wajib diisi.');
      return;
    }

    if (!formPembayaran.kasId) {
      setError('Akun kas wajib dipilih.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/keuangan/piutang/${selectedPiutang.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jumlahBayar,
          tanggalBayar: formPembayaran.tanggalBayar,
          keterangan: formPembayaran.keterangan,
          kasId: formPembayaran.kasId
        })
      });

      if (!response.ok) {
        let errorMessage = 'Gagal mencatat pembayaran piutang';

        if (response.status === 400) {
          errorMessage = 'Data pembayaran tidak valid. Periksa kembali informasi yang dimasukkan.';
        } else if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk mencatat pembayaran piutang.';
        } else if (response.status === 404) {
          errorMessage = 'Data piutang tidak ditemukan. Mungkin sudah dihapus.';
        } else if (response.status === 409) {
          errorMessage = 'Pembayaran tidak dapat diproses karena konflik data.';
        } else {
          const errorJson = await response.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage += ': ' + errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        // Success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
        successDiv.innerHTML = `
          <span class="text-green-600">✅</span>
          <div>
            <p class="font-semibold">Pembayaran Berhasil Dicatat!</p>
            <p class="text-sm">Pembayaran sebesar ${formatRupiah(jumlahBayar)} telah tercatat dalam sistem.</p>
          </div>
          <button onclick="this.parentElement.remove()" class="text-green-700 hover:text-green-900 font-bold">×</button>
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

        // Close modals and refresh data
        setShowPembayaranModal(false);
        setShowDetailModal(false);
        await fetchPiutangData();

        // Reset form
        setFormPembayaran({
          jumlahBayar: '',
          tanggalBayar: new Date().toISOString().split('T')[0],
          keterangan: '',
          kasId: kasList.length > 0 ? kasList[0].id.toString() : ''
        });
      } else {
        setError(result.error || 'Gagal mencatat pembayaran piutang');
      }

    } catch (error: any) {
      console.error('Error input pembayaran:', error);
      const errorMessage = error.message?.includes('Gagal mencatat') || error.message?.includes('Gagal memuat') ?
        error.message : 'Terjadi kesalahan saat mencatat pembayaran. Silakan periksa koneksi internet Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Server-side filtering is handled by API, only filter status client-side if needed
  const filteredData = selectedStatus === 'all'
    ? piutangData
    : piutangData.filter(item => item.status === selectedStatus);

  // Hitung total
  const totalPiutang = filteredData.reduce((sum, item) => sum + item.totalPiutang, 0);
  const totalTerbayar = filteredData.reduce((sum, item) => sum + item.terbayar, 0);
  const totalSisa = filteredData.reduce((sum, item) => sum + item.sisaPiutang, 0);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleShowDetail = (piutang: PiutangItem) => {
    fetchDetailPiutang(piutang.id);
  };

  const handleShowPembayaran = () => {
    setShowDetailModal(false);
    setShowPembayaranModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data piutang...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Piutang Penjualan</h1>
        <p className="text-gray-600">Monitor dan kelola piutang penjualan dari semua cabang</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Total Piutang</p>
          <p className="text-2xl font-bold text-blue-600">{formatRupiah(totalPiutang)}</p>
          <p className="text-xs text-gray-500 mt-1">{filteredData.length} transaksi</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Sudah Terbayar</p>
          <p className="text-2xl font-bold text-green-600">{formatRupiah(totalTerbayar)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {totalPiutang > 0 ? Math.round((totalTerbayar / totalPiutang) * 100) : 0}% dari total
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Sisa Piutang</p>
          <p className="text-2xl font-bold text-orange-600">{formatRupiah(totalSisa)}</p>
          <p className="text-xs text-gray-500 mt-1">Perlu ditagih</p>
        </div>
      </div>

   
    {/* Filters */}
<div className="bg-white rounded-lg shadow p-4 mb-6">
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        type="text"
        placeholder="Cari nota, customer, sales..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    
    <select
      value={selectedCabang}
      onChange={(e) => setSelectedCabang(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">Semua Cabang</option>
      {cabangList.map(cabang => (
        <option key={cabang.id} value={cabang.id}>
          {cabang.nama_cabang}
        </option>
      ))}
    </select>

    <select
      value={selectedStatus}
      onChange={(e) => setSelectedStatus(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">Semua Status</option>
      <option value="Belum Lunas">Belum Lunas</option>
      <option value="Cicil">Cicil</option>
      <option value="Lunas">Lunas</option> {/* ✅ Tambahkan ini */}
    </select>

    <button 
      onClick={() => alert('Export Excel belum diimplementasi')}  // Placeholder; implement actual export logic
      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
    >
      <Download className="w-4 h-4" />
      Export Excel
    </button>
  </div>
</div>


      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Memuat data piutang...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500">Tidak ada data piutang penjualan</p>
          </div>
        ) : (
          filteredData.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-semibold text-blue-700 truncate">{item.nota}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {item.customer} • {item.tanggal}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    item.status === 'Belum Lunas'
                      ? 'bg-red-100 text-red-800'
                      : item.status === 'Cicil'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cabang:</span>
                  <span className="font-medium">{item.cabang}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Piutang:</span>
                  <span className="font-semibold text-blue-700">
                    {formatRupiah(item.totalPiutang)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Terbayar:</span>
                  <span className="font-semibold text-green-600">
                    {formatRupiah(item.terbayar)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sisa:</span>
                  <span className="font-semibold text-orange-600">
                    {formatRupiah(item.sisaPiutang)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${item.persenPembayaran}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">{item.persenPembayaran}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => handleShowDetail(item)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm"
                >
                  <Eye size={16} />
                  Detail
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">No. Nota</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cabang</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Customer</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Piutang</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Terbayar</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sisa</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Progress</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.nota}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.tanggal}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.cabang}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">
                    {formatRupiah(item.totalPiutang)}
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600 text-right font-semibold">
                    {formatRupiah(item.terbayar)}
                  </td>
                  <td className="px-6 py-4 text-sm text-orange-600 text-right font-semibold">
                    {formatRupiah(item.sisaPiutang)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${item.persenPembayaran}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">{item.persenPembayaran}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'Belum Lunas'
                        ? 'bg-red-100 text-red-800'
                        : item.status === 'Cicil'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleShowDetail(item)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Tidak ada data piutang penjualan
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPiutang && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Detail Piutang Penjualan</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Info Penjualan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">No. Nota</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.nota}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Tanggal</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.tanggal}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Cabang</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.cabang}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Customer</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.customer}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">No. Telp</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.customerTelp || '-'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Jatuh Tempo</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedPiutang.jatuhTempo}</p>
                </div>
              </div>

              {/* Ringkasan Piutang */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                  <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Piutang</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-900">
                    {formatRupiah(selectedPiutang.totalPiutang)}
                  </p>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
                  <p className="text-xs sm:text-sm text-green-700 mb-1">Sudah Dibayar</p>
                  <p className="text-lg sm:text-xl font-bold text-green-900">
                    {formatRupiah(selectedPiutang.terbayar)}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 sm:p-4 rounded-lg border border-orange-200">
                  <p className="text-xs sm:text-sm text-orange-700 mb-1">Sisa Piutang</p>
                  <p className="text-lg sm:text-xl font-bold text-orange-900">
                    {formatRupiah(selectedPiutang.sisaPiutang)}
                  </p>
                </div>
              </div>

              {/* Riwayat Pembayaran */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">Riwayat Pembayaran</h3>
                {selectedPiutang.pembayaran && selectedPiutang.pembayaran.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Tanggal</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Jumlah</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPiutang.pembayaran.map((bayar, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">{bayar.tanggal}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-green-600 text-right font-semibold">
                              {formatRupiah(bayar.jumlah)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">{bayar.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm sm:text-base">Belum ada pembayaran</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm sm:text-base"
                >
                  Tutup
                </button>

                {/* ✅ CONDITIONALLY SHOW PAYMENT BUTTON BASED ON STATUS */}
                {selectedPiutang.status !== 'Lunas' && selectedPiutang.sisaPiutang > 0 ? (
                  <button
                    onClick={handleShowPembayaran}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm sm:text-base"
                  >
                    <Plus className="w-4 h-4" />
                    Input Pembayaran
                  </button>
                ) : (
                  <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-green-100 text-green-800 rounded-lg text-sm sm:text-base">
                    <Check className="w-4 h-4" />
                    ✓ Piutang Sudah Lunas
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

       {/* Modal Input Pembayaran */}
      {showPembayaranModal && selectedPiutang && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-xl font-bold">Input Pembayaran Piutang</h2>
              <button
                onClick={() => {
                  setShowPembayaranModal(false);
                  setShowDetailModal(true);
                }}
                className="p-1 hover:bg-green-700 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Nota: {selectedPiutang.nota}</p>
                <p className="text-sm text-gray-600">Customer: {selectedPiutang.customer}</p>
                <p className="text-lg font-bold text-orange-600 mt-2">
                  Sisa Piutang: {formatRupiah(selectedPiutang.sisaPiutang)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Bayar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formPembayaran.jumlahBayar}
                    onChange={(e) => setFormPembayaran({...formPembayaran, jumlahBayar: e.target.value})}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Bayar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formPembayaran.tanggalBayar}
                    onChange={(e) => setFormPembayaran({...formPembayaran, tanggalBayar: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Akun Kas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formPembayaran.kasId}
                    onChange={(e) => setFormPembayaran({...formPembayaran, kasId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Pilih Akun Kas</option>
                    {kasList.map(kas => (
                      <option key={kas.id} value={kas.id}>
                        {kas.nama_kas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keterangan
                  </label>
                  <textarea
                    value={formPembayaran.keterangan}
                    onChange={(e) => setFormPembayaran({...formPembayaran, keterangan: e.target.value})}
                    placeholder="Keterangan pembayaran (opsional)"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPembayaranModal(false);
                    setShowDetailModal(true);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleInputPembayaran}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
