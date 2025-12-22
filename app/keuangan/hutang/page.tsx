'use client';

import { useState, useEffect } from 'react';
import { Receipt, Search, AlertTriangle, CheckCircle, DollarSign, Eye, X, Plus, Check } from 'lucide-react';

interface HutangPembelian {
  id: number;
  total_hutang: number;
  dibayar: number;
  sisa: number;
  status: string;
  jatuh_tempo: string;
  suplier?: { nama: string };
  transaksi_pembelian?: {
    id: number;
    cabang?: {
      nama_cabang: string;
    };
  };
}

interface HutangDetail extends HutangPembelian {
  pembayaran: Array<{
    id: number;
    tanggal: string;
    jumlah: number;
    keterangan: string;
    kas: string;
  }>;
}

export default function HutangPembelianPage() {
  const [hutangList, setHutangList] = useState<HutangPembelian[]>([]);
  const [filteredData, setFilteredData] = useState<HutangPembelian[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPembayaranModal, setShowPembayaranModal] = useState(false);
  const [selectedHutang, setSelectedHutang] = useState<HutangDetail | null>(null);
  const [kasList, setKasList] = useState<Array<{ id: number; nama_kas: string; saldo: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingJatuhTempo, setEditingJatuhTempo] = useState(false);
  const [newJatuhTempo, setNewJatuhTempo] = useState('');

  // Form pembayaran
  const [formPembayaran, setFormPembayaran] = useState({
    jumlahBayar: '',
    tanggalBayar: new Date().toISOString().split('T')[0],
    keterangan: '',
    kasId: ''
  });

  useEffect(() => {
    fetchHutang();
    fetchKasList();
  }, [page, searchTerm]);

  const fetchHutang = async () => {
    try {
      setLoading(true);
      // Updated API endpoint path
      const res = await fetch(`/api/keuangan/hutang?page=${page}&limit=10&search=${searchTerm}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Fetch failed:', res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const json = await res.json();
      setHutangList(json.data || []);
      setFilteredData(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error fetching hutang:', errorMessage);
      alert(`Failed to load data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Format number to Rupiah
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Stats calculations
  const totalDebt = hutangList.reduce((sum, h) => sum + h.total_hutang, 0);
  const totalPaid = hutangList.reduce((sum, h) => sum + h.dibayar, 0);
  const totalRemaining = hutangList.reduce((sum, h) => sum + h.sisa, 0);
  const overdueCount = hutangList.filter(h => new Date(h.jatuh_tempo) < new Date() && h.status !== 'lunas').length;

  const handleShowDetail = (hutang: HutangPembelian) => {
    fetchDetailHutang(hutang.id);
  };

  const fetchDetailHutang = async (hutangId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/keuangan/hutang/${hutangId}`);

      if (!response.ok) {
        let errorMessage = 'Gagal memuat detail hutang';
        if (response.status === 404) {
          errorMessage = 'Data hutang tidak ditemukan.';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSelectedHutang(data);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error fetching detail hutang:', error);
      alert(error.message || 'Terjadi kesalahan saat memuat detail hutang.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleShowPembayaran = () => {
    setShowDetailModal(false);
    setShowPembayaranModal(true);
  };

  const handleInputPembayaran = async () => {
    if (!selectedHutang) {
      setError('Data hutang tidak ditemukan. Silakan refresh halaman.');
      return;
    }

    const jumlahBayar = parseFloat(formPembayaran.jumlahBayar);

    if (isNaN(jumlahBayar) || jumlahBayar <= 0) {
      setError('Jumlah pembayaran tidak valid. Masukkan angka positif.');
      return;
    }

    if (jumlahBayar > selectedHutang.sisa) {
      setError('Jumlah pembayaran melebihi sisa hutang. Maksimal pembayaran adalah ' + formatRupiah(selectedHutang.sisa));
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
      const response = await fetch(`/api/transaksi/pembelian/${selectedHutang.transaksi_pembelian?.id}/cicilan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tanggal_cicilan: formPembayaran.tanggalBayar,
          jumlah_cicilan: jumlahBayar,
          rekening: formPembayaran.kasId,
          jenis_pembayaran: "cicilan",
          tipe_cicilan: 'cicilan',
          keterangan: formPembayaran.keterangan || `Pembayaran hutang - ${selectedHutang.suplier?.nama}`,
        })
      });

      if (!response.ok) {
        let errorMessage = 'Gagal mencatat pembayaran hutang';

        if (response.status === 400) {
          errorMessage = 'Data pembayaran tidak valid. Periksa kembali informasi yang dimasukkan.';
        } else if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk mencatat pembayaran hutang.';
        } else if (response.status === 404) {
          errorMessage = 'Data hutang tidak ditemukan. Mungkin sudah dihapus.';
        } else if (response.status === 409) {
          errorMessage = 'Pembayaran tidak dapat diproses karena konflik data.';
        } else {
          try {
            const errorJson = await response.json();
            if (errorJson?.error) {
              errorMessage += ': ' + errorJson.error;
            } else if (typeof errorJson === 'string') {
              errorMessage += ': ' + errorJson;
            } else {
              errorMessage += ': Unknown error format';
            }
          } catch (jsonError) {
            console.error('JSON parse error:', jsonError);
            // If response.json() fails, try to get the response as text
            try {
              const errorText = await response.text();
              console.error('Raw response text:', errorText);
              if (errorText && errorText.trim()) {
                errorMessage += ': ' + errorText.trim();
              } else {
                errorMessage += ': Server returned empty response';
              }
            } catch (textError) {
              console.error('Text parse error:', textError);
              errorMessage += ': Unable to parse error response';
            }
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success !== false) {
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
        await fetchHutang();

        // Navigate to Detail Pembelian page to show updated cicilan data
        const timestamp = Date.now(); // Add timestamp to force page refresh
        const detailPembelianUrl = `/transaksi/pembelian/${selectedHutang.transaksi_pembelian?.id}?refresh=${timestamp}`;
        window.location.href = detailPembelianUrl;

        // Reset form
        setFormPembayaran({
          jumlahBayar: '',
          tanggalBayar: new Date().toISOString().split('T')[0],
          keterangan: '',
          kasId: kasList.length > 0 ? kasList[0].id.toString() : ''
        });
      } else {
        setError(result.error || 'Gagal mencatat pembayaran hutang');
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

  const handleEditJatuhTempo = () => {
    setEditingJatuhTempo(true);
    setNewJatuhTempo(selectedHutang?.jatuh_tempo ? new Date(selectedHutang.jatuh_tempo).toISOString().split('T')[0] : '');
  };

  const handleSaveJatuhTempo = async () => {
    if (!selectedHutang || !newJatuhTempo) {
      setError('Tanggal jatuh tempo tidak valid.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/keuangan/hutang/${selectedHutang.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jatuh_tempo: newJatuhTempo
        })
      });

      if (!response.ok) {
        let errorMessage = 'Gagal mengupdate jatuh tempo';

        if (response.status === 400) {
          errorMessage = 'Data jatuh tempo tidak valid.';
        } else if (response.status === 401) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (response.status === 403) {
          errorMessage = 'Anda tidak memiliki akses untuk mengupdate jatuh tempo.';
        } else if (response.status === 404) {
          errorMessage = 'Data hutang tidak ditemukan.';
        } else {
          const errorJson = await response.json().catch(() => null);
          if (errorJson?.error) {
            errorMessage += ': ' + errorJson.error;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success !== false) {
        // Success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
        successDiv.innerHTML = `
          <span class="text-green-600">✅</span>
          <div>
            <p class="font-semibold">Jatuh Tempo Berhasil Diupdate!</p>
            <p class="text-sm">Tanggal jatuh tempo telah diperbarui.</p>
          </div>
          <button onclick="this.parentElement.remove()" class="text-green-700 hover:text-green-900 font-bold">×</button>
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

        // Update local state and exit edit mode
        if (selectedHutang) {
          selectedHutang.jatuh_tempo = newJatuhTempo;
        }
        setEditingJatuhTempo(false);
        setNewJatuhTempo('');

        // Refresh data
        await fetchHutang();
      } else {
        setError(result.error || 'Gagal mengupdate jatuh tempo');
      }

    } catch (error: any) {
      console.error('Error updating jatuh tempo:', error);
      const errorMessage = error.message?.includes('Gagal mengupdate') ?
        error.message : 'Terjadi kesalahan saat mengupdate jatuh tempo.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditJatuhTempo = () => {
    setEditingJatuhTempo(false);
    setNewJatuhTempo('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6 xl:p-8">
        {/* Header Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg sm:rounded-xl shadow-lg">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Hutang Pembelian</h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">Pantau hutang pembelian per cabang ke supplier</p>
            </div>
          </div>
        </div>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white rounded-lg sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">Total Hutang</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">{formatRupiah(totalDebt)}</p>
              </div>
              <div className="p-2 sm:p-3 bg-red-50 rounded-lg sm:rounded-xl ml-2 flex-shrink-0">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">Sudah Dibayar</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 mt-1 truncate">{formatRupiah(totalPaid)}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-50 rounded-lg sm:rounded-xl ml-2 flex-shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">Sisa Hutang</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 mt-1 truncate">{formatRupiah(totalRemaining)}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-50 rounded-lg sm:rounded-xl ml-2 flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-lg sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-red-100 text-xs sm:text-sm font-medium truncate">Jatuh Tempo</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{overdueCount}</p>
                <p className="text-red-100 text-xs mt-1 truncate">Belum lunas</p>
              </div>
              <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl backdrop-blur-sm ml-2 flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Cari supplier, cabang..."
                  className="w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mobile Cards View - Show on screens smaller than lg */}
          <div className="block lg:hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 font-medium text-sm sm:text-base">Memuat data...</p>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-6 sm:p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 sm:p-4 bg-gray-100 rounded-full w-fit mx-auto">
                    <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-base sm:text-lg">
                      {searchTerm ? 'Tidak ada hasil' : 'Belum ada hutang'}
                    </p>
                    <p className="text-gray-500 text-xs sm:text-sm mt-1">
                      {searchTerm
                        ? 'Coba gunakan kata kunci lain'
                        : 'Hutang pembelian akan muncul di sini'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredData.map((hutang) => (
                  <div key={hutang.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                          {hutang.suplier?.nama || '-'}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
                          {hutang.transaksi_pembelian?.cabang?.nama_cabang ?? '-'}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                          hutang.status === 'lunas' ? 'bg-green-100 text-green-700' :
                          hutang.status === 'belum_lunas' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {hutang.status === 'lunas' ? 'Lunas' :
                           hutang.status === 'belum_lunas' ? 'Belum Lunas' :
                           hutang.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm mb-3">
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="font-semibold text-gray-900 truncate">{formatRupiah(hutang.total_hutang)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Dibayar</p>
                        <p className="font-semibold text-green-600 truncate">{formatRupiah(hutang.dibayar)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Sisa</p>
                        <p className="font-semibold text-orange-600 truncate">{formatRupiah(hutang.sisa)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleShowDetail(hutang)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-xs sm:text-sm"
                      >
                        <Eye size={14} className="sm:w-4 sm:h-4" />
                        Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View - Hidden on screens smaller than lg */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cabang
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Hutang
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dibayar
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sisa
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Receipt className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-900 font-semibold text-lg">
                            {searchTerm ? 'Tidak ada hasil' : 'Belum ada hutang'}
                          </p>
                          <p className="text-gray-500 text-sm mt-1">
                            {searchTerm
                              ? 'Coba gunakan kata kunci lain'
                              : 'Hutang pembelian akan muncul di sini'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((hutang) => (
                    <tr
                      key={hutang.id}
                      className="hover:bg-blue-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{hutang.suplier?.nama || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
<p className="text-gray-600 text-sm">{hutang.transaksi_pembelian?.cabang?.nama_cabang ?? '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-semibold text-gray-900">{formatRupiah(hutang.total_hutang)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-green-600">{formatRupiah(hutang.dibayar)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-orange-600 font-semibold">{formatRupiah(hutang.sisa)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                          hutang.status === 'lunas' ? 'bg-green-100 text-green-700' :
                          hutang.status === 'belum_lunas' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {hutang.status === 'lunas' ? 'Lunas' :
                           hutang.status === 'belum_lunas' ? 'Belum Lunas' :
                           hutang.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleShowDetail(hutang)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
now 
          {/* Footer */}
          {filteredData.length > 0 && (
            <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-gray-600">
                Menampilkan <span className="font-semibold text-gray-900">{filteredData.length}</span> hutang
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedHutang && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">Detail Hutang Pembelian</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6">
                {/* Info Hutang */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Supplier</p>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedHutang.suplier?.nama || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Cabang</p>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedHutang.transaksi_pembelian?.cabang?.nama_cabang || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Status</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                      selectedHutang.status === 'lunas' ? 'bg-green-100 text-green-700' :
                      selectedHutang.status === 'belum_lunas' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedHutang.status === 'lunas' ? 'Lunas' :
                       selectedHutang.status === 'belum_lunas' ? 'Belum Lunas' :
                       selectedHutang.status}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm text-gray-600">Jatuh Tempo</p>
                      {!editingJatuhTempo && (
                        <button
                          onClick={handleEditJatuhTempo}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingJatuhTempo ? (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={newJatuhTempo}
                          onChange={(e) => setNewJatuhTempo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveJatuhTempo}
                            disabled={loading}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {loading ? 'Menyimpan...' : 'Simpan'}
                          </button>
                          <button
                            onClick={handleCancelEditJatuhTempo}
                            className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">
                        {selectedHutang.jatuh_tempo ? new Date(selectedHutang.jatuh_tempo).toLocaleDateString('id-ID') : '-'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ringkasan Hutang */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
                    <p className="text-xs sm:text-sm text-red-700 mb-1">Total Hutang</p>
                    <p className="text-lg sm:text-xl font-bold text-red-900">
                      {formatRupiah(selectedHutang.total_hutang)}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
                    <p className="text-xs sm:text-sm text-green-700 mb-1">Sudah Dibayar</p>
                    <p className="text-lg sm:text-xl font-bold text-green-900">
                      {formatRupiah(selectedHutang.dibayar)}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-3 sm:p-4 rounded-lg border border-orange-200">
                    <p className="text-xs sm:text-sm text-orange-700 mb-1">Sisa Hutang</p>
                    <p className="text-lg sm:text-xl font-bold text-orange-900">
                      {formatRupiah(selectedHutang.sisa)}
                    </p>
                  </div>
                </div>

                {/* Riwayat Pembayaran */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">Riwayat Pembayaran</h3>
                  {selectedHutang.pembayaran && selectedHutang.pembayaran.length > 0 ? (
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
                          {selectedHutang.pembayaran.map((bayar, idx) => (
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
                  {selectedHutang.status !== 'lunas' && selectedHutang.sisa > 0 ? (
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
                      ✓ Hutang Sudah Lunas
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

       {/* Modal Input Pembayaran */}
      {showPembayaranModal && selectedHutang && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-xl font-bold">Input Pembayaran Hutang</h2>
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
                <p className="text-sm text-gray-600">Supplier: {selectedHutang.suplier?.nama}</p>
                <p className="text-sm text-gray-600">Cabang: {selectedHutang.transaksi_pembelian?.cabang?.nama_cabang}</p>
                <p className="text-lg font-bold text-orange-600 mt-2">
                  Sisa Hutang: {formatRupiah(selectedHutang.sisa)}
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
                        {kas.nama_kas} - Saldo: {formatRupiah(kas.saldo)}
                      </option>
                    ))}
                  </select>
                  {formPembayaran.kasId && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      {(() => {
                        const selectedKas = kasList.find(k => k.id === parseInt(formPembayaran.kasId));
                        const jumlahBayar = parseFloat(formPembayaran.jumlahBayar) || 0;
                        const remainingBalance = selectedKas ? selectedKas.saldo - jumlahBayar : 0;
                        const isInsufficient = selectedKas && jumlahBayar > selectedKas.saldo;

                        return (
                          <div className="text-xs sm:text-sm">
                            <div className="flex justify-between mb-1">
                              <span className="text-gray-600">Saldo Saat Ini:</span>
                              <span className="font-semibold text-gray-900">
                                {selectedKas ? formatRupiah(selectedKas.saldo) : '0'}
                              </span>
                            </div>
                            <div className="flex justify-between mb-1">
                              <span className="text-gray-600">Jumlah Pembayaran:</span>
                              <span className="font-semibold text-red-600">
                                -{formatRupiah(jumlahBayar)}
                              </span>
                            </div>
                            <div className="border-t border-blue-300 pt-1 mt-2">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-700">Sisa Saldo:</span>
                                <span className={`font-bold ${isInsufficient ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatRupiah(remainingBalance)}
                                </span>
                              </div>
                              {isInsufficient && (
                                <p className="text-red-600 text-xs mt-1 font-medium">
                                  ⚠️ Saldo tidak mencukupi untuk pembayaran ini
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
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

        {/* Error Display */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3 max-w-md">
            <span className="text-red-500">⚠️</span>
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}
      </div>
  );
}
