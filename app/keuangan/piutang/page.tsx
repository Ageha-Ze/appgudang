'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Search, Download, X, Plus, Calendar } from 'lucide-react';

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

  }, []);

  const fetchPiutangData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        cabang_id: selectedCabang,
        status: selectedStatus,
        search: searchQuery
      });
      const response = await fetch(`/api/keuangan/piutang?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPiutangData(data);
      } else {
        console.error('Failed to fetch piutang data');
      }
    } catch (error) {
      console.error('Error fetching piutang data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCabangList = async () => {
  try {
    const response = await fetch('/api/master/cabang');
    if (response.ok) {
      const data = await response.json();
      // Ensure data is an array (adjust if API returns { data: [...] })
      setCabangList(Array.isArray(data) ? data : []);
    } else {
      console.error('Failed to fetch cabang list:', response.status);
      setCabangList([]);  // Default to empty array
    }
  } catch (error) {
    console.error('Error fetching cabang list:', error);
    setCabangList([]);  // Default to empty array
  }
};


  const fetchDetailPiutang = async (piutangId: number) => {
    try {
    const response = await fetch(`/api/keuangan/piutang/${piutangId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPiutang(data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching detail piutang:', error);
    }
  };

  const handleInputPembayaran = async () => {
    if (!selectedPiutang) return;

    const jumlahBayar = parseFloat(formPembayaran.jumlahBayar);
    
    if (isNaN(jumlahBayar) || jumlahBayar <= 0) {
      alert('Jumlah pembayaran tidak valid');
      return;
    }

    if (jumlahBayar > selectedPiutang.sisaPiutang) {
      alert('Jumlah pembayaran melebihi sisa piutang');
      return;
    }

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

      if (response.ok) {
        alert('Pembayaran berhasil dicatat');
        setShowPembayaranModal(false);
        setShowDetailModal(false);
        fetchPiutangData();
        
        // Reset form
        setFormPembayaran({
          jumlahBayar: '',
          tanggalBayar: new Date().toISOString().split('T')[0],
          keterangan: '',
          kasId: 'CASH TAGIHAN'
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Gagal mencatat pembayaran');
      }
    } catch (error) {
      console.error('Error input pembayaran:', error);
      alert('Terjadi kesalahan saat mencatat pembayaran');
    }
  };

  // Filter data (client-side for simplicity; can move to API if needed)
  const filteredData = piutangData.filter(item => {
    const matchSearch =
      (item.nota?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.customer?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.sales?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchCabang = selectedCabang === 'all' || item.cabang === selectedCabang;
    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;

    return matchSearch && matchCabang && matchStatus;
  });

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
        <option key={cabang.id} value={cabang.nama_cabang}>
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


      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                        : 'bg-orange-100 text-orange-800'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Detail Piutang Penjualan</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Info Penjualan */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">No. Nota</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.nota}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tanggal</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.tanggal}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cabang</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.cabang}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">No. Telp</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.customerTelp || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Jatuh Tempo</p>
                  <p className="font-semibold text-gray-900">{selectedPiutang.jatuhTempo}</p>
                </div>
              </div>

              {/* Ringkasan Piutang */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 mb-1">Total Piutang</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatRupiah(selectedPiutang.totalPiutang)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 mb-1">Sudah Dibayar</p>
                  <p className="text-xl font-bold text-green-900">
                    {formatRupiah(selectedPiutang.terbayar)}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-700 mb-1">Sisa Piutang</p>
                  <p className="text-xl font-bold text-orange-900">
                    {formatRupiah(selectedPiutang.sisaPiutang)}
                  </p>
                </div>
              </div>

              {/* Riwayat Pembayaran */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Riwayat Pembayaran</h3>
                {selectedPiutang.pembayaran && selectedPiutang.pembayaran.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tanggal</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Jumlah</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPiutang.pembayaran.map((bayar, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{bayar.tanggal}</td>
                            <td className="px-4 py-3 text-sm text-green-600 text-right font-semibold">
                              {formatRupiah(bayar.jumlah)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{bayar.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Belum ada pembayaran</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
                <button 
                  onClick={handleShowPembayaran}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Input Pembayaran
                </button>
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
